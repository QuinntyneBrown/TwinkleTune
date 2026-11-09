import { foldCents, HIT_TOLERANCE_CENTS, noteLanded, type NoteResult } from './scoring'

/**
 * How far outside a note's span (in real time) singing that matches the note is
 * still credited to it. Young singers follow the melody rather than lead it.
 */
export const TIMING_TOLERANCE_MS = 180

/**
 * The most time one frame can stand for: about the audio a single analysis
 * window covers. A stalled frame is not credited with singing nobody analysed,
 * and no single frame can land a note by itself.
 */
export const MAX_FRAME_MS = 40

/** Frame time assumed when the caller does not say: a 60 fps display. */
const NOMINAL_FRAME_MS = 1000 / 60

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
  /** true when this frame's pitch matched the active note or a neighbour within the tolerance */
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
      hitMs: 0,
      voicedMs: 0,
      totalMs: 0,
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

  /**
   * Tally one frame. `sungMidi` is the detected pitch, or null when no voice
   * was heard; `toleranceBeats` is the timing tolerance at the current tempo;
   * `frameMs` is the real time since the previous frame, which is what the
   * frame is credited with (up to MAX_FRAME_MS).
   *
   * A sung frame goes to the active note when it is on-pitch for it; failing
   * that, to the nearest note that ended or begins within the tolerance and
   * that it does match; failing that, it counts against the active note.
   */
  observe(
    scoreBeat: number,
    sungMidi: number | null,
    toleranceBeats = 0,
    frameMs = NOMINAL_FRAME_MS,
  ): Observation {
    const ms = frameMs > 0 ? Math.min(frameMs, MAX_FRAME_MS) : 0 // NaN and negatives count for nothing
    const activeIdx = this.activeIndex(scoreBeat)
    if (activeIdx !== -1) this.results[activeIdx].totalMs += ms
    if (sungMidi === null) return { activeIdx, onNote: false }

    if (activeIdx !== -1 && this.onPitch(activeIdx, sungMidi)) {
      this.credit(activeIdx, scoreBeat, ms)
      return { activeIdx, onNote: true }
    }

    const neighbour = this.matchingNeighbour(scoreBeat, sungMidi, toleranceBeats, activeIdx)
    if (neighbour !== -1) {
      // a settled neighbour gains nothing, but its tail is still not a wrong note here
      if (neighbour >= this.cursor) this.credit(neighbour, scoreBeat, ms)
      return { activeIdx, onNote: true }
    }

    if (activeIdx !== -1) this.results[activeIdx].voicedMs += ms
    return { activeIdx, onNote: false }
  }

  /**
   * Settle notes in song order and return their indices. A note settles as its
   * end passes if it is already landed; otherwise it stays open through the
   * timing tolerance so late singing can still be credited. (Late credit only
   * ever raises a note's counts, so a note landed at its end stays landed.)
   */
  finalize(scoreBeat: number, toleranceBeats = 0): number[] {
    const settled: number[] = []
    while (this.cursor < this.notes.length) {
      const n = this.notes[this.cursor]
      const end = n.start + n.dur
      if (scoreBeat < end) break
      if (scoreBeat < end + toleranceBeats && !noteLanded(this.results[this.cursor])) break
      settled.push(this.cursor++)
    }
    return settled
  }

  /** Forget everything captured so far (used by "Start over"). */
  reset(): void {
    this.cursor = 0
    for (const r of this.results) {
      r.hitMs = 0
      r.voicedMs = 0
      r.totalMs = 0
      r.firstHitFrac = null
    }
  }

  private onPitch(idx: number, sungMidi: number): boolean {
    return Math.abs(foldCents(sungMidi, this.notes[idx].midi + this.shift)) <= HIT_TOLERANCE_CENTS
  }

  private credit(idx: number, scoreBeat: number, ms: number): void {
    const n = this.notes[idx]
    const r = this.results[idx]
    r.voicedMs += ms
    r.hitMs += ms
    if (r.firstHitFrac === null) {
      r.firstHitFrac = Math.max(0, Math.min(1, (scoreBeat - n.start) / n.dur))
    }
  }

  /** Nearest note (other than `activeIdx`) within the tolerance that `sungMidi` is on-pitch for, or -1. */
  private matchingNeighbour(
    scoreBeat: number,
    sungMidi: number,
    toleranceBeats: number,
    activeIdx: number,
  ): number {
    if (toleranceBeats <= 0) return -1
    let best = -1
    let bestDistance = Infinity
    for (let i = 0; i < this.notes.length; i++) {
      if (i === activeIdx) continue
      const n = this.notes[i]
      // notes are in time order: nothing further on can be within reach
      if (n.start - scoreBeat > toleranceBeats) break
      const end = n.start + n.dur
      const distance = scoreBeat >= end ? scoreBeat - end : n.start - scoreBeat
      if (distance < 0 || distance > toleranceBeats || distance >= bestDistance) continue
      if (!this.onPitch(i, sungMidi)) continue
      best = i
      bestDistance = distance
    }
    return best
  }
}
