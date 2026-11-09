import { foldCents, HIT_TOLERANCE_CENTS, type NoteResult } from './scoring'

/** The slice of a song note the judge needs. `midi` is the base (untransposed) pitch. */
export interface JudgeNote {
  midi: number
  /** start time in beats */
  start: number
  /** duration in beats */
  dur: number
  phraseIdx: number
  noteIdx: number
}

export interface Observation {
  /** index of the note whose span contains the score beat, or -1 */
  activeIdx: number
  /** true when this frame was credited as on-pitch */
  onNote: boolean
}

/**
 * Live per-note capture: feed it one observation per animation frame and it
 * tallies each note's `NoteResult`, then settles notes in order as they pass.
 * Pure (no DOM, no audio) so the judging rules can be tested frame by frame.
 */
export class NoteJudge {
  readonly results: NoteResult[]
  private cursor = 0

  constructor(
    private readonly notes: readonly JudgeNote[],
    /** semitones the song is transposed by; targets are `note.midi + shift` */
    private readonly shift = 0,
  ) {
    this.results = notes.map((n) => ({
      phraseIdx: n.phraseIdx,
      noteIdx: n.noteIdx,
      midi: n.midi,
      hitFrames: 0,
      totalFrames: 0,
      firstHitFrac: null,
    }))
  }

  /** How many notes have been settled so far (they settle in song order). */
  get finalizedCount(): number {
    return this.cursor
  }

  /** The not-yet-settled note whose span contains `scoreBeat`, or -1. */
  activeIndex(scoreBeat: number): number {
    return this.notes.findIndex(
      (n, i) => i >= this.cursor && scoreBeat >= n.start && scoreBeat < n.start + n.dur,
    )
  }

  /** Tally one frame: `sungMidi` is the detected pitch, or null when no voice was heard. */
  observe(scoreBeat: number, sungMidi: number | null): Observation {
    const activeIdx = this.activeIndex(scoreBeat)
    if (activeIdx === -1) return { activeIdx, onNote: false }
    const n = this.notes[activeIdx]
    const r = this.results[activeIdx]
    r.totalFrames++
    if (sungMidi !== null && this.onPitch(activeIdx, sungMidi)) {
      r.hitFrames++
      if (r.firstHitFrac === null) r.firstHitFrac = (scoreBeat - n.start) / n.dur
      return { activeIdx, onNote: true }
    }
    return { activeIdx, onNote: false }
  }

  /** Settle every note whose end has passed; returns their indices in order. */
  finalize(scoreBeat: number): number[] {
    const settled: number[] = []
    while (this.cursor < this.notes.length) {
      const n = this.notes[this.cursor]
      if (scoreBeat < n.start + n.dur) break
      settled.push(this.cursor++)
    }
    return settled
  }

  /** Forget everything captured so far (used by "Start over"). */
  reset(): void {
    this.cursor = 0
    for (const r of this.results) {
      r.hitFrames = 0
      r.totalFrames = 0
      r.firstHitFrac = null
    }
  }

  private onPitch(idx: number, sungMidi: number): boolean {
    return Math.abs(foldCents(sungMidi, this.notes[idx].midi + this.shift)) <= HIT_TOLERANCE_CENTS
  }
}
