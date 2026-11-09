/** What the browser can tell us about the audio path. Latencies are in seconds. */
export interface LatencyReport {
  /** AudioContext.baseLatency */
  baseLatency?: number
  /** AudioContext.outputLatency */
  outputLatency?: number
  /** the microphone track's `getSettings().latency` */
  inputLatency?: number
  sampleRate: number
  /** samples in one pitch-analysis window */
  windowSize: number
}

/** Cap on the browser-reported part, so a bogus report cannot push scoring off the song. */
export const MAX_DEVICE_LATENCY_MS = 500

/**
 * How long after the playback clock reaches a beat the singing for that beat
 * is seen by the pitch detector, in milliseconds.
 */
export function pipelineLatencyMs(_report: LatencyReport): number {
  return 0 // not estimated yet
}
