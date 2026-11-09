import { describe, expect, it } from 'vitest'
import { foldCents, MIN_HIT_MS, noteLanded, summarize, type NoteResult } from './scoring'
import { getSong } from '../songs/catalog'
import type { Song } from '../songs/types'

const twinkle = getSong('twinkle') as Song

function resultsFor(song: Song, fill: (r: NoteResult) => void): NoteResult[] {
  return song.phrases.flatMap((p, pi) =>
    p.notes.map((n, ni) => {
      const r: NoteResult = {
        phraseIdx: pi,
        noteIdx: ni,
        midi: n.midi,
        hitMs: 0,
        voicedMs: 0,
        totalMs: 0,
        firstHitFrac: null,
      }
      fill(r)
      r.voicedMs = r.totalMs // these fixtures sing through the whole note
      return r
    }),
  )
}

describe('foldCents (octave-forgiving pitch compare)', () => {
  it('treats the same pitch class in any octave as a match', () => {
    expect(foldCents(72, 60)).toBe(0) // C5 sung against C4 target
    expect(foldCents(48, 60)).toBe(0) // C3 sung against C4 target
  })
  it('measures semitone offsets in cents', () => {
    expect(foldCents(61, 60)).toBe(100)
    expect(foldCents(59, 60)).toBe(-100)
  })
  it('folds to the nearest pitch class direction', () => {
    expect(foldCents(67, 60)).toBe(-500) // a fifth up reads as a fourth down
  })
  it('handles fractional midis', () => {
    expect(foldCents(60.25, 60)).toBeCloseTo(25)
  })
})

describe('noteLanded (SR-L2-2)', () => {
  const base = { phraseIdx: 0, noteIdx: 0, midi: 60, firstHitFrac: 0 }
  it('does not hold silent time against the note', () => {
    // a late start, a consonant and an early release: heard for 330 of 600 ms
    expect(noteLanded({ ...base, hitMs: 300, voicedMs: 330, totalMs: 600 })).toBe(true)
  })
  it('lands when at least half the sung time matched', () => {
    expect(noteLanded({ ...base, hitMs: 100, voicedMs: 200, totalMs: 200 })).toBe(true)
    expect(noteLanded({ ...base, hitMs: 80, voicedMs: 200, totalMs: 200 })).toBe(false)
  })
  it('needs the on-pitch singing to cover a quarter of the note', () => {
    expect(noteLanded({ ...base, hitMs: 100, voicedMs: 100, totalMs: 600 })).toBe(false)
    expect(noteLanded({ ...base, hitMs: 150, voicedMs: 150, totalMs: 600 })).toBe(true)
  })
  it('needs at least 45 ms of on-pitch singing', () => {
    expect(MIN_HIT_MS).toBe(45)
    expect(noteLanded({ ...base, hitMs: 33, voicedMs: 33, totalMs: 33 })).toBe(false)
    expect(noteLanded({ ...base, hitMs: 50, voicedMs: 50, totalMs: 50 })).toBe(true)
  })
  it('gives the same verdict at 60 and at 30 frames a second', () => {
    // the same 67 ms of on-pitch singing in a 150 ms note: four 60 fps frames or two 30 fps frames
    const at60 = { ...base, hitMs: 4 * (1000 / 60), voicedMs: 4 * (1000 / 60), totalMs: 9 * (1000 / 60) }
    const at30 = { ...base, hitMs: 2 * (1000 / 30), voicedMs: 2 * (1000 / 30), totalMs: 4.5 * (1000 / 30) }
    expect(noteLanded(at60)).toBe(true)
    expect(noteLanded(at30)).toBe(true)
  })
  it('never lands a note nobody sang', () => {
    expect(noteLanded({ ...base, hitMs: 0, voicedMs: 0, totalMs: 500 })).toBe(false)
    expect(noteLanded({ ...base, hitMs: 0, voicedMs: 0, totalMs: 0 })).toBe(false)
  })
})

describe('summarize', () => {
  it('gives three stars and no tricky part for a perfect run', () => {
    const results = resultsFor(twinkle, (r) => {
      r.hitMs = 300
      r.totalMs = 300
      r.firstHitFrac = 0.1
    })
    const s = summarize(twinkle, results)
    expect(s.landed).toBe(s.total)
    expect(s.accuracy).toBe(1)
    expect(s.stars).toBe(3)
    expect(s.timingStars).toBe(3)
    expect(s.braveStars).toBe(3)
    expect(s.maxStreak).toBe(s.total)
    expect(s.trickyPhrase).toBeNull()
    expect(s.sparkles).toBe(s.total * 10)
  })

  it('points at the phrase that went worst as the tricky part', () => {
    const results = resultsFor(twinkle, (r) => {
      const miss = r.phraseIdx === 2 // "Up above the world so high"
      r.hitMs = miss ? 0 : 300
      r.totalMs = 300
      r.firstHitFrac = miss ? null : 0.1
    })
    const s = summarize(twinkle, results)
    expect(s.trickyPhrase).toBe(2)
    expect(s.trickyLyric).toBe('Up above the world so high')
    expect(s.stars).toBeLessThan(3)
  })

  it('drops braveness when the high notes are missed', () => {
    const results = resultsFor(twinkle, (r) => {
      const high = r.midi >= 67
      r.hitMs = high ? 0 : 300
      r.totalMs = 300
      r.firstHitFrac = high ? null : 0.1
    })
    const s = summarize(twinkle, results)
    expect(s.braveStars).toBe(1)
  })

  it('tracks the longest streak', () => {
    let i = 0
    const results = resultsFor(twinkle, (r) => {
      // miss every 5th note
      const miss = i++ % 5 === 4
      r.hitMs = miss ? 0 : 300
      r.totalMs = 300
    })
    const s = summarize(twinkle, results)
    expect(s.maxStreak).toBe(4)
  })
})
