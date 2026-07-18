import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'

export class ResultsPage extends BasePage {
  readonly headline: Locator
  readonly songSubtitle: Locator
  readonly starsRow: Locator
  readonly filledStars: Locator
  readonly emptyStars: Locator
  readonly scoreCard: Locator
  readonly marks: Locator
  readonly badgeToasts: Locator
  readonly coachBubble: Locator
  readonly practiceButton: Locator
  readonly singAgainLink: Locator
  readonly newSongLink: Locator
  readonly homeLink: Locator
  readonly reactiveScene: Locator

  constructor(page: Page) {
    super(page, 'results')
    this.headline = page.locator('h1.whoop')
    this.songSubtitle = this.headline.locator('small')
    this.starsRow = page.locator('.stars-row')
    this.filledStars = page.locator('.stars-row .pop:not(.empty)')
    this.emptyStars = page.locator('.stars-row .pop.empty')
    this.scoreCard = page.locator('.score-card')
    this.marks = page.locator('.marks')
    this.badgeToasts = page.locator('.badge-toast')
    this.coachBubble = page.locator('.result-coach .bubble')
    this.practiceButton = page.getByRole('link', { name: 'Practice the tricky part' })
    this.singAgainLink = page.getByRole('link', { name: 'Sing again' })
    this.newSongLink = page.getByRole('link', { name: 'New song' })
    this.homeLink = page.getByRole('link', { name: 'Home' })
    this.reactiveScene = page.locator('[data-reactive-scene]')
  }
}
