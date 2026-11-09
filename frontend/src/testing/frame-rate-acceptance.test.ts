// Acceptance Test
// Traces to: SR-L2-19
// Description: A slow or stuttering sing loop credits a synthesised singer exactly as a fast one does

import { describe, expect, it } from 'vitest'
import { songs } from '../songs/catalog'
import { pauseBetweenScenarios, rate, shortRate, SLOW } from './acceptance'
import { REFERENCE_ROOM, REFERENCE_SINGER, simulateCatalogue, type SimulationOptions } from './synthetic-singer'

pauseBetweenScenarios()

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

  const pacings: [string, SimulationOptions][] = [
    ['at 30 frames per second', { fps: 30 }],
    ['at 20 frames per second', { fps: 20 }],
    ['at 15 frames per second', { fps: 15 }],
    ['when one frame in five arrives late', STUTTER],
  ]
  for (const [when, pacing] of pacings) {
    it(`still lands no more than 5% of notes for a singer a semitone sharp ${when}`, SLOW, () => {
      const outcome = simulateCatalogue(songs, SHARP, REFERENCE_ROOM, pacing)
      expect(rate(outcome)).toBeLessThanOrEqual(0.05)
    })
  }
})
