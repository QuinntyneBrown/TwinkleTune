// Acceptance Test
// Traces to: AE-L2-18
// Description: The pipeline latency estimate sums and bounds what the browser reports

import { describe, expect, it } from 'vitest'
import { MAX_DEVICE_LATENCY_MS, pipelineLatencyMs } from './latency'

const at48k = { sampleRate: 48000, windowSize: 2048 }
const ANALYSIS_48K = (2048 / 2 / 48000) * 1000 // ≈ 21.3 ms

describe('pipelineLatencyMs (AE-L2-18)', () => {
  it('adds the reported output and input delays to half the analysis window', () => {
    const ms = pipelineLatencyMs({ ...at48k, baseLatency: 0.02, outputLatency: 0.23, inputLatency: 0.04 })
    expect(ms).toBeCloseTo(290 + ANALYSIS_48K, 5)
    expect(ms).toBeCloseTo(311.3, 1)
  })

  it('is the analysis delay alone when the browser reports nothing', () => {
    expect(pipelineLatencyMs(at48k)).toBeCloseTo(21.3, 1)
    expect(pipelineLatencyMs({ sampleRate: 44100, windowSize: 2048 })).toBeCloseTo(23.2, 1)
  })

  it('counts a non-finite or negative report as 0', () => {
    expect(pipelineLatencyMs({ ...at48k, outputLatency: NaN })).toBeCloseTo(ANALYSIS_48K, 5)
    expect(pipelineLatencyMs({ ...at48k, outputLatency: Infinity })).toBeCloseTo(ANALYSIS_48K, 5)
    expect(pipelineLatencyMs({ ...at48k, inputLatency: -0.05 })).toBeCloseTo(ANALYSIS_48K, 5)
    expect(pipelineLatencyMs({ ...at48k, baseLatency: NaN, outputLatency: 0.1 })).toBeCloseTo(100 + ANALYSIS_48K, 5)
  })

  it('caps the device part at 500 ms', () => {
    expect(MAX_DEVICE_LATENCY_MS).toBe(500)
    const ms = pipelineLatencyMs({ ...at48k, outputLatency: 1.5, inputLatency: 0.5 })
    expect(ms).toBeCloseTo(500 + ANALYSIS_48K, 5)
  })

  it('never returns a non-finite estimate', () => {
    expect(pipelineLatencyMs({ sampleRate: 0, windowSize: 2048 })).toBe(0)
  })
})
