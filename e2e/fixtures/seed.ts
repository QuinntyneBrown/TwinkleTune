import type { Page } from '@playwright/test'

export const STORAGE_KEY = 'twinkletune:v1'

/** Local-date ISO string, matching the app's own todayISO(). */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface SongBestSeed {
  stars: number
  accuracy: number
  plays: number
}

export interface SummarySeed {
  songId: string
  songTitle: string
  landed: number
  total: number
  accuracy: number
  stars: number
  pitchStars: number
  timingStars: number
  braveStars: number
  maxStreak: number
  sparkles: number
  trickyPhrase: number | null
  trickyLyric: string | null
  noMic: boolean
}

export interface SeedOptions {
  name?: string
  avatar?: string
  /** Defaults to A3–G4 ({low: 57, high: 67}); pass null for "voice not set up yet". */
  range?: { low: number; high: number } | null
  latencyMs?: number
  sparkles?: number
  singDays?: string[]
  plays?: Record<string, number>
  bests?: Record<string, SongBestSeed>
  badges?: Record<string, string>
  lastResult?: SummarySeed | null
  lastSongId?: string | null
  lastNewBadges?: string[]
}

/**
 * The default voice range {57, 67} centers on 62, which makes
 * "Hot Cross Buns" (notes 60–64) need zero transposition — handy for
 * sing-flow tests that should skip the "tuned for you" dialog.
 */
export function buildState(o: SeedOptions = {}): Record<string, unknown> {
  return {
    profile: {
      name: o.name ?? 'Quinn',
      avatar: o.avatar ?? '🦄',
      range: o.range === undefined ? { low: 57, high: 67 } : o.range,
      latencyMs: o.latencyMs ?? 0,
    },
    sparkles: o.sparkles ?? 0,
    singDays: o.singDays ?? [],
    plays: o.plays ?? {},
    bests: o.bests ?? {},
    badges: o.badges ?? {},
    lastResult: o.lastResult ?? null,
    lastSongId: o.lastSongId ?? null,
    lastNewBadges: o.lastNewBadges ?? [],
  }
}

/** A completed-song summary as the app would store it; override what the test cares about. */
export function makeSummary(over: Partial<SummarySeed> = {}): SummarySeed {
  return {
    songId: 'twinkle',
    songTitle: 'Twinkle Twinkle Little Star',
    landed: 36,
    total: 42,
    accuracy: 36 / 42,
    stars: 3,
    pitchStars: 3,
    timingStars: 2,
    braveStars: 3,
    maxStreak: 12,
    sparkles: 360,
    trickyPhrase: null,
    trickyLyric: null,
    noMic: false,
    ...over,
  }
}

/** Pre-load app state into localStorage. Must run before the page navigates. */
export async function seedApp(page: Page, opts: SeedOptions = {}): Promise<void> {
  await page.addInitScript(
    (arg: { key: string; json: string }) => window.localStorage.setItem(arg.key, arg.json),
    { key: STORAGE_KEY, json: JSON.stringify(buildState(opts)) },
  )
}

/** Read the app state back out of localStorage for assertions. */
export function readState(page: Page): Promise<any> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'), STORAGE_KEY)
}
