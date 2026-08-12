import type { Song } from './song'
import { allNotes, songBeats } from './song'
import { midiToHz } from './range'

let sharedCtx: AudioContext | null = null

/** Lazily create the shared AudioContext (must be triggered from a user gesture once). */
export function audioCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

export interface PlayOptions {
  /** semitones to shift the whole song ("in your key") */
  transpose?: number
  /** playback rate: 0.7 = slow practice mode */
  rate?: number
  /** start beat (e.g. start of a phrase for practice) */
  fromBeat?: number
  /** stop after this beat (exclusive); Infinity = whole song */
  untilBeat?: number
  /** count-in clicks before the music starts */
  countInBeats?: number
  onDone?: () => void
}

/**
 * Synthesizes the melody with Web Audio. Songs are note data, so transposing
 * is just a frequency shift and slow mode is just a longer beat — no artifacts.
 */
export class SongPlayer {
  playing = false
  private nodes: AudioNode[] = []
  private doneTimer: ReturnType<typeof setTimeout> | null = null
  private t0 = 0
  private spb = 0.6
  private startBeat = 0
  private countIn = 0

  start(song: Song, opts: PlayOptions = {}): void {
    this.stop()
    const {
      transpose = 0,
      rate = 1,
      fromBeat = 0,
      untilBeat = Infinity,
      countInBeats = 4,
      onDone,
    } = opts

    const ctx = audioCtx()
    this.spb = 60 / song.bpm / rate
    this.startBeat = fromBeat
    this.countIn = countInBeats
    this.t0 = ctx.currentTime + 0.08

    const master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    this.nodes.push(master)

    const beatTime = (beat: number) => this.t0 + (countInBeats + beat - fromBeat) * this.spb

    // count-in: first click higher, like a friendly "ready?"
    for (let i = 0; i < countInBeats; i++) {
      this.click(ctx, master, this.t0 + i * this.spb, i === 0 ? 1568 : 1046)
    }

    const end = Math.min(untilBeat, songBeats(song))
    for (const note of allNotes(song)) {
      if (note.start < fromBeat || note.start >= end) continue
      this.tone(ctx, master, midiToHz(note.midi + transpose), beatTime(note.start), note.dur * this.spb)
    }

    this.playing = true
    const totalSec = (countInBeats + end - fromBeat) * this.spb + 0.6
    if (onDone) {
      this.doneTimer = setTimeout(() => {
        this.playing = false
        onDone()
      }, totalSec * 1000)
    }
  }

  /** Current position in beats; negative during the count-in. */
  currentBeat(): number {
    if (!this.playing) return this.startBeat - this.countIn
    return this.startBeat - this.countIn + (audioCtx().currentTime - this.t0) / this.spb
  }

  secondsPerBeat(): number {
    return this.spb
  }

  stop(): void {
    this.playing = false
    if (this.doneTimer) {
      clearTimeout(this.doneTimer)
      this.doneTimer = null
    }
    for (const n of this.nodes) {
      try {
        if (n instanceof OscillatorNode) n.stop()
        n.disconnect()
      } catch {
        /* already stopped */
      }
    }
    this.nodes = []
  }

  /** Soft toy-piano-ish melody voice: triangle + quiet sine an octave below. */
  private tone(ctx: AudioContext, out: AudioNode, hz: number, at: number, durSec: number): void {
    const playDur = Math.max(0.1, durSec * 0.92)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.03)
    gain.gain.setValueAtTime(0.4, at + Math.max(0.03, playDur - 0.08))
    gain.gain.exponentialRampToValueAtTime(0.0001, at + playDur)
    gain.connect(out)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = hz
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + playDur + 0.05)

    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    subGain.gain.value = 0.25
    sub.type = 'sine'
    sub.frequency.value = hz / 2
    sub.connect(subGain)
    subGain.connect(gain)
    sub.start(at)
    sub.stop(at + playDur + 0.05)

    this.nodes.push(osc, sub, gain, subGain)
  }

  private click(ctx: AudioContext, out: AudioNode, at: number, hz: number): void {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
    gain.connect(out)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + 0.1)
    this.nodes.push(osc, gain)
  }
}

/** One-off preview of a single pitch (used by the voice-setup ladder + tuned-for-you demo). */
export function playNote(midi: number, durSec = 0.5, wave: OscillatorType = 'triangle'): void {
  const ctx = audioCtx()
  const gain = ctx.createGain()
  const at = ctx.currentTime + 0.02
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durSec)
  gain.connect(ctx.destination)
  const osc = ctx.createOscillator()
  osc.type = wave
  osc.frequency.value = midiToHz(midi)
  osc.connect(gain)
  osc.start(at)
  osc.stop(at + durSec + 0.05)
}
