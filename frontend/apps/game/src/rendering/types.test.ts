import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VISUAL_STATE,
  normalizeMicEnergy,
  normalizeVisualState,
  seedFromString,
} from './types'

describe('reactive visual state', () => {
  it('clamps external signals and keeps state finite', () => {
    expect(
      normalizeVisualState(DEFAULT_VISUAL_STATE, {
        energy: 4,
        progress: -2,
        pitchY: Number.NaN,
        streak: 3.9,
        intensity: 1.4,
        onNote: true,
      }),
    ).toEqual({ energy: 1, progress: 0, pitchY: 0, streak: 3, intensity: 1, onNote: true })
  })

  it('maps the tracker noise floor and clear singing into 0..1 energy', () => {
    expect(normalizeMicEnergy(0.01)).toBe(0)
    expect(normalizeMicEnergy(0.075)).toBeCloseTo(0.5)
    expect(normalizeMicEnergy(0.14)).toBe(1)
  })

  it('derives stable, distinct normalized seeds', () => {
    const first = seedFromString('twinkle')
    expect(first).toBe(seedFromString('twinkle'))
    expect(first).not.toBe(seedFromString('hotcrossbuns'))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(1)
  })
})
