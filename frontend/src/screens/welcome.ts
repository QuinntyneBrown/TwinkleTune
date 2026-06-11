import { store } from '../state/store'
import { mascotSVG, skyDecor } from '../ui/parts'
import { parentGate } from '../ui/modal'
import { showSettings } from '../ui/settings'

const AVATARS = ['🦄', '🐱', '🐸', '🦊']

export function renderWelcome(root: HTMLElement): void {
  const existing = store.get().profile
  const picked = existing?.avatar ?? AVATARS[0]

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen screen--center screen--nonav">
    ${mascotSVG('mascot mascot-lg pop')}
    <h1 class="logo rise d1"><span class="tw">Twinkle</span>Tune</h1>
    <p class="tagline rise d2">Sing your heart out! 🎤</p>

    <div class="hello-bubble rise d3">
      <div class="bubble bubble-left">Hi! I'm <strong>Twinkle</strong>, your singing buddy. What should I call you?</div>
    </div>

    <div class="card name-card rise d4">
      <label for="kid-name">My name is…</label>
      <input class="name-input" id="kid-name" type="text" maxlength="20"
             placeholder="Type your name" value="${existing?.name ?? ''}">
    </div>

    <p class="pick-label rise d5">Pick your singer! 🌟</p>
    <div class="avatars rise d5">
      ${AVATARS.map(
        (a) => `<button class="avatar-pick${a === picked ? ' picked' : ''}" data-avatar="${a}" aria-pressed="${a === picked}">${a}</button>`,
      ).join('')}
    </div>

    <div class="welcome-cta rise d6">
      <button class="btn btn-xl" data-go>Let's Sing! 🎤</button>
    </div>

    <p class="grownups rise d7"><button class="link-quiet" data-grownups>🔒 Grown-Ups Corner</button></p>
  </main>`

  let avatar = picked
  root.querySelectorAll<HTMLButtonElement>('.avatar-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.avatar-pick').forEach((b) => {
        b.classList.remove('picked')
        b.setAttribute('aria-pressed', 'false')
      })
      btn.classList.add('picked')
      btn.setAttribute('aria-pressed', 'true')
      avatar = btn.dataset.avatar as string
    })
  })

  root.querySelector('[data-go]')?.addEventListener('click', () => {
    const name = (root.querySelector('#kid-name') as HTMLInputElement).value.trim() || 'Superstar'
    const prev = store.get().profile
    store.update((s) => {
      s.profile = {
        name,
        avatar,
        range: prev?.range ?? null,
        latencyMs: prev?.latencyMs ?? 0,
      }
    })
    location.hash = store.get().profile?.range ? '#/home' : '#/voice'
  })

  root.querySelector('[data-grownups]')?.addEventListener('click', () => parentGate(showSettings))
}
