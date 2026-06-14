import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'
import { ParentGate } from './components/parent-gate'

export class WelcomePage extends BasePage {
  readonly logo: Locator
  readonly nameInput: Locator
  readonly letsSingButton: Locator
  readonly grownUpsButton: Locator
  readonly gate: ParentGate

  constructor(page: Page) {
    super(page, 'welcome')
    this.logo = page.locator('h1.logo')
    this.nameInput = page.getByLabel('My name is')
    this.letsSingButton = page.getByRole('button', { name: "Let's Sing!" })
    this.grownUpsButton = page.getByRole('button', { name: 'Grown-Ups Corner' })
    this.gate = new ParentGate(page)
  }

  avatar(emoji: string): Locator {
    return this.page.locator(`.avatar-pick[data-avatar="${emoji}"]`)
  }

  async completeOnboarding(name?: string, avatar?: string): Promise<void> {
    if (name !== undefined) await this.nameInput.fill(name)
    if (avatar !== undefined) await this.avatar(avatar).click()
    await this.letsSingButton.click()
  }
}
