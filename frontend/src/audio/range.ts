import type { Song } from '../songs/types'
import { songRange } from '../songs/types'
import type { VoiceRange } from '../state/store'

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToName(midi: number): string {
  const m = Math.round(midi)
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Semitones to shift a song so its note span sits centered in the voice range.
 * 0 when no range is known. Clamped to ±6 (beyond that, octave folding in
 * scoring means a different octave fits better anyway).
 */
export function computeShift(song: Song, range: VoiceRange | null): number {
  if (!range) return 0
  const { min, max } = songRange(song)
  const songCenter = (min + max) / 2
  const voiceCenter = (range.low + range.high) / 2
  return clamp(Math.round(voiceCenter - songCenter), -6, 6)
}

export function describeShift(shift: number): string {
  if (shift === 0) return 'Already a perfect fit!'
  const n = Math.abs(shift)
  const dir = shift < 0 ? 'lower' : 'higher'
  return `Moved ${n} note${n === 1 ? '' : 's'} ${dir} for you 💙`
}

/**
 * Locks onto a sustained pitch: feed it frames (midi or null) and it returns
 * the median once the recent window is stable, then resets for the next capture.
 */
export class StablePitchCapture {
  private buf: number[] = []
  private silentFrames = 0

  constructor(
    private windowFrames = 40, // ~0.7s at 60fps
    private spreadSemitones = 1.0,
  ) {}

  reset(): void {
    this.buf = []
    this.silentFrames = 0
  }

  /** Progress 0..1 toward a stable capture, for UI feedback. */
  progress(): number {
    return Math.min(1, this.buf.length / this.windowFrames)
  }

  feed(midi: number | null): number | null {
    if (midi === null) {
      // tolerate brief detector dropouts mid-note
      if (++this.silentFrames > 8) this.reset()
      return null
    }
    this.silentFrames = 0
    this.buf.push(midi)
    if (this.buf.length > this.windowFrames) this.buf.shift()
    if (this.buf.length < this.windowFrames) return null

    const sorted = [...this.buf].sort((a, b) => a - b)
    const p10 = sorted[Math.floor(sorted.length * 0.1)]
    const p90 = sorted[Math.floor(sorted.length * 0.9)]
    if (p90 - p10 > this.spreadSemitones) return null

    const median = sorted[Math.floor(sorted.length / 2)]
    this.reset()
    return median
  }
}
