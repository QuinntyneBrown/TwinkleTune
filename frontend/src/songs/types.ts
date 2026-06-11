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
