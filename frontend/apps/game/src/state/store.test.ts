import { describe, expect, it } from 'vitest'
import { createStore, recordPlay, streakCount, type StorageLike } from './store'
import type { SongSummary } from './scoring'
import { getSong } from '../songs/catalog'
import type { Song } from '../songs/types'

const twinkle = getSong('twinkle') as Song

const fakeStorage = (): StorageLike => {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

const summary = (over: Partial<SongSummary> = {}): SongSummary => ({
  songId: 'twinkle',
  songTitle: 'Twinkle Twinkle Little Star',
  landed: 18,
  total: 20,
  accuracy: 0.9,
  stars: 3,
  pitchStars: 3,
  timingStars: 2,
  braveStars: 3,
  maxStreak: 12,
  sparkles: 180,
  trickyPhrase: null,
  trickyLyric: null,
  noMic: false,
  ...over,
})

describe('streakCount', () => {
  it('counts consecutive days ending today', () => {
    expect(streakCount(['2026-06-09', '2026-06-10', '2026-06-11'], '2026-06-11')).toBe(3)
  })
  it("doesn't lose the streak before today's song is sung", () => {
    expect(streakCount(['2026-06-09', '2026-06-10'], '2026-06-11')).toBe(2)
  })
  it('breaks on a gap', () => {
    expect(streakCount(['2026-06-07', '2026-06-08', '2026-06-10'], '2026-06-11')).toBe(1)
    expect(streakCount(['2026-06-05'], '2026-06-11')).toBe(0)
  })
  it('works across month boundaries', () => {
    expect(streakCount(['2026-05-30', '2026-05-31', '2026-06-01'], '2026-06-01')).toBe(3)
  })
})

describe('recordPlay', () => {
  it('accumulates sparkles, bests, days and badges', () => {
    const store = createStore(fakeStorage())
    const fresh = recordPlay(store, twinkle, summary(), '2026-06-11')

    const s = store.get()
    expect(s.sparkles).toBe(180)
    expect(s.singDays).toEqual(['2026-06-11'])
    expect(s.plays['2026-06-11']).toBe(1)
    expect(s.bests['twinkle']).toMatchObject({ stars: 3, plays: 1 })
    expect(fresh).toContain('first-song')
    expect(fresh).toContain('show-stopper') // 3 stars
    expect(fresh).toContain('perfect-ten') // 12-note streak
    expect(s.lastNewBadges).toEqual(fresh)
    expect(s.lastResult?.songId).toBe('twinkle')
  })

  it('keeps the best score and does not re-award badges', () => {
    const store = createStore(fakeStorage())
    recordPlay(store, twinkle, summary(), '2026-06-11')
    const second = recordPlay(store, twinkle, summary({ stars: 1, accuracy: 0.4, maxStreak: 2, sparkles: 40 }), '2026-06-11')

    const s = store.get()
    expect(s.bests['twinkle'].stars).toBe(3) // best kept
    expect(s.bests['twinkle'].plays).toBe(2)
    expect(s.sparkles).toBe(220)
    expect(second).not.toContain('first-song')
    expect(second).not.toContain('show-stopper')
  })

  it('awards the 3-day streak badge on the third day', () => {
    const store = createStore(fakeStorage())
    recordPlay(store, twinkle, summary({ stars: 1, maxStreak: 1 }), '2026-06-09')
    recordPlay(store, twinkle, summary({ stars: 1, maxStreak: 1 }), '2026-06-10')
    const third = recordPlay(store, twinkle, summary({ stars: 1, maxStreak: 1 }), '2026-06-11')
    expect(third).toContain('streak-3')
  })

  it('persists through the storage layer', () => {
    const storage = fakeStorage()
    const store = createStore(storage)
    recordPlay(store, twinkle, summary(), '2026-06-11')
    const reloaded = createStore(storage)
    expect(reloaded.get().sparkles).toBe(180)
  })

  it('no-mic runs count the day but never the score', () => {
    const store = createStore(fakeStorage())
    recordPlay(store, twinkle, summary({ noMic: true, sparkles: 0 }), '2026-06-11')
    const s = store.get()
    expect(s.singDays).toEqual(['2026-06-11'])
    expect(s.bests['twinkle'].stars).toBe(0)
  })
})
