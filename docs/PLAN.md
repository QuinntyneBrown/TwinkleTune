# TwinkleTune — Build Plan: Mockups → Fully Functional App

## Context

The `docs/` folder holds 9 approved HTML mockups for TwinkleTune, a singing app for a 9-year-old: every song transposed to her voice, real-time note-by-note feedback, confidence-building tips, and progress/badges. This plan turns those mockups into a complete, working end-to-end application.

**Platform decision: web application — no features are lost.**
- Real-time pitch detection works in-browser via `getUserMedia` + Web Audio.
- Songs are stored as *note data* (not recordings) and synthesized with Web Audio, so transposing into her key is a semitone offset — zero audio artifacts, and slow mode is just a lower BPM.
- A PWA (manifest + service worker) makes it installable and fully offline on a tablet — feels native.
- Bonus: no accounts, no audio ever leaves the device (kid-privacy friendly).

A native app would only be needed for app-store distribution or licensed master recordings — neither is in scope.

**Stack (user-confirmed): Vite + TypeScript, no framework.** The mockup HTML/CSS ports nearly 1:1. Only runtime dependency: `pitchy` (McLeod pitch method). Dev: `vitest`.

## Layout

App lives in `frontend/`; the `docs/mocks/` mockups stay untouched as the design reference.

```
frontend/
  package.json, vite.config.ts, index.html    (SPA shell)
  public/          manifest, icons, service worker
  src/
    main.ts        hash router (#/welcome, #/home, …) + screen mounting
    ui/            shared components ported from the mockup design system:
                   buttons, cards, modal, toast, bottom nav, mascot SVG, sky decor
    screens/       one module per mockup: welcome, voice-setup, home, songs,
                   sing, results, tips, progress (dialogs are ui/modal instances)
    audio/
      player.ts    Web Audio synth playback (triangle osc + envelope melody),
                   transpose by semitones, tempo, count-in
      pitch.ts     mic capture → pitch detection (pitchy MPM) → Hz → MIDI float;
                   median filter (~5 frames), RMS noise gate, clarity threshold
      range.ts     voice-range capture → per-song semitone shift
    songs/
      types.ts     Song schema
      catalog.ts   6 public-domain songs as typed note data
    state/
      store.ts     localStorage-backed profile, progress, sparkles, streaks
      scoring.ts   note hit detection, streaks, stars, tricky-part finder
      badges.ts    award rules
```

## Key designs

**Song format** — `{ id, title, emoji, bpm, difficulty, phrases: [{ lyric, notes: [{ midi, start, dur, syll }] }] }` (times in beats). Phrase grouping drives karaoke lines and the "practice the tricky part" loop. Ship 6 hand-encoded **public-domain** songs — the mockups' copyrighted titles get replaced.

**"In your key"** — Voice setup captures her lowest and highest comfortable note (sustained ≥1 s, octave-error-guarded). Per song: shift = semitones that center the song's note span inside her range, clamped to ±6. Stored in profile; re-runnable anytime (powers the "your range grew" card).

**Kid-friendly scoring** — a note is *landed* when the sung pitch is within ±50 cents **after octave folding** (pitch-class match — kids naturally sing in their own octave) for ≥50% of the note's duration. Streak counter, +10 sparkles per hit, end-of-song: notes landed, stars for pitch/timing/braveness, tricky part = phrase with lowest hit ratio → offer practice loop at 70% tempo.

**Gameplay loop (sing screen)** — one `requestAnimationFrame` loop drives note-pill scrolling (DOM transforms, reusing mockup pill design), karaoke word highlight, and the singer-star's Y position from live pitch. Toasts/cheers fire from scoring events.

**Gamification** — localStorage JSON: profile (name, avatar, range), per-song bests, sparkles, date-based daily streak, badges (First Song, 3-Day Streak, High Note Hero, Show Stopper, Brave Bird, Perfect Ten). Parent gate (math question modal) guards settings/reset.

## Phases (each independently verifiable)

| # | Work | Acceptance criteria |
|---|------|---------------------|
| 0 | Save `docs/PLAN.md`; scaffold Vite + TS + vitest at repo root | `npm run dev` serves shell; `npm test` runs |
| 1 | Port design system; hash router; all 9 screens as static components | Click through every screen; visual parity with `docs/` mockups |
| 2 | Song schema + 6 PD songs; state store | Vitest green for store; songs validate against schema |
| 3 | Playback engine | Dev page plays any song transposed ±6 st; slow mode; count-in |
| 4 | Pitch detection + mic permission flow | Dev tuner shows sung note stable within ±20 cents, latency <150 ms; mic-denied state handled |
| 5 | Voice setup wired end-to-end | Range saved → song list shows computed "In your key ✓" shift |
| 6 | Sing-screen gameplay + live scoring | Full playthrough: synced pills, live hits, streaks, karaoke highlight |
| 7 | Results, badges, streaks, practice-the-tricky-part | Scoring/badge/streak rules unit-tested (mocked dates); practice mode loops correct phrase at 70% tempo |
| 8 | Tips content, all dialogs, parent gate, grown-ups settings | All 7 dialog types functional |
| 9 | PWA, polish, accessibility, tablet test | Installable, runs offline, touch-friendly |

## Verification

- **Unit (vitest):** scoring math, octave folding, transposition/range math, badge rules, streak logic with mocked dates.
- **Manual:** dev tuner page (`#/tuner`) against a piano app for pitch accuracy; complete sing-through of Twinkle Twinkle; mic-permission-denied path; install + offline test on her tablet.

## Risks & mitigations

- **Octave detection errors** → pitch-class scoring + median filter.
- **Mic latency on budget tablets** → adjustable latency offset in Grown-Ups settings.
- **Background noise** → RMS gate + pitchy clarity threshold.
- **iOS/Safari audio policy** → AudioContext resumed on first user tap.
