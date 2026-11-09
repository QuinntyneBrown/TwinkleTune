import { PitchDetector } from 'pitchy'
import { BandLimiter } from './band-limit'
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
/** the band sung fundamentals and their first harmonics live in */
export const BAND_LOW_HZ = 90
export const BAND_HIGH_HZ = 1500
/** loudness gate, measured inside the band */
const MIN_BAND_RMS = 0.006
const MIN_CLARITY = 0.8
const MIN_HZ = 70
const MAX_HZ = 1500
const MEDIAN_WINDOW = 5

function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

/**
 * One window of samples → pitch. Pure signal processing (no Web Audio), so it
 * can be driven by synthesised audio in tests.
 *
 * The window is first limited to the singing band, so hum, rumble, breath and
 * hiss neither open the loudness gate nor drown the voice's periodicity. The
 * gate then keeps quiet background noise from registering as singing, and a
 * median filter over recent frames guards against octave-error blips.
 */
export class PitchAnalyzer {
  private detector: PitchDetector<Float32Array>
  private band = new BandLimiter(BAND_LOW_HZ, BAND_HIGH_HZ)
  private filtered: Float32Array
  private history: number[] = []

  constructor(readonly windowSize = FFT_SIZE) {
    this.detector = PitchDetector.forFloat32Array(windowSize)
    this.filtered = new Float32Array(windowSize)
  }

  /** `buf` must hold exactly `windowSize` time-domain samples. */
  analyze(buf: Float32Array, sampleRate: number): PitchFrame | null {
    this.band.process(buf, sampleRate, this.filtered)
    if (rmsOf(this.filtered) < MIN_BAND_RMS) return null

    const [hz, clarity] = this.detector.findPitch(this.filtered, sampleRate)
    if (clarity < MIN_CLARITY || hz < MIN_HZ || hz > MAX_HZ) return null

    this.history.push(hzToMidi(hz))
    if (this.history.length > MEDIAN_WINDOW) this.history.shift()
    const midi = [...this.history].sort((a, b) => a - b)[Math.floor(this.history.length / 2)]

    // the reported level is the unfiltered one, so meters and visuals keep their meaning
    return { hz, midi, clarity, rms: rmsOf(buf) }
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
