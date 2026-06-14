import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'

/** The hidden developer tuner at #/tuner. */
export class TunerPage extends BasePage {
  readonly heading: Locator
  readonly toggleButton: Locator
  readonly note: Locator
  readonly hz: Locator
  readonly clarity: Locator

  constructor(page: Page) {
    super(page, 'tuner')
    this.heading = page.getByRole('heading', { name: 'Tuner (dev)' })
    this.toggleButton = page.locator('[data-toggle]')
    this.note = page.locator('[data-note]')
    this.hz = page.locator('[data-hz]')
    this.clarity = page.locator('[data-clarity]')
  }
}
