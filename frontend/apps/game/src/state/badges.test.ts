import { describe, expect, it } from 'vitest'
import { evaluateBadges, BADGES } from './badges'
import type { SongSummary } from './scoring'

const summary = (over: Partial<SongSummary> = {}): SongSummary => ({
  songId: 'twinkle',
  songTitle: 'Twinkle Twinkle Little Star',
  landed: 10,
  total: 20,
  accuracy: 0.5,
  stars: 1,
  pitchStars: 1,
  timingStars: 1,
  braveStars: 1,
  maxStreak: 3,
  sparkles: 100,
  trickyPhrase: null,
  trickyLyric: null,
  noMic: false,
  ...over,
})

const ctx = (over: Partial<Parameters<typeof evaluateBadges>[0]> = {}) => ({
  totalPlays: 1,
  streak: 1,
  summary: summary(),
  songDifficulty: 1 as const,
  earned: new Set<string>(),
  ...over,
})

describe('evaluateBadges', () => {
  it('awards first-song on the first play', () => {
    expect(evaluateBadges(ctx())).toContain('first-song')
  })

  it('never re-awards earned badges', () => {
    expect(evaluateBadges(ctx({ earned: new Set(['first-song']) }))).not.toContain('first-song')
  })

  it('awards streak-3 at a three-day streak', () => {
    expect(evaluateBadges(ctx({ streak: 3 }))).toContain('streak-3')
    expect(evaluateBadges(ctx({ streak: 2 }))).not.toContain('streak-3')
  })

  it('awards show-stopper for three stars', () => {
    expect(evaluateBadges(ctx({ summary: summary({ stars: 3, accuracy: 0.9 }) }))).toContain('show-stopper')
  })

  it('awards high-note-hero for brave high notes', () => {
    expect(
      evaluateBadges(ctx({ summary: summary({ braveStars: 3, accuracy: 0.7 }) })),
    ).toContain('high-note-hero')
  })

  it('awards brave-bird for finishing a difficulty-3 song', () => {
    expect(evaluateBadges(ctx({ songDifficulty: 3 }))).toContain('brave-bird')
  })

  it('awards perfect-ten for a 10-note streak', () => {
    expect(evaluateBadges(ctx({ summary: summary({ maxStreak: 10 }) }))).toContain('perfect-ten')
  })

  it('gives no scored badges on a no-mic fun run', () => {
    const fresh = evaluateBadges(
      ctx({ summary: summary({ noMic: true, stars: 3, maxStreak: 10, braveStars: 3 }) }),
    )
    expect(fresh).not.toContain('show-stopper')
    expect(fresh).not.toContain('perfect-ten')
    expect(fresh).not.toContain('high-note-hero')
    expect(fresh).toContain('first-song') // playing still counts
  })

  it('only contains known badge ids', () => {
    const all = evaluateBadges(
      ctx({ streak: 5, songDifficulty: 3, summary: summary({ stars: 3, maxStreak: 12, braveStars: 3, accuracy: 0.95 }) }),
    )
    const known = new Set(BADGES.map((b) => b.id))
    for (const id of all) expect(known.has(id)).toBe(true)
  })
})
