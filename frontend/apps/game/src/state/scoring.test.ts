import { describe, expect, it } from 'vitest'
import { foldCents, noteLanded, summarize, type NoteResult } from './scoring'
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
        hitFrames: 0,
        totalFrames: 0,
        firstHitFrac: null,
      }
      fill(r)
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

describe('noteLanded', () => {
  const base = { phraseIdx: 0, noteIdx: 0, midi: 60, firstHitFrac: 0 }
  it('lands when at least half the frames matched', () => {
    expect(noteLanded({ ...base, hitFrames: 5, totalFrames: 10 })).toBe(true)
    expect(noteLanded({ ...base, hitFrames: 4, totalFrames: 10 })).toBe(false)
  })
  it('needs a minimum number of observed frames', () => {
    expect(noteLanded({ ...base, hitFrames: 2, totalFrames: 2 })).toBe(false)
  })
})

describe('summarize', () => {
  it('gives three stars and no tricky part for a perfect run', () => {
    const results = resultsFor(twinkle, (r) => {
      r.hitFrames = 10
      r.totalFrames = 10
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
      r.hitFrames = miss ? 0 : 10
      r.totalFrames = 10
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
      r.hitFrames = high ? 0 : 10
      r.totalFrames = 10
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
      r.hitFrames = miss ? 0 : 10
      r.totalFrames = 10
    })
    const s = summarize(twinkle, results)
    expect(s.maxStreak).toBe(4)
  })
})
