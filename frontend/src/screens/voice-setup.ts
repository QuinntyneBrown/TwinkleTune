import { PitchTracker } from '../audio/pitch'
import { midiToName, StablePitchCapture } from '../audio/range'
import { playNote } from '../audio/player'
import { pushProfileToServer } from '../state/profile'
import { store } from '../state/store'
import { mascotSVG, skyDecor } from '../ui/parts'
import { showModal, toast } from '../ui/modal'

type Phase = 'intro' | 'low' | 'high'

// ladder spans C3..C6, one rung per 3 semitones
const LADDER_LOW = 48
const LADDER_RUNGS = 12
const RUNG_SPAN = 3

export function renderVoiceSetup(root: HTMLElement): () => void {
  const tracker = new PitchTracker()
  const capture = new StablePitchCapture()
  let phase: Phase = 'intro'
  let lowMidi: number | null = null
  let raf = 0

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen screen--nonav">
    <header class="topbar rise">
      <a class="icon-btn" href="#/home" aria-label="Go back">←</a>
      <h1 class="title">Find My Voice</h1>
      <a class="link-quiet spacer" style="width:auto;font-size:13px" href="#/home">Later</a>
    </header>

    <div class="steps rise d1" aria-label="Progress" data-steps>
      <span class="step-dot now"></span>
      <span class="step-dot"></span>
      <span class="step-dot"></span>
    </div>

    <div class="coach rise d2">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left" data-bubble>
        Let's play a 1-minute game! I'll listen to your voice so I can
        <strong>tune every song just for you</strong>. Ready?
      </div>
    </div>

    <section class="card ladder-card rise d3" aria-label="Your vocal range ladder">
      <div class="ladder" data-ladder>
        ${Array.from({ length: LADDER_RUNGS }, (_, i) => `<div class="rung" data-rung="${i}"></div>`).join('')}
      </div>
      <div class="ladder-side" aria-hidden="true">
        <span>⭐</span>
        <small>HIGH&nbsp;&nbsp;·&nbsp;&nbsp;LOW</small>
        <span>🌊</span>
      </div>
    </section>

    <div class="card card-soft listen rise d4">
      <div class="mic" data-mic role="img" aria-label="Microphone">🎤</div>
      <div class="listen-info">
        <strong data-listen-msg>Press the button when you're ready!</strong>
        <div class="eq" data-eq aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </div>

    <div class="why rise d5">
      <span class="ico">💙</span>
      <span>Twinkle remembers your range, then <strong>tunes every song to fit YOUR voice</strong> — never too high, never too low.</span>
    </div>

    <div class="ctas rise d6">
      <button class="btn btn-xl" data-action>I'm ready — listen! 🎤</button>
    </div>
  </main>`

  const bubble = root.querySelector('[data-bubble]') as HTMLElement
  const listenMsg = root.querySelector('[data-listen-msg]') as HTMLElement
  const actionBtn = root.querySelector('[data-action]') as HTMLButtonElement
  const mic = root.querySelector('[data-mic]') as HTMLElement
  const eq = root.querySelector('[data-eq]') as HTMLElement
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.step-dot'))
  const rungs = Array.from(root.querySelectorAll<HTMLElement>('[data-rung]'))

  const rungFor = (midi: number) =>
    Math.max(0, Math.min(LADDER_RUNGS - 1, Math.floor((midi - LADDER_LOW) / RUNG_SPAN)))

  const setSteps = (n: 1 | 2 | 3) => {
    dots.forEach((d, i) => {
      d.className = `step-dot${i < n - 1 ? ' done' : i === n - 1 ? ' now' : ''}`
    })
  }

  function paintLadder(currentMidi: number | null): void {
    rungs.forEach((r, i) => {
      r.classList.remove('now', 'lit')
      r.innerHTML = r.classList.contains('captured') ? r.innerHTML : ''
      const cur = currentMidi !== null ? rungFor(currentMidi) : -1
      if (i === cur) {
        r.classList.add('now')
        r.innerHTML = `<span class="singer-dot">${store.get().profile?.avatar ?? '🎤'}</span>`
      } else if (i < cur) {
        r.classList.add('lit')
      }
    })
  }

  function markCaptured(midi: number, label: string): void {
    const r = rungs[rungFor(midi)]
    r.classList.add('captured')
    r.textContent = `${label} ${midiToName(midi)} ✓`
  }

  function micDeniedDialog(): void {
    showModal({
      ariaLabel: 'Microphone needed',
      html: `
        ${mascotSVG('mascot mascot-sm', false)}
        <h3>Twinkle can't hear you 💙</h3>
        <p>Your microphone is turned off for this app. Ask a grown-up to allow the microphone, then try again!</p>
        <button class="btn" data-retry>Try again 🎤</button>
        <button class="link-quiet" data-later>Do this later</button>
      `,
      onMount(modal, close) {
        modal.querySelector('[data-retry]')?.addEventListener('click', () => {
          close()
          void beginListening()
        })
        modal.querySelector('[data-later]')?.addEventListener('click', () => {
          close()
          location.hash = '#/home'
        })
      },
    })
  }

  async function beginListening(): Promise<void> {
    try {
      await tracker.start()
    } catch {
      micDeniedDialog()
      return
    }
    phase = 'low'
    setSteps(2)
    capture.reset()
    bubble.innerHTML = 'Sing your <strong>lowest comfy</strong> note — a big cozy <strong>“laaa”</strong> — and hold it!'
    listenMsg.textContent = 'Listening for your low note… 🌊'
    actionBtn.style.display = 'none'
    mic.classList.add('live')
    eq.classList.add('live')
    loop()
  }

  function captured(midi: number): void {
    if (phase === 'low') {
      lowMidi = midi
      markCaptured(midi, 'Low')
      playNote(midi)
      toast(`Got it! Your cozy low note: ${midiToName(midi)} 🌊`, 'gold')
      phase = 'high'
      setSteps(3)
      capture.reset()
      bubble.innerHTML = 'Beautiful! Now squeak up high like a baby bird — your <strong>highest comfy</strong> <strong>“laaa”</strong>!'
      listenMsg.textContent = 'Listening for your high note… ⭐'
    } else if (phase === 'high') {
      if (lowMidi !== null && midi < lowMidi + 4) {
        toast('That sounds close to your low note — reach a little higher! 🐦', 'pink')
        capture.reset()
        return
      }
      markCaptured(midi, 'High')
      playNote(midi)
      finish(lowMidi as number, midi)
    }
  }

  function finish(low: number, high: number): void {
    cancelAnimationFrame(raf)
    tracker.stop()
    store.update((s) => {
      if (s.profile) s.profile.range = { low, high }
    })
    void pushProfileToServer() // her range follows her to other devices
    showModal({
      ariaLabel: 'Voice found',
      dismissible: false,
      html: `
        ${mascotSVG('mascot mascot-sm', true)}
        <h3>Your voice is found! 🎉</h3>
        <p>You sing from <strong>${midiToName(low)}</strong> up to <strong>${midiToName(high)}</strong>.
        Every song is now <strong>tuned just for you</strong> — never too high, never too low.</p>
        <button class="btn" data-songs>To my songs 🎵</button>
        <button class="link-quiet" data-home>Home</button>
      `,
      onMount(modal, close) {
        modal.querySelector('[data-songs]')?.addEventListener('click', () => {
          close()
          location.hash = '#/songs'
        })
        modal.querySelector('[data-home]')?.addEventListener('click', () => {
          close()
          location.hash = '#/home'
        })
      },
    })
  }

  function loop(): void {
    raf = requestAnimationFrame(loop)
    const frame = tracker.read()
    paintLadder(frame?.midi ?? null)
    eq.classList.toggle('live', frame !== null)
    if (frame) {
      const locked = capture.feed(frame.midi)
      if (locked !== null) captured(Math.round(locked))
      else {
        const pct = Math.round(capture.progress() * 100)
        if (pct > 10) listenMsg.textContent = `Keep holding it… ${pct}% ✨`
      }
    } else {
      capture.feed(null)
    }
  }

  actionBtn.addEventListener('click', () => void beginListening())

  return () => {
    cancelAnimationFrame(raf)
    tracker.stop()
  }
}
