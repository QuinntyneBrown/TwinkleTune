/**
 * Test support: a synthesised child-like singer and a harness that plays her
 * through the shipped listening pipeline (PitchAnalyzer → NoteJudge →
 * noteLanded) exactly as the sing loop does, one analysis window per frame.
 *
 * Nothing here is imported by the app; it exists so requirements about how
 * well TwinkleTune understands a voice can be verified without a microphone.
 */
import { pipelineLatencyMs, type LatencyReport } from '../audio/latency'
import { FFT_SIZE, PitchAnalyzer } from '../audio/pitch'
import { midiToHz } from '../audio/range'
import { NoteJudge, TIMING_TOLERANCE_MS } from '../state/note-judge'
import { noteLanded, type NoteResult } from '../state/scoring'
import type { Song } from '../songs/types'

export const SAMPLE_RATE = 48000

export interface Singer {
  /** how far behind the music she hears every syllable is sung (negative = ahead) */
  lagMs: number
  /** unvoiced consonant before each syllable (capped at 30% of the note) */
  consonantMs: number
  /** how early each note is let go (capped at 20% of the note) */
  releaseMs: number
  /** constant tuning error */
  offsetCents: number
  /** per-note random tuning error (standard deviation) */
  wanderCents: number
  /** vibrato depth at 5.5 Hz */
  vibratoCents: number
  /** each note starts this many cents flat and glides up over ~40 ms */
  scoopCents: number
  /** amplitude of the fundamental; 0 = not singing at all */
  level: number
  /** breath noise amplitude while voiced */
  breath: number
}

export interface Room {
  /** steady background noise amplitude (uniform white noise) */
  noise: number
  /** delay between singing and the samples reaching the analyser */
  inputLagMs: number
  /** delay between the playback clock and the music being heard (default 0) */
  outputLagMs?: number
  /** amplitude of a steady 60 Hz mains hum (default 0) */
  hum?: number
}

/** An in-tune young singer with the ordinary imperfections of a real voice. */
export const REFERENCE_SINGER: Singer = {
  lagMs: 0,
  consonantMs: 60,
  releaseMs: 70,
  offsetCents: 10,
  wanderCents: 15,
  vibratoCents: 15,
  scoopCents: 150,
  level: 0.08,
  breath: 0.01,
}

/** A living room on a tablet: a little hiss, a little input lag. */
export const REFERENCE_ROOM: Room = { noise: 0.004, inputLagMs: 40 }

/** The same room with the music coming from a wireless speaker. */
export const BLUETOOTH_ROOM: Room = { noise: 0.004, inputLagMs: 40, outputLagMs: 250 }

/** Steady background noise loud enough to open the RMS gate on its own. */
export const NOISY_ROOM: Room = { noise: 0.02, inputLagMs: 40 }

/** Small deterministic PRNG so every run synthesises the same performance. */
function prng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const HARMONICS = [1, 0.5, 0.3, 0.15, 0.08]

/** Render one whole performance of `song` to mono samples at SAMPLE_RATE. */
export function synthesizeSinging(song: Song, singer: Singer, room: Room, seed = 1): Float32Array {
  const spb = 60 / song.bpm
  const notes = song.phrases.flatMap((p) => p.notes)
  const totalSec = Math.max(...notes.map((n) => n.start + n.dur)) * spb + 1
  const out = new Float32Array(Math.ceil(totalSec * SAMPLE_RATE))
  const rand = prng(seed)
  const gauss = () => {
    let u = 0
    for (let i = 0; i < 6; i++) u += rand()
    return (u - 3) / Math.SQRT1_2
  }

  let phase = 0
  for (const n of notes) {
    const durSec = n.dur * spb
    const consonant = Math.min(singer.consonantMs / 1000, durSec * 0.3)
    const release = Math.min(singer.releaseMs / 1000, durSec * 0.2)
    // she follows what she hears, which trails the clock by the output delay
    const behind = (singer.lagMs + (room.outputLagMs ?? 0)) / 1000
    const from = Math.floor((n.start * spb + behind + consonant) * SAMPLE_RATE)
    const to = Math.floor(((n.start + n.dur) * spb + behind - release) * SAMPLE_RATE)
    const tuning = singer.offsetCents + gauss() * singer.wanderCents
    if (singer.level <= 0) continue
    for (let i = Math.max(0, from); i < to && i < out.length; i++) {
      const t = (i - from) / SAMPLE_RATE
      const scoop = -singer.scoopCents * Math.exp(-t / 0.04)
      const vibrato = singer.vibratoCents * Math.sin(2 * Math.PI * 5.5 * t)
      phase += (2 * Math.PI * midiToHz(n.midi + (tuning + scoop + vibrato) / 100)) / SAMPLE_RATE
      const envelope = Math.min(1, t / 0.03) * Math.min(1, (to - i) / SAMPLE_RATE / 0.04)
      let voice = 0
      for (let h = 0; h < HARMONICS.length; h++) voice += HARMONICS[h] * Math.sin((h + 1) * phase)
      out[i] += envelope * (singer.level * voice + singer.breath * (rand() * 2 - 1))
    }
  }
  if (room.noise > 0) {
    for (let i = 0; i < out.length; i++) out[i] += room.noise * (rand() * 2 - 1)
  }
  if (room.hum) {
    for (let i = 0; i < out.length; i++) out[i] += room.hum * Math.sin((2 * Math.PI * 60 * i) / SAMPLE_RATE)
  }
  return out
}

export interface PerformanceOutcome {
  results: NoteResult[]
  /** per note, in song order */
  landed: boolean[]
  /** note durations in beats, in song order */
  durations: number[]
  /** frames in which the analyzer reported a pitch */
  pitchFrames: number
}

export interface SimulationOptions {
  /** animation frames per second of the simulated sing loop */
  fps?: number
  /** the profile's mic timing offset, as the sing loop applies it */
  latencyMs?: number
  /**
   * The latencies (in seconds) the browser reports for this device. Defaults to
   * an accurate report of the room; pass `{}` for a browser that reports nothing.
   */
  reported?: Pick<LatencyReport, 'baseLatency' | 'outputLatency' | 'inputLatency'>
  seed?: number
}

/** Sing `song` through the real pipeline and report which notes landed. */
export function simulatePerformance(
  song: Song,
  singer: Singer,
  room: Room,
  { fps = 60, latencyMs = 0, seed = 1, reported }: SimulationOptions = {},
): PerformanceOutcome {
  const samples = synthesizeSinging(song, singer, room, seed)
  const spb = 60 / song.bpm
  const notes = song.phrases.flatMap((p, phraseIdx) => p.notes.map((n, noteIdx) => ({ ...n, phraseIdx, noteIdx })))
  const analyzer = new PitchAnalyzer(FFT_SIZE)
  const judge = new NoteJudge(notes, 0)
  const window = new Float32Array(FFT_SIZE)
  const toleranceBeats = TIMING_TOLERANCE_MS / 1000 / spb
  const totalSec = samples.length / SAMPLE_RATE
  let pitchFrames = 0
  // the sing loop's compensation: the engine's estimate plus the profile offset
  const compensationMs =
    latencyMs +
    pipelineLatencyMs({
      ...(reported ?? {
        outputLatency: (room.outputLagMs ?? 0) / 1000,
        inputLatency: room.inputLagMs / 1000,
      }),
      sampleRate: SAMPLE_RATE,
      windowSize: FFT_SIZE,
    })

  for (let t = 0; t < totalSec; t += 1 / fps) {
    // the analyser always holds the most recent FFT_SIZE samples it has received
    const end = Math.floor((t - room.inputLagMs / 1000) * SAMPLE_RATE)
    for (let i = 0; i < FFT_SIZE; i++) {
      const at = end - FFT_SIZE + i
      window[i] = at >= 0 && at < samples.length ? samples[at] : 0
    }
    const frame = analyzer.analyze(window, SAMPLE_RATE)
    if (frame) pitchFrames++
    const scoreBeat = t / spb - compensationMs / 1000 / spb
    judge.observe(scoreBeat, frame ? frame.midi : null, toleranceBeats, 1000 / fps)
    judge.finalize(scoreBeat, toleranceBeats)
  }
  judge.finalize(Infinity, toleranceBeats)

  return {
    results: judge.results,
    landed: judge.results.map((r) => noteLanded(r)),
    durations: notes.map((n) => n.dur),
    pitchFrames,
  }
}

export interface CatalogueOutcome {
  landed: number
  total: number
  /** notes with at least one on-pitch frame */
  hit: number
  /** of those, notes first hit within the first 40% of the note */
  hitEarly: number
  /** notes lasting half a beat or less */
  shortLanded: number
  shortTotal: number
  /** frames in which a pitch was reported, over all songs */
  pitchFrames: number
}

/** Sing every song in `songs` and add up the outcomes. */
export function simulateCatalogue(
  songs: readonly Song[],
  singer: Singer,
  room: Room,
  options: SimulationOptions = {},
): CatalogueOutcome {
  const sum: CatalogueOutcome = { landed: 0, total: 0, hit: 0, hitEarly: 0, shortLanded: 0, shortTotal: 0, pitchFrames: 0 }
  songs.forEach((song, i) => {
    const outcome = simulatePerformance(song, singer, room, { ...options, seed: (options.seed ?? 1) + i })
    sum.pitchFrames += outcome.pitchFrames
    outcome.landed.forEach((ok, n) => {
      const short = outcome.durations[n] <= 0.5
      sum.total++
      if (ok) sum.landed++
      if (short) sum.shortTotal++
      if (short && ok) sum.shortLanded++
      const firstHit = outcome.results[n].firstHitFrac
      if (firstHit !== null) sum.hit++
      if (firstHit !== null && firstHit <= 0.4) sum.hitEarly++
    })
  })
  return sum
}
