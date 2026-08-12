/** Modal + toast managers — every dialog in the app comes through here. */

export interface ModalHandle {
  el: HTMLElement
  close: () => void
}

interface ModalOptions {
  /** inner HTML of the .modal card */
  html: string
  /** called with the modal root so buttons can be wired up */
  onMount?: (modal: HTMLElement, close: () => void) => void
  /** clicking the dark backdrop closes the modal (default true) */
  dismissible?: boolean
  ariaLabel?: string
  /** extra classes on the .modal card (e.g. 'modal-wide' for managers) */
  className?: string
}

export function showModal(opts: ModalOptions): ModalHandle {
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.innerHTML = `<div class="modal${opts.className ? ` ${opts.className}` : ''}" role="dialog" aria-label="${opts.ariaLabel ?? 'Dialog'}">${opts.html}</div>`

  const close = () => overlay.remove()
  if (opts.dismissible !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
  }
  document.body.appendChild(overlay)
  const modal = overlay.querySelector('.modal') as HTMLElement
  opts.onMount?.(modal, close)
  return { el: modal, close }
}

let toastHost: HTMLElement | null = null

export function toast(message: string, variant: '' | 'gold' | 'pink' = '', ms = 2200): void {
  if (!toastHost || !document.body.contains(toastHost)) {
    toastHost = document.createElement('div')
    toastHost.className = 'toast-host'
    document.body.appendChild(toastHost)
  }
  const t = document.createElement('span')
  t.className = `toast${variant ? ` toast-${variant}` : ''}`
  t.textContent = message
  toastHost.appendChild(t)
  setTimeout(() => t.classList.add('bye'), ms)
  setTimeout(() => t.remove(), ms + 450)
}

/** Math-question gate so little fingers stay out of the Grown-Ups Corner. */
export function parentGate(onPass: () => void): void {
  const a = 2 + Math.floor(Math.random() * 7)
  const b = 2 + Math.floor(Math.random() * 7)
  const answer = a + b
  const options = [answer, answer - 1, answer + 2].sort(() => Math.random() - 0.5)

  showModal({
    ariaLabel: 'Grown-ups only',
    html: `
      <span class="modal-emoji" aria-hidden="true">🔒</span>
      <h3>For grown-ups only</h3>
      <p>To continue, answer:<br><strong style="color:var(--ink);font-size:18px">What is ${a} + ${b}?</strong></p>
      <div class="num-row">
        ${options.map((o) => `<button class="num" data-val="${o}">${o}</button>`).join('')}
      </div>
      <button class="link-quiet" data-close>Back to singing</button>
    `,
    onMount(modal, close) {
      modal.querySelector('[data-close]')?.addEventListener('click', close)
      modal.querySelectorAll<HTMLButtonElement>('.num').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (Number(btn.dataset.val) === answer) {
            close()
            onPass()
          } else {
            btn.classList.add('shake')
            setTimeout(() => btn.classList.remove('shake'), 700)
          }
        })
      })
    },
  })
}
