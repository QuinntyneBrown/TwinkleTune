import { api } from '../api/client'
import { duetSession, type DuetResult } from '../api/duet'
import { isServerSongId } from '../songs/repo'
import { store } from '../state/store'
import { badgeById } from '../state/badges'
import { mascotSVG, skyDecor, starSVG } from '../ui/parts'
import { toast } from '../ui/modal'
import { createReactiveScene, seedFromString } from '../rendering/reactive-scene'

export function renderResults(root: HTMLElement, params: URLSearchParams): () => void {
  const state = store.get()
  const r = state.lastResult
  if (!r) {
    location.hash = '#/home'
    return () => {}
  }
  const name = state.profile?.name ?? 'Superstar'
  const duet = params.get('duet') === '1' ? duetSession.get() : null

  // family high score — fire and forget, server optional
  if (!r.noMic && state.profile?.singerId && isServerSongId(r.songId)) {
    void api.highscores
      .submit({
        songId: r.songId,
        singerId: state.profile.singerId,
        stars: r.stars,
        accuracy: r.accuracy,
        sparkles: r.sparkles,
        maxStreak: r.maxStreak,
      })
      .then((res) => {
        if (res.improved) toast('🏆 New family record!', 'gold', 2600)
      })
      .catch(() => {})
  }

  const headline = r.noMic
    ? 'What a fun sing-along'
    : r.stars === 3
      ? 'Super Singing'
      : r.stars === 2
        ? 'Beautiful Singing'
        : 'Brave Singing'

  const starsRow = r.noMic
    ? ''
    : `
    <div class="stars-row" aria-label="${r.stars} star${r.stars === 1 ? '' : 's'} earned">
      <span class="pop d2${r.stars >= 1 ? '' : ' empty'}">${starSVG(r.stars >= 1)}</span>
      <span class="pop d4${r.stars >= 2 ? '' : ' empty'}">${starSVG(r.stars >= 2)}</span>
      <span class="pop d6${r.stars >= 3 ? '' : ' empty'}">${starSVG(r.stars >= 3)}</span>
    </div>`

  const marks = (n: number) => '⭐'.repeat(Math.max(1, Math.min(3, n)))

  const scoreCard = r.noMic
    ? `
    <section class="card score-card rise d3">
      <h2>You sang the whole song! 🎉</h2>
      <p class="score-note">Next time let Twinkle listen, and she'll cheer for every note you land.</p>
    </section>`
    : `
    <section class="card score-card rise d3">
      <h2>You landed ${r.landed} of ${r.total} notes! 🎯</h2>
      <div class="track"><div class="fill fill-gold fill-animated" style="width:${Math.round(r.accuracy * 100)}%"></div></div>
      <p class="score-note">${
        state.profile?.range ? 'Sung in YOUR key — high five for those notes!' : 'Tip: do “Find my voice” so songs fit you perfectly!'
      }</p>
      <div class="marks">
        <span class="mark"><b>${marks(r.pitchStars)}</b>Pitch</span>
        <span class="mark"><b>${marks(r.timingStars)}</b>Timing</span>
        <span class="mark"><b>${marks(r.braveStars)}</b>Braveness</span>
      </div>
    </section>`

  const badgeChips = state.lastNewBadges
    .map((id) => badgeById(id))
    .filter(Boolean)
    .map((b, i) => `<div class="badge-toast pop d${5 + i}">${b!.emoji} New badge: ${b!.name}!</div>`)
    .join('')

  const coachText = r.noMic
    ? `That sounded like so much fun! Want to sing it again with Twinkle listening?`
    : r.trickyLyric
      ? `Your notes <strong>sparkled!</strong> The “${r.trickyLyric}” part was tricky — want to practice just that bit?`
      : r.stars === 3
        ? `Absolutely <strong>magical</strong>. You landed this song — pick a brave new one!`
        : `That was <strong>wonderful</strong>. One more sing and it'll shine even brighter!`

  const practiceBtn =
    !r.noMic && r.trickyPhrase !== null
      ? `<a class="btn btn-gold btn-xl rise d7" href="#/sing?song=${r.songId}&practice=${r.trickyPhrase}&slow=1">Practice the tricky part 🎯</a>`
      : ''

  root.innerHTML = `
  <canvas class="reactive-scene reactive-scene--results" data-reactive-scene aria-hidden="true"></canvas>
  ${skyDecor()}
  <main class="screen screen--center screen--nonav">
    ${mascotSVG('mascot pop', true)}
    <h1 class="whoop rise d1">${headline}, ${name}! 🎉
      <small>${r.songTitle}</small>
    </h1>
    ${starsRow}
    ${duet ? '<div data-duet-result style="width:100%"></div>' : ''}
    ${scoreCard}
    ${badgeChips}
    <div class="result-coach rise d6">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left">${duet ? 'What a duet! Singing together is the best magic. 💙' : coachText}</div>
    </div>
    <div class="result-ctas">
      ${duet ? '' : practiceBtn}
      <div class="cta-row rise d8">
        ${
          duet
            ? '<button class="btn btn-gold" data-again-duet>Another duet 🎤🎤</button>'
            : `<a class="btn btn-white" href="#/sing?song=${r.songId}">Sing again 🔁</a>`
        }
        <a class="btn btn-pink" href="#/songs">New song 🎵</a>
      </div>
      <a class="link-quiet rise d8" href="#/home" style="margin:6px auto 0" data-home>Home 🏠</a>
    </div>
  </main>`

  const visual = createReactiveScene(root.querySelector('[data-reactive-scene]') as HTMLCanvasElement, {
    kind: 'results',
    seed: seedFromString(`${r.songId}:${r.sparkles}:${r.stars}`),
  })
  visual.update({
    progress: 1,
    onNote: !r.noMic && r.stars > 0,
    intensity: r.noMic ? 0.55 : 0.55 + r.stars * 0.15,
    streak: r.maxStreak,
  })
  visual.burst(r.noMic ? 0.65 : 0.7 + r.stars * 0.1)

  if (duet) {
    const box = root.querySelector('[data-duet-result]') as HTMLElement

    const paintDuet = (result: DuetResult): void => {
      const players = [...result.players].sort((a) => (a.singerId === duet.me.singerId ? -1 : 1))
      box.innerHTML = `
        <section class="card score-card pop" style="margin-top:6px">
          <h2>Together you earned ${result.combinedSparkles} ✨!</h2>
          <div class="duet-players" style="margin-top:8px">
            ${players
              .map(
                (p) => `
              <div class="profile-card" style="box-shadow:none;background:#F4FAFE">
                <strong>${p.name}</strong>
                <span style="font-size:18px">${'★'.repeat(p.stars)}${'☆'.repeat(Math.max(0, 3 - p.stars))}</span>
                <span style="font-weight:800;color:var(--ink-soft);font-size:13px">${p.landed} of ${p.total} notes · ✨${p.sparkles}</span>
              </div>`,
              )
              .join('')}
          </div>
        </section>`
    }

    if (duet.result) paintDuet(duet.result)
    else {
      box.innerHTML = `
        <section class="card score-card" style="margin-top:6px;text-align:center">
          <h2>Waiting for ${duet.opponent?.name ?? 'your duet buddy'}… 🎶</h2>
          <p class="score-note">They're still singing their heart out!</p>
        </section>`
      duet.client.onDuetResult((result) => {
        duet.result = result
        paintDuet(result)
      })
    }

    root.querySelector('[data-again-duet]')?.addEventListener('click', async () => {
      await duetSession.end()
      location.hash = '#/duet'
    })
    root.querySelector('[data-home]')?.addEventListener('click', () => {
      void duetSession.end()
    })
  }

  return () => visual.destroy()
}
