// Acceptance Test
// Traces to: SG-L2-9, SG-L2-10, SG-L2-25
// Description: Sung frames are attributed to the right note within the timing tolerance, and notes settle in order

import { describe, expect, it } from 'vitest'
import { MAX_FRAME_MS, NoteJudge, TIMING_TOLERANCE_MS, type JudgeNote } from './note-judge'
import { noteLanded } from './scoring'

const note = (midi: number, start: number, dur: number, noteIdx: number): JudgeNote => ({
  midi,
  start,
  dur,
  phraseIdx: 0,
  noteIdx,
})

// C4 for one beat, then E4 for one beat
const cThenE = [note(60, 0, 1, 0), note(64, 1, 1, 1)]

// At 100 BPM a beat lasts 600 ms, so the 180 ms tolerance is 0.3 beats.
const SPB = 0.6
const TOL = TIMING_TOLERANCE_MS / 1000 / SPB
const ms = (n: number) => n / 1000 / SPB

// Most tests feed frames worth 10 ms each, so the tallies read as round numbers.
const FRAME_MS = 10
const see = (judge: NoteJudge, scoreBeat: number, sungMidi: number | null, toleranceBeats = 0) =>
  judge.observe(scoreBeat, sungMidi, toleranceBeats, FRAME_MS)

describe('NoteJudge — per-note frame accumulation (SG-L2-9)', () => {
  it('adds each frame to the observed, sung and on-pitch time of the active note', () => {
    const judge = new NoteJudge(cThenE)
    expect(see(judge, 0.1, 60)).toEqual({ activeIdx: 0, onNote: true })
    expect(see(judge, 0.2, 62)).toEqual({ activeIdx: 0, onNote: false })
    expect(see(judge, 0.3, null)).toEqual({ activeIdx: 0, onNote: false })
    expect(judge.results[0]).toMatchObject({ totalMs: 30, voicedMs: 20, hitMs: 10 })
    expect(judge.results[1]).toMatchObject({ totalMs: 0, voicedMs: 0, hitMs: 0 })
  })

  it('judges against the transposed target and forgives the octave', () => {
    const judge = new NoteJudge([note(67, 0, 1, 0)], 2) // target is MIDI 69
    expect(see(judge, 0.5, 69.4).onNote).toBe(true)
    expect(see(judge, 0.5, 57).onNote).toBe(true) // an octave below
    expect(see(judge, 0.5, 67).onNote).toBe(false) // the untransposed pitch
  })

  it('records where in the note the first on-pitch frame fell', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 0.1, null)
    see(judge, 0.3, 60)
    see(judge, 0.6, 60)
    expect(judge.results[0].firstHitFrac).toBeCloseTo(0.3)
  })

  it('reports no active note outside every span', () => {
    const judge = new NoteJudge(cThenE)
    expect(see(judge, -1, 60)).toEqual({ activeIdx: -1, onNote: false })
    expect(see(judge, 5, 60)).toEqual({ activeIdx: -1, onNote: false })
  })
})

describe('NoteJudge — a frame stands for the time since the previous one (SG-L2-9)', () => {
  it('credits a 30 fps frame with twice the time of a 60 fps frame', () => {
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, 60, 0, 1000 / 30)
    expect(judge.results[0].totalMs).toBeCloseTo(33.3, 1)
    expect(judge.results[0].voicedMs).toBeCloseTo(33.3, 1)
    expect(judge.results[0].hitMs).toBeCloseTo(33.3, 1)
  })

  it('caps a stalled frame at 40 ms', () => {
    expect(MAX_FRAME_MS).toBe(40)
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, 60, 0, 250) // a stall, or the first frame after a pause
    expect(judge.results[0]).toMatchObject({ totalMs: 40, voicedMs: 40, hitMs: 40 })
  })

  it('ignores a nonsensical frame time', () => {
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, 60, 0, -5)
    judge.observe(0.2, 60, 0, NaN)
    expect(judge.results[0]).toMatchObject({ totalMs: 0, voicedMs: 0, hitMs: 0 })
  })

  it('assumes a 60 fps frame when no frame time is given', () => {
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, 60)
    expect(judge.results[0].hitMs).toBeCloseTo(16.7, 1)
  })

  it('lands a quarter-beat note from two on-pitch frames at 30 fps', () => {
    // 150 ms note at 100 BPM; a 30 fps loop sees it four or five times
    const judge = new NoteJudge([note(60, 0, 0.25, 0)])
    const frame = 1000 / 30
    judge.observe(0.02, null, 0, frame) // consonant
    judge.observe(0.08, 60, 0, frame)
    judge.observe(0.14, 60, 0, frame)
    judge.observe(0.2, null, 0, frame) // early release
    expect(noteLanded(judge.results[0])).toBe(true)
  })

  it('never lands a note from a single frame, however slow the device', () => {
    const judge = new NoteJudge([note(60, 0, 0.25, 0)])
    judge.observe(0.1, 60, 0, 1000 / 10)
    expect(noteLanded(judge.results[0])).toBe(false)
  })
})

describe('NoteJudge — timing-tolerant frame attribution (SG-L2-25)', () => {
  it('uses a 180 ms tolerance', () => {
    expect(TIMING_TOLERANCE_MS).toBe(180)
  })

  it('credits a held note that spills into the next span to the note being sung', () => {
    const judge = new NoteJudge(cThenE)
    // still holding C 150 ms into the E note
    const seen = see(judge, 1 + ms(150), 60, TOL)
    expect(seen).toEqual({ activeIdx: 1, onNote: true })
    expect(judge.results[0]).toMatchObject({ voicedMs: 10, hitMs: 10, totalMs: 0 })
    // the E note saw a frame go by, but nothing was sung against it
    expect(judge.results[1]).toMatchObject({ voicedMs: 0, hitMs: 0, totalMs: 10 })
  })

  it('credits a note sung slightly early, with a first-hit fraction of 0', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 1 - ms(100), 64, TOL)
    expect(judge.results[1]).toMatchObject({ voicedMs: 10, hitMs: 10, firstHitFrac: 0 })
    expect(judge.results[0]).toMatchObject({ voicedMs: 0, hitMs: 0, totalMs: 10 })
  })

  it('records a first-hit fraction of 1 for a note first hit late', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 1 + ms(100), 60, TOL)
    expect(judge.results[0].firstHitFrac).toBe(1)
  })

  it('stops crediting once the tolerance has passed', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 1 + ms(200), 60, TOL)
    expect(judge.results[0]).toMatchObject({ voicedMs: 0, hitMs: 0 })
    expect(judge.results[1]).toMatchObject({ voicedMs: 10, hitMs: 0, totalMs: 10 })
  })

  it('prefers the active note when the pitch fits it', () => {
    const repeated = [note(60, 0, 1, 0), note(60, 1, 1, 1)]
    const judge = new NoteJudge(repeated)
    see(judge, 1 + ms(50), 60, TOL)
    expect(judge.results[1]).toMatchObject({ voicedMs: 10, hitMs: 10 })
    expect(judge.results[0]).toMatchObject({ voicedMs: 0, hitMs: 0 })
  })

  it('picks the nearest matching neighbour', () => {
    // C, a short D, then C again: a C sung just after the D began belongs to the first C
    const cdc = [note(60, 0, 1, 0), note(62, 1, 0.5, 1), note(60, 1.5, 1, 2)]
    const judge = new NoteJudge(cdc)
    see(judge, 1 + ms(60), 60, TOL)
    expect(judge.results[0].hitMs).toBe(10)
    expect(judge.results[2].hitMs).toBe(0)
    // ...and one sung just before the second C begins belongs to that one
    see(judge, 1.5 - ms(60), 60, TOL)
    expect(judge.results[2].hitMs).toBe(10)
  })

  it('neither credits nor penalises when the matching neighbour is already settled', () => {
    const judge = new NoteJudge(cThenE)
    for (let i = 0; i < 6; i++) see(judge, 0.2 + i * 0.1, 60, TOL)
    expect(judge.finalize(1.0, TOL)).toEqual([0]) // landed, so settled at its end
    const before = { ...judge.results[0] }
    expect(see(judge, 1 + ms(100), 60, TOL).onNote).toBe(true)
    expect(judge.results[0]).toEqual(before)
    expect(judge.results[1]).toMatchObject({ voicedMs: 0, hitMs: 0, totalMs: 10 })
  })

  it('credits singing between notes to the note it matches', () => {
    const gapped = [note(60, 0, 1, 0), note(64, 2, 1, 1)] // a one-beat rest between them
    const judge = new NoteJudge(gapped)
    expect(see(judge, 1 + ms(100), 60, TOL)).toEqual({ activeIdx: -1, onNote: true })
    expect(judge.results[0].hitMs).toBe(10)
  })

  it('with no tolerance, judges the active note only', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 1 + ms(50), 60)
    expect(judge.results[0]).toMatchObject({ voicedMs: 0, hitMs: 0 })
    expect(judge.results[1]).toMatchObject({ voicedMs: 10, hitMs: 0 })
  })
})

describe('NoteJudge — finalisation (SG-L2-10)', () => {
  it('settles notes in order as they pass', () => {
    const judge = new NoteJudge(cThenE)
    expect(judge.finalize(0.5)).toEqual([])
    expect(judge.finalize(1.0)).toEqual([0])
    expect(judge.finalize(1.5)).toEqual([])
    expect(judge.finalize(Infinity)).toEqual([1])
    expect(judge.finalizedCount).toBe(2)
  })

  it('stops accumulating on a settled note', () => {
    const judge = new NoteJudge(cThenE)
    judge.finalize(1.0)
    expect(see(judge, 0.5, 60).activeIdx).toBe(-1)
    expect(judge.results[0].totalMs).toBe(0)
  })

  it('settles a landed note as its end passes', () => {
    const judge = new NoteJudge(cThenE)
    for (let i = 0; i < 6; i++) see(judge, 0.2 + i * 0.1, 60, TOL)
    expect(noteLanded(judge.results[0])).toBe(true)
    expect(judge.finalize(1.0, TOL)).toEqual([0])
  })

  it('keeps a not-yet-landed note open until the tolerance has passed', () => {
    const judge = new NoteJudge(cThenE)
    expect(judge.finalize(1.0, TOL)).toEqual([])
    expect(judge.finalize(1.0 + TOL - 0.01, TOL)).toEqual([])
    expect(judge.finalize(1.0 + TOL, TOL)).toEqual([0])
  })

  it('lets late singing land a note inside the tolerance', () => {
    // a quarter-beat C (150 ms) sung 150 ms late: every sung frame falls in the E span
    const quick = [note(60, 0, 0.25, 0), note(64, 0.25, 1, 1)]
    const judge = new NoteJudge(quick)
    for (let b = 0; b < 0.25; b += 0.05) see(judge, b, null, TOL)
    expect(judge.finalize(0.25, TOL)).toEqual([])
    for (let b = 0.25; b < 0.5; b += 0.05) see(judge, b, 60, TOL)
    expect(judge.finalize(0.5, TOL)).toEqual([0])
    expect(noteLanded(judge.results[0])).toBe(true)
  })

  it('never settles a later note before an earlier one', () => {
    const judge = new NoteJudge(cThenE)
    for (let i = 0; i < 6; i++) see(judge, 1.2 + i * 0.1, 64, TOL)
    // E is landed and over, but C (missed) is settled first, in order
    expect(judge.finalize(2.0, TOL)).toEqual([0, 1])
  })

  it('reset clears every tally and starts over', () => {
    const judge = new NoteJudge(cThenE)
    see(judge, 0.1, 60)
    judge.finalize(Infinity)
    judge.reset()
    expect(judge.finalizedCount).toBe(0)
    expect(judge.results[0]).toMatchObject({ totalMs: 0, voicedMs: 0, hitMs: 0, firstHitFrac: null })
    expect(see(judge, 0.1, 60).activeIdx).toBe(0)
  })
})
