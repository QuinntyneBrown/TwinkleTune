// Acceptance Test
// Traces to: AE-L2-21
// Description: The analyzer returns one observation per 1/60 s hop of audio, however unevenly it is polled

import { describe, expect, it } from 'vitest'
import { FFT_SIZE, HISTORY_SIZE, HOP_MS, PitchAnalyzer } from './pitch'

const SAMPLE_RATE = 48000

/** The analyser's history at `nowMs`: the last HISTORY_SIZE samples of `signal(seconds)`. */
function historyAt(nowMs: number, signal: (t: number) => number): Float32Array {
  const history = new Float32Array(HISTORY_SIZE)
  const end = Math.round((nowMs / 1000) * SAMPLE_RATE)
  for (let i = 0; i < HISTORY_SIZE; i++) history[i] = signal((end - HISTORY_SIZE + i) / SAMPLE_RATE)
  return history
}

const a440 = (t: number) => 0.2 * Math.sin(2 * Math.PI * 440 * t)

/** Poll at each of `timesMs` and return what every poll produced. */
function poll(analyzer: PitchAnalyzer, timesMs: number[], signal = a440) {
  return timesMs.map((now) => analyzer.analyzeHops(historyAt(now, signal), SAMPLE_RATE, now))
}

describe('PitchAnalyzer.analyzeHops (AE-L2-21)', () => {
  it('analyses one window every sixtieth of a second and keeps 8192 samples of history', () => {
    expect(HOP_MS).toBeCloseTo(16.667, 3)
    expect(HISTORY_SIZE).toBe(8192)
  })

  it('returns one observation per poll when polled every hop', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    const polls = poll(analyzer, [1000, 1000 + HOP_MS, 1000 + 2 * HOP_MS, 1000 + 3 * HOP_MS])
    for (const observations of polls) {
      expect(observations).toHaveLength(1)
      expect(observations[0].ageMs).toBeCloseTo(0, 5)
      expect(observations[0].frame?.hz).toBeCloseTo(440, 0)
    }
  })

  it('catches up on the hops that came due since the previous poll, oldest first', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    const [, late] = poll(analyzer, [1000, 1050])
    expect(late.map((o) => o.ageMs)).toHaveLength(3)
    expect(late[0].ageMs).toBeCloseTo(2 * HOP_MS, 5)
    expect(late[1].ageMs).toBeCloseTo(HOP_MS, 5)
    expect(late[2].ageMs).toBeCloseTo(0, 5)
  })

  it('returns nothing until the next hop is due (a 120 Hz display)', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    const half = HOP_MS / 2
    const polls = poll(analyzer, [1000, 1000 + half, 1000 + 2 * half, 1000 + 3 * half, 1000 + 4 * half])
    expect(polls.map((p) => p.length)).toEqual([1, 0, 1, 0, 1])
  })

  it('keeps the grid even when polls are uneven', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    // 20 ms polls: the windows analysed still end on a 16.7 ms grid, so their ages vary
    const polls = poll(analyzer, [1000, 1020, 1040, 1060, 1080, 1100])
    const ends = polls.flatMap((observations, i) => observations.map((o) => 1000 + i * 20 - o.ageMs))
    expect(ends).toHaveLength(7) // 100 ms at one hop per 16.7 ms, plus the first
    ends.forEach((end, k) => expect(end).toBeCloseTo(1000 + k * HOP_MS, 5))
  })

  it('returns only what the history holds after a long stall, then carries on', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    const [, afterStall, next] = poll(analyzer, [1000, 2000, 2000 + HOP_MS])
    expect(afterStall).toHaveLength(8) // (8192 - 2048) samples = 128 ms = 7 hops back, plus now
    expect(afterStall[0].ageMs).toBeCloseTo(7 * HOP_MS, 5)
    expect(afterStall[7].ageMs).toBeCloseTo(0, 5)
    expect(next).toHaveLength(1)
  })

  it('gives each observation the pitch of its own window', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    // silence until a tone begins at 1030 ms; polled at 1000 and again at 1050
    const toneFrom1030 = (t: number) => (t >= 1.03 ? a440(t) : 0)
    const [, late] = poll(analyzer, [1000, 1050], toneFrom1030)
    expect(late[0].frame).toBeNull() // its window ended 33 ms ago, before the tone began
    // its window holds only 20 ms of tone, so allow the estimate a few cents
    const cents = 1200 * Math.log2((late[2].frame?.hz ?? 0) / 440)
    expect(Math.abs(cents)).toBeLessThan(10)
  })

  it('reset forgets the grid', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    poll(analyzer, [1000])
    analyzer.reset()
    expect(poll(analyzer, [5000])[0]).toHaveLength(1)
  })

  it('analyze still answers for the newest window alone', () => {
    const analyzer = new PitchAnalyzer(FFT_SIZE)
    const history = historyAt(1000, a440)
    expect(analyzer.analyze(history.subarray(HISTORY_SIZE - FFT_SIZE), SAMPLE_RATE)?.hz).toBeCloseTo(440, 0)
  })
})
