import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'
import { BottomNav } from './components/bottom-nav'

export class HomePage extends BasePage {
  readonly greeting: Locator
  readonly levelLine: Locator
  readonly streakChip: Locator
  readonly coachBubble: Locator
  readonly goalCard: Locator
  readonly goalRing: Locator
  readonly findVoiceCard: Locator
  readonly heroTile: Locator
  readonly warmUpsTile: Locator
  readonly mySongsTile: Locator
  readonly tipOfTheDay: Locator
  readonly nav: BottomNav

  constructor(page: Page) {
    super(page, 'home')
    this.greeting = page.locator('.hello h1')
    this.levelLine = page.locator('.hello-text p')
    this.streakChip = page.locator('.streak-chip-top')
    this.coachBubble = page.locator('.coach-home .bubble')
    this.goalCard = page.getByLabel("Today's goal")
    this.goalRing = this.goalCard.locator('.goal-ring b')
    this.findVoiceCard = page.getByRole('link', { name: 'Find my voice' })
    this.heroTile = page.getByRole('link', { name: 'Sing a Song' })
    this.warmUpsTile = page.getByRole('link', { name: 'Warm-Ups' })
    this.mySongsTile = page.getByRole('link', { name: 'My Songs' })
    this.tipOfTheDay = page.getByLabel('Tip of the day')
    this.nav = new BottomNav(page)
  }
}
