import type { Locator, Page } from '@playwright/test'

/** Shared behavior for all screens of the hash-routed app. */
export abstract class BasePage {
  protected constructor(
    readonly page: Page,
    private readonly path: string,
  ) {}

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/#/${this.path}${query}`)
  }

  /** A transient toast message (bottom of the screen). */
  toast(text: string | RegExp): Locator {
    return this.page.locator('.toast').filter({ hasText: text })
  }

  /** A modal dialog by its accessible name. */
  dialog(name: string): Locator {
    return this.page.getByRole('dialog', { name })
  }
}
