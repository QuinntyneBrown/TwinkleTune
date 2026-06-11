import { store } from '../state/store'
import { badgeById } from '../state/badges'
import { mascotSVG, skyDecor, starSVG } from '../ui/parts'

const CONFETTI_COLORS = ['#F4DBE3', '#5EA8DA', '#FFD66B', '#83C5F1', '#AFE3F4']

function confettiHTML(): string {
  const bits = Array.from({ length: 14 }, (_, i) => {
    const left = 4 + i * 7
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const dur = (3 + (i % 5) * 0.4).toFixed(1)
    const delay = ((i % 7) * 0.3).toFixed(1)
    return `<i style="left:${left}%;background:${color};animation-duration:${dur}s;animation-delay:${delay}s"></i>`
  }).join('')
  return `<div class="confetti" aria-hidden="true">${bits}</div>`
}

export function renderResults(root: HTMLElement): void {
  const state = store.get()
  const r = state.lastResult
  if (!r) {
    location.hash = '#/home'
    return
  }
  const name = state.profile?.name ?? 'Superstar'

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
  ${skyDecor()}
  ${confettiHTML()}
  <main class="screen screen--center screen--nonav">
    ${mascotSVG('mascot pop', true)}
    <h1 class="whoop rise d1">${headline}, ${name}! 🎉
      <small>${r.songTitle}</small>
    </h1>
    ${starsRow}
    ${scoreCard}
    ${badgeChips}
    <div class="result-coach rise d6">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left">${coachText}</div>
    </div>
    <div class="result-ctas">
      ${practiceBtn}
      <div class="cta-row rise d8">
        <a class="btn btn-white" href="#/sing?song=${r.songId}">Sing again 🔁</a>
        <a class="btn btn-pink" href="#/songs">New song 🎵</a>
      </div>
      <a class="link-quiet rise d8" href="#/home" style="margin:6px auto 0">Home 🏠</a>
    </div>
  </main>`
}
