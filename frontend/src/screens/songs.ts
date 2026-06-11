import { songs } from '../songs/catalog'
import { difficultyLabel, songSeconds } from '../songs/types'
import { computeShift, describeShift } from '../audio/range'
import { store } from '../state/store'
import { skyDecor, bottomNav } from '../ui/parts'

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function renderSongs(root: HTMLElement): void {
  const state = store.get()
  const range = state.profile?.range ?? null
  const lastSong = state.lastSongId ? songs.find((s) => s.id === state.lastSongId) : null

  let filter: 0 | 1 | 2 | 3 = 0 // 0 = all

  const songCard = (song: (typeof songs)[number], idx: number) => {
    const shift = computeShift(song, range)
    const tuned = range
      ? `<span class="tuned" title="${describeShift(shift)}">✓ In your key</span>`
      : `<a class="tuned tuned-cta" href="#/voice">Find my voice →</a>`
    return `
    <article class="song rise d${Math.min(idx + 2, 8)}" data-diff="${song.difficulty}">
      <div class="art art-${song.art}" aria-hidden="true">${song.emoji}</div>
      <div class="song-body">
        <strong>${song.title}</strong>
        <div class="song-meta">
          <span>⏱ ${fmtDuration(songSeconds(song))}</span>
          <span>${difficultyLabel(song.difficulty)}</span>
          ${tuned}
        </div>
      </div>
      <button class="play" data-sing="${song.id}" aria-label="Sing ${song.title}">▶</button>
    </article>`
  }

  const againCard = lastSong
    ? `
    <section class="again-card rise d2" aria-label="Sing it again">
      <span class="art-emoji" aria-hidden="true">${lastSong.emoji}</span>
      <div class="again-body">
        <strong>Sing it again!</strong>
        <small>${lastSong.title} · you know this one ✨</small>
      </div>
      <button class="btn btn-pink" data-sing="${lastSong.id}" aria-label="Sing ${lastSong.title} again">▶</button>
    </section>`
    : ''

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen">
    <header class="topbar rise">
      <a class="icon-btn" href="#/home" aria-label="Go back">←</a>
      <h1 class="title">Pick a Song 🎵</h1>
      <span class="spacer"></span>
    </header>

    <div class="chip-row rise d1" role="tablist" aria-label="Song difficulty">
      <button class="chip active" data-filter="0" role="tab" aria-selected="true">⭐ All</button>
      <button class="chip" data-filter="1" role="tab">😊 Easy</button>
      <button class="chip" data-filter="2" role="tab">🙂 Medium</button>
      <button class="chip" data-filter="3" role="tab">😤 Brave</button>
    </div>

    ${againCard}
    <div data-song-list>
      ${songs.map((s, i) => songCard(s, i)).join('')}
    </div>

    <div class="new-songs rise d8">
      <span class="ico" aria-hidden="true">🎁</span>
      New songs land every Friday!
    </div>
  </main>
  ${bottomNav('songs')}`

  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      filter = Number(chip.dataset.filter) as typeof filter
      root.querySelectorAll('[data-filter]').forEach((c) => {
        c.classList.toggle('active', c === chip)
        c.setAttribute('aria-selected', String(c === chip))
      })
      root.querySelectorAll<HTMLElement>('.song').forEach((card) => {
        card.style.display = filter === 0 || Number(card.dataset.diff) === filter ? '' : 'none'
      })
    })
  })

  root.querySelectorAll<HTMLButtonElement>('[data-sing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/sing?song=${btn.dataset.sing}`
    })
  })
}
