import type { Song } from '../songs/types'
import { songRange } from '../songs/types'

/**
 * Cents difference between sung and target pitch, octave-folded.
 * Kids naturally sing in their own octave, so we compare pitch class:
 * the result is always in (-600, +600] cents.
 */
export function foldCents(sungMidi: number, targetMidi: number): number {
  let d = (sungMidi - targetMidi) % 12
  if (d > 6) d -= 12
  if (d <= -6) d += 12
  return d === 0 ? 0 : d * 100 // `? :` normalizes JS negative zero from %
}

/** Per-note accumulation gathered live during play. */
export interface NoteResult {
  phraseIdx: number
  noteIdx: number
  midi: number
  /** milliseconds of singing attributed to this note whose pitch was within tolerance */
  hitMs: number
  /** milliseconds attributed to this note in which a pitch was heard at all (on-pitch or not) */
  voicedMs: number
  /** milliseconds observed while this note was active, sung or silent */
  totalMs: number
  /** position (0..1) within the note where the first hit happened, null if never hit */
  firstHitFrac: number | null
}

export const HIT_TOLERANCE_CENTS = 50

/**
 * How closely a singer's pitch must match a note for it to count. A grown-up
 * chooses the level per singer in the Grown-Ups Corner; it stays on the device.
 */
export type PitchStrictness = 'gentle' | 'just-right' | 'precise'

const TOLERANCE_BY_STRICTNESS: Record<PitchStrictness, number> = {
  gentle: 80,
  'just-right': 65,
  precise: HIT_TOLERANCE_CENTS,
}

/** A stored level, or Precise when it is missing or not one of the three. */
export function pitchStrictness(value: unknown): PitchStrictness {
  return value === 'gentle' || value === 'just-right' ? value : 'precise'
}

/**
 * The half-width, in cents after octave folding, of the band inside which a
 * sung pitch is on-pitch for a singer on this level (inclusive). A singer with
 * no level is judged as Precise: the rule that applied before levels existed.
 */
export function hitToleranceCents(value: unknown): number {
  return TOLERANCE_BY_STRICTNESS[pitchStrictness(value)]
}
/**
 * minimum-sample guard: less on-pitch singing than this can never land a note.
 * 45 ms is three frames at 60 fps and two at 30 fps.
 */
export const MIN_HIT_MS = 45
/** at least this share of the sung time must be on-pitch */
export const MIN_PRECISION = 0.5
/** on-pitch time must cover at least this share of the time the note was active */
export const MIN_COVERAGE = 0.25

/**
 * A note is "landed" when the child was on-pitch for at least half of the
 * time she was heard singing it, for a meaningful share of the note.
 * Silence — a breath, a consonant, a late start — never counts against it.
 * The evidence is measured in time, so the verdict does not depend on how
 * many frames a second the device manages.
 */
export function noteLanded(r: NoteResult): boolean {
  return (
    r.hitMs >= MIN_HIT_MS &&
    r.hitMs >= MIN_PRECISION * r.voicedMs &&
    r.hitMs >= MIN_COVERAGE * r.totalMs
  )
}

export interface SongSummary {
  songId: string
  songTitle: string
  landed: number
  total: number
  accuracy: number
  stars: 1 | 2 | 3
  pitchStars: number
  timingStars: number
  braveStars: number
  maxStreak: number
  sparkles: number
  trickyPhrase: number | null
  trickyLyric: string | null
  /** played in no-mic "just for fun" mode */
  noMic: boolean
}

function starsFromRatio(r: number, hi = 0.85, mid = 0.6): number {
  return r >= hi ? 3 : r >= mid ? 2 : 1
}

export function summarize(song: Song, results: NoteResult[], noMic = false): SongSummary {
  const total = results.length
  const landedFlags = results.map((r) => noteLanded(r))
  const landed = landedFlags.filter(Boolean).length
  const accuracy = total > 0 ? landed / total : 0

  let maxStreak = 0
  let run = 0
  for (const hit of landedFlags) {
    run = hit ? run + 1 : 0
    maxStreak = Math.max(maxStreak, run)
  }

  // timing: of the notes that were hit at all, how many were caught early?
  const hitOnes = results.filter((r) => r.firstHitFrac !== null)
  const early = hitOnes.filter((r) => (r.firstHitFrac as number) <= 0.4).length
  const timingStars = hitOnes.length === 0 ? 1 : starsFromRatio(early / hitOnes.length, 0.8, 0.5)

  // braveness: how did the highest notes of the song go?
  const { max } = songRange(song)
  const highIdx = results.map((r, i) => ({ r, i })).filter(({ r }) => r.midi >= max - 2)
  const highLanded = highIdx.filter(({ i }) => landedFlags[i]).length
  const braveStars = highIdx.length === 0 ? 3 : starsFromRatio(highLanded / highIdx.length, 0.9, 0.6)

  // tricky part: the phrase with the lowest landed ratio, if it's genuinely shaky
  let trickyPhrase: number | null = null
  let worst = 1
  song.phrases.forEach((_p, pi) => {
    const inPhrase = results.map((r, i) => ({ r, i })).filter(({ r }) => r.phraseIdx === pi)
    if (inPhrase.length < 3) return
    const ratio = inPhrase.filter(({ i }) => landedFlags[i]).length / inPhrase.length
    if (ratio < worst) {
      worst = ratio
      trickyPhrase = pi
    }
  })
  if (worst >= 0.75) trickyPhrase = null

  return {
    songId: song.id,
    songTitle: song.title,
    landed,
    total,
    accuracy,
    stars: starsFromRatio(accuracy) as 1 | 2 | 3,
    pitchStars: starsFromRatio(accuracy),
    timingStars,
    braveStars,
    maxStreak,
    sparkles: landed * 10,
    trickyPhrase,
    trickyLyric: trickyPhrase !== null ? song.phrases[trickyPhrase].lyric : null,
    noMic,
  }
}
