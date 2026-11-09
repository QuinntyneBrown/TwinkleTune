import { describe, expect, it } from 'vitest'
import { songs } from '../songs/catalog'
import {
  NOISY_ROOM,
  REFERENCE_ROOM,
  REFERENCE_SINGER,
  simulateCatalogue,
  type CatalogueOutcome,
} from './synthetic-singer'

// Acceptance tests for SR-L2-18: synthesised singing goes through the shipped
// pitch detection, frame attribution, and landed decision for every bundled song.

const rate = (o: CatalogueOutcome) => o.landed / o.total
const shortRate = (o: CatalogueOutcome) => o.shortLanded / o.shortTotal
const SLOW = { timeout: 120_000 }

describe('SR-L2-18 — judging holds up to natural singing', () => {
  it('lands at least 90% of notes for an in-tune child singing on the beat', SLOW, () => {
    const outcome = simulateCatalogue(songs, REFERENCE_SINGER, REFERENCE_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('lands at least 90% of notes, and 60% of short notes, when she sings 180 ms behind the beat', SLOW, () => {
    const outcome = simulateCatalogue(songs, { ...REFERENCE_SINGER, lagMs: 180 }, REFERENCE_ROOM)
    expect(outcome.shortTotal).toBeGreaterThan(0)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
    expect(shortRate(outcome)).toBeGreaterThanOrEqual(0.6)
  })

  it('lands no more than 5% of notes for a child singing a semitone sharp', SLOW, () => {
    const outcome = simulateCatalogue(songs, { ...REFERENCE_SINGER, offsetCents: 100 }, REFERENCE_ROOM)
    expect(rate(outcome)).toBeLessThanOrEqual(0.05)
  })

  it('lands nothing when nobody sings in a noisy room', SLOW, () => {
    const outcome = simulateCatalogue(songs, { ...REFERENCE_SINGER, level: 0, breath: 0 }, NOISY_ROOM)
    expect(outcome.landed).toBe(0)
  })
})
