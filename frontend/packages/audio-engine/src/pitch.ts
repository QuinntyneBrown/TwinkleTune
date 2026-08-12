import { PitchDetector } from 'pitchy'
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

const FFT_SIZE = 2048
const MIN_RMS = 0.01
const MIN_CLARITY = 0.8
const MIN_HZ = 70
const MAX_HZ = 1500
const MEDIAN_WINDOW = 5

/**
 * Microphone → pitch. Poll `read()` once per animation frame.
 * Median filter over recent frames guards against octave-error blips;
 * the RMS gate keeps background noise from registering as singing.
 */
export class PitchTracker {
  latest: PitchFrame | null = null
  private media: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(FFT_SIZE)
  private detector = PitchDetector.forFloat32Array(FFT_SIZE)
  private history: number[] = []

  get running(): boolean {
    return this.analyser !== null
  }

  /** Settings of the live mic track (sample rate, processing flags) for diagnostics. */
  get trackSettings(): MediaTrackSettings | null {
    return this.media?.getAudioTracks()[0]?.getSettings() ?? null
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
    this.source = ctx.createMediaStreamSource(this.media)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.source.connect(this.analyser)
  }

  read(): PitchFrame | null {
    if (!this.analyser) return null
    this.analyser.getFloatTimeDomainData(this.buf)

    let sum = 0
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i]
    const rms = Math.sqrt(sum / this.buf.length)
    if (rms < MIN_RMS) {
      this.latest = null
      return null
    }

    const [hz, clarity] = this.detector.findPitch(this.buf, audioCtx().sampleRate)
    if (clarity < MIN_CLARITY || hz < MIN_HZ || hz > MAX_HZ) {
      this.latest = null
      return null
    }

    this.history.push(hzToMidi(hz))
    if (this.history.length > MEDIAN_WINDOW) this.history.shift()
    const midi = [...this.history].sort((a, b) => a - b)[Math.floor(this.history.length / 2)]

    this.latest = { hz, midi, clarity, rms }
    return this.latest
  }

  stop(): void {
    this.media?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.media = null
    this.source = null
    this.analyser = null
    this.history = []
    this.latest = null
  }
}
