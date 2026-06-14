import './styles/twinkle.css'
import './styles/screens.css'

import { store } from './state/store'
import { renderWelcome } from './screens/welcome'
import { renderVoiceSetup } from './screens/voice-setup'
import { renderHome } from './screens/home'
import { renderSongs } from './screens/songs'
import { renderSing } from './screens/sing'
import { renderResults } from './screens/results'
import { renderTips } from './screens/tips'
import { renderMe } from './screens/me'
import { renderTuner } from './screens/tuner'
import { renderProfiles } from './screens/profiles'
import { renderDuet } from './screens/duet'

export type Cleanup = (() => void) | void
export type ScreenRenderer = (root: HTMLElement, params: URLSearchParams) => Cleanup

const routes: Record<string, ScreenRenderer> = {
  welcome: renderWelcome,
  voice: renderVoiceSetup,
  home: renderHome,
  songs: renderSongs,
  sing: renderSing,
  results: renderResults,
  tips: renderTips,
  me: renderMe,
  tuner: renderTuner,
  profiles: renderProfiles,
  duet: renderDuet,
}

const NO_PROFILE_OK = new Set(['welcome', 'tuner', 'profiles'])

const app = document.getElementById('app') as HTMLElement
let cleanup: Cleanup

function route(): void {
  if (typeof cleanup === 'function') cleanup()
  cleanup = undefined

  // "#/sing?song=twinkle&practice=2" -> name "sing", params {...}
  const hash = location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = hash.split('?')
  let name = path || (store.get().profile ? 'home' : 'welcome')
  if (!routes[name]) name = 'home'
  if (!NO_PROFILE_OK.has(name) && !store.get().profile) name = 'welcome'

  app.innerHTML = ''
  window.scrollTo(0, 0)
  cleanup = routes[name](app, new URLSearchParams(query))
}

window.addEventListener('hashchange', route)
route()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus, never an error */
    })
  })
}
