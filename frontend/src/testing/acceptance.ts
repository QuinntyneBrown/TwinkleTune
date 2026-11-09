/** Shared by the synthetic-singer acceptance tests. Not imported by the app. */
import { afterEach } from 'vitest'
import type { CatalogueOutcome } from './synthetic-singer'

/** Share of all notes landed. */
export const rate = (o: CatalogueOutcome) => o.landed / o.total
/** Share of the notes lasting half a beat or less that landed. */
export const shortRate = (o: CatalogueOutcome) => o.shortLanded / o.shortTotal
/** Share of the hit notes first hit within the first 40% of the note. */
export const earlyRate = (o: CatalogueOutcome) => o.hitEarly / o.hit

/** Each scenario sings the whole catalogue: seconds of computation, not milliseconds. */
export const SLOW = { timeout: 120_000 }

/**
 * A scenario is one long synchronous computation. Without a pause between
 * them the test runner's worker never gets a turn to exchange messages with
 * the main process, which times out after a minute of silence on a slow
 * machine. Call once at the top of an acceptance test file.
 */
export function pauseBetweenScenarios(): void {
  afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
}
