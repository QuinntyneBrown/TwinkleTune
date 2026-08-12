/* The song data model lives in @twinkletune/audio-engine (the player and
   transposition math are built on it); this module re-exports it and adds the
   app-level helpers that don't belong in the engine. */
export type { Song, SongNote, SongPhrase } from '@twinkletune/audio-engine'
export { allNotes, songRange, songBeats, songSeconds } from '@twinkletune/audio-engine'

import type { Song } from '@twinkletune/audio-engine'
import { allNotes } from '@twinkletune/audio-engine'

export function difficultyLabel(d: Song['difficulty']): string {
  return d === 1 ? '⭐ Easy' : d === 2 ? '⭐⭐ Medium' : '⭐⭐⭐ Brave'
}

/**
 * Song invariants — kept identical to the backend's SongValidator so the
 * Grown-Ups song editor rejects exactly what the server would reject.
 */
export function validateSong(song: Song): string[] {
  const errors: string[] = []
  if (!song.title.trim()) errors.push('A song needs a title.')
  else if (song.title.length > 80) errors.push('Title is too long (max 80 characters).')
  if (!song.emoji.trim()) errors.push('Pick an emoji for the song art.')
  if (song.art < 1 || song.art > 4) errors.push('Art style must be between 1 and 4.')
  if (song.bpm < 40 || song.bpm > 220) errors.push('Tempo must be between 40 and 220 BPM.')
  if (song.difficulty < 1 || song.difficulty > 3) errors.push('Difficulty must be 1, 2 or 3.')

  if (song.phrases.length === 0) {
    errors.push('A song needs at least one phrase.')
    return errors
  }

  song.phrases.forEach((p, i) => {
    if (!p.lyric.trim()) errors.push(`Phrase ${i + 1} needs a lyric line.`)
    if (p.notes.length === 0) errors.push(`Phrase ${i + 1} needs at least one note.`)
  })

  const notes = allNotes(song)
  notes.forEach((n, i) => {
    if (n.dur <= 0) errors.push(`Note ${i + 1}: duration must be positive.`)
    if (!n.syll.trim()) errors.push(`Note ${i + 1}: every note needs a syllable.`)
    if (n.midi < 48 || n.midi > 84) errors.push(`Note ${i + 1}: midi ${n.midi} is outside 48–84 (C3–C6).`)
    if (i > 0 && n.start + 1e-6 < notes[i - 1].start + notes[i - 1].dur)
      errors.push(`Note ${i + 1}: overlaps the previous note.`)
  })

  if (notes.length > 0) {
    const midis = notes.map((n) => n.midi)
    const span = Math.max(...midis) - Math.min(...midis)
    if (span > 16) errors.push(`The melody spans ${span} semitones — keep it within 16.`)
  }
  return errors
}
