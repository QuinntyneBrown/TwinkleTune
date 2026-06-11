/** Shared visual fragments: mascot, sky decorations, bottom nav, star SVGs. */

export function mascotSVG(cls = 'mascot', happy = false): string {
  const mouth = happy
    ? '<path d="M48 64 Q60 80 72 64" fill="none" stroke="#2B5876" stroke-width="4" stroke-linecap="round"/>'
    : '<path d="M50 66 Q60 76 70 66" fill="none" stroke="#2B5876" stroke-width="4" stroke-linecap="round"/>'
  return `
  <svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 6 L75 42 L114 45 L84 71 L94 110 L60 89 L26 110 L36 71 L6 45 L45 42 Z"
          fill="#FFD66B" stroke="#E8B445" stroke-width="7" stroke-linejoin="round"/>
    <circle cx="48" cy="56" r="4.5" fill="#2B5876"/>
    <circle cx="72" cy="56" r="4.5" fill="#2B5876"/>
    <circle cx="41" cy="66" r="5.5" fill="#F4DBE3"/>
    <circle cx="79" cy="66" r="5.5" fill="#F4DBE3"/>
    ${mouth}
  </svg>`
}

export function starSVG(filled: boolean): string {
  const fill = filled ? '#FFD66B' : '#EAF3FA'
  const stroke = filled ? '#E8B445' : '#C6D9E8'
  return `
  <svg viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 6 L75 42 L114 45 L84 71 L94 110 L60 89 L26 110 L36 71 L6 45 L45 42 Z"
          fill="${fill}" stroke="${stroke}" stroke-width="7" stroke-linejoin="round"/>
  </svg>`
}

export function skyDecor(): string {
  return `
  <div class="sky" aria-hidden="true">
    <div class="cloud" style="width:150px;height:46px;top:9%;animation-duration:95s"></div>
    <div class="cloud" style="width:100px;height:32px;top:28%;animation-duration:78s;animation-delay:-30s;opacity:.6"></div>
    <div class="cloud" style="width:170px;height:52px;top:66%;animation-duration:110s;animation-delay:-60s;opacity:.5"></div>
    <span class="tstar" style="top:14%;left:10%">✦</span>
    <span class="tstar" style="top:11%;right:14%;animation-delay:.9s">✦</span>
    <span class="tstar" style="top:48%;left:5%;animation-delay:1.4s">✦</span>
    <span class="tstar" style="top:58%;right:7%;animation-delay:.4s">✦</span>
    <span class="fnote" style="top:32%;left:6%;animation-delay:.7s">🎵</span>
    <span class="fnote" style="top:40%;right:5%;animation-delay:1.8s">🎶</span>
  </div>`
}

export type NavTab = 'home' | 'songs' | 'tips' | 'me'

export function bottomNav(active: NavTab): string {
  const item = (tab: NavTab, href: string, ico: string, label: string) =>
    `<a class="bn-item${active === tab ? ' active' : ''}" href="${href}"><span class="ico">${ico}</span>${label}</a>`
  return `
  <nav class="bottomnav" aria-label="Main navigation">
    ${item('home', '#/home', '🏠', 'Home')}
    ${item('songs', '#/songs', '🎵', 'Songs')}
    ${item('tips', '#/tips', '💡', 'Tips')}
    ${item('me', '#/me', '⭐', 'Me')}
  </nav>`
}
