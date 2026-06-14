import { api, type ApiHighScore } from '../api/client'
import { currentSongs, getSongById, isServerSongId, loadSongs, songsAreLive } from '../songs/repo'
import type { Song } from '../songs/types'
import { difficultyLabel, songSeconds } from '../songs/types'
import { computeShift, describeShift } from '../audio/range'
import { store } from '../state/store'
import { skyDecor, bottomNav } from '../ui/parts'
import { showModal } from '../ui/modal'

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function showBoard(song: Song): void {
  showModal({
    ariaLabel: `High scores for ${song.title}`,
    className: 'modal-wide',
    html: `
      <h3>🏆 ${song.title}</h3>
      <div data-board><p style="text-align:center;font-weight:800;color:var(--ink-soft)">Loading…</p></div>
      <button class="link-quiet" data-close>Close</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      const board = modal.querySelector('[data-board]') as HTMLElement
      api.highscores
        .forSong(song.id)
        .then((scores: ApiHighScore[]) => {
          board.innerHTML = scores.length
            ? scores
                .map(
                  (s, i) => `
              <div class="board-row">
                <span class="pos">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
                <span class="em">${s.singerAvatar ?? '🎤'}</span>
                <span class="nm">${s.singerName}</span>
                <span>${'★'.repeat(s.stars)}${'☆'.repeat(Math.max(0, 3 - s.stars))}</span>
                <span style="color:var(--ink-soft)">${Math.round(s.accuracy * 100)}%</span>
              </div>`,
                )
                .join('')
            : '<p style="text-align:center;font-weight:800;color:var(--ink-soft)">No scores yet — be the first! ⭐</p>'
        })
        .catch(() => {
          board.innerHTML = '<p style="text-align:center;font-weight:800;color:var(--ink-soft)">Scores need the family server 📡</p>'
        })
    },
  })
}

export function renderSongs(root: HTMLElement): void {
  const state = store.get()
  const range = state.profile?.range ?? null
  let filter: 0 | 1 | 2 | 3 = 0 // 0 = all

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

    <div data-list>
      <p style="text-align:center;font-weight:800;color:var(--ink-soft)">Tuning the songbook… 🎶</p>
    </div>
  </main>
  ${bottomNav('songs')}`

  const list = root.querySelector('[data-list]') as HTMLElement

  const songCard = (song: Song, idx: number, live: boolean) => {
    const shift = computeShift(song, range)
    const tuned = range
      ? `<span class="tuned" title="${describeShift(shift)}">✓ In your key</span>`
      : `<a class="tuned tuned-cta" href="#/voice">Find my voice →</a>`
    const extras = live
      ? `<span class="song-actions">
           <button class="mini-btn" data-board="${song.id}" aria-label="High scores for ${song.title}">🏆</button>
           <button class="mini-btn" data-duet="${song.id}" aria-label="Duet ${song.title}">🎤🎤 Duet</button>
         </span>`
      : ''
    return `
    <article class="song rise d${Math.min(idx + 2, 8)}" data-diff="${song.difficulty}">
      <div class="art art-${song.art}" aria-hidden="true">${song.emoji}</div>
      <div class="song-body">
        <strong>${song.title}</strong>
        <div class="song-meta">
          <span>⏱ ${fmtDuration(songSeconds(song))}</span>
          <span>${difficultyLabel(song.difficulty)}</span>
          ${tuned}
          ${extras}
        </div>
      </div>
      <button class="play" data-sing="${song.id}" aria-label="Sing ${song.title}">▶</button>
    </article>`
  }

  function paint(songs: Song[], live: boolean): void {
    const lastSong = state.lastSongId ? getSongById(state.lastSongId) : undefined
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

    list.innerHTML = `
      ${live ? '' : `<div class="why rise" style="margin:0 0 14px"><span class="ico">📡</span><span>Offline songbook — duets and family scores come back when the server does.</span></div>`}
      ${againCard}
      ${songs.map((s, i) => songCard(s, i, live)).join('')}
      <div class="new-songs rise d8">
        <span class="ico" aria-hidden="true">🎁</span>
        ${live ? 'Grown-ups can add new songs in the Grown-Ups Corner!' : 'New songs land every Friday!'}
      </div>`

    list.querySelectorAll<HTMLElement>('.song').forEach((card) => {
      card.style.display = filter === 0 || Number(card.dataset.diff) === filter ? '' : 'none'
    })
    list.querySelectorAll<HTMLButtonElement>('[data-sing]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.hash = `#/sing?song=${btn.dataset.sing}`
      })
    })
    list.querySelectorAll<HTMLButtonElement>('[data-duet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.hash = `#/duet?song=${btn.dataset.duet}`
      })
    })
    list.querySelectorAll<HTMLButtonElement>('[data-board]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const song = getSongById(btn.dataset.board as string)
        if (song && isServerSongId(song.id)) showBoard(song)
      })
    })
  }

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

  paint(currentSongs(), songsAreLive())
  void loadSongs().then(({ songs, online }) => paint(songs, online))
}
