(() => {
  document.documentElement.classList.add('reveal-ready')

  const header = document.querySelector('[data-header]')
  const menuButton = document.querySelector('[data-menu-button]')
  const menu = document.querySelector('[data-mobile-menu]')
  const mobileBreakpoint = window.matchMedia('(max-width: 980px)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const setHeaderState = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 12)
  }

  const closeMenu = () => {
    header?.classList.remove('is-open')
    document.body.classList.remove('menu-open')
    menuButton?.setAttribute('aria-expanded', 'false')
    menuButton?.setAttribute('aria-label', 'Open navigation')
    menu?.setAttribute('aria-hidden', 'true')
    if (menu instanceof HTMLElement) menu.inert = true
  }

  menuButton?.addEventListener('click', () => {
    const willOpen = !header?.classList.contains('is-open')
    header?.classList.toggle('is-open', willOpen)
    document.body.classList.toggle('menu-open', willOpen)
    menuButton.setAttribute('aria-expanded', String(willOpen))
    menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation')
    menu?.setAttribute('aria-hidden', String(!willOpen))
    if (menu instanceof HTMLElement) menu.inert = !willOpen
  })

  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu()
  })
  mobileBreakpoint.addEventListener('change', (event) => {
    if (!event.matches) closeMenu()
  })

  closeMenu()
  setHeaderState()
  window.addEventListener('scroll', setHeaderState, { passive: true })

  const revealItems = document.querySelectorAll('[data-reveal]')
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'))
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -9% 0px', threshold: 0.08 },
    )
    revealItems.forEach((item) => revealObserver.observe(item))
  }

  const tiltStage = document.querySelector('[data-tilt-stage]')
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  if (tiltStage && hasFinePointer && !reducedMotion) {
    tiltStage.addEventListener('pointermove', (event) => {
      const bounds = tiltStage.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 30
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 24
      tiltStage.style.setProperty('--pointer-x', `${x}px`)
      tiltStage.style.setProperty('--pointer-y', `${y}px`)
    })
    tiltStage.addEventListener('pointerleave', () => {
      tiltStage.style.setProperty('--pointer-x', '0px')
      tiltStage.style.setProperty('--pointer-y', '0px')
    })
  }

  const year = document.querySelector('[data-year]')
  if (year) year.textContent = String(new Date().getFullYear())
})()
