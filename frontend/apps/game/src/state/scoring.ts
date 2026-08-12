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
  /** frames where the sung pitch was within tolerance */
  hitFrames: number
  /** frames observed while this note was active */
  totalFrames: number
  /** position (0..1) within the note where the first hit happened, null if never hit */
  firstHitFrac: number | null
}

export const HIT_TOLERANCE_CENTS = 50

/** A note is "landed" when it was matched for at least half the frames we heard. */
export function noteLanded(r: NoteResult, minFrames = 3): boolean {
  return r.totalFrames >= minFrames && r.hitFrames / r.totalFrames >= 0.5
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
