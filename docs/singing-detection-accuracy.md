# Singing Detection Accuracy — Architecture Investigation

**Date:** 2026-07-25
**Scope:** `frontend/src/audio/pitch.ts`, `frontend/src/audio/player.ts`,
`frontend/src/audio/range.ts`, `frontend/src/state/scoring.ts`,
`frontend/src/screens/sing.ts`, `frontend/src/screens/voice-setup.ts`,
`frontend/src/ui/settings.ts`
**Status:** Investigation findings and recommendations. No code was changed.

---

## 1. Executive summary

TwinkleTune's pitch pipeline is well-chosen at the algorithm level — McLeod
pitch method via `pitchy`, octave-folded scoring, a median filter, an RMS gate,
and a deliberate refusal to let the browser apply auto-gain or noise
suppression. Those are the right decisions for a children's singing game.

The accuracy problems are **not** in the choice of algorithm. They are in the
*plumbing around it*: how audio reaches the detector, how detected frames are
counted, and how the app's idea of "now" is aligned to what the child actually
hears. Six issues stand out, in rough order of impact on a real family's
experience:

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| A | Latency compensation defaults to `0 ms` and is never measured | **Severe** — scoring is systematically early by 100–250 ms | Medium |
| B | Detection is driven by `requestAnimationFrame`, and scoring counts *frames* not *time* | **Severe** — a 30 fps device scores differently from a 60 fps device | Medium |
| C | The median filter's history is not cleared when frames are rejected | **High** — every phrase opens with up to 4 frames of the *previous* phrase's pitch | Trivial |
| D | The synthesized melody leaks from speaker into microphone with no reference cancellation | **High** — the game can score an empty room | Medium–Large |
| E | Fixed absolute gates (`MIN_RMS`, `MIN_CLARITY`) don't adapt to mic, child, or room | **High** — quiet or breathy children are systematically under-detected | Medium |
| F | Scoring is a per-frame boolean with a hard ±50 ¢ edge and no attack allowance | **Medium** — punishes the scooping that children naturally do | Medium |

Findings A, B and C are code-verifiable from the current source and are
described precisely below. Finding D is a mechanism identified by inspection;
it should be confirmed empirically before large engineering effort is spent on
the full fix (§4.4 gives a cheap first mitigation).

---

## 2. How the pipeline works today

```
                         ┌──────────────────────────────────────────┐
  microphone ──────────► │ getUserMedia                             │
                         │   echoCancellation:  false               │
                         │   noiseSuppression:  false               │  pitch.ts
                         │   autoGainControl:   false               │
                         └────────────────┬─────────────────────────┘
                                          ▼
                         MediaStreamAudioSourceNode ──► AnalyserNode (fftSize 2048)
                                          │
             read()  ◄─────────────────────┘   ← called once per requestAnimationFrame
               │
               ├─ getFloatTimeDomainData(2048)          most recent ~43 ms only
               ├─ RMS gate           rms  < 0.01        → reject
               ├─ McLeod findPitch()
               ├─ clarity gate       clarity < 0.8      → reject
               ├─ band gate          hz ∉ [70, 1500]    → reject
               └─ median of last 5 accepted MIDI values → PitchFrame
                                          │
                                          ▼
   sing.ts loop():   scoreBeat = player.currentBeat() − latencyMs/1000/secondsPerBeat
                     activeNote = note where scoreBeat ∈ [start, start+dur)
                     hit if |foldCents(frame.midi, note.midi + shift)| ≤ 50
                     r.totalFrames++ ; r.hitFrames++ on hit
                                          │
                                          ▼
   scoring.ts:       noteLanded = totalFrames ≥ 3 && hitFrames/totalFrames ≥ 0.5
                     stars from landed/total
```

Two design choices deserve explicit credit before the criticism starts:

1. **`SongPlayer.currentBeat()` reads `AudioContext.currentTime`, not
   `performance.now()`.** The transport clock is the audio clock. This is
   correct and avoids a whole family of drift bugs that karaoke apps usually
   have.
2. **Octave-folded scoring (`foldCents`).** Children sing in whatever octave
   their voice lives in. Folding to pitch class is exactly right, and it makes
   the ±6 clamp in `computeShift` harmless for scoring — the transposition
   exists to make the *audible* melody comfortable to imitate, not to make
   scoring work.

---

## 3. Findings in detail

### A. Latency compensation defaults to zero and is never measured

**Evidence.** `Profile.latencyMs` is initialised to `0` in both places a profile
is created (`screens/welcome.ts:69`, `state/profile.ts:15`). The only way it
ever becomes non-zero is a grown-up dragging the slider in
`ui/settings.ts:24` — a control most families will never find, buried behind the
parent gate, labelled "If cheers feel late, nudge this".

**Why it matters.** The real end-to-end offset between "the child sings a note"
and "the app scores that note" is the sum of at least five terms, none of which
is currently accounted for:

| Term | Typical magnitude | Source |
|------|-------------------|--------|
| Output latency (speaker) | 20–150 ms | `AudioContext.outputLatency` + `baseLatency` |
| Microphone capture buffering | 10–60 ms | OS/driver, varies wildly by device |
| Analysis window centroid | ~21 ms | `FFT_SIZE/2 / sampleRate` |
| Median filter group delay | ~33 ms at 60 fps, ~67 ms at 30 fps | `MEDIAN_WINDOW/2` frames |
| Render-loop poll interval | 8–17 ms average | rAF cadence |
| **Total** | **~90–280 ms** | |

The output-latency term matters more than it looks. `currentTime` is the moment
a sample is *submitted* to the audio graph, not the moment it leaves the
speaker. The child sings in time with what they *hear*, so the app's transport
is ahead of the child's reference by the full output latency — and then the
child's voice arrives late by the input latency on top of that. Both errors
push in the same direction.

At 120 BPM a beat is 500 ms. A 200 ms uncorrected offset is 0.4 beats — often
longer than an eighth note. The practical symptom is a child who is singing
perfectly in time being scored against the *previous* note for the first ~40 %
of every note, which also corrupts `firstHitFrac` and therefore the timing
stars, which are computed from `firstHitFrac ≤ 0.4`.

**Recommendation.**

1. **Seed `latencyMs` automatically at first run** rather than defaulting to 0:

   ```ts
   const ctx = audioCtx()
   const seedMs =
     (ctx.baseLatency + (ctx.outputLatency ?? 0)) * 1000 +   // speaker path
     (FFT_SIZE / 2 / ctx.sampleRate) * 1000 +                 // window centroid
     (MEDIAN_WINDOW / 2) * (1000 / measuredFrameRate) +       // filter delay
     inputLatencyMs                                            // from track settings
   ```

   `MediaStreamTrack.getSettings().latency` is available on Chromium and gives
   the input term; fall back to a conservative 30 ms elsewhere. Even a rough
   seed is enormously better than 0.

2. **Add a real round-trip measurement** as an optional 15-second step: emit a
   short chirp through the speaker, listen for it on the mic, cross-correlate,
   and take the lag. This measures *everything* — output, acoustic flight time,
   input, and buffering — in one number, on the actual hardware. Run it three
   times and take the median. See §5.2 for how to make this a delightful step
   for a child rather than a technical chore.

3. **Store latency per audio device, not just per device.** Key the value on
   `MediaDeviceInfo.deviceId` (or a hash of `groupId` + label). Plugging in
   earbuds changes the correct offset by 50–100 ms; carrying a stale value
   across that switch is worse than having no value.

### B. Detection cadence is coupled to the render loop, and scoring counts frames

**Evidence.** `PitchTracker.read()` is called exactly once per
`requestAnimationFrame` in `screens/sing.ts:276`. `scoring.ts` then accumulates
integers per call: `r.totalFrames++`, `r.hitFrames++`, and decides with
`noteLanded(r, minFrames = 3)` → `totalFrames >= 3 && hitFrames/totalFrames >= 0.5`.

**Why it matters.** Three separate problems fall out of this.

*Frame-rate dependence of the score.* A device running the WebGPU reactive
scene at 30 fps accumulates half the frames per note that a 60 fps device does.
The ratio test survives that, but the `minFrames >= 3` floor does not: a short
note (e.g. `dur = 0.5` at 120 BPM = 250 ms) yields ~15 frames at 60 fps but only
~7 at 30 fps — and under thermal throttling or a heavy scene, fewer still. Notes
that fall below three observed frames are silently treated as not landed,
regardless of how well they were sung. Two children on two tablets get different
scores for identical singing. For a family leaderboard, that is a fairness bug,
not just an accuracy bug.

*Audio is discarded, not analysed.* `getFloatTimeDomainData` returns only the
most recent 2048 samples — about 43 ms at 48 kHz. At 60 fps (16.7 ms) windows
overlap and nothing is lost. At 30 fps (33 ms) coverage is still just about
complete. But any rAF stall longer than ~43 ms — a garbage-collection pause, a
scene recompile, a backgrounded tab — drops audio on the floor entirely.
Nothing in the pipeline knows this happened.

*The median filter's time constant is not constant.* `MEDIAN_WINDOW = 5` is
83 ms of history at 60 fps and 167 ms at 30 fps. So is `StablePitchCapture`'s
`windowFrames = 40` in voice setup, documented in the source as "~0.7 s at
60 fps" — on a 30 fps device the child must hold a steady note for 1.3 seconds
to complete the range capture. Small children find that hard, especially at the
top of their range where the voice is least stable.

**Recommendation.**

1. **Move detection into an `AudioWorkletNode`.** The worklet runs on the audio
   thread at a fixed cadence, keeps a ring buffer, and analyses at a
   deterministic hop (e.g. 2048-sample window, 512-sample hop → ~94 analyses per
   second at 48 kHz, gapless). It posts frames to the main thread; the render
   loop just reads the latest. This single change fixes the frame-rate
   dependence, the dropped-audio problem, and the variable filter time constant,
   and it makes detection immune to the WebGPU scene's cost. It is also the
   precondition for finding D's proper fix.

2. **Make scoring time-based, not frame-based.** Replace `hitFrames` /
   `totalFrames` with `hitSeconds` / `heardSeconds`, accumulated as
   `dt = now − lastFrameTime`. Replace `minFrames = 3` with a duration floor
   (e.g. 60 ms of observation). The change is small and localized to
   `NoteResult`, `noteLanded`, and the accumulation block in `sing.ts`, and it
   makes the score identical across frame rates even before the worklet lands.
   This is the highest value-per-hour item in the whole document.

3. **Express `StablePitchCapture`'s window in milliseconds**, converting to
   frames from a measured rate — or drive it from the worklet's fixed cadence.

### C. Median-filter history survives rejected frames

**Evidence.** `pitch.ts:63-72`. Both rejection paths — RMS gate and
clarity/band gate — set `this.latest = null` and return, but leave
`this.history` untouched. Only `stop()` clears it.

**Why it matters.** Consider a phrase boundary: the child stops singing, four
frames are rejected for low RMS, the child starts the next phrase on a different
note. The first accepted frame of the new note is medianed against **four stale
values from the previous phrase**, so `read()` reports the *old* pitch. With a
5-element window, the reported pitch does not become a majority of new data
until the third accepted frame.

The damage lands precisely where it hurts most:

- The first frames of every note are the ones that set `firstHitFrac`, which
  drives the timing stars (`firstHitFrac ≤ 0.4` → "caught early"). A wrong pitch
  at note onset suppresses the early-hit flag.
- On short notes, the stale window can be a meaningful fraction of the whole
  note.
- The gap can be arbitrarily long. Nothing bounds how old a history entry is —
  a child who pauses for ten seconds resumes with a ten-second-old pitch in the
  filter.

**Recommendation.** Clear or age out the history on rejection. Minimal fix:

```ts
if (rms < MIN_RMS) {
  if (++this.silentFrames > 1) this.history.length = 0
  this.latest = null
  return null
}
```

Better: store `{ midi, t }` pairs and drop entries older than ~120 ms when
reading, which also makes the filter's behaviour independent of the poll rate
(and composes with finding B). Best: add onset detection — when RMS rises
sharply after a quiet period, flush the history so a new note's attack is never
smeared with the previous note's pitch.

### D. The app's own melody can be scored as the child's singing

**Evidence.** `SongPlayer` synthesizes the melody with a triangle oscillator
plus a sine sub-octave, straight to `ctx.destination` — the device speakers.
`PitchTracker.start()` requests the mic with `echoCancellation: false`. There is
no reference-signal cancellation anywhere in the graph.

**Why it matters.** The leaked signal is close to a worst case for this
detector:

- It is a synthesized tone, so McLeod clarity is very high — comfortably above
  `MIN_CLARITY = 0.8`, higher than a real child's breathy voice usually manages.
- It is at *exactly* the target pitch, so `foldCents` returns ~0 and the ±50 ¢
  test passes trivially.
- On a laptop it is worst of all, because the speakers fire toward the same
  bezel the mic sits in.

The consequence is that with the volume up and no one singing, the app can award
a good score to an empty room. Beyond fairness, it corrupts the signal the whole
game is built on: a child who sings *nothing* on a hard phrase may still see it
marked landed, so the "tricky part" detection in `summarize()` never surfaces
the phrase they actually need to practise.

Disabling `echoCancellation` was the right call for pitch fidelity — browser AEC
mangles sustained tones. The answer is not to turn it back on, but to cancel
using the reference the app already has.

**Recommendation, cheapest first.**

1. **Recommend and detect headphones.** Wired earbuds eliminate the path
   entirely. Surface this in the sound-check step (§5.2) and, when the output is
   speakers, quietly hold the melody's master gain lower during sung passages.

2. **Known-reference suspicion heuristic (cheap, ships in a day).** The app
   knows exactly which note the synth is sounding at every instant. Flag a frame
   as suspect when *all* of: the detected pitch is within ~15 ¢ of the currently
   sounding synth pitch, clarity > 0.97, and RMS is in the low range typical of
   leakage rather than of a child at arm's length. Suspect frames should not
   count toward `hitFrames`. This is imperfect — a child singing dead-on in
   unison is the false positive — but the clarity threshold separates the cases
   well in practice, because human voices essentially never sustain clarity that
   high.

3. **Adaptive echo cancellation with the synth as reference (proper fix).**
   Because TwinkleTune *generates* the melody, it has a perfect, sample-aligned
   reference signal — which is exactly what generic browser AEC lacks. Split the
   `SongPlayer` master into a second, silent branch feeding an AudioWorklet, and
   run an NLMS adaptive filter to subtract the speaker path from the mic input
   before pitch detection. This is real DSP work, but it is the difference
   between "works with headphones" and "works in a living room". It depends on
   the worklet migration in finding B, which is a good reason to do B first.

### E. Fixed absolute gates don't adapt to the mic, the child, or the room

**Evidence.** `MIN_RMS = 0.01`, `MIN_CLARITY = 0.8`, `MIN_HZ = 70`,
`MAX_HZ = 1500` — all module constants, applied identically everywhere.

**Why it matters.**

*The RMS gate has no fixed meaning.* With `autoGainControl: false` (correct),
the absolute sample level depends entirely on mic sensitivity, distance, and
platform gain. A quiet four-year-old at arm's length from a laptop's low-gain
array mic can sit below 0.01 for an entire song — Twinkle simply never hears
them, and the app gives no diagnosis, just a zero score. Conversely, a room with
a TV or an air purifier can sit *above* 0.01 continuously, so background noise
is fed to the detector all song long.

*The clarity gate is tuned for adults.* Children's voices are breathy and
unstable, particularly at the top of their range and at note onsets. McLeod
clarity for a small child frequently sits in the 0.6–0.8 band. Discarding all of
those frames both loses real singing and interacts badly with finding B's
`minFrames >= 3` floor — the notes most likely to be dropped are exactly the
high notes that drive the `braveStars` calculation.

*The band is wider than the content.* `validateSong` already restricts songs to
MIDI 48–84 (130–1046 Hz), and children's fundamentals live in roughly 200–1100
Hz. Accepting down to 70 Hz just admits HVAC hum, footsteps and table thumps as
candidate pitches. At 70 Hz a 2048-sample window at 48 kHz contains only about
three periods — not enough for a reliable autocorrelation estimate anyway.

**Recommendation.**

1. **Measure a noise floor and set the gate relative to it.** The voice-setup
   flow and the count-in both offer natural quiet windows. Set
   `gate = max(0.006, noiseFloor × 2.5)` and re-estimate periodically. This
   fixes both the too-quiet child and the noisy room with one mechanism.
2. **Narrow the band to `MIN_HZ = 130`, `MAX_HZ = 1200`** and insert a
   `BiquadFilterNode` high-pass at ~90 Hz before the analyser. Rumble also
   inflates RMS, so removing it makes the loudness gate more honest, not just
   the pitch estimate.
3. **Soften the clarity gate.** Instead of a hard reject below 0.8, accept
   frames down to ~0.55 and carry the clarity forward as a *weight* into
   scoring, so a marginal frame contributes partially. This pairs naturally with
   the time-weighted scoring in finding B.
4. **Track and surface "heard" separately from "hit."** Add a `heardSeconds`
   counter alongside `hitSeconds` in `NoteResult`. It costs almost nothing and
   unlocks the single most valuable UX improvement in §5.3 — telling the
   difference between "you sang the wrong note" and "I couldn't hear you."

### F. Per-frame boolean scoring with a hard edge and no attack allowance

**Evidence.** `HIT_TOLERANCE_CENTS = 50` in a strict `≤` comparison,
per frame, with no weighting by position within the note.

**Why it matters.** Two effects, both of which punish normal child singing.

*The cliff.* A child consistently 45 ¢ flat scores a perfect note; one at 55 ¢
flat scores zero. Their singing is nearly identical and the feedback is
opposite. The results screen has no way to say "you were close and always a
little flat" — which is the single most actionable coaching note a beginning
singer can receive, and would slot naturally into the existing tips system.

*The scoop.* Children approach notes with a portamento glide from below,
typically over the first 100–200 ms. Under per-frame accumulation, every one of
those attack frames counts against the 50 % ratio. On short notes the glide can
be most of the note, so a note that was *arrived at* perfectly still fails.

**Recommendation.**

1. **Graded credit instead of a boolean.** Full credit within ±35 ¢, falling
   linearly to zero at ±110 ¢. Aggregate the graded values over the note. This
   is a small change to the accumulation block and makes the score continuous,
   which is both fairer and more informative.
2. **Discount the attack.** Weight the first ~25 % of a note's duration at, say,
   0.3, or skip it entirely when the note is long enough to have a sustain. This
   is what commercial karaoke scorers do, and it directly rewards the thing you
   want to teach — *landing and holding* the note.
3. **Consider a note-level decision from the contour.** Collect the pitch
   contour across the note window, drop the attack, take the median of the
   sustained portion, and compare once. This is dramatically more robust to
   momentary dropouts than counting frames, and it produces a per-note signed
   cents error — exactly the input a "you're singing a bit flat on the high
   notes" coaching message needs.
4. **Report signed error, not just magnitude.** `summarize()` currently keeps no
   record of *direction*. Median signed cents per song is one extra field and
   powers a whole class of genuinely useful, encouraging feedback.

### G. Secondary observations

- **No tests cover `pitch.ts`.** `range.test.ts` and `scoring.test.ts` exist;
  the detector has none, because it depends on Web Audio globals. Extract a pure
  `analyzeFrame(samples, sampleRate, state) → PitchFrame | null` and test it
  against synthesized waveforms with known fundamentals, plus a small corpus of
  recorded child-voice WAV fixtures with ground-truth annotations. Without a
  corpus, every constant in §3.E is being tuned by feel; with one, they can be
  optimised against measured hit rate and false-positive rate.
- **`AudioContext` is created without a `latencyHint`.** `new AudioContext({
  latencyHint: 'interactive' })` reduces the output-latency term in finding A on
  most platforms, at some CPU cost.
- **`audioCtx()` is called inside the per-frame hot path** (`pitch.ts:68`) purely
  to read `sampleRate`. Cache it at `start()`.
- **The `#/tuner` dev screen is a genuine asset.** It already surfaces hz,
  clarity and RMS. Extending it with a noise-floor read-out, a measured
  frame-rate display, and a round-trip latency measurement would turn it into
  the diagnostic tool this investigation's follow-up work needs. See §5.2 for
  the child-facing version.
- **Voice-setup's high-note capture is the hardest moment in the app.**
  `StablePitchCapture` demands 40 frames within a 1.0-semitone spread, at the
  exact top of the child's range where the voice is least stable. Consider
  loosening `spreadSemitones` for the high capture specifically, or capturing
  the maximum of a deliberate upward sweep instead of a sustained tone.

---

## 4. Prioritised roadmap

**Tier 1 — small changes, large accuracy gains.** Do these first.

1. Clear the median-filter history on rejection (finding C). Roughly five lines.
2. Convert `NoteResult` accumulation from frames to seconds (finding B.2).
3. Seed `latencyMs` from `baseLatency` + `outputLatency` + known pipeline delays
   instead of 0 (finding A.1).
4. Narrow the frequency band and add the high-pass filter (finding E.2).
5. Extract a pure `analyzeFrame` and start the fixture corpus (finding G).

**Tier 2 — the changes that make it feel right.**

6. Round-trip latency measurement, wrapped as a child-friendly step (§5.2).
7. Noise-floor-relative RMS gate and softened, weighted clarity gate (finding E).
8. Graded scoring with attack discount and signed-error reporting (finding F).
9. `heardSeconds` tracking and the "I couldn't hear you" feedback path (§5.3).

**Tier 3 — architectural.**

10. Migrate detection into an `AudioWorkletNode` with a ring buffer (finding B.1).
11. NLMS echo cancellation using the synth output as reference (finding D.3).
12. Per-audio-device calibration storage (finding A.3).

---

## 5. User-experience recommendations

### 5.1 The core principle

Today, five different failures all present to the child as the same thing — a
note that doesn't light up:

- the mic wasn't granted,
- the child is too far away or too quiet,
- the room is too noisy,
- the timing offset is wrong,
- the child genuinely sang the wrong note.

Only the last one is the child's to fix. Distinguishing them is the highest
leverage UX work available, and finding E.4's `heardSeconds` counter is what
makes it possible.

### 5.2 Add a "Sound Check" step before "Find My Voice"

A 20-second step, in Twinkle's voice, that quietly performs three technical
tasks:

- **"Let's listen to your room first."** Two seconds of silence measures the
  noise floor. If it's high: *"Ooh, it's a bit noisy in here! Can someone turn
  down the TV?"*
- **"Now say hello to me!"** The child speaks or sings; a live level meter fills
  up. Too quiet → *"Come a little closer — about an arm's length!"* Clipping →
  *"Whoa, a bit too close!"* This calibrates the RMS gate and teaches placement
  in one move.
- **"Can you hear my magic sound?"** A chirp plays and is captured; this is the
  round-trip latency measurement from finding A.2, presented as a game rather
  than a technical step.

End with a visible, reassuring result: *"Perfect! I can hear you beautifully."*
Offer a shortcut to re-run it from the pause menu, because rooms and devices
change.

### 5.3 In-game feedback that names the actual problem

- **A quiet "I can't hear you" nudge.** If `heardSeconds` stays near zero across
  a whole phrase, have Twinkle say *"I can't quite hear you — come a bit
  closer!"* rather than silently scoring zeros. This is the single most valuable
  message the app could add.
- **Show the tolerance band.** Draw a soft coloured halo around each note pill
  representing the ±50 ¢ (or graded) window. Right now the child sees a binary
  hit/miss with no sense of how close they were; a visible band turns the game
  into something they can *aim* at.
- **Near-miss feedback.** With graded scoring in place, a note at 60–110 ¢ can
  say *"So close! A tiny bit higher ⬆"* instead of nothing.
- **Don't recentre the star on silence.** `sing.ts:312` drifts the avatar toward
  `midiCenter` when no pitch is detected. To a child that reads as "I'm being
  moved to the wrong place." Fading or holding position is gentler and more
  honest.
- **Results should separate "heard" from "hit."** *"Twinkle heard you for 8 of
  the 12 lines — try moving a bit closer next time!"* is a far more useful
  outcome than a low star count with no explanation.
- **Coach the direction.** With signed cents error, the tips system can say
  *"You were singing just a little bit low on the high notes — take a big
  balloon breath before the loud part!"* That is real, specific, actionable
  singing instruction.

### 5.4 Onboarding and settings

- Move the mic permission request into Sound Check, with a clear explanation of
  *why* before the browser prompt fires. Cold permission prompts have poor
  grant rates, and a denial currently drops the child into a modal after they
  were already excited to sing.
- Replace the raw `−300…+300 ms` slider as the *primary* control with the
  measured value plus a "Re-measure" button. Keep the slider in Grown-Ups
  Corner as a manual override, which is the right home for it.
- Prompt to re-run Sound Check when a different audio input device appears.

### 5.5 Accessibility

- Respect `prefers-reduced-motion` in the reactive scene during singing — it is
  the most visually intense screen in the app.
- Announce Twinkle's coaching messages via an ARIA live region, not visual text
  alone.
- Ensure the tolerance band and hit states are distinguishable without relying
  on colour alone.

---

## 6. Device guidance for families

### 6.1 Which device is best?

**Short answer: a tablet, in a stand, at arm's length.**

**The shortest answer of all: any device plus cheap wired earbuds beats any
device without them.** Earbuds eliminate the speaker-to-microphone path
described in finding D entirely, which removes the largest source of false
scoring and lets the child hear the melody clearly without turning the volume
up.

| Device | Screen at singing distance | Microphone | Speaker→mic bleed | Posture | Verdict |
|--------|---------------------------|------------|-------------------|---------|---------|
| **Tablet** | Large — the note track is readable from an arm's length | Designed for hands-free video calls at 30–60 cm | Moderate | Stands upright; child can stand and breathe | **Best** |
| **Phone** | Too small — the child leans in and stops breathing properly | Usually the best hardware, with strong beamforming | Moderate | Good if propped in landscape | Good fallback |
| **Laptop** | Largest, but the child sits at a desk | Above the keyboard, often 50–80 cm away; picks up fans, keys, table knocks | **Worst** — speakers fire toward the same bezel as the mic | Seated at a desk is the worst singing posture | Workable, use headphones |

The reasoning behind the ranking:

- **The screen must be readable from singing distance.** Good singing requires
  standing back, standing up, and breathing. A phone forces the child to lean in
  to read the lyrics and note track, which collapses their posture and their
  breath support — so the *smallest screen hurts the audio*, indirectly but
  reliably.
- **Tablet mics are tuned for exactly this distance.** Tablet microphone arrays
  are designed around hands-free video calling at 30–60 cm, which is precisely
  where a child should stand. Laptop mics assume you are seated at a keyboard.
- **Laptops have the worst geometry for finding D.** The speakers and the
  microphone are typically within a few centimetres of each other and pointed
  the same way. Laptops also tend to apply the most aggressive OS-level audio
  processing, which fights the deliberate `noiseSuppression: false` choice.
- **Chromebooks and budget tablets** are fine — the algorithm is not
  CPU-hungry — but they are the devices most likely to run the reactive scene at
  30 fps, which is exactly the case finding B describes. The time-based scoring
  fix matters most for these families.

### 6.2 Where to put the device

**Distance: about one arm's length — 30 to 50 cm (12 to 20 inches).**

- Closer than ~15 cm and breath blasts and plosives ("p", "b") overload the mic
  and the level gate mis-reads them as singing.
- Farther than ~1 m and the room's reverberation starts to dominate the direct
  sound, which smears the pitch estimate and drops detector clarity.

**Height: screen at the child's face height, mic edge unobstructed.**

- Prop the tablet in a stand or a folding case so the screen faces the child
  square-on. A device flat on a table both points the mic at the ceiling and
  forces the child to look down, which closes the throat.
- Know where the microphone actually is and don't cover it. Tablets usually
  place it on the top edge in landscape; phones usually have one at the bottom
  and one at the top. A hand, a case flap or a cushion over the port costs more
  signal than any setting in the app.

**Angle: sing past the device, not into it.**

- Aim about 20–30° off-axis rather than straight down the mic. This keeps
  plosives and breath noise off the capsule while losing almost no level.

**Surface: something hard and stable — but not bare.**

- A soft bed or sofa muffles bottom-edge mics and lets the device tilt.
- A bare glass or stone table reflects sound straight back into the mic and
  causes comb filtering. A placemat or a book under the stand fixes it.

**Room: soft and small beats hard and echoey.**

- A carpeted bedroom or living room with soft furniture is ideal.
- Kitchens and bathrooms are the worst — tile and glass produce the reverb that
  most degrades pitch detection.
- Don't stand 30 cm from a bare wall singing at it. A metre of space in front of
  the child helps a lot.

**Noise: switch off what you can.**

- TV, dishwasher, air purifier, ceiling fan, and open windows onto a street all
  raise the noise floor, which raises the level gate and makes quiet singing
  invisible. TwinkleTune deliberately turns off browser noise suppression to
  protect pitch accuracy, so the room genuinely matters more here than in a
  video call.

**Volume: about half, or use headphones.**

- Loud speakers make the melody bleed into the microphone (finding D). Headphones
  or earbuds remove the problem completely and are the single best 10-dollar
  upgrade to the app's accuracy.

**Posture: stand up if you can.**

- Standing gives better breath support, better pitch stability, and a better
  time. Prop the device on a shelf, a windowsill, or a kitchen counter at chest
  height and let the child stand and move.

### 6.3 Quick checklist for the fridge

1. 🎧 Earbuds if you have them — otherwise volume at about half.
2. 📏 Stand an arm's length away.
3. 🧍 Stand up, screen at face height.
4. 🎤 Check nothing is covering the microphone.
5. 🔇 Turn off the TV and the fan.
6. 🛋️ Choose a carpeted room over the kitchen.
7. 🎯 Re-run "Find My Voice" when you switch devices or rooms.

---

## 7. What was not investigated

- No empirical measurement was performed. Every latency figure in §3.A is a
  typical-hardware estimate, not a measurement on the family's devices. Finding
  D's severity in particular should be confirmed by measuring at realistic
  volumes before Tier 3 effort is committed.
- Backend scoring validation (`SongValidator`, high-score submission) was read
  only far enough to confirm the shared song invariants; server-side score
  plausibility checking is out of scope here but is worth a look given
  finding D.
- Duet mode's tick relay was not analysed for how detection latency differences
  between two devices affect the shared experience. Given finding A, two
  uncalibrated devices could easily be 200 ms apart, which is a duet-specific
  fairness question worth its own investigation.
