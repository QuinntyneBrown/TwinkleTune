# TwinkleTune ⭐

A singing buddy web app for young performers. Every song is **tuned to the singer's own voice**, a friendly star coach named **Twinkle** gives note-by-note feedback while they sing, and the only kind of feedback that exists is encouragement.

Built for a 9-year-old: one big obvious action per screen, few words, big rounded type, and chunky toy-like buttons.

## How it works

- 🎯 **Find My Voice** — a 1-minute game listens for the singer's lowest and highest comfortable notes, then transposes every song to sit in that range. Songs are synthesized from note data, so re-keying is artifact-free.
- 🎤 **Sing!** — syllable pills scroll toward the singer's star avatar, which moves with their live pitch (Web Audio + [pitchy](https://github.com/ianprime0509/pitchy) pitch detection). Scoring is octave-forgiving — kids naturally sing in their own octave.
- 🎉 **Celebrate** — stars, confetti, streaks, sparkles, and badges. Tricky phrases become an invitation: "want to practice just that bit?" (looped at 70% tempo, never a penalty).
- 💡 **Twinkle's Tips** — warm-ups and confidence boosters ("mistakes are sparkle dust").
- 🔒 **Grown-Ups Corner** — parent-gated settings (mic latency offset, voice re-setup, reset). All data stays in `localStorage`; no accounts, no audio ever leaves the device.

The songs are six hand-encoded **public-domain** melodies: Twinkle Twinkle Little Star, Mary Had a Little Lamb, Hot Cross Buns, London Bridge, Old MacDonald, and Row Row Row Your Boat.

## Repository layout

```
frontend/        The app — Vite + TypeScript, no framework
  src/audio/     Web Audio synth player, mic pitch tracker, voice-range math
  src/songs/     Song schema + public-domain catalog (note data, not recordings)
  src/state/     localStorage store, octave-folded scoring, badge rules
  src/screens/   One module per screen (welcome, voice setup, home, songs,
                 sing, results, tips, progress, dev tuner)
  src/ui/        Shared parts: mascot, modals, toasts, bottom nav
  public/        PWA manifest, icons, service worker
docs/
  PLAN.md        Build plan (mockups → working app)
  mocks/         The original HTML design mockups (open mocks/index.html)
```

Palette: `#F4DBE3` · `#5EA8DA` · `#83C5F1` · `#B9DDF5` · `#AFE3F4`

## Getting started

```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
```

Other scripts (run from `frontend/`):

| Command           | What it does                              |
|-------------------|-------------------------------------------|
| `npm test`        | Unit tests (scoring, store, badges, songs) |
| `npm run build`   | Type-check + production build to `dist/`  |
| `npm run preview` | Serve the production build locally        |

### Putting it on a tablet

`npm run build`, host `frontend/dist/` anywhere (any static host, or `npm run preview` on your LAN), open it on the tablet and **Add to Home Screen** — the PWA installs with its own icon and works offline after the first visit.

### Handy hidden screen

`#/tuner` is a developer tuner (note name, cents needle, clarity) for sanity-checking pitch detection against a piano app.

## Design

The design mockups in `docs/mocks/` are the visual source of truth — a soft pastel "sky studio" built from the palette above, with Baloo 2 + Nunito type. Start at `docs/mocks/index.html` for a gallery of every screen and dialog.
