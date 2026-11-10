<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo/twinkletune-logo-dark.png">
    <img src="docs/logo/twinkletune-logo.png" alt="TwinkleTune" width="440">
  </picture>
</p>

<p align="center">
  An encouragement-only singing app for young performers.
</p>

<p align="center">
  <a href="https://github.com/QuinntyneBrown/TwinkleTune/actions/workflows/ci-cd.yml"><img src="https://github.com/QuinntyneBrown/TwinkleTune/actions/workflows/ci-cd.yml/badge.svg?branch=main" alt="CI and deployment status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT licence"></a>
</p>

<p align="center">
  <a href="https://twinkletune.app">Website</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#contributing">Contributing</a>
</p>

# TwinkleTune

TwinkleTune is a singing app for young performers. Every song is transposed to the singer's own
voice range, a star coach named **Twinkle** gives note-by-note feedback while she sings, and the
only kind of feedback that exists is encouragement.

The app is an offline-first PWA: pitch detection, scoring and rewards run entirely on the device.
An optional, self-hosted **family server** on the home network adds switchable profiles, a shared
songbook, family high scores and two-device duets. Every server feature is a progressive
enhancement, so solo play works fully offline.

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Building and testing](#building-and-testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Privacy](#privacy)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Features

- **Find My Voice.** A one-minute game listens for the singer's lowest and highest comfortable
  notes, then transposes every song to sit in that range. Songs are synthesised from note data,
  so re-keying has no artefacts. The range is saved to her profile and follows her across devices.
- **Sing.** Syllable pills scroll toward the singer's star avatar, which moves with her live pitch
  (Web Audio and [pitchy](https://github.com/ianprime0509/pitchy) pitch detection). Scoring is
  octave-forgiving, because children naturally sing in their own octave.
- **Duets.** One singer makes a 4-letter room code and another joins from her own device. Both
  sing the same song and watch each other's sparkles and note streaks live over SignalR. Results
  lead with the combined family sparkles.
- **Profiles and high scores.** Switchable singers with a picked avatar or an uploaded photo, and
  a family high-score board on every song card.
- **Celebration.** Stars, confetti, streaks, sparkles and badges. A tricky part becomes an
  invitation to practise just that phrase at 70% tempo, never a penalty.
- **Twinkle's Tips.** Warm-ups and confidence boosters, such as "mistakes are sparkle dust".
- **Grown-Ups Corner.** Behind a parent gate: mic latency offset, voice re-setup, a song editor
  with live preview, an avatar manager and reset.

The app ships with seven hand-encoded **public-domain** melodies: Twinkle Twinkle Little Star,
Mary Had a Little Lamb, Hot Cross Buns, London Bridge, Old MacDonald, Row Row Row Your Boat and
Jesus Loves Me. Grown-ups can add more in the song editor.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- [.NET SDK](https://dotnet.microsoft.com/download) 10.0, only for the family server

### Run the app

Solo play needs nothing but the frontend, and works fully offline.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

### Run the family server (optional)

The server adds profiles, duets, high scores and the song editor.

```bash
cd backend
dotnet run --project src/TwinkleTune.Api    # http://localhost:5240
```

The frontend looks for the server at `http://localhost:5240`. Set `VITE_API_URL` to point it
elsewhere. For two-device duets on your Wi-Fi, serve both apps on your computer's LAN address and
add that origin to `Cors:Origins` in `backend/src/TwinkleTune.Api/appsettings.json`.

> [!WARNING]
> The family server has no authentication, by design. It is for the home network only. Do not
> expose it to the internet. See the ADRs in [`docs/adr/`](docs/adr/).

### Install it on a tablet

Run `npm run build` in `frontend/`, host `frontend/dist/` on any static host (or run
`npm run preview` on your LAN), open it on the tablet and choose **Add to Home Screen**. The PWA
installs with its own icon and works offline after the first visit.

## Building and testing

| Command | Where | What it does |
|---|---|---|
| `npm test` | `frontend/` | Unit tests for scoring, note judging, the store, badges and songs |
| `npm run build` | `frontend/` | Type-check and production build to `dist/` |
| `dotnet test` | `backend/` | Unit and integration tests, including a two-client SignalR duet |
| `npm test` | `e2e/` | Playwright suite against the offline app |
| `npm run test:server` | `e2e/` | Full-stack Playwright suite on an isolated test database |
| `npm run test:marketing` | `e2e/` | Playwright suite for the marketing site |

No test needs a database server or a real microphone. The end-to-end suites run in Chromium and
replace the microphone with a re-tunable oscillator.

`#/tuner` in the app is a developer tuner (note name, cents needle, clarity) for checking pitch
detection against a piano app.

## Project structure

```
frontend/        The app: Vite + TypeScript, no framework
  src/audio/     Web Audio synth, mic pitch tracker, voice-range math
  src/songs/     Song schema, bundled catalogue, server songbook with offline cache
  src/state/     Per-singer store, scoring, note judging, badges
  src/screens/   One module per screen
  src/rendering/ Canvas and WebGPU playfield
  src/api/       REST client and SignalR duet client
  src/ui/        Shared parts: mascot, modals, toasts, bottom nav
  public/        PWA manifest, icons, service worker
backend/         Family server: .NET 10, Clean Architecture
  src/TwinkleTune.Domain/          Entities and song invariants, no dependencies
  src/TwinkleTune.Application/     Services, DTOs, in-memory duet rooms
  src/TwinkleTune.Infrastructure/  EF Core + SQLite, photo storage, seeding
  src/TwinkleTune.Api/             Controllers, SignalR DuetHub, health check
  tests/                           Unit and integration tests
e2e/             Playwright suites for the app, the full stack and the marketing site
marketing/       Public brochure: dependency-free HTML, CSS and JavaScript
infra/           Azure Static Web Apps infrastructure (Bicep)
docs/            Specifications, designs, mocks, ADRs and brand assets
.github/         CI/CD workflow
```

## Documentation

| Document | Contents |
|---|---|
| [`docs/specs/`](docs/specs/README.md) | Requirements for each subsystem, with acceptance criteria and the glossary |
| [`docs/detailed-designs/`](docs/detailed-designs/) | Per-feature designs with diagrams |
| [`docs/mocks/`](docs/mocks/) | HTML mocks of every screen, the visual source of truth (open `index.html`) |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`docs/deployment.md`](docs/deployment.md) | Azure provisioning and the deployment pipeline |
| [`docs/stickers/`](docs/stickers/README.md) | Print-ready promotional stickers |
| [`AGENTS.md`](AGENTS.md) | Architecture rules, domain vocabulary and the development workflow |

The design is a soft pastel "sky studio" set in Baloo 2 and Nunito. Its palette is `#F4DBE3`,
`#5EA8DA`, `#83C5F1`, `#B9DDF5` and `#AFE3F4`.

## Deployment

A green push to `main` publishes the marketing site at [twinkletune.app](https://twinkletune.app)
and the offline PWA at [twinkletune.app/app](https://twinkletune.app/app) through Azure Static Web
Apps. The family server is deliberately never deployed. See
[`docs/deployment.md`](docs/deployment.md) for provisioning and pipeline details.

To preview the marketing site locally, use the frontend's Vite installation:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 4175 ../marketing
```

## Privacy

- Singing audio never leaves the device.
- There are no accounts, no analytics and no third-party network calls.
- Badges, streaks and sparkles stay in the device's `localStorage`.
- Profiles, songs, photos and high scores live only on your own family server, in
  `backend/data/` (one SQLite file and a photos folder).
- During a duet, only live score events cross the network.

## Contributing

Contributions are welcome: bug reports, fixes, new public-domain songs, accessibility improvements
and documentation. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and
report bugs through [GitHub Issues](https://github.com/QuinntyneBrown/TwinkleTune/issues).

## Security

Do not report security issues in a public issue. Follow the private reporting process in
[SECURITY.md](SECURITY.md).

## License

TwinkleTune is licensed under the [MIT License](LICENSE).
