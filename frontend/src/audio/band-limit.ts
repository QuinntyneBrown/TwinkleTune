/** One second-order filter section, normalised so a0 = 1. */
interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

/** Section Qs of a 4th-order Butterworth filter (two cascaded biquads). */
const BUTTERWORTH_4 = [0.5411961, 1.3065630]

function section(kind: 'highpass' | 'lowpass', cutoffHz: number, q: number, sampleRate: number): Biquad {
  const w = (2 * Math.PI * cutoffHz) / sampleRate
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const edge = kind === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2
  return {
    b0: edge / a0,
    b1: (kind === 'lowpass' ? 2 * edge : -2 * edge) / a0,
    b2: edge / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  }
}

/**
 * Limits a window of samples to the band between `lowHz` and `highHz` with a
 * 4th-order Butterworth high-pass and a 4th-order Butterworth low-pass.
 * Pure signal processing (no Web Audio), so it runs the same in tests.
 */
export class BandLimiter {
  private sections: Biquad[] = []
  private sectionsRate = 0

  constructor(
    readonly lowHz: number,
    readonly highHz: number,
  ) {}

  /**
   * Filter `input` into `output` (same length). Each call starts from rest, so
   * overlapping windows never share state; the few milliseconds the filter
   * takes to settle sit at the head of the window.
   */
  process(input: Float32Array, sampleRate: number, output: Float32Array): void {
    if (sampleRate !== this.sectionsRate) {
      this.sections = [
        ...BUTTERWORTH_4.map((q) => section('highpass', this.lowHz, q, sampleRate)),
        ...BUTTERWORTH_4.map((q) => section('lowpass', this.highHz, q, sampleRate)),
      ]
      this.sectionsRate = sampleRate
    }

    let source = input
    for (const { b0, b1, b2, a1, a2 } of this.sections) {
      let x1 = 0
      let x2 = 0
      let y1 = 0
      let y2 = 0
      for (let i = 0; i < source.length; i++) {
        const x = source[i]
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1
        x1 = x
        y2 = y1
        y1 = y
        output[i] = y
      }
      source = output // later sections filter in place
    }
  }
}
