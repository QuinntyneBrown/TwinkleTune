/**
 * Limits a window of samples to the band between `lowHz` and `highHz`.
 * Pure signal processing (no Web Audio), so it runs the same in tests.
 */
export class BandLimiter {
  constructor(
    readonly lowHz: number,
    readonly highHz: number,
  ) {}

  /** Filter `input` into `output` (same length). Each call starts from rest. */
  process(input: Float32Array, _sampleRate: number, output: Float32Array): void {
    output.set(input) // not filtering yet
  }
}
