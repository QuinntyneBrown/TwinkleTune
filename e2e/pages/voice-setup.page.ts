import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'

export class VoiceSetupPage extends BasePage {
  readonly title: Locator
  readonly readyButton: Locator
  readonly bubble: Locator
  readonly listenMsg: Locator
  readonly capturedRungs: Locator
  readonly laterLink: Locator
  readonly backLink: Locator
  readonly voiceFoundDialog: Locator
  readonly toMySongsButton: Locator
  readonly voiceFoundHomeButton: Locator
  readonly micDeniedDialog: Locator
  readonly tryAgainButton: Locator
  readonly doLaterButton: Locator

  constructor(page: Page) {
    super(page, 'voice')
    this.title = page.getByRole('heading', { name: 'Find My Voice' })
    this.readyButton = page.getByRole('button', { name: "I'm ready" })
    this.bubble = page.locator('[data-bubble]')
    this.listenMsg = page.locator('[data-listen-msg]')
    this.capturedRungs = page.locator('.rung.captured')
    this.laterLink = page.getByRole('link', { name: 'Later' })
    this.backLink = page.getByRole('link', { name: 'Go back' })
    this.voiceFoundDialog = this.dialog('Voice found')
    this.toMySongsButton = this.voiceFoundDialog.getByRole('button', { name: 'To my songs' })
    this.voiceFoundHomeButton = this.voiceFoundDialog.getByRole('button', { name: 'Home' })
    this.micDeniedDialog = this.dialog('Microphone needed')
    this.tryAgainButton = this.micDeniedDialog.getByRole('button', { name: 'Try again' })
    this.doLaterButton = this.micDeniedDialog.getByRole('button', { name: 'Do this later' })
  }
}
