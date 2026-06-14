import { api, ApiError, type ApiAvatar, type ApiSong } from '../api/client'
import { SongPlayer } from '../audio/player'
import type { Song } from '../songs/types'
import { validateSong } from '../songs/types'
import { showModal, toast } from './modal'

/* ============ Song manager (Grown-Ups Corner) ============ */

const PHRASES_TEMPLATE = [
  {
    lyric: 'La la la',
    notes: [
      { midi: 60, start: 0, dur: 1, syll: 'La' },
      { midi: 62, start: 1, dur: 1, syll: 'la' },
      { midi: 64, start: 2, dur: 2, syll: 'la' },
    ],
  },
]

function parseSongForm(modal: HTMLElement): { song: Song; errors: string[] } {
  const value = (sel: string) => (modal.querySelector(sel) as HTMLInputElement | HTMLSelectElement).value
  let phrases: Song['phrases'] = []
  const errors: string[] = []
  try {
    phrases = JSON.parse(value('[data-f-phrases]')) as Song['phrases']
    if (!Array.isArray(phrases)) throw new Error()
  } catch {
    errors.push('The phrases box must be valid JSON (a list of phrases).')
  }
  const song: Song = {
    id: 'editor-preview',
    title: value('[data-f-title]').trim(),
    emoji: value('[data-f-emoji]').trim(),
    art: Number(value('[data-f-art]')) as Song['art'],
    bpm: Number(value('[data-f-bpm]')),
    difficulty: Number(value('[data-f-difficulty]')) as Song['difficulty'],
    phrases,
  }
  if (errors.length === 0) errors.push(...validateSong(song))
  return { song, errors }
}

function songEditor(existing: ApiSong | null, onSaved: () => void): void {
  const preview = new SongPlayer()
  const phrasesJson = JSON.stringify(existing?.phrases ?? PHRASES_TEMPLATE, null, 2)

  showModal({
    ariaLabel: existing ? 'Edit song' : 'New song',
    className: 'modal-wide',
    html: `
      <h3>${existing ? `Edit “${existing.title}”` : 'New song 🎵'}</h3>
      <label class="field-label">Title</label>
      <input class="field" data-f-title maxlength="80" value="${existing?.title ?? ''}">
      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label class="field-label">Emoji</label>
          <input class="field" data-f-emoji maxlength="4" value="${existing?.emoji ?? '🎵'}">
        </div>
        <div style="flex:1">
          <label class="field-label">Tempo (BPM)</label>
          <input class="field" data-f-bpm type="number" min="40" max="220" value="${existing?.bpm ?? 100}">
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label class="field-label">Difficulty</label>
          <select class="field" data-f-difficulty>
            <option value="1"${(existing?.difficulty ?? 1) === 1 ? ' selected' : ''}>⭐ Easy</option>
            <option value="2"${existing?.difficulty === 2 ? ' selected' : ''}>⭐⭐ Medium</option>
            <option value="3"${existing?.difficulty === 3 ? ' selected' : ''}>⭐⭐⭐ Brave</option>
          </select>
        </div>
        <div style="flex:1">
          <label class="field-label">Art style</label>
          <select class="field" data-f-art>
            ${[1, 2, 3, 4].map((a) => `<option value="${a}"${(existing?.art ?? 1) === a ? ' selected' : ''}>Style ${a}</option>`).join('')}
          </select>
        </div>
      </div>
      <label class="field-label">Phrases & notes (JSON — midi 60 = middle C, times in beats)</label>
      <textarea class="field" data-f-phrases spellcheck="false">${phrasesJson}</textarea>
      <div class="errors" data-errors hidden></div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-white btn-sm" data-preview style="flex:1">Preview ▶</button>
        <button class="btn btn-sm" data-save style="flex:1">${existing ? 'Save' : 'Create'} ✨</button>
      </div>
      <button class="link-quiet" data-close>Cancel</button>
    `,
    onMount(modal, close) {
      const errorsBox = modal.querySelector('[data-errors]') as HTMLElement
      const showErrors = (errors: string[]) => {
        errorsBox.hidden = errors.length === 0
        errorsBox.innerHTML = errors.map((e) => `<div>• ${e}</div>`).join('')
      }

      modal.querySelector('[data-close]')?.addEventListener('click', () => {
        preview.stop()
        close()
      })

      modal.querySelector('[data-preview]')?.addEventListener('click', () => {
        const { song, errors } = parseSongForm(modal)
        showErrors(errors)
        if (errors.length === 0) preview.start(song, { countInBeats: 1 })
      })

      modal.querySelector('[data-save]')?.addEventListener('click', async () => {
        const { song, errors } = parseSongForm(modal)
        showErrors(errors)
        if (errors.length > 0) return
        const body = {
          title: song.title,
          emoji: song.emoji,
          art: song.art,
          bpm: song.bpm,
          difficulty: song.difficulty,
          phrases: song.phrases,
        }
        try {
          if (existing) await api.songs.update(existing.id, body)
          else await api.songs.create(body)
          preview.stop()
          close()
          toast(existing ? 'Song saved! ✨' : 'Song created! 🎉', 'gold')
          onSaved()
        } catch (e) {
          showErrors(e instanceof ApiError && e.errors.length ? e.errors : [e instanceof Error ? e.message : 'Could not save.'])
        }
      })
    },
  })
}

export function showSongManager(): void {
  showModal({
    ariaLabel: 'Manage songs',
    className: 'modal-wide',
    html: `
      <h3>Songbook 🎵</h3>
      <div data-rows><p style="text-align:center;font-weight:800;color:var(--ink-soft)">Loading…</p></div>
      <button class="btn" data-new>+ New song</button>
      <button class="link-quiet" data-close>Close</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      const rows = modal.querySelector('[data-rows]') as HTMLElement

      async function refresh(): Promise<void> {
        let songs: ApiSong[]
        try {
          songs = await api.songs.list()
        } catch {
          rows.innerHTML = '<p style="text-align:center;font-weight:800;color:var(--ink-soft)">The family server is not reachable 📡</p>'
          return
        }
        rows.innerHTML = songs
          .map(
            (s) => `
          <div class="mgr-row">
            <span class="em">${s.emoji}</span>
            <span>${s.title}${s.isSeed ? ' <small style="color:var(--ink-soft)">built-in</small>' : ''}</span>
            <button class="icon-btn" data-edit="${s.id}" aria-label="Edit ${s.title}">✏️</button>
            <button class="icon-btn" data-del="${s.id}" aria-label="Delete ${s.title}">🗑️</button>
          </div>`,
          )
          .join('')

        rows.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) =>
          btn.addEventListener('click', () => {
            const song = songs.find((s) => s.id === btn.dataset.edit)!
            songEditor(song, () => void refresh())
          }),
        )
        rows.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((btn) =>
          btn.addEventListener('click', () => {
            const song = songs.find((s) => s.id === btn.dataset.del)!
            showModal({
              ariaLabel: 'Confirm delete',
              html: `
                <span class="modal-emoji">🫣</span>
                <h3>Delete “${song.title}”?</h3>
                <p>${song.isSeed ? 'This is a built-in song — it will be gone from the family songbook.' : 'Its family high scores go with it.'}</p>
                <button class="btn btn-pink" data-yes>Yes, delete</button>
                <button class="link-quiet" data-no>Keep it</button>
              `,
              onMount(m2, close2) {
                m2.querySelector('[data-no]')?.addEventListener('click', close2)
                m2.querySelector('[data-yes]')?.addEventListener('click', async () => {
                  try {
                    await api.songs.remove(song.id)
                    close2()
                    toast('Song deleted 💙')
                    void refresh()
                  } catch {
                    toast('Could not delete right now', 'pink')
                  }
                })
              },
            })
          }),
        )
      }

      modal.querySelector('[data-new]')?.addEventListener('click', () => songEditor(null, () => void refresh()))
      void refresh()
    },
  })
}

/* ============ Avatar manager (Grown-Ups Corner) ============ */

function avatarEditor(existing: ApiAvatar | null, onSaved: () => void): void {
  showModal({
    ariaLabel: existing ? 'Edit avatar' : 'New avatar',
    html: `
      <h3>${existing ? 'Edit avatar' : 'New avatar 😊'}</h3>
      <label class="field-label">Emoji</label>
      <input class="field" data-f-emoji maxlength="4" value="${existing?.emoji ?? ''}" placeholder="🐯">
      <label class="field-label">Name</label>
      <input class="field" data-f-name maxlength="30" value="${existing?.name ?? ''}" placeholder="Tiger">
      <button class="btn" data-save>${existing ? 'Save' : 'Add'} ✨</button>
      <button class="link-quiet" data-close>Cancel</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      modal.querySelector('[data-save]')?.addEventListener('click', async () => {
        const emoji = (modal.querySelector('[data-f-emoji]') as HTMLInputElement).value.trim()
        const name = (modal.querySelector('[data-f-name]') as HTMLInputElement).value.trim()
        try {
          if (existing) await api.avatars.update(existing.id, emoji, name)
          else await api.avatars.create(emoji, name)
          close()
          toast('Saved! ✨', 'gold')
          onSaved()
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not save', 'pink')
        }
      })
    },
  })
}

export function showAvatarManager(): void {
  showModal({
    ariaLabel: 'Manage avatars',
    className: 'modal-wide',
    html: `
      <h3>Avatars 😊</h3>
      <div data-rows><p style="text-align:center;font-weight:800;color:var(--ink-soft)">Loading…</p></div>
      <button class="btn" data-new>+ New avatar</button>
      <button class="link-quiet" data-close>Close</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      const rows = modal.querySelector('[data-rows]') as HTMLElement

      async function refresh(): Promise<void> {
        let avatars: ApiAvatar[]
        try {
          avatars = await api.avatars.list()
        } catch {
          rows.innerHTML = '<p style="text-align:center;font-weight:800;color:var(--ink-soft)">The family server is not reachable 📡</p>'
          return
        }
        rows.innerHTML = avatars
          .map(
            (a) => `
          <div class="mgr-row">
            <span class="em">${a.emoji}</span>
            <span>${a.name}</span>
            <button class="icon-btn" data-edit="${a.id}" aria-label="Edit ${a.name}">✏️</button>
            <button class="icon-btn" data-del="${a.id}" aria-label="Delete ${a.name}">🗑️</button>
          </div>`,
          )
          .join('')

        rows.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) =>
          btn.addEventListener('click', () => {
            const avatar = avatars.find((a) => a.id === btn.dataset.edit)!
            avatarEditor(avatar, () => void refresh())
          }),
        )
        rows.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((btn) =>
          btn.addEventListener('click', async () => {
            try {
              await api.avatars.remove(btn.dataset.del as string)
              toast('Avatar removed 💙')
              void refresh()
            } catch {
              toast('Could not delete right now', 'pink')
            }
          }),
        )
      }

      modal.querySelector('[data-new]')?.addEventListener('click', () => avatarEditor(null, () => void refresh()))
      void refresh()
    },
  })
}
