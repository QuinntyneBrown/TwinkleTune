import { api, type ApiAvatar, type ApiSinger } from '../api/client'
import { activateSinger } from '../state/profile'
import { getActiveSingerId, store } from '../state/store'
import { mascotSVG, skyDecor } from '../ui/parts'
import { parentGate, showModal, toast } from '../ui/modal'

function singerAvatarHTML(s: ApiSinger): string {
  return s.hasPhoto
    ? `<div class="avatar avatar-lg"><img class="avatar-photo" src="${api.singers.photoUrl(s.id)}?t=${Date.now()}" alt=""></div>`
    : `<div class="avatar avatar-lg">${s.avatarEmoji ?? '🎤'}</div>`
}

/** Create/edit dialog shared by "+ New singer" and the ✏️ button. */
function singerDialog(existing: ApiSinger | null, avatars: ApiAvatar[], onSaved: () => void): void {
  let avatarId = existing?.avatarId ?? avatars[0]?.id ?? null

  showModal({
    ariaLabel: existing ? 'Edit singer' : 'New singer',
    html: `
      <h3>${existing ? `Edit ${existing.name}` : 'Who else sings? 🌟'}</h3>
      <div class="name-card" style="max-width:none;margin-top:10px">
        <label for="singer-name">Name</label>
        <input class="name-input" id="singer-name" maxlength="20" placeholder="Type the name"
               value="${existing?.name ?? ''}">
      </div>
      <p class="pick-label" style="margin:16px 0 10px">Pick an avatar</p>
      <div class="avatars" style="flex-wrap:wrap" data-avatar-row>
        ${avatars
          .map(
            (a) =>
              `<button class="avatar-pick${a.id === avatarId ? ' picked' : ''}" data-avatar-id="${a.id}" title="${a.name}">${a.emoji}</button>`,
          )
          .join('')}
      </div>
      <p class="pick-label" style="margin:16px 0 6px">…or use a photo 📸</p>
      <input type="file" accept="image/jpeg,image/png,image/webp" data-photo
             style="font-weight:700;max-width:100%">
      <button class="btn" data-save>${existing ? 'Save changes' : 'Add singer ⭐'}</button>
      ${existing ? '<button class="btn btn-pink" data-delete>Remove singer 🗑️</button>' : ''}
      <button class="link-quiet" data-close>Cancel</button>
    `,
    onMount(modal, close) {
      modal.querySelectorAll<HTMLButtonElement>('[data-avatar-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('[data-avatar-id]').forEach((b) => b.classList.remove('picked'))
          btn.classList.add('picked')
          avatarId = btn.dataset.avatarId as string
        })
      })
      modal.querySelector('[data-close]')?.addEventListener('click', close)

      modal.querySelector('[data-save]')?.addEventListener('click', async () => {
        const name = (modal.querySelector('#singer-name') as HTMLInputElement).value.trim()
        if (!name) {
          toast('Every singer needs a name! 💙', 'pink')
          return
        }
        try {
          const body = {
            name,
            avatarId,
            rangeLow: existing?.rangeLow ?? null,
            rangeHigh: existing?.rangeHigh ?? null,
          }
          const singer = existing
            ? await api.singers.update(existing.id, body)
            : await api.singers.create(body)

          const photoInput = modal.querySelector('[data-photo]') as HTMLInputElement
          const file = photoInput.files?.[0]
          if (file) await api.singers.uploadPhoto(singer.id, file)

          close()
          toast(existing ? 'Saved! ✨' : `Welcome, ${name}! 🎉`, 'gold')
          onSaved()
        } catch (e) {
          toast(e instanceof Error ? e.message : 'The family server had a hiccup 💙', 'pink')
        }
      })

      modal.querySelector('[data-delete]')?.addEventListener('click', () => {
        close()
        parentGate(() => {
          showModal({
            ariaLabel: 'Confirm remove',
            html: `
              <span class="modal-emoji">🫣</span>
              <h3>Remove ${existing!.name}?</h3>
              <p>Their family high scores will be removed too. This device's badges stay until "start over".</p>
              <button class="btn btn-pink" data-yes>Yes, remove</button>
              <button class="link-quiet" data-no>Keep them</button>
            `,
            onMount(m2, close2) {
              m2.querySelector('[data-no]')?.addEventListener('click', close2)
              m2.querySelector('[data-yes]')?.addEventListener('click', async () => {
                try {
                  await api.singers.remove(existing!.id)
                  close2()
                  toast('Removed 💙')
                  onSaved()
                } catch {
                  toast('Could not remove right now', 'pink')
                }
              })
            },
          })
        })
      })
    },
  })
}

export function renderProfiles(root: HTMLElement): void {
  root.innerHTML = `
  ${skyDecor()}
  <main class="screen screen--nonav">
    <header class="topbar rise">
      <a class="icon-btn" href="#/home" aria-label="Go back">←</a>
      <h1 class="title">Who's singing? 🎤</h1>
      <span class="spacer"></span>
    </header>
    <div class="coach rise d1">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left">Tap your card and the whole app becomes <strong>yours</strong> — your songs, your key, your sparkles!</div>
    </div>
    <div data-list><p style="text-align:center;font-weight:800;color:var(--ink-soft)">Looking for the family… ☁️</p></div>
  </main>`

  const list = root.querySelector('[data-list]') as HTMLElement

  async function refresh(): Promise<void> {
    let singers: ApiSinger[]
    let avatars: ApiAvatar[]
    try {
      ;[singers, avatars] = await Promise.all([api.singers.list(), api.avatars.list()])
    } catch {
      list.innerHTML = `
        <div class="new-songs" style="margin-top:10px">
          <span class="ico">📡</span>
          The family server isn't reachable right now.<br>
          You can keep singing with the profile on this device!
          <div style="margin-top:14px"><a class="btn btn-sm" href="#/home">Keep singing solo ▶</a></div>
        </div>`
      return
    }

    const activeId = getActiveSingerId()
    list.innerHTML = `
      <div class="profile-grid">
        ${singers
          .map(
            (s, i) => `
          <div class="profile-card rise d${Math.min(i + 2, 8)}${s.id === activeId ? ' active' : ''}">
            <button class="profile-edit icon-btn" data-edit="${s.id}" aria-label="Edit ${s.name}">✏️</button>
            ${singerAvatarHTML(s)}
            <strong>${s.name}</strong>
            ${s.id === activeId ? '<span class="profile-tag">SINGING NOW ⭐</span>' : ''}
            <button class="btn btn-sm" data-pick="${s.id}">${s.id === activeId ? "That's me!" : 'Sing as me! 🎤'}</button>
          </div>`,
          )
          .join('')}
        <button class="profile-card profile-new rise d${Math.min(singers.length + 2, 8)}" data-new>
          <span style="font-size:44px">➕</span>
          <strong>New singer</strong>
        </button>
      </div>`

    list.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const singer = singers.find((s) => s.id === btn.dataset.pick)!
        activateSinger(singer)
        toast(`Hi, ${singer.name}! 👋`, 'gold')
        location.hash = store.get().profile?.range ? '#/home' : '#/voice'
      })
    })
    list.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const singer = singers.find((s) => s.id === btn.dataset.edit)!
        singerDialog(singer, avatars, () => void refresh())
      })
    })
    list.querySelector('[data-new]')?.addEventListener('click', () => {
      singerDialog(null, avatars, () => void refresh())
    })
  }

  void refresh()
}
