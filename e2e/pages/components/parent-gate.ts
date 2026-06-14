import type { Locator, Page } from '@playwright/test'

/** The "For grown-ups only" math-question gate. */
export class ParentGate {
  readonly dialog: Locator

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Grown-ups only' })
  }

  private async readAnswer(): Promise<number> {
    const question = await this.dialog.locator('p strong').innerText()
    const m = question.match(/(\d+)\s*\+\s*(\d+)/)
    if (!m) throw new Error(`Could not parse parent-gate question: "${question}"`)
    return Number(m[1]) + Number(m[2])
  }

  async solve(): Promise<void> {
    const answer = await this.readAnswer()
    await this.dialog.locator(`button.num[data-val="${answer}"]`).click()
  }

  async answerWrong(): Promise<void> {
    const answer = await this.readAnswer()
    const buttons = this.dialog.locator('button.num')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      if (Number(await buttons.nth(i).getAttribute('data-val')) !== answer) {
        await buttons.nth(i).click()
        return
      }
    }
    throw new Error('Parent gate offered no wrong option')
  }
}
