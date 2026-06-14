import type { Locator, Page } from '@playwright/test'

export type NavTab = 'home' | 'songs' | 'tips' | 'me'

/** The persistent bottom navigation bar (Home / Songs / Tips / Me). */
export class BottomNav {
  readonly root: Locator

  constructor(page: Page) {
    this.root = page.locator('nav.bottomnav')
  }

  tab(tab: NavTab): Locator {
    return this.root.locator(`a[href="#/${tab}"]`)
  }

  activeTab(): Locator {
    return this.root.locator('.bn-item.active')
  }
}
