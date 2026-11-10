import type { Locator, Page } from '@playwright/test'
import { BasePage } from './base.page'

export class SingPage extends BasePage {
  /** Twinkle's headphone tip, shown before the first song of a visit (SG-L2-28). */
  static readonly HEADPHONE_TIP = 'Psst… headphones or a headset help me hear just you! 🎧'
  /** The coach bubble's usual line before the start. */
  static readonly READY_LINE = 'Take a big balloon breath… 🎈'

  readonly title: Locator
  readonly keyChip: Locator
  readonly turtleChip: Locator
  readonly stageLabel: Locator
  readonly singer: Locator
  readonly startButton: Locator
  readonly duetReadyButton: Locator
  readonly coach: Locator
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
    this.duetReadyButton = page.getByRole('button', { name: "I'm ready!" })
    this.coach = page.locator('[data-coach]')
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

  /**
   * For each of the stage's six lanes, the share of pixels painted in the lane
   * colour, sampled across the scene at the lane band and halfway between lanes.
   */
  async sceneLaneCoverage(): Promise<{ onLane: number[]; between: number[] }> {
    return this.reactiveScene.evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('scene is not a 2D canvas')
      const lane = [0xea, 0xf4, 0xfc]
      const row = canvas.height / 6
      const share = (y: number): number => {
        const data = ctx.getImageData(0, Math.floor(y), canvas.width, 1).data
        let hits = 0
        let total = 0
        for (let x = 0; x < canvas.width; x += Math.max(1, Math.floor(canvas.width / 40))) {
          const i = x * 4
          total++
          if (lane.every((c, k) => Math.abs(data[i + k] - c) <= 3)) hits++
        }
        return hits / total
      }
      const rows = [1, 2, 3, 4, 5, 6]
      return {
        onLane: rows.map((k) => share(k * row - (row * 1.5) / 50)),
        between: rows.map((k) => share(k * row - row / 2)),
      }
    })
  }

  /** A finished song redirects to #/results on its own; wait for that. */
  async waitForResults(timeout = 45_000): Promise<void> {
    await this.page.waitForURL(/#\/results$/, { timeout })
  }
}
