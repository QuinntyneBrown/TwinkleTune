import { PitchDetector } from 'pitchy'
import { pipelineLatencyMs } from './latency'
import { audioCtx } from './player'
import { hzToMidi } from './range'

export interface PitchFrame {
  hz: number
  /** MIDI note as a float (60.0 = exactly C4) */
  midi: number
  /** detector confidence 0..1 */
  clarity: number
  rms: number
}

export const FFT_SIZE = 2048
const MIN_RMS = 0.01
const MIN_CLARITY = 0.8
const MIN_HZ = 70
const MAX_HZ = 1500
const MEDIAN_WINDOW = 5

/**
 * One window of samples → pitch. Pure signal processing (no Web Audio), so it
 * can be driven by synthesised audio in tests.
 * Median filter over recent frames guards against octave-error blips;
 * the RMS gate keeps background noise from registering as singing.
 */
export class PitchAnalyzer {
  private detector: PitchDetector<Float32Array>
  private history: number[] = []

  constructor(readonly windowSize = FFT_SIZE) {
    this.detector = PitchDetector.forFloat32Array(windowSize)
  }

  /** `buf` must hold exactly `windowSize` time-domain samples. */
  analyze(buf: Float32Array, sampleRate: number): PitchFrame | null {
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / buf.length)
    if (rms < MIN_RMS) return null

    const [hz, clarity] = this.detector.findPitch(buf, sampleRate)
    if (clarity < MIN_CLARITY || hz < MIN_HZ || hz > MAX_HZ) return null

    this.history.push(hzToMidi(hz))
    if (this.history.length > MEDIAN_WINDOW) this.history.shift()
    const midi = [...this.history].sort((a, b) => a - b)[Math.floor(this.history.length / 2)]

    return { hz, midi, clarity, rms }
  }

  reset(): void {
    this.history = []
  }
}

/** Microphone → pitch. Poll `read()` once per animation frame. */
export class PitchTracker {
  latest: PitchFrame | null = null
  private media: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(FFT_SIZE)
  private analyzer = new PitchAnalyzer(FFT_SIZE)
  /** seconds, as the browser reports it for the microphone track (not every browser does) */
  private inputLatency: number | undefined

  get running(): boolean {
    return this.analyser !== null
  }

  /** Throws DOMException (NotAllowedError) when the mic is denied. */
  async start(): Promise<void> {
    if (this.running) return
    const ctx = audioCtx()
    this.media = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const settings = this.media.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined
    this.inputLatency = settings?.latency
    this.source = ctx.createMediaStreamSource(this.media)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.source.connect(this.analyser)
  }

  read(): PitchFrame | null {
    if (!this.analyser) return null
    this.analyser.getFloatTimeDomainData(this.buf)
    this.latest = this.analyzer.analyze(this.buf, audioCtx().sampleRate)
    return this.latest
  }

  /**
   * How far the pitch this tracker reports trails the playback clock, in ms:
   * what the browser says about the speaker and microphone paths, plus half
   * the analysis window. Cheap enough to read every frame.
   */
  pipelineLatencyMs(): number {
    const ctx = audioCtx()
    return pipelineLatencyMs({
      baseLatency: ctx.baseLatency,
      outputLatency: ctx.outputLatency,
      inputLatency: this.inputLatency,
      sampleRate: ctx.sampleRate,
      windowSize: FFT_SIZE,
    })
  }

  stop(): void {
    this.media?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.media = null
    this.source = null
    this.analyser = null
    this.inputLatency = undefined
    this.analyzer.reset()
    this.latest = null
  }
}
