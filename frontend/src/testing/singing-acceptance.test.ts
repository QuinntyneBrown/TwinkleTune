// Acceptance Test
// Traces to: SR-L2-18, SR-L2-19, SG-L2-19, AE-L2-20
// Description: A synthesised singer goes through the real pitch detection and note judging for every bundled song

import { describe, expect, it } from 'vitest'
import { songs } from '../songs/catalog'
import {
  BLUETOOTH_ROOM,
  NOISY_ROOM,
  REFERENCE_ROOM,
  REFERENCE_SINGER,
  simulateCatalogue,
  type CatalogueOutcome,
  type Room,
  type SimulationOptions,
} from './synthetic-singer'

// Acceptance tests for SR-L2-18: synthesised singing goes through the shipped
// pitch detection, frame attribution, and landed decision for every bundled song.

const rate = (o: CatalogueOutcome) => o.landed / o.total
const shortRate = (o: CatalogueOutcome) => o.shortLanded / o.shortTotal
const earlyRate = (o: CatalogueOutcome) => o.hitEarly / o.hit
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

// Acceptance tests for SR-L2-19: a slow or stuttering device must not hear less of the voice.
describe('SR-L2-19 — judging does not depend on the frame rate', () => {
  const SHARP = { ...REFERENCE_SINGER, offsetCents: 100 }
  const STUTTER: SimulationOptions = { fps: 60, stutter: 0.2 } // one frame in five arrives late

  for (const fps of [30, 20, 15]) {
    it(`lands at least 95% of notes, and 90% of short notes, at ${fps} frames per second`, SLOW, () => {
      const outcome = simulateCatalogue(songs, REFERENCE_SINGER, REFERENCE_ROOM, { fps })
      expect(rate(outcome)).toBeGreaterThanOrEqual(0.95)
      expect(shortRate(outcome)).toBeGreaterThanOrEqual(0.9)
    })
  }

  it('lands at least 95% of notes, and 90% of short notes, when one frame in five arrives late', SLOW, () => {
    const outcome = simulateCatalogue(songs, REFERENCE_SINGER, REFERENCE_ROOM, STUTTER)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.95)
    expect(shortRate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('still lands no more than 5% of notes for a singer a semitone sharp', SLOW, () => {
    for (const pacing of [{ fps: 30 }, { fps: 20 }, { fps: 15 }, STUTTER]) {
      const outcome = simulateCatalogue(songs, SHARP, REFERENCE_ROOM, pacing)
      expect(rate(outcome)).toBeLessThanOrEqual(0.05)
    }
  })
})

// Acceptance test for SG-L2-19: the music comes from a wireless speaker, so the
// child hears (and sings) a quarter of a second behind the playback clock.
describe('SG-L2-19 — latency compensation', () => {
  it('scores a child singing along to a 250 ms-delayed speaker as in time', SLOW, () => {
    const outcome = simulateCatalogue(songs, REFERENCE_SINGER, BLUETOOTH_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.95)
    expect(shortRate(outcome)).toBeGreaterThanOrEqual(0.85)
    expect(earlyRate(outcome)).toBeGreaterThanOrEqual(0.85)
  })
})

// Acceptance tests for AE-L2-20: the ordinary interference of a home.
describe('AE-L2-20 — detection holds up in a noisy home', () => {
  const HISSY_ROOM: Room = { ...REFERENCE_ROOM, noise: 0.08 } // hiss as loud as the voice
  const HUMMING_ROOM: Room = { ...REFERENCE_ROOM, hum: 0.1 } // mains hum louder than the voice
  const NOBODY = { ...REFERENCE_SINGER, level: 0, breath: 0 }

  it('hears a breathy voice', SLOW, () => {
    const outcome = simulateCatalogue(songs, { ...REFERENCE_SINGER, breath: 0.1 }, REFERENCE_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('hears a voice through hiss as loud as the voice', SLOW, () => {
    const outcome = simulateCatalogue(songs, REFERENCE_SINGER, HISSY_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('hears a voice through mains hum louder than the voice', SLOW, () => {
    const outcome = simulateCatalogue(songs, REFERENCE_SINGER, HUMMING_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('hears a very quiet voice', SLOW, () => {
    const outcome = simulateCatalogue(songs, { ...REFERENCE_SINGER, level: 0.012, breath: 0.002 }, REFERENCE_ROOM)
    expect(rate(outcome)).toBeGreaterThanOrEqual(0.9)
  })

  it('reports no pitch when nobody sings over the hiss or the hum', SLOW, () => {
    for (const room of [HISSY_ROOM, HUMMING_ROOM]) {
      const outcome = simulateCatalogue(songs, NOBODY, room)
      expect(outcome.pitchFrames).toBe(0)
      expect(outcome.landed).toBe(0)
    }
  })
})
