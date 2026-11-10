## Project overview

TwinkleTune is a singing app for young performers. Every song is transposed to the singer's own
voice range, a star coach named **Twinkle** gives note-by-note feedback while she sings, and the
only kind of feedback that exists is encouragement. The app is an offline-first PWA (Vite +
TypeScript, no framework): pitch detection, scoring and rewards run entirely on the device. An
optional, self-hosted .NET **family server** on the home LAN adds switchable profiles, a shared
songbook, family high scores and two-device duets over SignalR. Every server feature is a
progressive enhancement: solo play works fully offline.

## Repository layout

- `frontend/`: the app. `src/` holds `audio/` (synth, pitch tracker, range math), `songs/`
  (schema, bundled catalogue, server songbook), `state/` (store, scoring, note judging, badges),
  `screens/` (one module per screen), `rendering/` (Canvas and WebGPU playfield), `api/` (REST and
  SignalR clients), `ui/` (shared parts) and `testing/` (synthetic singer).
- `backend/`: family server, .NET 10, Clean Architecture (`TwinkleTune.slnx`)
- `e2e/`: Playwright suites for the offline app (`tests/`), full stack (`tests-server/`) and
  marketing (`tests-marketing/`)
- `marketing/`: public brochure, dependency-free HTML/CSS/JS
- `infra/`: Azure Static Web Apps infrastructure (Bicep); see `docs/deployment.md`
- `docs/specs/`: requirements, one folder per subsystem with `L1.md` (high level) and `L2.md`
  (detailed, with GIVEN/WHEN/THEN acceptance criteria). `README.md` there is the master index,
  subsystem catalogue and glossary.
- `docs/detailed-designs/`: per-feature designs, `{subsystem}/{feature}/README.md` plus diagrams
- `docs/mocks/`: hand-written HTML mocks, the visual source of truth (start at `index.html`). One
  file per screen state under `pages/`, `dialogs/` and `notifications/`, sharing `assets/tokens.css`
  and `assets/ui.css`; `README.md` there has the conventions and the coverage matrix.
- `docs/adr/`: architecture decisions. Read the relevant ADRs before changing the areas they cover.
- `.claude/skills/`, `.agents/skills/`: skills copied from Hewn; `.codex/skills/`: design-book PDF

See `README.md` for setup and development commands.

## Domain vocabulary

Use these words in code, docs and UI. Do not invent synonyms. The full glossary is in
`docs/specs/README.md` §5.

- **Singer**: one child's profile. Owns her voice range, avatar or photo, and local rewards.
- **Song**: note data (phrases of `{ midi, start, dur, syll }` notes), never a recording. A
  **seed song** is one of the seven bundled public-domain melodies.
- **Voice range**: lowest and highest comfortable notes, captured by *Find My Voice*. **Shift** is
  the number of semitones a song is transposed to fit it.
- **Landed note**: a note matched, octave-folded, on enough of the frames in which she was heard.
- **Sparkle**: the reward point, ten per landed note. **Streak**: consecutive landed notes in a
  song, or consecutive days sung.
- **Tricky part**: the phrase with the lowest landed ratio, offered as optional practice. Never a
  penalty.
- **Duet room**: an in-memory, 4-letter-code room for exactly two singers.
- **Parent gate**: the arithmetic challenge in front of the **Grown-Ups Corner** and destructive
  actions.
- **No-mic mode**: play without a microphone. It never earns scored badges or high scores.

Requirement IDs are `<SUBSYSTEM>-L<level>-<number>` (for example `SR-L2-18`) using the catalogue
codes VP, AE, SL, SG, SR, RP, PP, HS, DM, CE, GC, AS, FS. Identifiers are never reused.

## Product principles (non-negotiable)

- **Encouragement only.** No red crosses, no "wrong", no score that reads as failure. Silence is
  not a wrong note. Every new string a child sees must pass this test.
- **One big obvious action per screen.** Few words, big rounded type (Baloo 2 + Nunito), chunky
  toy-like buttons.
- **Privacy first.** Singing audio never leaves the device. No accounts, no analytics, no
  third-party network calls. Badges, streaks and sparkles stay in `localStorage`; profiles, songs,
  photos and high scores live only on the family server. Duets send only live score events.
- **Offline first.** Never make solo play depend on the network.
- **Public-domain songs only.** Note the provenance of any seed song you add.

## Frontend architecture

- No framework. Don't introduce a UI framework or state library without an ADR.
- Keep pure logic (scoring, note judging, range math, badges, store) free of DOM and Web Audio so
  unit tests and the synthetic singer can drive it.
- Persistence goes through the `StorageLike` seam in `src/state/store.ts`, namespaced per singer.
  Mic latency offset belongs to the device; voice range belongs to the singer and syncs; pitch
  strictness belongs to the singer but stays on the device and never syncs.
- The API client uses `VITE_API_URL` (default `http://localhost:5240`) and probes `/health` with a
  short timeout. Server calls fail soft to the bundled catalogue and cached data, never to an
  error the child sees.
- Keep the mocks' class names and accessible names. E2E locators depend on that parity.
- Read colours from the CSS custom properties in `src/styles/`, never by hex value. Never carry
  status or feedback by colour alone.

## Backend architecture

Layer dependency direction (strict, see ADR-0002):

- `TwinkleTune.Domain`: entities and song invariants, no dependencies
- `TwinkleTune.Application`: plain services, repository interfaces, DTOs, the in-memory duet room
  service. No MediatR/CQRS.
- `TwinkleTune.Infrastructure`: EF Core + SQLite, repositories, photo storage, seeding
- `TwinkleTune.Api`: controllers, `DuetHub` at `/hubs/duet`, `/health`, DI composition, CORS

Non-obvious rules:

- Business rules live in services and the domain, not controllers or the hub.
- The schema uses `EnsureCreated()` plus idempotent seeding. Introduce EF migrations, with an ADR,
  the first time the shipped schema has to evolve. Song notes are a JSON column.
- Duet rooms are in memory only and are never persisted.
- The server owns high scores only (upsert-if-better per singer and song); sparkles, badges and
  day streaks stay on the client. Photos: `backend/data/photos/`, at most 2 MB, jpeg/png/webp.
- **No authentication, by design.** The server is for the home LAN only, with CORS restricted to
  `Cors:Origins`. Never expose or deploy it; only the marketing site and the static PWA deploy.

Tests never need a database server. Integration tests boot the real API through `ApiFactory` on a
temp SQLite file and photo folder, including a two-client SignalR duet. Run `dotnet test`.

## E2E architecture (Playwright)

- Page Object Model: one page object per screen under `e2e/pages/` (shared parts in
  `components/`), owning the selectors and the interactions. Tests state intent; page objects know
  the DOM. Never put a selector in a test.
- The microphone is never used for real. `FakeMic` (`e2e/fixtures/fake-mic.ts`) swaps
  `getUserMedia` for a re-tunable oscillator. Seed state with `e2e/fixtures/seed.ts`.
- `npm test` runs the offline app, `npm run test:server` the real backend on an isolated database
  under `e2e/.tmp`, and `npm run test:marketing` the brochure. Chromium only.

## Incremental implementation and ATDD (mandatory)

Mocks are design artifacts. ATDD does not apply to them. Do not write tests for mocks.

Every new feature or change to production behavior MUST have a requirement in `docs/specs/`, a
detailed design in `docs/detailed-designs/`, and, for UI changes, an updated mock in `docs/mocks/`
before implementation begins. Keep them aligned with the code in the same pull request.

Every production behavior implementation MUST invoke and follow the `implementing-incrementally`
skill before any code is written, combined with acceptance test-driven development. Plan small,
reviewable slices, then complete one slice at a time: write Given/When/Then acceptance criteria,
write the acceptance test, and run it to prove it fails for the expected reason BEFORE writing
production code. Implement only what satisfies that slice, refactor with tests green, and run the
relevant regression checks. Do not move to the next slice until those checks pass. No bulk
implementation, no tests added afterwards, and no weakening tests to manufacture a pass.

Every new acceptance test file starts with a header naming the requirements it covers:

```typescript
// Acceptance Test
// Traces to: SR-L2-18
// Description: A synthesised singer 180 ms behind the beat still lands most notes
```

Front-end logic: Vitest beside the module (`*.test.ts`), or the synthetic singer in
`src/testing/` for the pitch and judging chain. Front-end behavior: Playwright. Back end:
integration tests against the API, unit tests for services and validators.

Before opening a pull request, run what CI runs for the areas you touched: `npm test` and
`npm run build` in `frontend/`, `dotnet test` in `backend/`, and the relevant `e2e/` suites.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior: no structure,
layout or naming tests, no banned-API scans, no tests that parse this repository's own
specifications.
