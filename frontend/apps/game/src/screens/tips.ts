import { store } from '../state/store'
import { mascotSVG, skyDecor, bottomNav } from '../ui/parts'
import { showModal, toast } from '../ui/modal'
import { HERO_TIP, TIPS, type Tip } from './tips-data'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'breathing', label: '🌬️ Breathing' },
  { id: 'brave', label: '💪 Brave Voice' },
  { id: 'warmup', label: '🎶 Warm-ups' },
  { id: 'show', label: '🎭 Show Time' },
]

function openTip(tip: Tip): void {
  showModal({
    ariaLabel: tip.title,
    html: `
      <span class="modal-emoji" aria-hidden="true">${tip.icon}</span>
      <h3>${tip.title}</h3>
      <ol class="tip-steps">
        ${tip.steps.map((s) => `<li>${s}</li>`).join('')}
      </ol>
      <button class="btn btn-gold" data-done>I did it! ✨</button>
      <button class="link-quiet" data-close>Maybe later</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      modal.querySelector('[data-done]')?.addEventListener('click', () => {
        store.update((s) => {
          s.sparkles += 5
        })
        toast('+5 sparkles ✨', 'gold')
        close()
      })
    },
  })
}

export function renderTips(root: HTMLElement): void {
  root.innerHTML = `
  ${skyDecor()}
  <main class="screen">
    <header class="topbar rise">
      <a class="icon-btn" href="#/home" aria-label="Go back">←</a>
      <h1 class="title">Twinkle's Tips 💡</h1>
      <span class="spacer"></span>
    </header>

    <div class="coach rise d1">
      ${mascotSVG('mascot mascot-sm')}
      <div class="bubble bubble-left">Every great singer started <strong>exactly</strong> where you are! 💙</div>
    </div>

    <section class="tip-hero rise d2" aria-label="Tip of the day">
      <span class="label">⭐ TWINKLE'S FAVOURITE</span>
      <h2>${HERO_TIP.title}</h2>
      <p>${HERO_TIP.short}</p>
      <button class="btn btn-sm" data-hero>Try it with me ▶</button>
      <span class="balloon" aria-hidden="true">${HERO_TIP.icon}</span>
    </section>

    <div class="chip-row rise d3" role="tablist" aria-label="Tip categories">
      ${CATEGORIES.map(
        (c, i) =>
          `<button class="chip${i === 0 ? ' active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${i === 0}">${c.label}</button>`,
      ).join('')}
    </div>

    <div data-tip-list>
      ${TIPS.map(
        (t, i) => `
        <button class="tip-card rise d${Math.min(i + 4, 8)}" data-tip="${t.id}" data-category="${t.category}">
          <span class="tip-ico ${t.iconCls}" aria-hidden="true">${t.icon}</span>
          <span class="tip-body">
            <strong>${t.title}</strong>
            <span>${t.short}</span>
          </span>
          <span class="tip-min">${t.mins}</span>
        </button>`,
      ).join('')}
    </div>

    <section class="quote rise d8" aria-label="Confidence corner">
      <span class="hearts" aria-hidden="true">💖</span>
      <p>“Your voice is one of a kind — that's your superpower.”</p>
      <small>— Twinkle</small>
    </section>
  </main>
  ${bottomNav('tips')}`

  root.querySelector('[data-hero]')?.addEventListener('click', () => openTip(HERO_TIP))

  root.querySelectorAll<HTMLButtonElement>('[data-tip]').forEach((card) => {
    card.addEventListener('click', () => {
      const tip = TIPS.find((t) => t.id === card.dataset.tip)
      if (tip) openTip(tip)
    })
  })

  root.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat
      root.querySelectorAll('[data-cat]').forEach((c) => {
        c.classList.toggle('active', c === chip)
        c.setAttribute('aria-selected', String(c === chip))
      })
      root.querySelectorAll<HTMLElement>('[data-tip]').forEach((card) => {
        card.style.display = cat === 'all' || card.dataset.category === cat ? '' : 'none'
      })
    })
  })
}
