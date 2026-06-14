# TwinkleTune ⭐

A singing app for young performers. Every song is **tuned to the singer's own voice**, a friendly star coach named **Twinkle** gives note-by-note feedback while they sing, and the only kind of feedback that exists is encouragement. With the optional **family server**, sisters can switch profiles, duet head-to-head on two devices with live note streaks, and chase family high scores.

Built for kids: one big obvious action per screen, few words, big rounded type, and chunky toy-like buttons.

## How it works

- 🎯 **Find My Voice** — a 1-minute game listens for the singer's lowest and highest comfortable notes, then transposes every song to sit in that range. Songs are synthesized from note data, so re-keying is artifact-free. The range saves to her profile and follows her across devices.
- 🎤 **Sing!** — syllable pills scroll toward the singer's star avatar, which moves with their live pitch (Web Audio + [pitchy](https://github.com/ianprime0509/pitchy) pitch detection). Scoring is octave-forgiving — kids naturally sing in their own octave.
- 🎤🎤 **Duets** — make a 4-letter room code, a sister joins from her device, both sing the same song at once and watch each other's sparkles and note streaks live (SignalR). Results lead with the *combined* family sparkles.
- 👨‍👧‍👧 **Profiles** — switchable singers with a picked avatar or an uploaded photo; per-song **family high scores** with a 🏆 board on every song card.
- 🎉 **Celebrate** — stars, confetti, streaks, sparkles, and badges. Tricky phrases become an invitation: "want to practice just that bit?" (looped at 70% tempo, never a penalty).
- 💡 **Twinkle's Tips** — warm-ups and confidence boosters ("mistakes are sparkle dust").
- 🔒 **Grown-Ups Corner** — parent-gated: mic latency offset, voice re-setup, **song editor** (create/edit/delete songs with live preview), avatar manager, reset.

**Privacy:** badges, streaks and sparkles stay in the device's `localStorage`. Profiles, songs, photos and high scores live only on *your* home server (`backend/data/` — one SQLite file plus a photos folder). During duets, only live score events cross the network. Singing audio never leaves the device, and there are no accounts. Solo play works fully offline; every server feature degrades gracefully.

The seeded songs are six hand-encoded **public-domain** melodies: Twinkle Twinkle Little Star, Mary Had a Little Lamb, Hot Cross Buns, London Bridge, Old MacDonald, and Row Row Row Your Boat. Grown-ups can add more in the song editor.

## Repository layout

```
frontend/        The app — Vite + TypeScript, no framework
  src/audio/     Web Audio synth player, mic pitch tracker, voice-range math
  src/songs/     Song schema + bundled catalog + server songbook w/ offline cache
  src/state/     per-profile localStorage store, octave-folded scoring, badges
  src/screens/   One module per screen (incl. profiles picker + duet lobby)
  src/api/       REST client + SignalR duet client
  src/ui/        Shared parts: mascot, modals, toasts, managers, bottom nav
  public/        PWA manifest, icons, service worker
backend/         Family server — .NET 10, Clean Architecture
  src/TwinkleTune.Domain/          entities + song invariants (no dependencies)
  src/TwinkleTune.Application/     services, DTOs, in-memory duet rooms
  src/TwinkleTune.Infrastructure/  EF Core + SQLite, photo storage, seeding
  src/TwinkleTune.Api/             minimal API + SignalR DuetHub
  tests/                           unit + integration (incl. 2-client duet flow)
e2e/             Playwright suites: offline app (npm test) and
                 full-stack duets/profiles (npm run test:server)
docs/
  PLAN.md            Build plan (mockups → working app)
  PLAN-BACKEND.md    Build plan (backend milestone)
  adr/               Architecture decision records
  mocks/             The original HTML design mockups (open mocks/index.html)
```

Palette: `#F4DBE3` · `#5EA8DA` · `#83C5F1` · `#B9DDF5` · `#AFE3F4`

## Getting started

**Frontend only (solo play, fully offline):**

```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
```

**With the family server (profiles, duets, high scores, song editor):**

```bash
cd backend
dotnet run --project src/TwinkleTune.Api    # → http://localhost:5240
```

The frontend looks for the server at `http://localhost:5240` by default; point it elsewhere with
`VITE_API_URL`. For two-device duets on your Wi-Fi, serve both apps on your PC's LAN address and
add that origin to `Cors:Origins` in `backend/src/TwinkleTune.Api/appsettings.json`. The server is
designed for **home-LAN use only** — don't expose it to the internet (no auth by design; see ADR-0002).

| Command (where)              | What it does                                           |
|------------------------------|--------------------------------------------------------|
| `npm test` (frontend/)       | Unit tests (scoring, store, badges, songs)             |
| `npm run build` (frontend/)  | Type-check + production build to `dist/`               |
| `dotnet test` (backend/)     | Backend unit + integration tests (incl. SignalR duet)  |
| `npm test` (e2e/)            | Playwright suite against the offline app               |
| `npm run test:server` (e2e/) | Full-stack Playwright suite (isolated test database)   |

### Putting it on a tablet

`npm run build`, host `frontend/dist/` anywhere (any static host, or `npm run preview` on your LAN), open it on the tablet and **Add to Home Screen** — the PWA installs with its own icon and works offline after the first visit.

### Handy hidden screen

`#/tuner` is a developer tuner (note name, cents needle, clarity) for sanity-checking pitch detection against a piano app.

## Design

The design mockups in `docs/mocks/` are the visual source of truth — a soft pastel "sky studio" built from the palette above, with Baloo 2 + Nunito type. Start at `docs/mocks/index.html` for a gallery of every screen and dialog.
