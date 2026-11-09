// Acceptance Test
// Traces to: AE-L2-20
// Description: A synthesised singer is still heard through breath, hiss, hum and low level, and silence is not

import { describe, expect, it } from 'vitest'
import { songs } from '../songs/catalog'
import { pauseBetweenScenarios, rate, SLOW } from './acceptance'
import { REFERENCE_ROOM, REFERENCE_SINGER, simulateCatalogue, type Room } from './synthetic-singer'

pauseBetweenScenarios()

// The ordinary interference of a home.
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

  const rooms: [string, Room][] = [
    ['the hiss', HISSY_ROOM],
    ['the hum', HUMMING_ROOM],
  ]
  for (const [what, room] of rooms) {
    it(`reports no pitch when nobody sings over ${what}`, SLOW, () => {
      const outcome = simulateCatalogue(songs, NOBODY, room)
      expect(outcome.pitchFrames).toBe(0)
      expect(outcome.landed).toBe(0)
    })
  }
})
