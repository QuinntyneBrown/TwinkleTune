# ADR-0001: Extract the Audio Engine into a Workspace Library, Split frontend/ into Two Apps

**Date:** 2026-08-12
**Category:** frontend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

The audio engine — microphone capture, pitchy-based pitch detection with RMS/clarity/frequency
gates and median smoothing (`pitch.ts`), Web Audio melody synthesis (`player.ts`), and
note/transposition math (`range.ts`) — lived inside the app at `frontend/src/audio/`. It was
already a clean leaf layer (nothing in it imported screens, UI, or API code), but it could only
be exercised through the full game.

That became a real limitation when the audio engine device test plan
(`docs/audio-engine-device-test-plan.html`) was written: verifying the
speaker → air → microphone → PitchTracker path needs a purpose-built instrument, and the hidden
`#/tuner` screen inside the game is a yes/no needle with no history, no known-tone source, and
no way to export what the engine actually heard.

Forces at play:

- **Verification needs its own app.** A loopback check (play a known note, assert the engine
  hears that note back) doesn't belong in a kids' game UI, but it needs the *exact same* engine
  code — not a copy.
- **Deployment must not change.** CI builds the frontend with `npm ci` / `npm test` /
  `npm run build` in `frontend/`, stages `frontend/dist` into the Azure Static Web Apps
  artifact, and deploys only on push to `main`. The e2e Playwright configs launch the dev
  server with `cwd: ../frontend`.
- **The engine had two outward imports** to untangle: the song model in
  `frontend/src/songs/types.ts` (used by the player for melody/beat math) and the type-only
  `VoiceRange` from `frontend/src/state/store.ts` (used by `computeShift`).
- **No monorepo tooling existed** — `frontend/` was a single npm project.

## Decision

Restructure `frontend/` into an npm-workspaces monorepo with the engine as a first-class
library and two apps:

- `frontend/packages/audio-engine/` — `@twinkletune/audio-engine`, a TypeScript-source library
  (no build step; `exports` points at `src/index.ts` and Vite/tsc consume it directly). It owns
  the pure **song model** (`Song`, `allNotes`, `songRange`, `songBeats`, `songSeconds`) and
  **`VoiceRange`**, inverting the old app-ward dependencies. App-flavored helpers
  (`difficultyLabel`, `validateSong`) stay in the game, which re-exports the model from its
  `songs/types.ts` so most app imports were untouched.
- `frontend/apps/game/` — `@twinkletune/game`, the production app moved wholesale.
- `frontend/apps/audio-lab/` — `@twinkletune/audio-lab`, a dev-only diagnostic app implementing
  the device test plan in software: a piano-key played-vs-heard check (±25 cents, octave-exact),
  the 7-reference-tone sweep with the plan's P/O/N/—/~ scoring codes, and a diagnostics CSV
  recorder (the improvement the plan explicitly recommends). It is never built or deployed by CI.

The workspace root keeps the CI contract stable: root `dev`/`build`/`test` scripts delegate to
workspaces, the single lockfile stays at `frontend/package-lock.json`, and the shared toolchain
(vite, vitest, typescript) is hoisted to root devDependencies. The only deployment-adjacent
edits were one path in `ci-cd.yml` (`frontend/apps/game/dist` instead of `frontend/dist`) and
the Playwright dev-server `cwd`/command lines.

## Options Considered

### Option 1: Test app only, engine stays in the game (alias imports)
- **Pros:** Smallest diff; no workspace tooling; zero CI changes.
- **Cons:** The "library" is a folder reachable by relative paths — nothing stops screens code
  and engine code from re-entangling; the test app would import deep into another app's `src/`,
  which is exactly the coupling the extraction is meant to end.

### Option 2: Workspaces, but the game stays at the frontend root
- **Pros:** CI and e2e configs untouched entirely; least deployment risk.
- **Cons:** Asymmetric layout (one app at the root, one under `apps/`) that misrepresents the
  structure — the game looks like "the" frontend and audio-lab like an afterthought; root
  `package.json` doubles as an app manifest and a workspace root.

### Option 3: Full `apps/` + `packages/` restructure (chosen)
- **Pros:** Honest, symmetric layout; the engine's boundary is enforced by a real package (its
  only dependency is `pitchy` — it cannot import app code without it showing up in
  `package.json`); each app owns its config; future apps/libraries have an obvious home.
- **Cons:** Touches deployment config (one `cp` path in the workflow) and three Playwright
  config lines; a large rename diff (mitigated: `git mv` preserved history — every moved file
  shows 92–100% similarity).

## Consequences

### Positive
- The capture pipeline is verifiable in isolation: the audio-lab plays a known tone and asserts
  the engine's reading, closing the loop the device test plan describes — on any device with a
  browser, straight from `npm run dev:lab`.
- The engine's dependency direction is now enforced, not conventional: `song model + VoiceRange`
  live in the library, and the game depends on `@twinkletune/audio-engine`, never the reverse.
- `npm test` at `frontend/` now runs the engine's tests plus the game's — the CI command didn't
  change.

### Negative
- Deep-path documentation (specs, detailed designs) referencing `frontend/src/...` needed a
  mechanical path update, and future docs must use the longer workspace paths.
- Contributors must understand npm workspaces (one `npm install` at `frontend/`, `-w` flags to
  target a package).

### Risks
- **Engine scope creep.** The library carries the song model out of necessity; the next
  temptation is scoring or storage "for convenience." Rule: if it isn't needed to *make or hear
  sound*, it doesn't go in `audio-engine`.
- **Lockfile drift.** The root lockfile now covers three packages; partial `npm install` runs
  inside a workspace directory should be avoided (always install from `frontend/`).

## Implementation Notes

- Library surface: `audioCtx`, `SongPlayer`, `playNote(midi, durSec, wave)`, `PitchTracker`
  (+ new `trackSettings` getter for diagnostics), `StablePitchCapture`, note math
  (`midiToName/midiToHz/hzToMidi`), `computeShift`/`describeShift`, song model, `VoiceRange`.
- `range.test.ts` moved into the library and swaps the game's catalog song for an inline
  fixture with the same C4–A4 span, so the library's tests have no app dependency.
- The marketing-site preview incantation became a root script (`npm run dev:marketing`), which
  also simplified the marketing Playwright config.

## References

- `docs/audio-engine-device-test-plan.html` — the manual test plan the audio-lab implements
- `docs/specs/audio-engine/L1.md`, `L2.md` — engine requirements (AE-L2-1…17)
- `docs/detailed-designs/audio-engine/` — engine feature designs
- `frontend/packages/audio-engine/src/index.ts` — the library's public surface
- `.github/workflows/ci-cd.yml` — the single-path deployment change
