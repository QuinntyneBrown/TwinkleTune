// Acceptance Test
// Traces to: SR-L2-20
// Description: A synthesised singer who is consistently flat lands clearly more notes on Gentle than on Precise

import { describe, expect, it } from 'vitest'
import { songs } from '../songs/catalog'
import { hitToleranceCents } from '../state/scoring'
import { pauseBetweenScenarios, rate, SLOW } from './acceptance'
import { REFERENCE_ROOM, REFERENCE_SINGER, simulateCatalogue, type CatalogueOutcome } from './synthetic-singer'

pauseBetweenScenarios()

describe('SR-L2-20 — hit tolerance by pitch strictness', () => {
  const FLAT = { ...REFERENCE_SINGER, offsetCents: -40 }
  const judgedOn = (level: unknown): CatalogueOutcome =>
    simulateCatalogue(songs, FLAT, REFERENCE_ROOM, { toleranceCents: hitToleranceCents(level) })

  // each scenario sings the whole catalogue, so the Precise run is shared
  let preciseRun: CatalogueOutcome | undefined
  const precise = () => (preciseRun ??= judgedOn('precise'))

  it('lands at least 25 points more notes on Gentle than on Precise for a singer 40 cents flat', SLOW, () => {
    expect(rate(judgedOn('gentle')) - rate(precise())).toBeGreaterThanOrEqual(0.25)
  })

  it('judges a singer with no level exactly as Precise does', SLOW, () => {
    const noLevel = simulateCatalogue(songs, FLAT, REFERENCE_ROOM)
    expect(noLevel).toEqual(precise())
  })
})
