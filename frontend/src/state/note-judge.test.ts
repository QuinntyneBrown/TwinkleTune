import { describe, expect, it } from 'vitest'
import { NoteJudge, type JudgeNote } from './note-judge'

const note = (midi: number, start: number, dur: number, noteIdx: number): JudgeNote => ({
  midi,
  start,
  dur,
  phraseIdx: 0,
  noteIdx,
})

// C4 for one beat, then E4 for one beat
const cThenE = [note(60, 0, 1, 0), note(64, 1, 1, 1)]

describe('NoteJudge — per-note frame accumulation (SG-L2-9)', () => {
  it('counts observed and on-pitch frames on the active note', () => {
    const judge = new NoteJudge(cThenE)
    expect(judge.observe(0.1, 60)).toEqual({ activeIdx: 0, onNote: true })
    expect(judge.observe(0.2, 62)).toEqual({ activeIdx: 0, onNote: false })
    expect(judge.observe(0.3, null)).toEqual({ activeIdx: 0, onNote: false })
    expect(judge.results[0]).toMatchObject({ totalFrames: 3, hitFrames: 1 })
    expect(judge.results[1]).toMatchObject({ totalFrames: 0, hitFrames: 0 })
  })

  it('judges against the transposed target and forgives the octave', () => {
    const judge = new NoteJudge([note(67, 0, 1, 0)], 2) // target is MIDI 69
    expect(judge.observe(0.5, 69.4).onNote).toBe(true)
    expect(judge.observe(0.5, 57).onNote).toBe(true) // an octave below
    expect(judge.observe(0.5, 67).onNote).toBe(false) // the untransposed pitch
  })

  it('records where in the note the first on-pitch frame fell', () => {
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, null)
    judge.observe(0.3, 60)
    judge.observe(0.6, 60)
    expect(judge.results[0].firstHitFrac).toBeCloseTo(0.3)
  })

  it('reports no active note outside every span', () => {
    const judge = new NoteJudge(cThenE)
    expect(judge.observe(-1, 60)).toEqual({ activeIdx: -1, onNote: false })
    expect(judge.observe(5, 60)).toEqual({ activeIdx: -1, onNote: false })
  })
})

describe('NoteJudge — finalisation (SG-L2-10)', () => {
  it('settles notes in order as their ends pass', () => {
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
    expect(judge.observe(0.5, 60).activeIdx).toBe(-1)
    expect(judge.results[0].totalFrames).toBe(0)
  })

  it('reset clears every tally and starts over', () => {
    const judge = new NoteJudge(cThenE)
    judge.observe(0.1, 60)
    judge.finalize(Infinity)
    judge.reset()
    expect(judge.finalizedCount).toBe(0)
    expect(judge.results[0]).toMatchObject({ totalFrames: 0, hitFrames: 0, firstHitFrac: null })
    expect(judge.observe(0.1, 60).activeIdx).toBe(0)
  })
})
