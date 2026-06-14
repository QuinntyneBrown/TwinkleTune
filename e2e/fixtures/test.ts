import { test as base } from '@playwright/test'
import { FakeMic } from './fake-mic'
import { WelcomePage } from '../pages/welcome.page'
import { VoiceSetupPage } from '../pages/voice-setup.page'
import { HomePage } from '../pages/home.page'
import { SongsPage } from '../pages/songs.page'
import { SingPage } from '../pages/sing.page'
import { ResultsPage } from '../pages/results.page'
import { TipsPage } from '../pages/tips.page'
import { MePage } from '../pages/me.page'
import { TunerPage } from '../pages/tuner.page'

interface Fixtures {
  welcomePage: WelcomePage
  voiceSetupPage: VoiceSetupPage
  homePage: HomePage
  songsPage: SongsPage
  singPage: SingPage
  resultsPage: ResultsPage
  tipsPage: TipsPage
  mePage: MePage
  tunerPage: TunerPage
  fakeMic: FakeMic
}

export const test = base.extend<Fixtures>({
  welcomePage: async ({ page }, use) => use(new WelcomePage(page)),
  voiceSetupPage: async ({ page }, use) => use(new VoiceSetupPage(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  songsPage: async ({ page }, use) => use(new SongsPage(page)),
  singPage: async ({ page }, use) => use(new SingPage(page)),
  resultsPage: async ({ page }, use) => use(new ResultsPage(page)),
  tipsPage: async ({ page }, use) => use(new TipsPage(page)),
  mePage: async ({ page }, use) => use(new MePage(page)),
  tunerPage: async ({ page }, use) => use(new TunerPage(page)),
  fakeMic: async ({ page }, use) => use(new FakeMic(page)),
})

export { expect } from '@playwright/test'
