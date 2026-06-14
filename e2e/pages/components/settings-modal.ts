import type { Locator, Page } from '@playwright/test'

/** The Grown-Ups Corner settings modal (behind the parent gate). */
export class SettingsModal {
  readonly dialog: Locator
  readonly latencySlider: Locator
  readonly latencyLabel: Locator
  readonly redoVoiceLink: Locator
  readonly resetButton: Locator
  readonly closeButton: Locator
  readonly confirmDialog: Locator
  readonly eraseButton: Locator
  readonly keepButton: Locator

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Grown-ups corner' })
    this.latencySlider = this.dialog.locator('[data-latency]')
    this.latencyLabel = this.dialog.locator('[data-latency-label]')
    this.redoVoiceLink = this.dialog.getByRole('link', { name: 'Re-do' })
    this.resetButton = this.dialog.getByRole('button', { name: 'Start everything over' })
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' })
    this.confirmDialog = page.getByRole('dialog', { name: 'Confirm reset' })
    this.eraseButton = this.confirmDialog.getByRole('button', { name: 'Yes, erase everything' })
    this.keepButton = this.confirmDialog.getByRole('button', { name: 'Keep my stuff' })
  }

  /** Playwright's fill() refuses range inputs, so drive the slider via the DOM. */
  async setLatency(ms: number): Promise<void> {
    await this.latencySlider.evaluate((el, value) => {
      const input = el as HTMLInputElement
      input.value = String(value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, ms)
  }
}
