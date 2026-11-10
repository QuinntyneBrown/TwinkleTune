import { PitchDetector } from 'pitchy'
import { BandLimiter } from './band-limit'
import { pipelineLatencyMs } from './latency'
import { microphoneConstraints, resolveMicrophone, type MicrophoneChoice } from './microphone'
import { listMicrophones } from './microphone-access'
import { audioCtx } from './player'
import { hzToMidi } from './range'
import { deviceSettings } from '../state/device'

export interface PitchFrame {
  hz: number
  /** MIDI note as a float (60.0 = exactly C4) */
  midi: number
  /** detector confidence 0..1 */
  clarity: number
  rms: number
}

/** A pitch frame (or none) for one hop of audio, as seen at the moment of a poll. */
export interface PitchObservation {
  frame: PitchFrame | null
  /** how long before the poll this observation's window ended */
  ageMs: number
}

export const FFT_SIZE = 2048
/** the fixed step of audio time between one analysed window and the next */
export const HOP_MS = 1000 / 60
/** samples of history kept, so hops missed by a slow or late poll can still be analysed */
export const HISTORY_SIZE = 8192
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
  /** audio-clock time of the last hop analysed by analyzeHops */
  private gridMs: number | null = null

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

  /**
   * Analyse every hop that has come due since the previous call, oldest first.
   * `history` holds the most recent samples and ends at `nowMs` on the audio
   * clock. The windows analysed sit on a fixed HOP_MS grid of audio time
   * however unevenly this is called: a late call catches up on what it missed
   * (as far back as `history` reaches) and an early one returns nothing.
   */
  analyzeHops(history: Float32Array, sampleRate: number, nowMs: number): PitchObservation[] {
    if (this.gridMs === null || nowMs < this.gridMs) this.gridMs = nowMs - HOP_MS

    const EPSILON = 1e-6 // keeps a hop that is exactly due from being missed by rounding
    let due = Math.floor((nowMs - this.gridMs) / HOP_MS + EPSILON)
    const reachMs = ((history.length - this.windowSize) / sampleRate) * 1000
    const held = Math.floor(reachMs / HOP_MS + EPSILON) + 1
    if (due > held) {
      // a stall longer than the history: restart the grid at the oldest window that fits
      this.gridMs = nowMs - held * HOP_MS
      due = held
    }

    const observations: PitchObservation[] = []
    for (let k = 1; k <= due; k++) {
      const ageMs = Math.max(0, nowMs - (this.gridMs + k * HOP_MS))
      const end = history.length - Math.round((ageMs / 1000) * sampleRate)
      const window = history.subarray(end - this.windowSize, end)
      observations.push({ frame: this.analyze(window, sampleRate), ageMs })
    }
    this.gridMs += due * HOP_MS
    return observations
  }

  reset(): void {
    this.history = []
    this.gridMs = null
  }
}

/**
 * Microphone → pitch. Poll once per animation frame: `readHops()` for every
 * hop heard since the last poll (the sing loop), or `read()` for just the
 * pitch right now (the tuner, Find My Voice). Use one or the other on a given
 * tracker — each advances the smoothing history.
 */
export class PitchTracker {
  latest: PitchFrame | null = null
  private media: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(HISTORY_SIZE)
  private analyzer = new PitchAnalyzer(FFT_SIZE)
  /** seconds, as the browser reports it for the microphone track (not every browser does) */
  private inputLatency: number | undefined

  get running(): boolean {
    return this.analyser !== null
  }

  /**
   * Starts listening on the device's microphone choice, or on the system
   * default when there is none or the chosen microphone is not available: a
   * headset left in another room is never an error. Throws DOMException
   * (NotAllowedError) when the mic is denied.
   */
  async start(choice: MicrophoneChoice | null = deviceSettings.getMicrophone()): Promise<void> {
    if (this.running) return
    const ctx = audioCtx()
    const wanted = choice ? resolveMicrophone(choice, await listMicrophones()) : null
    this.media = await this.open(wanted)
    const settings = this.media.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined
    this.inputLatency = settings?.latency
    this.source = ctx.createMediaStreamSource(this.media)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = HISTORY_SIZE // the time-domain history it keeps for us
    this.source.connect(this.analyser)
  }

  private async open(deviceId: string | null): Promise<MediaStream> {
    const request = (id: string | null) =>
      navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints(id) })
    if (deviceId === null) return request(null)
    try {
      return await request(deviceId)
    } catch (e) {
      const name = (e as { name?: string } | null)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') throw e
      // unplugged a moment ago, or a stale identifier: listen on the system default instead
      return request(null)
    }
  }

  read(): PitchFrame | null {
    if (!this.analyser) return null
    this.analyser.getFloatTimeDomainData(this.buf)
    const newest = this.buf.subarray(HISTORY_SIZE - FFT_SIZE)
    this.latest = this.analyzer.analyze(newest, audioCtx().sampleRate)
    return this.latest
  }

  /**
   * Every hop of audio that has come due since the previous call, oldest
   * first, so a slow or stuttering display hears as much of the voice as a
   * fast one. `latest` becomes the newest hop's frame.
   */
  readHops(): PitchObservation[] {
    if (!this.analyser) return []
    this.analyser.getFloatTimeDomainData(this.buf)
    const ctx = audioCtx()
    const hops = this.analyzer.analyzeHops(this.buf, ctx.sampleRate, ctx.currentTime * 1000)
    if (hops.length > 0) this.latest = hops[hops.length - 1].frame
    return hops
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
