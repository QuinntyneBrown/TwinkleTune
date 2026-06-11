import { store } from '../state/store'
import { midiToName } from '../audio/range'
import { showModal } from './modal'

/** The Grown-Ups Corner — reached only through the parent gate. */
export function showSettings(): void {
  const s = store.get()
  const profile = s.profile
  const rangeLabel = profile?.range
    ? `${midiToName(profile.range.low)} – ${midiToName(profile.range.high)}`
    : 'not set yet'

  showModal({
    ariaLabel: 'Grown-ups corner',
    html: `
      <span class="modal-emoji" aria-hidden="true">🧑‍🤝‍🧒</span>
      <h3>Grown-Ups Corner</h3>
      <p>All of ${profile?.name ?? 'your singer'}'s data stays on this device — nothing is uploaded. 💙</p>

      <div class="setting-row">
        <span>Mic timing offset<br><small style="color:var(--ink-soft)">If cheers feel late, nudge this</small></span>
        <input type="range" min="-300" max="300" step="10" value="${profile?.latencyMs ?? 0}" data-latency>
        <b data-latency-label>${profile?.latencyMs ?? 0} ms</b>
      </div>
      <div class="setting-row">
        <span>Voice range<br><small style="color:var(--ink-soft)">${rangeLabel}</small></span>
        <a class="btn btn-sm" style="width:auto;margin:0" href="#/voice" data-close-link>Re-do</a>
      </div>

      <button class="btn btn-pink" data-reset>Start everything over 🗑️</button>
      <button class="link-quiet" data-close>Close</button>
    `,
    onMount(modal, close) {
      const slider = modal.querySelector('[data-latency]') as HTMLInputElement
      const label = modal.querySelector('[data-latency-label]') as HTMLElement
      slider.addEventListener('input', () => {
        label.textContent = `${slider.value} ms`
        store.update((st) => {
          if (st.profile) st.profile.latencyMs = Number(slider.value)
        })
      })
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      modal.querySelector('[data-close-link]')?.addEventListener('click', close)
      modal.querySelector('[data-reset]')?.addEventListener('click', () => {
        close()
        showModal({
          ariaLabel: 'Confirm reset',
          html: `
            <span class="modal-emoji">🫣</span>
            <h3>Really start over?</h3>
            <p>This erases the profile, sparkles, badges and voice range on this device.</p>
            <button class="btn btn-pink" data-yes>Yes, erase everything</button>
            <button class="link-quiet" data-no>Keep my stuff</button>
          `,
          onMount(m2, close2) {
            m2.querySelector('[data-no]')?.addEventListener('click', close2)
            m2.querySelector('[data-yes]')?.addEventListener('click', () => {
              store.reset()
              close2()
              location.hash = '#/welcome'
            })
          },
        })
      })
    },
  })
}
