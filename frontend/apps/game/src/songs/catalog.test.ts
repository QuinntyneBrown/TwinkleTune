import { describe, expect, it } from 'vitest'
import { songs } from './catalog'
import { allNotes, songBeats, songRange, songSeconds } from './types'

describe('song catalog', () => {
  it('has seven songs with unique ids', () => {
    expect(songs.length).toBe(7)
    expect(new Set(songs.map((s) => s.id)).size).toBe(7)
  })

  for (const song of songs) {
    describe(song.title, () => {
      it('has phrases with notes and lyrics', () => {
        expect(song.phrases.length).toBeGreaterThan(0)
        for (const p of song.phrases) {
          expect(p.lyric.trim().length).toBeGreaterThan(0)
          expect(p.notes.length).toBeGreaterThan(0)
        }
      })

      it('has every syllable on a positive-length note', () => {
        for (const n of allNotes(song)) {
          expect(n.dur).toBeGreaterThan(0)
          expect(n.syll.trim().length).toBeGreaterThan(0)
        }
      })

      it('keeps notes in order without overlaps', () => {
        const notes = allNotes(song)
        for (let i = 1; i < notes.length; i++) {
          expect(notes[i].start + 1e-6).toBeGreaterThanOrEqual(
            notes[i - 1].start + notes[i - 1].dur,
          )
        }
      })

      it('stays in a kid-singable range (C3..C6 base)', () => {
        const { min, max } = songRange(song)
        expect(min).toBeGreaterThanOrEqual(48)
        expect(max).toBeLessThanOrEqual(84)
        expect(max - min).toBeLessThanOrEqual(16)
      })

      it('has a sensible length', () => {
        expect(songBeats(song)).toBeGreaterThan(8)
        expect(songSeconds(song)).toBeLessThan(60)
      })
    })
  }
})
