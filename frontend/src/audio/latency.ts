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

/** A reported latency in ms; anything missing, non-finite or negative counts as 0. */
function reportedMs(seconds: number | undefined): number {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
}

/**
 * How long after the playback clock reaches a beat the singing for that beat
 * is seen by the pitch detector, in milliseconds:
 *
 * - output delay — she sings with what she hears, and hears it after the clock;
 * - input delay — her voice takes time to reach the analyser;
 * - half the analysis window — a detected pitch describes the middle of its window.
 */
export function pipelineLatencyMs(report: LatencyReport): number {
  const device = Math.min(
    MAX_DEVICE_LATENCY_MS,
    reportedMs(report.baseLatency) + reportedMs(report.outputLatency) + reportedMs(report.inputLatency),
  )
  const analysis = report.sampleRate > 0 ? (report.windowSize / 2 / report.sampleRate) * 1000 : 0
  return device + analysis
}
