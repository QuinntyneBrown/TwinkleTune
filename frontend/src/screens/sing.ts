import { getSongById } from '../songs/repo'
import { duetSession } from '../api/duet'
import type { SongNote } from '../songs/types'
import { songBeats, songRange } from '../songs/types'
import { SongPlayer } from '../audio/player'
import { PitchTracker } from '../audio/pitch'
import { computeShift, describeShift } from '../audio/range'
import { foldCents, HIT_TOLERANCE_CENTS, noteLanded, summarize, type NoteResult } from '../state/scoring'
import { recordPlay, store, todayISO } from '../state/store'
import { mascotSVG } from '../ui/parts'
import { showModal, toast } from '../ui/modal'
import { createReactiveScene, normalizeMicEnergy, seedFromString } from '../rendering/reactive-scene'
import { SingingWakeLock } from '../ui/wake-lock'

const PX_PER_BEAT = 90
const MARKER_FRAC = 0.21
const STAGE_PAD_TOP = 40
const STAGE_PAD_BOTTOM = 56

const CHEERS = ['Perfect! ✨', 'Great! 🌟', 'Yes! 💙', 'Sparkly! ✨', 'Wow! 🎉']
const PHRASE_CHEERS = [
  'Big breath — here comes the next part!',
  "You're doing wonderfully! 💙",
  'Right on the notes — keep going!',
  'I love this part! 🎵',
  'Sing it out, superstar! ⭐',
]

const tunedDialogShown = new Set<string>()

interface TimedNote extends SongNote {
  phraseIdx: number
  noteIdx: number
  el?: HTMLElement
}

export function renderSing(root: HTMLElement, params: URLSearchParams): () => void {
  const songMaybe = getSongById(params.get('song') ?? '')
  if (!songMaybe) {
    location.hash = '#/songs'
    return () => {}
  }
  const song = songMaybe

  // duet mode: the lobby stashed the live SignalR session before navigating here
  const duet = params.get('duet') === '1' ? duetSession.get() : null
  if (params.get('duet') === '1' && !duet) {
    location.hash = '#/duet'
    return () => {}
  }

  const state = store.get()
  const profile = state.profile!
  const range = profile.range
  const shift = computeShift(song, range)
  const practicePhrase = params.has('practice') ? Number(params.get('practice')) : null
  const slow = params.get('slow') === '1' || practicePhrase !== null
  const rate = slow ? 0.7 : 1

  const phrase = practicePhrase !== null ? song.phrases[practicePhrase] : null
  const fromBeat = phrase ? phrase.notes[0].start : 0
  const untilBeat = phrase
    ? phrase.notes[phrase.notes.length - 1].start + phrase.notes[phrase.notes.length - 1].dur
    : songBeats(song)

  const notes: TimedNote[] = song.phrases.flatMap((p, pi) =>
    p.notes.map((n, ni) => ({ ...n, phraseIdx: pi, noteIdx: ni })),
  )
  const windowNotes = notes.filter((n) => n.start >= fromBeat && n.start < untilBeat)
  const { min, max } = songRange(song)
  const midiCenter = (min + max) / 2

  const player = new SongPlayer()
  const tracker = new PitchTracker()
  const wakeLock = new SingingWakeLock()
  let noMic = false
  let raf = 0
  let started = false
  let finished = false
  let pausedModal: { close: () => void } | null = null

  // per-note live accumulation
  const results: NoteResult[] = windowNotes.map((n) => ({
    phraseIdx: n.phraseIdx,
    noteIdx: n.noteIdx,
    midi: n.midi,
    hitFrames: 0,
    totalFrames: 0,
    firstHitFrac: null,
  }))
  let finalizedUpTo = 0
  let streak = 0
  let landedCount = 0
  let lastPhrase = -1
  let singerY = 150
  let wasOnNote = false

  const keyChip = range
    ? `<span class="key-chip" title="${describeShift(shift)}">🎯 Your key ✓</span>`
    : `<span class="key-chip standard">Standard key</span>`

  root.innerHTML = `
  <div class="sky" aria-hidden="true">
    <span class="tstar" style="top:12%;left:5%">✦</span>
    <span class="tstar" style="top:18%;right:7%;animation-delay:1s">✦</span>
    <span class="fnote" style="top:24%;left:7%;font-size:30px;opacity:.62;animation-delay:.2s">♪</span>
    <span class="fnote" style="top:34%;right:6%;font-size:26px;opacity:.58;animation-delay:1.1s">♫</span>
    <span class="fnote" style="top:48%;left:4%;font-size:24px;opacity:.55;animation-delay:2.2s">♩</span>
    <span class="fnote" style="top:57%;right:9%;font-size:32px;opacity:.6;animation-delay:.7s">♬</span>
    <span class="fnote" style="top:71%;left:9%;font-size:27px;opacity:.58;animation-delay:1.6s">♫</span>
    <span class="fnote" style="top:79%;right:5%;font-size:24px;opacity:.54;animation-delay:2.8s">♪</span>
  </div>
  <main class="screen screen--nonav">
    <header class="sing-top rise">
      <button class="icon-btn" data-pause aria-label="Pause">⏸</button>
      <div class="sing-title">
        <strong>${phrase ? `Practice: “${phrase.lyric}”` : song.title}</strong>
        <div class="track"><div class="fill" data-progress style="width:0%"></div></div>
      </div>
      ${keyChip}${slow ? '<span class="key-chip standard">🐢</span>' : ''}
    </header>

    <section class="stage rise d1" aria-label="Pitch game — match the notes" data-stage>
      <canvas class="reactive-scene" data-reactive-scene aria-hidden="true"></canvas>
      <span class="streak-chip" data-streak>🔥 0 in a row!</span>
      <span class="opponent-chip" data-opponent hidden></span>
      <div class="note-track" data-track></div>
      <div class="singer quiet" data-singer role="img" aria-label="You">${profile.avatar}</div>
      <span class="stage-label" data-stage-label></span>
      <div class="countdown" data-countdown>
        <button class="btn btn-xl" style="width:auto" data-start>${duet ? "I'm ready! 🎤🎤" : 'Tap to start ▶'}</button>
      </div>
    </section>

    <section class="card lyrics rise d2" aria-label="Lyrics">
      <p class="lyr-line lyr-prev" data-prev></p>
      <p class="lyr-line lyr-now" data-now>Ready?</p>
      <p class="lyr-line lyr-next" data-next></p>
    </section>

    <div class="live-row rise d3">
      ${mascotSVG('mascot mascot-sm', true).replace('class="mascot mascot-sm"', 'class="mascot mascot-sm" style="width:58px"')}
      <div class="bubble bubble-left" data-coach>Take a big balloon breath… 🎈</div>
      <div class="sparkles-pill" data-sparkles title="Sparkles earned">✨ 0</div>
    </div>
  </main>`

  const stage = root.querySelector('[data-stage]') as HTMLElement
  const track = root.querySelector('[data-track]') as HTMLElement
  const singer = root.querySelector('[data-singer]') as HTMLElement
  const stageLabel = root.querySelector('[data-stage-label]') as HTMLElement
  const countdown = root.querySelector('[data-countdown]') as HTMLElement
  const progressEl = root.querySelector('[data-progress]') as HTMLElement
  const streakEl = root.querySelector('[data-streak]') as HTMLElement
  const sparklesEl = root.querySelector('[data-sparkles]') as HTMLElement
  const coachEl = root.querySelector('[data-coach]') as HTMLElement
  const prevEl = root.querySelector('[data-prev]') as HTMLElement
  const nowEl = root.querySelector('[data-now]') as HTMLElement
  const nextEl = root.querySelector('[data-next]') as HTMLElement
  const opponentEl = root.querySelector('[data-opponent]') as HTMLElement
  const visual = createReactiveScene(root.querySelector('[data-reactive-scene]') as HTMLCanvasElement, {
    kind: 'sing',
    seed: seedFromString(song.id),
  })

  if (duet) {
    const opp = duet.opponent
    opponentEl.hidden = false
    opponentEl.textContent = `${opp?.avatar ?? '🎤'} ${opp?.name ?? 'Duet buddy'} · ready!`
    duet.client.onOpponentTick((t) => {
      opponentEl.textContent =
        `${opp?.avatar ?? '🎤'} ${opp?.name ?? 'Buddy'} ✨${t.sparkles}${t.streak >= 3 ? ` 🔥${t.streak}` : ''}`
    })
    duet.client.onOpponentFinished((s) => {
      toast(`${s.name} finished — ${s.landed} notes! 🎉`, 'gold')
    })
    duet.client.onDuetResult((r) => {
      duet.result = r
    })
  }

  const stageH = 300
  const markerX = () => stage.clientWidth * MARKER_FRAC

  const yFor = (midi: number): number => {
    const span = Math.max(max - min, 4)
    const f = (midi - min) / span
    return STAGE_PAD_TOP + (1 - f) * (stageH - STAGE_PAD_TOP - STAGE_PAD_BOTTOM)
  }

  // build pills
  for (const n of windowNotes) {
    const el = document.createElement('span')
    el.className = 'note'
    el.textContent = n.syll
    el.style.left = `${n.start * PX_PER_BEAT}px`
    el.style.top = `${yFor(n.midi) - 17}px`
    el.style.width = `${Math.max(34, n.dur * PX_PER_BEAT - 8)}px`
    track.appendChild(el)
    n.el = el
  }

  function cheerPop(): void {
    const pop = document.createElement('span')
    pop.className = 'feedback-pop'
    pop.style.top = `${singerY - 46}px`
    pop.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)]
    stage.appendChild(pop)
    setTimeout(() => pop.remove(), 1100)
  }

  function updateKaraoke(beat: number): void {
    let pi = song.phrases.findIndex((p) => {
      const first = p.notes[0]
      const last = p.notes[p.notes.length - 1]
      return beat >= first.start - 1 && beat < last.start + last.dur + 0.5
    })
    if (pi === -1) pi = lastPhrase
    if (pi === -1) return

    if (pi !== lastPhrase) {
      lastPhrase = pi
      coachEl.textContent = PHRASE_CHEERS[pi % PHRASE_CHEERS.length]
    }
    const p = song.phrases[pi]
    prevEl.textContent = song.phrases[pi - 1]?.lyric ?? ''
    nextEl.textContent = song.phrases[pi + 1]?.lyric ?? ''
    nowEl.innerHTML = p.notes
      .map((n) => {
        const done = beat >= n.start + n.dur
        const now = beat >= n.start && beat < n.start + n.dur
        const cls = now ? 'word-now' : done ? 'word-done' : ''
        return cls ? `<span class="${cls}">${n.syll}</span>` : `<span>${n.syll}</span>`
      })
      .join(' ')
  }

  function setStreak(n: number): void {
    streak = n
    if (streak >= 3) {
      streakEl.textContent = `🔥 ${streak} in a row!`
      streakEl.classList.add('show')
    } else {
      streakEl.classList.remove('show')
    }
    if (streak > 0 && streak % 5 === 0) toast(`🔥 ${streak} in a row!`, 'gold', 1600)
  }

  function finalizeNotesUpTo(beat: number): void {
    while (finalizedUpTo < windowNotes.length) {
      const n = windowNotes[finalizedUpTo]
      if (beat < n.start + n.dur) break
      const r = results[finalizedUpTo]
      if (!noMic) {
        if (noteLanded(r)) {
          landedCount++
          setStreak(streak + 1)
          n.el?.classList.add('hit')
          cheerPop()
          sparklesEl.textContent = `✨ ${landedCount * 10}`
        } else {
          setStreak(0)
        }
      }
      n.el?.classList.remove('now')
      finalizedUpTo++
      duet?.client.sendTick({
        landed: landedCount,
        streak,
        sparkles: landedCount * 10,
        noteIdx: finalizedUpTo,
      })
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop)
    const beat = player.currentBeat()
    track.style.transform = `translateX(${markerX() - beat * PX_PER_BEAT}px)`

    // countdown overlay
    if (beat < fromBeat) {
      const n = Math.ceil(fromBeat - beat)
      countdown.style.display = 'grid'
      countdown.innerHTML = `<span>${n}</span>`
    } else if (beat < fromBeat + 0.5 && started) {
      countdown.innerHTML = '<span style="font-size:54px">Sing! 🎤</span>'
    } else {
      countdown.style.display = 'none'
    }

    const total = untilBeat - fromBeat
    const progress = Math.max(0, Math.min(1, (beat - fromBeat) / total))
    progressEl.style.width = `${progress * 100}%`

    updateKaraoke(beat)

    // scoring uses latency-adjusted time: the audio we hear now was sung a moment ago
    const latencyBeats = (profile.latencyMs / 1000) / player.secondsPerBeat()
    const scoreBeat = beat - latencyBeats
    const frame = noMic ? null : tracker.read()

    // move the star with her voice
    if (frame) {
      singer.classList.remove('quiet')
      const sungBase = frame.midi - shift
      const k = Math.round((midiCenter - sungBase) / 12)
      const displayMidi = sungBase + 12 * k
      singerY += (yFor(displayMidi) - singerY) * 0.3
    } else {
      singer.classList.add('quiet')
      singerY += (yFor(midiCenter) - singerY) * 0.02
    }
    singer.style.top = `${singerY - 30}px`

    // accumulate hit data on the active note
    const activeIdx = windowNotes.findIndex(
      (n, i) => i >= finalizedUpTo && scoreBeat >= n.start && scoreBeat < n.start + n.dur,
    )
    let onNote = false
    if (activeIdx !== -1) {
      const n = windowNotes[activeIdx]
      n.el?.classList.add('now')
      if (!noMic) {
        const r = results[activeIdx]
        r.totalFrames++
        if (frame && Math.abs(foldCents(frame.midi, n.midi + shift)) <= HIT_TOLERANCE_CENTS) {
          r.hitFrames++
          onNote = true
          if (r.firstHitFrac === null) r.firstHitFrac = (scoreBeat - n.start) / n.dur
        }
      }
    }
    singer.classList.toggle('on-note', onNote)
    if (onNote && !wasOnNote) visual.burst(0.55 + Math.min(0.45, streak / 20))
    wasOnNote = onNote

    finalizeNotesUpTo(scoreBeat)
    visual.update({
      energy: frame ? normalizeMicEnergy(frame.rms) : 0,
      onNote,
      streak,
      progress,
      pitchY: singerY / stageH,
      intensity: 0.45 + Math.min(0.5, streak / 20),
    })
  }

  function begin(from = fromBeat, countIn = 4): void {
    started = true
    countdown.innerHTML = ''
    visual.resume()
    wakeLock.request()
    player.start(song, {
      transpose: shift,
      rate,
      fromBeat: from,
      untilBeat,
      countInBeats: countIn,
      onDone: finish,
    })
    if (!raf) loop()
  }

  function finish(): void {
    if (finished) return
    finalizeNotesUpTo(untilBeat + 1)

    if (practicePhrase !== null) {
      toast('One more time — you sound great! 🐢', 'pink', 1800)
      setTimeout(() => {
        if (!finished) begin(fromBeat, 2)
      }, 1200)
      return
    }

    finished = true
    cancelAnimationFrame(raf)
    wakeLock.suspend()
    visual.burst(1)
    tracker.stop()
    const summary = summarize(song, results, noMic)
    recordPlay(store, song, summary, todayISO())

    if (duet) {
      duet.mySummary = {
        singerId: duet.me.singerId,
        name: duet.me.name,
        landed: summary.landed,
        total: summary.total,
        stars: summary.noMic ? 0 : summary.stars,
        sparkles: summary.sparkles,
        maxStreak: summary.maxStreak,
        accuracy: summary.accuracy,
      }
      void duet.client.finish(duet.mySummary).catch(() => {})
      setTimeout(() => {
        location.hash = '#/results?duet=1'
      }, 600)
      return
    }

    setTimeout(() => {
      location.hash = '#/results'
    }, 600)
  }

  function micDialog(): void {
    showModal({
      ariaLabel: 'Microphone needed',
      dismissible: false,
      html: `
        ${mascotSVG('mascot mascot-sm')}
        <h3>Can Twinkle hear you sing?</h3>
        <p>Twinkle needs your microphone so she can cheer for every note you land.</p>
        <button class="btn" data-retry>Yes, let's sing! 🎤</button>
        <button class="btn btn-white" data-fun>Sing just for fun 🎶</button>
        <button class="link-quiet" data-back>Back to songs</button>
      `,
      onMount(modal, close) {
        modal.querySelector('[data-retry]')?.addEventListener('click', () => {
          close()
          void startFlow()
        })
        modal.querySelector('[data-fun]')?.addEventListener('click', () => {
          close()
          noMic = true
          stageLabel.textContent = 'SING ALONG AND HAVE FUN 🎶'
          begin()
        })
        modal.querySelector('[data-back]')?.addEventListener('click', () => {
          close()
          location.hash = '#/songs'
        })
      },
    })
  }

  async function startFlow(): Promise<void> {
    try {
      await tracker.start()
      stageLabel.textContent = 'SING TO MOVE YOUR STAR ↑↓'
      begin()
    } catch {
      micDialog()
    }
  }

  function maybeTunedDialogThenStart(): void {
    if (!duet && range && shift !== 0 && !tunedDialogShown.has(song.id)) {
      tunedDialogShown.add(song.id)
      showModal({
        ariaLabel: 'Song tuned for you',
        html: `
          <span class="modal-emoji" aria-hidden="true">🎯</span>
          <h3>Tuned just for YOU!</h3>
          <p>Twinkle moved this song <strong>${Math.abs(shift)} note${Math.abs(shift) === 1 ? '' : 's'} ${shift < 0 ? 'lower' : 'higher'}</strong> so every part fits your voice like a comfy sweater.</p>
          <button class="btn" data-go>Cool, let's go! ✨</button>
        `,
        onMount(modal, close) {
          modal.querySelector('[data-go]')?.addEventListener('click', () => {
            close()
            void startFlow()
          })
        },
      })
    } else {
      void startFlow()
    }
  }

  function pauseDialog(): void {
    if (!started || finished) return
    const pausedBeat = Math.max(fromBeat, Math.floor(player.currentBeat()))
    player.stop()
    wakeLock.suspend()
    visual.pause()
    pausedModal = showModal({
      ariaLabel: 'Paused',
      dismissible: false,
      html: `
        <span class="modal-emoji" aria-hidden="true">🫧</span>
        <h3>Taking a breather?</h3>
        <p>Your song is waiting right where you left it.</p>
        <button class="btn" data-resume>Keep singing ▶</button>
        ${duet ? '' : '<button class="btn btn-white" data-restart>Start over 🔁</button>'}
        ${practicePhrase !== null ? '<button class="btn btn-gold" data-done-practice>Back to my score 🎯</button>' : ''}
        <button class="btn btn-pink" data-songs>${duet ? 'Leave the duet 👋' : 'Pick another song 🎵'}</button>
      `,
      onMount(modal, close) {
        modal.querySelector('[data-resume]')?.addEventListener('click', () => {
          close()
          begin(pausedBeat, 2)
        })
        modal.querySelector('[data-restart]')?.addEventListener('click', () => {
          close()
          windowNotes.forEach((n) => n.el?.classList.remove('hit', 'now'))
          results.forEach((r) => {
            r.hitFrames = 0
            r.totalFrames = 0
            r.firstHitFrac = null
          })
          finalizedUpTo = 0
          landedCount = 0
          setStreak(0)
          sparklesEl.textContent = '✨ 0'
          begin(fromBeat, 4)
        })
        modal.querySelector('[data-done-practice]')?.addEventListener('click', () => {
          close()
          finished = true
          location.hash = '#/results'
        })
        modal.querySelector('[data-songs]')?.addEventListener('click', () => {
          close()
          finished = true
          if (duet) {
            void duetSession.end()
            location.hash = '#/duet'
          } else {
            location.hash = '#/songs'
          }
        })
      },
    })
  }

  root.querySelector('[data-pause]')?.addEventListener('click', pauseDialog)
  root.querySelector('[data-start]')?.addEventListener('click', () => {
    if (practicePhrase !== null) {
      toast(`Practice time! Just this part 🐢`, 'pink', 1800)
    }
    maybeTunedDialogThenStart()
  })

  return () => {
    finished = true
    cancelAnimationFrame(raf)
    player.stop()
    tracker.stop()
    wakeLock.destroy()
    visual.destroy()
    pausedModal?.close()
  }
}
