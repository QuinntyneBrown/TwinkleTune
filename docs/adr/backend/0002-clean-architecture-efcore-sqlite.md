# ADR-0002: Backend Architecture — Clean Architecture, EF Core + SQLite, No-Auth LAN

**Date:** 2026-06-12
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

ADR-0001 accepted a family-scoped .NET + SignalR backend for TwinkleTune. The concrete feature set
is now: switchable singer profiles (with uploaded photo or picked avatar), avatar CRUD, song CRUD,
per-song high scores, and realtime head-to-head duets. This ADR records the structural decisions
for that backend.

Forces: a single maintainer who works in .NET professionally and asked for Clean Architecture
explicitly; family scale (single instance, a handful of users on a home LAN); the frontend must
remain offline-first with the API as a progressive enhancement; children's data should stay
minimal and on-premises.

## Decision

1. **Clean Architecture with four projects** (`Domain`, `Application`, `Infrastructure`, `Api`),
   dependencies pointing inward only. `Application` uses **plain services + repository
   interfaces** — no MediatR/CQRS ceremony at this scale.
2. **EF Core + SQLite** (`backend/data/twinkletune.db`). Song phrases/notes are stored as a JSON
   string column via a value converter rather than note-per-row tables. Schema is created with
   `EnsureCreated()` + idempotent seeding for v1; EF migrations get introduced the first time the
   shipped schema actually has to evolve.
3. **Duet rooms are in-memory only** (`ConcurrentDictionary`, 4-letter codes, ~30 min idle expiry)
   in an `Application` room service consumed by the SignalR hub in `Api`. Rooms are deliberately
   not persisted — a duet that outlives a server restart is not a real family scenario.
4. **Profile photos on disk** (`backend/data/photos/`), served by the API; ≤2 MB, jpeg/png/webp.
5. **No authentication.** The API is designed for home-LAN deployment; the client-side parent gate
   remains the only guard. CORS restricted to configured origins.
6. **Voice range lives on the Singer entity** (it belongs to the person and should follow her
   across devices); mic latency offset stays in device `localStorage` (it belongs to the device).
7. Server owns **high scores only** (upsert-if-better per singer/song); sparkles, badges and
   day-streaks remain client-side, namespaced per profile.

## Options Considered

### Option 1: Clean Architecture, plain services, SQLite (chosen)
- **Pros:** Matches the maintainer's professional stack and explicit request; testable core with
  zero-dependency Domain; SQLite is zero-ops and file-backupable; JSON song column keeps the schema
  tiny and mirrors the frontend's `Song` shape one-to-one.
- **Cons:** Four projects is ceremony for a family app; JSON column forgoes relational queries over
  notes (none are needed).

### Option 2: Single-project minimal API ("just Program.cs")
- **Pros:** Smallest possible footprint; everything in one file tour.
- **Cons:** Ignores the explicit Clean Architecture requirement; domain rules (song invariants,
  high-score upsert) end up tangled with HTTP concerns; harder to unit test without spinning up the host.

### Option 3: PostgreSQL/SQL Server + full migrations + JWT from day one
- **Pros:** Production-grade posture, ready for internet exposure.
- **Cons:** A database server to run forever at home; auth friction for kids; none of it is needed
  at family scale. Contradicts ADR-0001's guardrails.

## Consequences

### Positive
- Domain/Application are pure and unit-testable; integration tests cover the HTTP + SignalR edge.
- Whole backend state is two artifacts (one .db file, one photos folder) — backup = copy a folder.
- The frontend stays offline-first; every server feature degrades gracefully.

### Negative
- `EnsureCreated()` means a future schema change requires introducing migrations carefully (or
  losing high-score data); acceptable and documented for v1.
- Photos are the first child PII stored outside the device — mitigated by LAN-only deployment and
  honest Grown-Ups Corner copy.
- No auth means anyone on the home network can edit songs; accepted by the decider.

### Risks
- If the API is ever port-forwarded to the internet, the no-auth decision becomes unsafe —
  revisit this ADR (parent-PIN header or JWT) before any such exposure.

## Implementation Notes

- `Api` exposes `/api/avatars`, `/api/singers` (+`/photo`), `/api/songs`, high-score routes, and
  `/hubs/duet`. `public partial class Program {}` enables `WebApplicationFactory` integration tests.
- Integration tests run SQLite on a temp file and SignalR over the TestServer handler with
  long-polling transport.
- Seed data ports the six public-domain songs from `frontend/src/songs/catalog.ts` so the API and
  the offline bundle agree.

## References

- ADR-0001 (accepted) — scope and safety guardrails
- `docs/PLAN-BACKEND.md` — full milestone plan
- `frontend/src/state/store.ts` — `StorageLike` seam and per-profile namespacing
