# ADR-0001: .NET + SignalR Backend for Realtime Head-to-Head Singing

**Date:** 2026-06-11
**Category:** backend
**Status:** Accepted (2026-06-12) — scope extended to include profiles, song/avatar CRUD and photo upload; see ADR-0002 for the backend architecture
**Deciders:** Quinntyne Brown, Claude

## Context

TwinkleTune is currently a fully offline-first PWA: vanilla TypeScript + Vite frontend, all state
in `localStorage`, pitch detection and scoring entirely client-side, and **no data ever leaves the
device**. That last property is deliberate — the primary user is a 9-year-old, and "no accounts,
no uploads" is both the privacy story and a big part of the app's confidence-first ethos (the app
never makes a kid feel judged).

The proposal: add a .NET backend with SignalR to enable (a) realtime head-to-head competition —
two singers do the same song simultaneously and watch each other's scores live — and (b)
leaderboards.

Forces at play:

- **Audience is children.** Anything with accounts, public matchmaking, or persistent identity
  triggers COPPA-class obligations (verifiable parental consent, data minimization, moderation)
  and safety questions about who a child is matched with.
- **Product ethos.** The app's only feedback mode is encouragement. A global leaderboard is a
  ranking of children against strangers — structurally the opposite of "mistakes are sparkle dust."
- **Technical reality.** Head-to-head does *not* require streaming audio. Each client already
  computes pitch/score locally; only tiny score events (~10–20 Hz, small JSON) need to cross the
  wire. That is squarely in SignalR's sweet spot. Actually *hearing* each other sing in sync would
  require WebRTC and tight latency control — a different, much harder feature.
- **Team fit.** The maintainer's home stack is .NET, so an ASP.NET Core + SignalR service is the
  lowest-friction backend choice.
- **Architecture today is backend-free.** The state module (`frontend/src/state/store.ts`) already
  isolates persistence behind a `StorageLike` seam; gameplay code raises score events that a relay
  could subscribe to without restructuring.

## Decision

Proposed: build the feature, but scoped as **"Family Duet" rooms, not an online platform**.

1. ASP.NET Core (minimal API) + SignalR hub, joined via short-lived **room codes**
   (Kahoot/Jackbox style). No accounts, no registration — players join with a code and a
   first-name/avatar that exist only for the life of the room.
2. Head-to-head = both players sing the same song simultaneously; the hub relays score/pitch-state
   events; each client renders the opponent's star alongside their own. Scoring stays client-side.
3. Leaderboards are **family-scoped** (per room-code group or per device-pairing), never global.
   Results framing stays cooperative-friendly ("you two earned 38 sparkles together!"), with
   win/lose de-emphasized.
4. The PWA remains fully functional offline; the backend powers an optional "Play Together" mode
   only.

Explicitly out of scope until revisited: public matchmaking, global leaderboards, persistent user
accounts, voice chat / synchronized audio (WebRTC).

## Options Considered

### Option 1: Stay backend-free (status quo)
- **Pros:** Zero cost, zero ops, perfect privacy story; app is already complete and delightful solo;
  no COPPA surface at all.
- **Cons:** No social play. Singing is inherently social, and "sing against Dad / cousin" is a
  genuinely motivating loop for a 9-year-old; competitors (karaoke apps) treat this as core.

### Option 2: .NET + SignalR with ephemeral room codes, family-scoped boards (recommended)
- **Pros:** Real multiplayer fun with near-zero identity footprint (ephemeral rooms, first names
  only); SignalR is the right transport for low-rate score events and is native to the
  maintainer's stack; in-memory room state keeps the server trivially simple (single instance, no
  Redis backplane needed at family scale); offline-first PWA is preserved; cheating is irrelevant
  among family.
- **Cons:** Real ops cost appears (hosting, TLS, monitoring, updates) for a hobby project; two
  codebases/runtimes to maintain; room-code play requires coordinating humans ("everyone open the
  app now"), which limits spontaneous use.

### Option 3: Full online platform (accounts, matchmaking, global leaderboard)
- **Pros:** Maximum engagement mechanics; persistent progression across devices; the "complete"
  product vision.
- **Cons:** COPPA/GDPR-K obligations land immediately (parental consent flows, data retention
  policies, breach liability); matching children with strangers demands moderation and abuse
  tooling; global rankings contradict the app's confidence-building purpose; effort is an order of
  magnitude beyond the current project. Wrong scope for a family app today.

## Consequences

### Positive
- A genuinely new play mode (sing *with* someone) that solo play can't offer.
- Backend stays small enough to fit in one file-tour: one hub, a room registry, a handful of DTOs.
- The maintainer gets to use .NET where it's strongest; frontend only adds the
  `@microsoft/signalr` client and a lobby screen + opponent overlay.
- Privacy story survives mostly intact: "nothing leaves the device, except live scores while you
  play together — and those aren't stored."

### Negative
- The README/Grown-Ups Corner privacy claim ("all data stays on this device") must be revised and
  carefully scoped to remain honest.
- Hosting, certificates, CORS, reconnection handling, and version skew between frontend and hub
  become ongoing chores.
- A second singer is now a hard dependency for the feature's fun — empty-room UX needs thought
  (e.g., "ghost" replays of a family member's past run as a fallback).

### Risks
- **Scope creep toward Option 3.** Leaderboards have gravity; "family-scoped" must be enforced in
  design reviews, not just intentions.
- **Latency variance** between devices (tablet Wi-Fi vs PC ethernet) could make live score races
  feel unfair; mitigation: compare per-phrase results rather than instantaneous scores.
- **Competition vs confidence.** Losing live, repeatedly, to an older sibling can sting. Mitigate
  with cooperative framing (shared sparkle pool, "duet stars") as the default mode and
  versus as opt-in.

## Implementation Notes

If accepted, a thin slice in order:

1. `backend/` folder: ASP.NET Core minimal API + one `DuetHub` (SignalR). In-memory
   `ConcurrentDictionary<string, Room>`; rooms expire after ~30 min idle. No database initially.
2. Hub surface: `CreateRoom`, `JoinRoom(code, name, avatar)`, `StartSong(songId)`,
   `ScoreTick(landed, streak, sparkles)`, `PhraseResult(...)`, `FinishSong(summary)`.
3. Frontend: lobby screen (create/join with big friendly code letters), opponent star on the
   existing sing-screen stage, results screen comparison panel. SignalR client behind a small
   adapter so solo mode never imports it.
4. Family leaderboard (phase 2): SQLite + EF Core, keyed by room-group, first names only.
5. Hosting: any small VM/App Service; SignalR WebSockets needs sticky sessions only when scaled
   out — irrelevant at single-instance family scale.
6. Update README + Grown-Ups Corner copy to describe exactly what crosses the network in duet mode.

## References

- `docs/PLAN.md` — original offline-first architecture and privacy rationale
- `frontend/src/state/store.ts` — `StorageLike` seam where any server-backed persistence would slot in
- `frontend/src/screens/sing.ts` — game loop that would emit `ScoreTick` events
- Microsoft Learn: ASP.NET Core SignalR overview — https://learn.microsoft.com/aspnet/core/signalr/introduction
- FTC COPPA guidance — https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
