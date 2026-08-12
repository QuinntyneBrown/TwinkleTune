import { level, levelTitle, songsSungOn, store, streakCount, todayISO } from '../state/store'
import { avatarHTML, mascotSVG, skyDecor, bottomNav } from '../ui/parts'
import { tipOfTheDay } from './tips-data'

const DAILY_GOAL = 3

export function renderHome(root: HTMLElement): void {
  const s = store.get()
  const profile = s.profile!
  const today = todayISO()
  const sungToday = songsSungOn(s, today)
  const streak = streakCount(s.singDays, today)
  const lvl = level(s.sparkles)
  const tip = tipOfTheDay()
  const goalDeg = Math.min(1, sungToday / DAILY_GOAL) * 360
  const masteredCount = Object.values(s.bests).filter((b) => b.stars > 0).length

  const bubbleText = profile.range
    ? "Your songs are tuned and ready. Let's make today sparkle! ✨"
    : 'Shall we find your voice first? Then every song fits YOU! 💙'

  const voiceCard = profile.range
    ? ''
    : `
    <a class="card goal rise d2" href="#/voice" style="text-decoration:none">
      <div class="avatar" aria-hidden="true">🎯</div>
      <div class="goal-info">
        <strong>Find my voice</strong>
        <span>A 1-minute game so every song fits your voice</span>
      </div>
      <span style="font-size:24px" aria-hidden="true">→</span>
    </a>`

  const goalCard = profile.range
    ? `
    <section class="card goal rise d2" aria-label="Today's goal">
      <div class="goal-ring" style="background:conic-gradient(var(--blue) 0 ${goalDeg}deg,#E3F1FB ${goalDeg}deg 360deg)"
           role="img" aria-label="${sungToday} of ${DAILY_GOAL} songs done">
        <b>${Math.min(sungToday, DAILY_GOAL)}/${DAILY_GOAL}</b>
      </div>
      <div class="goal-info">
        <strong>Today's sparkle goal</strong>
        <span>${
          sungToday >= DAILY_GOAL
            ? 'Goal complete — you did it! 🎉'
            : sungToday === 0
              ? `Sing ${DAILY_GOAL} songs today`
              : `Sing ${DAILY_GOAL} songs — just ${DAILY_GOAL - sungToday} more to go!`
        }</span>
      </div>
      <span style="font-size:28px" aria-hidden="true">✨</span>
    </section>`
    : voiceCard

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen">
    <header class="hello rise">
      <a href="#/profiles" style="text-decoration:none" title="Switch singer" aria-label="Switch singer">
        ${avatarHTML(profile)}
      </a>
      <div class="hello-text">
        <h1>Hi, ${profile.name}! 👋</h1>
        <p>Level ${lvl} ${levelTitle(lvl)}</p>
      </div>
      <div class="streak-chip-top" title="Singing streak">⭐ ${streak}-day streak</div>
    </header>

    <div class="coach-home rise d1">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left">${bubbleText}</div>
    </div>

    ${goalCard}

    <a class="hero-tile rise d3" href="#/songs">
      <span class="spark" style="top:14px;right:120px">✦</span>
      <span class="spark" style="top:48px;right:80px;animation-delay:.8s">✦</span>
      <span class="spark" style="bottom:24px;left:160px;animation-delay:1.4s">✦</span>
      <h2>Sing a Song</h2>
      <p>${profile.range ? 'Every song in YOUR key 💙' : 'Pick a song and shine ✨'}</p>
      <span class="go">Let's go! ▶</span>
      <span class="big-mic" aria-hidden="true">🎤</span>
    </a>

    <div class="tiles">
      <a class="tile tile-pink rise d4" href="#/tips">
        <span class="ico" aria-hidden="true">🎈</span>
        <strong>Warm-Ups</strong>
        <span>2-minute voice games</span>
      </a>
      <a class="tile tile-white rise d5" href="#/me">
        <span class="ico" aria-hidden="true">💖</span>
        <strong>My Songs</strong>
        <span>${masteredCount} song${masteredCount === 1 ? '' : 's'} mastered</span>
      </a>
    </div>

    <section class="card tip-day rise d6" aria-label="Tip of the day">
      <div class="lamp" aria-hidden="true">${tip.icon}</div>
      <div class="tip-day-body">
        <strong>Tip of the day</strong>
        <p>${tip.title} — ${tip.short}</p>
      </div>
      <a class="tip-arrow" href="#/tips" aria-label="More tips">→</a>
    </section>
  </main>
  ${bottomNav('home')}`
}
