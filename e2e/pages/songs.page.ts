import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'
import { BottomNav } from './components/bottom-nav'

export class SongsPage extends BasePage {
  readonly heading: Locator
  readonly cards: Locator
  readonly visibleCards: Locator
  readonly againCard: Locator
  readonly inKeyBadges: Locator
  readonly findVoiceCtas: Locator
  readonly nav: BottomNav

  constructor(page: Page) {
    super(page, 'songs')
    this.heading = page.getByRole('heading', { name: 'Pick a Song' })
    this.cards = page.locator('article.song')
    this.visibleCards = page.locator('article.song:visible')
    this.againCard = page.getByLabel('Sing it again')
    this.inKeyBadges = page.getByText('✓ In your key')
    this.findVoiceCtas = page.getByRole('link', { name: 'Find my voice →' })
    this.nav = new BottomNav(page)
  }

  card(title: string): Locator {
    return this.cards.filter({ hasText: title })
  }

  filterChip(label: string): Locator {
    return this.page.getByRole('tab', { name: label })
  }

  playButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Sing ${title}`, exact: true })
  }

  againPlayButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Sing ${title} again`, exact: true })
  }
}
