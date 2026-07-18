import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'

export class SingPage extends BasePage {
  readonly title: Locator
  readonly keyChip: Locator
  readonly turtleChip: Locator
  readonly stageLabel: Locator
  readonly singer: Locator
  readonly startButton: Locator
  readonly pauseButton: Locator
  readonly countdown: Locator
  readonly progressFill: Locator
  readonly sparklesPill: Locator
  readonly streakChip: Locator
  readonly nowLyric: Locator
  readonly micDialog: Locator
  readonly singForFunButton: Locator
  readonly yesSingButton: Locator
  readonly backToSongsButton: Locator
  readonly tunedDialog: Locator
  readonly tunedGoButton: Locator
  readonly pausedDialog: Locator
  readonly resumeButton: Locator
  readonly restartButton: Locator
  readonly pickAnotherButton: Locator
  readonly reactiveScene: Locator

  constructor(page: Page) {
    super(page, 'sing')
    this.title = page.locator('.sing-title strong')
    this.keyChip = page.locator('.key-chip').first()
    this.turtleChip = page.locator('.key-chip', { hasText: '🐢' })
    this.stageLabel = page.locator('[data-stage-label]')
    this.singer = page.locator('[data-singer]')
    this.startButton = page.getByRole('button', { name: 'Tap to start' })
    this.pauseButton = page.getByRole('button', { name: 'Pause' })
    this.countdown = page.locator('[data-countdown]')
    this.progressFill = page.locator('[data-progress]')
    this.sparklesPill = page.locator('[data-sparkles]')
    this.streakChip = page.locator('[data-streak]')
    this.nowLyric = page.locator('[data-now]')
    this.micDialog = this.dialog('Microphone needed')
    this.singForFunButton = this.micDialog.getByRole('button', { name: 'Sing just for fun' })
    this.yesSingButton = this.micDialog.getByRole('button', { name: "Yes, let's sing!" })
    this.backToSongsButton = this.micDialog.getByRole('button', { name: 'Back to songs' })
    this.tunedDialog = this.dialog('Song tuned for you')
    this.tunedGoButton = this.tunedDialog.getByRole('button', { name: "Cool, let's go!" })
    this.pausedDialog = this.dialog('Paused')
    this.resumeButton = this.pausedDialog.getByRole('button', { name: 'Keep singing' })
    this.restartButton = this.pausedDialog.getByRole('button', { name: 'Start over' })
    this.pickAnotherButton = this.pausedDialog.getByRole('button', { name: 'Pick another song' })
    this.reactiveScene = page.locator('[data-reactive-scene]')
  }

  async open(songId: string, extra = ''): Promise<void> {
    await this.goto(`?song=${songId}${extra}`)
  }

  /** A finished song redirects to #/results on its own; wait for that. */
  async waitForResults(timeout = 45_000): Promise<void> {
    await this.page.waitForURL(/#\/results$/, { timeout })
  }
}
