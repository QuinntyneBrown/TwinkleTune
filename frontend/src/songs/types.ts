export interface SongNote {
  /** MIDI note number (60 = C4) at the song's base key */
  midi: number
  /** start time in beats from song start */
  start: number
  /** duration in beats */
  dur: number
  /** lyric syllable sung on this note */
  syll: string
}

export interface SongPhrase {
  /** full lyric line, for display and "practice the tricky part" labels */
  lyric: string
  notes: SongNote[]
}

export interface Song {
  id: string
  title: string
  emoji: string
  /** index of the art gradient (art-1..art-4 in the design system) */
  art: 1 | 2 | 3 | 4
  bpm: number
  /** 1 = Easy, 2 = Medium, 3 = Brave */
  difficulty: 1 | 2 | 3
  phrases: SongPhrase[]
}

export const allNotes = (s: Song): SongNote[] => s.phrases.flatMap((p) => p.notes)

export function songRange(s: Song): { min: number; max: number } {
  const midis = allNotes(s).map((n) => n.midi)
  return { min: Math.min(...midis), max: Math.max(...midis) }
}

export function songBeats(s: Song): number {
  return Math.max(...allNotes(s).map((n) => n.start + n.dur))
}

export function songSeconds(s: Song, rate = 1): number {
  return (songBeats(s) / s.bpm) * 60 / rate
}

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
