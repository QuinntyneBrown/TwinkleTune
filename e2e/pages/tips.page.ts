import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'
import { BottomNav } from './components/bottom-nav'

export class TipsPage extends BasePage {
  readonly heading: Locator
  readonly heroTryButton: Locator
  readonly tipCards: Locator
  readonly visibleTipCards: Locator
  readonly nav: BottomNav

  constructor(page: Page) {
    super(page, 'tips')
    this.heading = page.getByRole('heading', { name: "Twinkle's Tips" })
    this.heroTryButton = page.getByRole('button', { name: 'Try it with me' })
    this.tipCards = page.locator('button.tip-card')
    this.visibleTipCards = page.locator('button.tip-card:visible')
    this.nav = new BottomNav(page)
  }

  tipCard(title: string): Locator {
    return this.tipCards.filter({ hasText: title })
  }

  categoryChip(label: string): Locator {
    return this.page.getByRole('tab', { name: label })
  }

  tipDialog(title: string): Locator {
    return this.dialog(title)
  }

  didItButton(title: string): Locator {
    return this.tipDialog(title).getByRole('button', { name: 'I did it!' })
  }

  maybeLaterButton(title: string): Locator {
    return this.tipDialog(title).getByRole('button', { name: 'Maybe later' })
  }
}
