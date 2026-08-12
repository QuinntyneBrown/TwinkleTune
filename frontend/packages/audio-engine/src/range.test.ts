import { describe, expect, it } from 'vitest'
import { computeShift, describeShift, midiToName, StablePitchCapture } from './range'
import type { Song } from './song'

// Fixture with the same span as "Twinkle Twinkle": C4 (60) to A4 (69), center 64.5.
const twinkle: Song = {
  id: 'fixture',
  title: 'Fixture',
  emoji: '⭐',
  art: 1,
  bpm: 100,
  difficulty: 1,
  phrases: [
    {
      lyric: 'la la',
      notes: [
        { midi: 60, start: 0, dur: 1, syll: 'la' },
        { midi: 69, start: 1, dur: 1, syll: 'la' },
      ],
    },
  ],
}

describe('midiToName', () => {
  it('names notes with octaves', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(69)).toBe('A4')
    expect(midiToName(48)).toBe('C3')
    expect(midiToName(61)).toBe('C#4')
  })
})

describe('computeShift', () => {
  it('returns 0 when no range is known', () => {
    expect(computeShift(twinkle, null)).toBe(0)
  })
  it('returns 0 when the song already sits centered in the voice', () => {
    // song center is 64.5; voice centered there too
    expect(computeShift(twinkle, { low: 57, high: 72 })).toBe(0)
  })
  it('moves the song down for a lower voice', () => {
    const shift = computeShift(twinkle, { low: 53, high: 64 })
    expect(shift).toBeLessThan(0)
    expect(shift).toBeGreaterThanOrEqual(-6)
  })
  it('clamps to ±6 semitones', () => {
    expect(computeShift(twinkle, { low: 84, high: 96 })).toBe(6)
    expect(computeShift(twinkle, { low: 36, high: 41 })).toBe(-6)
  })
})

describe('describeShift', () => {
  it('is kid-friendly', () => {
    expect(describeShift(0)).toMatch(/perfect fit/i)
    expect(describeShift(-3)).toMatch(/3 notes lower/)
    expect(describeShift(1)).toMatch(/1 note higher/)
  })
})

describe('StablePitchCapture', () => {
  it('locks onto a held note', () => {
    const cap = new StablePitchCapture(10, 1)
    let captured: number | null = null
    for (let i = 0; i < 10; i++) {
      captured = cap.feed(60 + (i % 2) * 0.1) // tiny wobble around C4
    }
    expect(captured).not.toBeNull()
    expect(Math.round(captured as number)).toBe(60)
  })

  it('does not lock while the pitch is sliding around', () => {
    const cap = new StablePitchCapture(10, 1)
    let captured: number | null = null
    for (let i = 0; i < 20; i++) {
      const got = cap.feed(55 + i * 0.5) // glissando, never stable
      if (got !== null) captured = got
    }
    expect(captured).toBeNull()
  })

  it('survives brief dropouts but resets on long silence', () => {
    const cap = new StablePitchCapture(10, 1)
    for (let i = 0; i < 5; i++) cap.feed(62)
    cap.feed(null) // tiny dropout, buffer kept
    expect(cap.progress()).toBeGreaterThan(0)
    for (let i = 0; i < 9; i++) cap.feed(null) // long silence resets
    expect(cap.progress()).toBe(0)
  })
})
