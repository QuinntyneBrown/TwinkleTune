# Detect pitch

## Overview

TwinkleTune listens to a child sing and reports the pitch in real time, so
gameplay and scoring can react to whether the note is high or low. Detection runs
on the device from the microphone; no audio leaves the tablet. Homes are noisy
and tablets are budget hardware, so the detector first narrows what it listens to
down to the band a singing voice lives in, then rejects sound that is too quiet
or too uncertain to be a sung note, and smooths brief octave jumps.

audio engine — on-device layer that synthesises a song's melody and detects the
singer's pitch

This feature covers pitch input: acquiring the microphone, analysing one window
of samples per frame, band-limiting, gating and smoothing the result, and
releasing the microphone on stop. It reports raw pitch only; deciding whether the
pitch is correct belongs to scoring, and finding a comfortable vocal range
belongs to voice personalization. It runs offline on the device.

The terms below are used throughout.

- pitch frame — per-poll result carrying `hz`, a floating-point `midi`, a
  `clarity`, and an `rms`, or absent when the frame is rejected
- McLeod pitch method — autocorrelation-based algorithm, supplied by the `pitchy`
  library, that estimates a fundamental frequency and a clarity from a window of
  samples
- singing band — 90 Hz to 1500 Hz, the range holding sung fundamentals and their
  first harmonics
- band limiting — filtering of a window down to the singing band before anything
  else looks at it
- Butterworth filter — filter with a maximally flat passband; a 4th-order one
  falls away at 24 dB per octave beyond its cutoff
- biquad — second-order filter section; two in cascade make a 4th-order filter
- RMS — root-mean-square amplitude of a window
- band-limited level — RMS of the band-limited window, used as the loudness gate
- clarity — detector confidence in the range 0 to 1, used to reject uncertain
  detections
- median filter — smoothing that reports the median of the most recent accepted
  MIDI values, so one octave-error blip cannot swing the result
- floating-point MIDI — MIDI note number carried as a real number, so a pitch
  between two semitones is representable

## Description

The feature is a frontend-only slice inside `frontend/src/audio/pitch.ts` and
`frontend/src/audio/band-limit.ts`, with one helper from `range.ts` and the
`pitchy` library. No server participates. The signal processing is separated
from the Web Audio plumbing so it can be driven by synthesised audio in tests.

- **`PitchTracker`** — class that owns the microphone and analysis graph.
  `start()` acquires the stream and builds the analyser; `read()` copies one
  window out of the analyser and hands it to its `PitchAnalyzer`; `stop()`
  releases everything. The `running` getter is true while an analyser exists.
- **`start()`** — async method that calls `getUserMedia` with `echoCancellation`,
  `noiseSuppression`, and `autoGainControl` all `false`, builds a
  `MediaStreamAudioSourceNode` and an `AnalyserNode` with `fftSize = 2048`, and
  connects them. A denied permission surfaces as a `NotAllowedError` thrown to
  the caller.
- **`stop()`** — method that stops the media tracks, disconnects the source and
  analyser, nulls the graph, and clears the analyzer's history and `latest`.
- **`PitchAnalyzer`** — pure class turning one window into a `PitchFrame` or
  `null`. `analyze(buf, sampleRate)` runs these steps in order:
  1. band-limit `buf` into a scratch window with `BandLimiter.process`;
  2. compute the band-limited level and return `null` when it is below
     `MIN_BAND_RMS`;
  3. call `detector.findPitch(filtered, sampleRate)` and return `null` when
     `clarity < MIN_CLARITY`, `hz < MIN_HZ`, or `hz > MAX_HZ`;
  4. push `hzToMidi(hz)` into `history`, keep the last `MEDIAN_WINDOW` values,
     and report the median as `midi`, with `rms` computed from the unfiltered
     `buf` so level displays keep their meaning.
- **`BandLimiter(lowHz, highHz)`** — class in `band-limit.ts` holding a 4th-order
  Butterworth high-pass at `lowHz` and a 4th-order Butterworth low-pass at
  `highHz`, each as two cascaded biquads with section Qs 0.5412 and 1.3066.
  `process(input, sampleRate, output)` derives the coefficients for the sample
  rate (cached until the rate changes) and filters the window from rest. Starting
  from rest costs a few milliseconds of settling at the head of a 43 ms window,
  which the detector tolerates; it keeps windows independent, so overlapping
  frames never share state.
- **`PitchFrame`** — result type with `hz`, `midi` (float, `60.0 = C4`),
  `clarity` (0 to 1), and `rms` (unfiltered level).
- **`PitchDetector.forFloat32Array(FFT_SIZE)`** — `pitchy` detector configured
  for the 2048-sample window; `findPitch` returns `[hz, clarity]`.
- **`hzToMidi(hz)`** — `range.ts` helper computing `69 + 12·log2(hz/440)`.

Constants (the shipped baseline): `FFT_SIZE = 2048`, `BAND_LOW_HZ = 90`,
`BAND_HIGH_HZ = 1500`, `MIN_BAND_RMS = 0.006`, `MIN_CLARITY = 0.8`,
`MIN_HZ = 70`, `MAX_HZ = 1500`, `MEDIAN_WINDOW = 5`.

### Why band-limit

The McLeod method scores how periodic a window is, and broadband sound — breath,
hiss, a fan — is not periodic. Once that sound approaches the level of the voice
the clarity drops under the threshold and every frame is rejected: the detector
does not degrade, it goes deaf. Hum and rumble below the voice do the same from
the other side. Almost all of that energy lies outside 90–1500 Hz, while a sung
fundamental and the harmonics that carry its periodicity lie inside, so removing
the rest restores the detector's confidence without touching what it measures.

The high-pass sits at 90 Hz although pitches down to 70 Hz are accepted: a voice
that low is still tracked through its harmonics, and the higher cutoff takes
10 dB more off 60 Hz mains hum. The level gate moves inside the band and down to
0.006, because a voice loses little to the filter while white noise loses about
12 dB; the gate is therefore both more sensitive to a quiet voice and harder for
noise to open.

Driving the reference singer of the scoring subsystem through the pipeline over
all bundled songs (210 notes):

| Condition | Unfiltered detector | Band-limited |
|-----------|---------------------|--------------|
| Reference room | 99.5% landed | 99.5% |
| Breath noise louder than the voice's fundamental | 0% | 100% |
| Broadband hiss as loud as the voice | 0% | 100% |
| 60 Hz hum louder than the voice | 0% | 100% |
| Very quiet voice | 91% | 99% |
| Nobody singing, same hiss or hum | no pitch frames | no pitch frames |

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement
refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `AE-L2-10` | `AE-L1-4` | The engine shall analyse 2048-sample time-domain windows, band-limited per `AE-L2-19`, with the McLeod pitch method and, for an accepted frame, report `{ hz, midi, clarity, rms }` where `midi` is a float (`69 + 12·log2(hz/440)`) and `rms` is the level of the unfiltered window. |
| `AE-L2-11` | `AE-L1-5` | The engine shall reject (report no pitch for) any frame whose band-limited RMS level is below 0.006, so quiet background noise does not register as singing. |
| `AE-L2-12` | `AE-L1-5` | The engine shall reject a frame whose detector clarity is below 0.8 or whose frequency falls outside 70–1500 Hz, so uncertain or out-of-band detections are discarded. |
| `AE-L2-13` | `AE-L1-4, AE-L1-5` | The reported MIDI value shall be the median of the most recent 5 accepted frames, so a single octave-error blip cannot swing the reported pitch. |
| `AE-L2-14` | `AE-L1-6` | The engine shall request the microphone with echo cancellation, noise suppression, and auto-gain **disabled** (to preserve pitch fidelity), and shall propagate a permission-denied error to the caller rather than swallowing it. |
| `AE-L2-16` | `AE-L1-6` | Stopping the tracker shall stop the media tracks, disconnect the audio nodes, and clear the smoothing history and last frame, so no microphone remains active and no stale pitch survives into a later session. |
| `AE-L2-19` | `AE-L1-5` | Before the level gate and the pitch estimate, each analysis window shall be band-limited to 90–1500 Hz by a 4th-order Butterworth high-pass at 90 Hz followed by a 4th-order Butterworth low-pass at 1500 Hz, computed for the context's sample rate. |
| `AE-L2-20` | `AE-L1-4, AE-L1-5` | Taken end to end, the engine shall keep hearing an in-tune child through a breathy voice, broadband hiss, mains hum, or a quiet voice — at least 90% of notes landed in each case — and shall report no pitch at all when the same interference is present and nobody sings. |

## Diagrams

### System context

The singer sings into the TwinkleTune web app, which requests the microphone and
reads audio frames through the browser Web Audio API on the device.

![C4 system context for detecting pitch](diagrams/c4-context.png)

### Containers

A voice-capture or tuner screen polls the pitch engine each frame, and the engine
acquires the microphone and reads the analyser through the browser.

![C4 container view for detecting pitch](diagrams/c4-container.png)

### Components

Inside the pitch engine, `PitchTracker` reads the `AnalyserNode` and delegates
each window to `PitchAnalyzer`, which band-limits it with `BandLimiter`, takes
the frequency estimate from the `pitchy` `PitchDetector`, and converts frequency
to MIDI through `hzToMidi()`.

![C4 component view for detecting pitch](diagrams/c4-component.png)

### Class structure

`PitchTracker` owns a `PitchAnalyzer` and exposes the latest `PitchFrame`; the
analyzer owns a `BandLimiter` and depends on the `pitchy` `PitchDetector` for
`findPitch` and on `range.ts` for `hzToMidi`.

![Class diagram for detecting pitch](diagrams/class-structure.png)

### Behaviour — acquire the microphone and read a frame

`start()` requests the microphone with echo cancellation, noise suppression, and
auto-gain off (`AE-L2-14`); the `alt` models the denied-permission path. `read()`
then band-limits the window (`AE-L2-19`) and applies the level gate
(`AE-L2-11`), the McLeod estimate (`AE-L2-10`), the clarity and bounds gate
(`AE-L2-12`), and the median filter (`AE-L2-13`), with the too-quiet and
too-uncertain rejections shown as `alt` branches and the teardown (`AE-L2-16`) as
an `opt`.

![Sequence diagram for acquiring the microphone and reading a frame](diagrams/sequence-acquire-mic-and-read-frame.png)
