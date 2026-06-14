# TwinkleTune — Backend Milestone: Clean Architecture .NET + SignalR Duets

## Context

TwinkleTune is an offline-first kids' singing PWA (`frontend/`, Vite + TS, all state in
`localStorage`). ADR-0001 proposed a family-scoped .NET + SignalR backend; the user has now
requested it with concrete requirements:

- **Profiles** — switchable singer profiles (two daughters), each with an uploaded **photo or picked avatar**; avatars themselves are CRUD-managed.
- **Head-to-head duets** — both daughters sing the same song on different devices and see each other's results and **note streaks in real time**.
- **Songs CRUD** — create/update/view/delete songs.
- **High scores per song** — tracked server-side.

User-confirmed scope decisions:
1. Song editing = **structured form + JSON notes** in the Grown-Ups Corner (no piano-roll editor).
2. Server owns **high scores only**; sparkles/badges/day-streaks stay on-device, namespaced per profile.
3. **No auth, LAN-only** deployment; client-side parent gate remains the only guard.

Execution step 0: save this plan to `docs/PLAN-BACKEND.md`, flip ADR-0001 → Accepted, and add
ADR-0002 (Clean Architecture layering, EF Core + SQLite, no-auth LAN scope) in `docs/adr/backend/`.

## Backend (`backend/`)

```
backend/
  TwinkleTune.sln
  src/
    TwinkleTune.Domain/          entities + invariants, zero dependencies
    TwinkleTune.Application/     services, DTOs, interfaces (no MediatR — plain services)
    TwinkleTune.Infrastructure/  EF Core (SQLite), photo file storage, seeding
    TwinkleTune.Api/             minimal API endpoints + SignalR DuetHub + CORS + Swagger(dev)
  tests/
    TwinkleTune.UnitTests/       domain invariants, high-score upsert, room service
    TwinkleTune.IntegrationTests/ WebApplicationFactory + 2-client SignalR duet flow
```

Target `net10.0` (verify `dotnet --list-sdks` at execution; fall back to installed LTS).

**Domain entities**
- `Avatar { Id, Emoji, Name }` — seeded with the current four + a few extras.
- `Singer { Id, Name, AvatarId?, PhotoFileName?, RangeLow?, RangeHigh?, CreatedAt }` — voice range
  moves server-side so a daughter's tuning follows her across devices. Mic `latencyMs` stays
  device-local (it is a device property, not a person property).
- `Song { Id, Title, Emoji, Art, Bpm, Difficulty, PhrasesJson, IsSeed, UpdatedAt }` — phrases/notes
  stored as a JSON column (value converter). Domain validation mirrors the frontend catalog
  invariants (notes ordered, positive durations, non-empty syllables, C3–C6 base range, ≤16-semitone span).
- `HighScore { Id, SongId, SingerId, Stars, Accuracy, Sparkles, MaxStreak, AchievedAt }` — unique
  on (SongId, SingerId); submit = upsert-if-better.

**REST endpoints** (`/api/...`)
- `avatars`: GET list, POST, PUT/{id}, DELETE/{id}
- `singers`: CRUD + `PUT /{id}/photo` (multipart, ≤2 MB, jpeg/png/webp → `data/photos/`), photo GET
- `songs`: CRUD with validation problem-details on 400; seeds match the bundled six
- `highscores`: POST submit (upsert-if-better, returns `improved` flag);
  `GET /api/songs/{id}/highscores` (per-song board); `GET /api/singers/{id}/highscores`

**DuetHub** (`/hubs/duet`, in-memory `IRoomService`: ConcurrentDictionary, 4-letter codes, 30-min idle expiry)
- Client→server: `CreateRoom(singer)`, `JoinRoom(code, singer)`, `StartSong(songId)`,
  `ScoreTick(landed, streak, sparkles, noteIdx)`, `FinishSong(summary)`, `LeaveRoom`
- Server→client: `RoomState`, `PlayerJoined/Left`, `SongStarted(songId, startAtUtc)`,
  `OpponentTick(...)`, `OpponentFinished(summary)`, `DuetResult(combined + per-player)`, `RoomClosed`
- Count-in (4 beats) absorbs LAN clock skew; results compared per-phrase, not instantaneous.

## Frontend changes (`frontend/src/`)

- `api/client.ts` — fetch wrapper, base URL from `VITE_API_URL` (default `http://localhost:5240`),
  feature-detects server availability; **solo play must never require the API**.
- `api/duet.ts` — `@microsoft/signalr` adapter (new dependency), lazy-imported only by duet screens.
- **Profiles**: new `#/profiles` picker screen (cards with photo/avatar, tap to switch); create/edit
  (name, avatar pick from server list, photo upload with preview); delete behind parent gate.
  Active singer id in localStorage; `state/store.ts` re-keys state to `twinkletune:v1:{singerId}`
  (existing `twinkletune:v1` blob is adopted by the first profile created — one-time migration).
  `welcome.ts` becomes first-run profile creation via API, falling back to a local-only profile offline.
- **Songs**: `songs.ts` fetches from API, caches in localStorage, falls back to bundled
  `songs/catalog.ts` offline; song cards gain a per-song high-score chip and a "Duet" button.
  Extract a shared `validateSong()` into `songs/types.ts` (reused by editor UI + existing tests).
- **Grown-Ups Corner** (`ui/settings.ts`): Song manager (form for title/emoji/bpm/difficulty,
  per-phrase lyric + notes JSON textarea with validation, preview-play via existing
  `audio/player.ts` SongPlayer, delete w/ confirm) and Avatar manager (emoji + name CRUD).
- **Duet mode**: `#/duet` lobby (create/join with big friendly code letters, both singers shown);
  `sing.ts` gains a duet variant — synchronized start on `SongStarted`, throttled `ScoreTick`
  (~5/s + on note finalize), opponent mini-star + live streak chip rendered on the existing stage;
  duet results screen with side-by-side stars and a combined "family sparkles" total (cooperative
  framing first, versus de-emphasized).
- **Results**: POST high score for the active singer when server reachable; show
  "New family record! 🏆" when the upsert improved.

## Phases (each independently verifiable)

| # | Work | Acceptance criteria |
|---|------|---------------------|
| 0 | Plan → `docs/PLAN-BACKEND.md`; ADR-0001 → Accepted; new ADR-0002 | docs updated |
| 1 | Backend scaffold: sln, 4 src + 2 test projects, EF SQLite, health endpoint, Swagger | `dotnet build` + `dotnet test` green; `GET /health` 200 |
| 2 | Domain + Infrastructure: entities, validation, DbContext, migrations, seeding | song-invariant unit tests green; db seeds 6 songs + avatars |
| 3 | REST endpoints (avatars, singers + photo, songs, high scores) | integration tests round-trip all CRUD; photo upload works; high-score upsert keeps best |
| 4 | DuetHub + RoomService | integration test: two SignalR clients complete create→join→start→ticks→finish→`DuetResult` |
| 5 | Frontend profiles: api client, picker/switcher, per-singer storage namespacing, photo/avatar | two profiles switchable; photo shows on home; offline solo still works |
| 6 | Songs via API + Grown-Ups song & avatar managers | created song appears and is singable; invalid notes rejected with friendly message; offline falls back to cache/bundled |
| 7 | Duet mode + high-score submit/display | manual two-browser duet works end-to-end; per-song boards visible |
| 8 | Playwright e2e (`e2e/` — .gitignore already anticipates it) + README/privacy copy update | `dotnet test`, frontend `npm test`, e2e green (incl. two-browser-context duet smoke in no-mic mode) |

## Verification

- `dotnet test` — unit + integration, including the two-client SignalR duet test.
- `cd frontend && npm test && npm run build` — existing 68 tests must stay green.
- Playwright e2e against running backend: profile create → song CRUD → duet via two browser
  contexts (no-mic mode so it runs headless) → high-score board.
- Manual: real duet on two devices over LAN with mics; photo upload from a phone/tablet.

## Risks & mitigations

- **Offline regression** — solo path keeps zero API dependencies; everything server-y feature-detects.
- **Clock skew on synced start** — server `startAtUtc` + 4-beat count-in; per-phrase comparisons.
- **Photos are the first PII on a server** — LAN-only, documented honestly in Grown-Ups Corner + README.
- **SQLite concurrency** — trivial at family scale; EF retry on busy.
- **Sibling-loss sting** — duet results lead with combined sparkles; versus framing opt-in.
