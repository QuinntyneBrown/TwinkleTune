import { describe, expect, it } from 'vitest'
import { BandLimiter } from './band-limit'

const WINDOW = 2048

function tone(hz: number, sampleRate: number, amplitude = 0.1): Float32Array {
  const out = new Float32Array(WINDOW)
  for (let i = 0; i < WINDOW; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate)
  return out
}

function rms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

/** Level change in dB that band-limiting makes to a steady tone. */
function gainDb(hz: number, sampleRate: number): number {
  const input = tone(hz, sampleRate)
  const output = new Float32Array(WINDOW)
  new BandLimiter(90, 1500).process(input, sampleRate, output)
  return 20 * Math.log10(rms(output) / rms(input))
}

describe('BandLimiter 90–1500 Hz (AE-L2-19)', () => {
  for (const sampleRate of [44100, 48000]) {
    describe(`at ${sampleRate} Hz`, () => {
      it('leaves a sung pitch alone', () => {
        expect(Math.abs(gainDb(440, sampleRate))).toBeLessThan(0.5)
        expect(Math.abs(gainDb(262, sampleRate))).toBeLessThan(0.5)
      })

      it('takes at least 12 dB off 60 Hz mains hum', () => {
        expect(gainDb(60, sampleRate)).toBeLessThanOrEqual(-12)
      })

      it('takes at least 40 dB off a 6 kHz tone', () => {
        expect(gainDb(6000, sampleRate)).toBeLessThanOrEqual(-40)
      })
    })
  }

  it('does not touch its input and fills the whole output', () => {
    const input = tone(440, 48000)
    const copy = Float32Array.from(input)
    const output = new Float32Array(WINDOW).fill(9)
    new BandLimiter(90, 1500).process(input, 48000, output)
    expect(input).toEqual(copy)
    expect(output.every((v) => Math.abs(v) < 1)).toBe(true)
  })

  it('starts every window from rest, so one window never colours the next', () => {
    const limiter = new BandLimiter(90, 1500)
    const first = new Float32Array(WINDOW)
    const again = new Float32Array(WINDOW)
    limiter.process(tone(440, 48000), 48000, first)
    limiter.process(tone(60, 48000, 0.5), 48000, new Float32Array(WINDOW))
    limiter.process(tone(440, 48000), 48000, again)
    expect(again).toEqual(first)
  })

  it('follows a change of sample rate', () => {
    const limiter = new BandLimiter(90, 1500)
    const out = new Float32Array(WINDOW)
    limiter.process(tone(6000, 48000), 48000, out)
    limiter.process(tone(6000, 44100), 44100, out)
    expect(20 * Math.log10(rms(out) / rms(tone(6000, 44100)))).toBeLessThanOrEqual(-40)
  })

  it('silence in, silence out', () => {
    const out = new Float32Array(WINDOW).fill(1)
    new BandLimiter(90, 1500).process(new Float32Array(WINDOW), 48000, out)
    expect(rms(out)).toBe(0)
  })
})
