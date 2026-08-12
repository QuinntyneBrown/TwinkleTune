import { currentSongs } from '../songs/repo'
import { BADGES } from '../state/badges'
import { level, levelTitle, sparklesToNextLevel, store, todayISO } from '../state/store'
import { midiToName } from '@twinkletune/audio-engine'
import { skyDecor, bottomNav } from '../ui/parts'
import { parentGate } from '../ui/modal'
import { showSettings } from '../ui/settings'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function currentWeek(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7 // 0 = Monday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(y, m - 1, d - dow + i)
    return todayISO(day)
  })
}

export function renderMe(root: HTMLElement): void {
  const s = store.get()
  const profile = s.profile!
  const lvl = level(s.sparkles)
  const toNext = sparklesToNextLevel(s.sparkles)
  const xpPct = Math.round(((s.sparkles % 300) / 300) * 100)
  const today = todayISO()
  const week = currentWeek(today)
  const sung = new Set(s.singDays)

  const weekHTML = week
    .map((iso, i) => {
      const done = sung.has(iso)
      const isToday = iso === today
      const cls = `day${done ? ' done' : ''}${isToday ? ' today' : ''}`
      const icon = done ? '⭐' : isToday ? '🎤' : '·'
      return `<div class="${cls}"><i>${icon}</i>${DAY_LETTERS[i]}</div>`
    })
    .join('')

  const badgesHTML = BADGES.map((b, i) => {
    const earned = b.id in s.badges
    return `
    <div class="badge${earned ? '' : ' locked'} pop d${Math.min(i + 3, 8)}" title="${b.hint}">
      <span class="ico">${earned ? b.emoji : '🔒'}</span>
      <strong>${b.name}</strong>
    </div>`
  }).join('')

  const mastered = currentSongs()
    .map((song) => ({ song, best: s.bests[song.id] }))
    .filter((x) => x.best && x.best.stars > 0)
    .sort((a, b) => b.best!.stars - a.best!.stars)

  const masteredHTML = mastered.length
    ? mastered
        .map(
          ({ song, best }, i) => `
      <div class="mastered rise d${Math.min(i + 6, 8)}">
        <span class="em">${song.emoji}</span>
        <span>${song.title}</span>
        <b>${'★'.repeat(best!.stars)}${'☆'.repeat(3 - best!.stars)}</b>
      </div>`,
        )
        .join('')
    : `<div class="new-songs rise d6"><span class="ico">🎤</span>Sing your first song and it'll shine here!</div>`

  const growthHTML = profile.range
    ? `
    <div class="growth rise d8">
      <span class="em" aria-hidden="true">📈</span>
      <p>Your voice goes from <strong>${midiToName(profile.range.low)}</strong> to <strong>${midiToName(profile.range.high)}</strong> —
      that's <strong>${profile.range.high - profile.range.low + 1} notes</strong>! Twinkle keeps every song tuned to match.</p>
    </div>`
    : `
    <a class="growth rise d8" href="#/voice" style="text-decoration:none">
      <span class="em" aria-hidden="true">🎯</span>
      <p><strong>Find your voice!</strong> A 1-minute game so Twinkle can tune every song just for you. →</p>
    </a>`

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen">
    <header class="me-head rise">
      <button class="icon-btn me-gear" data-settings aria-label="Grown-ups corner">⚙️</button>
      <div class="avatar avatar-lg pop" role="img" aria-label="Your avatar">${profile.avatar}</div>
      <h1>${profile.name}'s Star Journey</h1>
      <p>Level ${lvl} ${levelTitle(lvl)} 🐦</p>
    </header>

    <section class="card xp rise d1" aria-label="Level progress">
      <div class="xp-row">
        <b>Level ${lvl}</b>
        <span>${toNext} ✨ to Level ${lvl + 1}!</span>
        <b style="color:#B7CFE2">Level ${lvl + 1}</b>
      </div>
      <div class="track"><div class="fill fill-animated" style="width:${xpPct}%"></div></div>
      <p style="margin-top:8px;font-weight:800;font-size:13px;color:var(--ink-soft)">✨ ${s.sparkles} sparkles collected</p>
    </section>

    <h2 class="section-title rise d2">⭐ This week</h2>
    <section class="card week rise d2" aria-label="Weekly singing streak">
      ${weekHTML}
    </section>

    <h2 class="section-title rise d3">🏅 My badges</h2>
    <div class="badges">
      ${badgesHTML}
    </div>

    <h2 class="section-title rise d6">💖 Songs I shine at</h2>
    ${masteredHTML}

    ${growthHTML}
  </main>
  ${bottomNav('me')}`

  root.querySelector('[data-settings]')?.addEventListener('click', () => parentGate(showSettings))
}
