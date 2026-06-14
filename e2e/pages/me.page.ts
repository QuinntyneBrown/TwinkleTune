import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'
import { BottomNav } from './components/bottom-nav'
import { ParentGate } from './components/parent-gate'
import { SettingsModal } from './components/settings-modal'

export class MePage extends BasePage {
  readonly header: Locator
  readonly levelLine: Locator
  readonly gearButton: Locator
  readonly levelCard: Locator
  readonly weekCard: Locator
  readonly doneDays: Locator
  readonly badges: Locator
  readonly lockedBadges: Locator
  readonly masteredRows: Locator
  readonly growth: Locator
  readonly nav: BottomNav
  readonly gate: ParentGate
  readonly settings: SettingsModal

  constructor(page: Page) {
    super(page, 'me')
    this.header = page.locator('.me-head h1')
    this.levelLine = page.locator('.me-head p')
    this.gearButton = page.getByRole('button', { name: 'Grown-ups corner' })
    this.levelCard = page.getByLabel('Level progress')
    this.weekCard = page.getByLabel('Weekly singing streak')
    this.doneDays = this.weekCard.locator('.day.done')
    this.badges = page.locator('.badge')
    this.lockedBadges = page.locator('.badge.locked')
    this.masteredRows = page.locator('.mastered')
    this.growth = page.locator('.growth')
    this.nav = new BottomNav(page)
    this.gate = new ParentGate(page)
    this.settings = new SettingsModal(page)
  }

  badge(name: string): Locator {
    return this.badges.filter({ hasText: name })
  }

  async openSettings(): Promise<void> {
    await this.gearButton.click()
    await this.gate.solve()
  }
}
