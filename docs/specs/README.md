# TwinkleTune — Product Requirements Specification

**Document type:** Software Requirements Specification (SRS), master index
**Product:** TwinkleTune — a voice‑personalized singing app for young performers
**Specification baseline:** v1.10
**Status:** Approved for release baseline
**Last updated:** 2026-11-10

---

## 1. About this specification

This folder is the authoritative requirements specification for TwinkleTune. It was produced by
reverse‑engineering the shipped implementation (frontend, family server, and end‑to‑end test suite)
into a structured, traceable requirements set suitable for a commercial software product.

The specification is written to serve four audiences:

| Audience | What they get from it |
|----------|-----------------------|
| **Product & QA** | Testable acceptance criteria for every behaviour, expressed as GIVEN/WHEN/THEN scenarios. |
| **Engineering** | A precise contract for each subsystem, traceable to the code that realises it. |
| **Sales & partners** | An honest, professional description of what the product does and the boundaries it respects (child privacy, offline‑first, encouragement‑only). |
| **Compliance & safety reviewers** | Explicit statements of the product's data‑handling, parental‑control, and children's‑safety posture. |

### 1.1 Requirements language

Requirements use the keywords **SHALL** (mandatory), **SHOULD** (recommended), and **MAY**
(optional) in the sense of RFC 2119. A requirement that says the system *shall* do something is a
binding acceptance obligation; a *should* is a strong recommendation that may be traded off with
documented justification.

### 1.2 Two levels of requirement

Each subsystem is specified at two levels of abstraction:

- **L1 — High‑level requirements** (`L1.md`): capability‑level statements of *what* the subsystem
  must achieve and *why*. L1 requirements are stable, solution‑independent, and readable by a
  non‑engineer. They carry a rationale and a priority.
- **L2 — Detailed requirements** (`L2.md`): concrete, verifiable statements of *how* the capability
  behaves, each **tracing to one or more L1 requirements** and each accompanied by **GIVEN/WHEN/THEN
  acceptance criteria**. L2 requirements cite the implementing source as their point of origin.

Every L2 requirement traces up to an L1 requirement; every L1 requirement is realised by at least one
L2 requirement. Each `L2.md` closes with a traceability matrix that makes this mapping explicit.

### 1.3 Identifier scheme

```
<SUBSYSTEM>-L<level>-<number>          e.g.  VP-L1-3,  DM-L2-14
```

`<SUBSYSTEM>` is the two‑letter subsystem code from the catalogue in §4. Identifiers are stable:
once assigned they are never re‑used, even if a requirement is retired.

### 1.4 Priority

Requirements are prioritised with **MoSCoW**:

- **Must** — the product is not shippable without it (core singing loop, privacy guarantees, safety).
- **Should** — important to the value proposition; ship‑blocking only if several are missing.
- **Could** — desirable polish; deferrable without harming the core promise.

### 1.5 Acceptance‑criteria format

Every L2 requirement is verified by one or more scenarios in Gherkin‑style form:

> **GIVEN** an initial context
> **WHEN** an event or action occurs
> **THEN** an observable, checkable outcome holds
> *(**AND** additional context or outcomes as needed)*

Scenarios are written to be directly executable as manual or automated test cases. Where the shipped
automated suite already exercises a scenario, the L2 source note points to it.

---

## 2. Product overview

TwinkleTune is a singing app built for children (primary persona: a nine‑year‑old). Its three
defining ideas are:

1. **Every song is tuned to the singer's own voice.** A one‑minute "Find My Voice" game captures the
   child's comfortable low and high notes; every song is then transposed to sit in that range. Because
   songs are stored as *note data* and synthesised on device, re‑keying is artefact‑free.
2. **The only feedback that exists is encouragement.** A star mascot named **Twinkle** gives
   note‑by‑note feedback while the child sings; mistakes are reframed as an invitation to practise,
   never a penalty. There are no accounts, no global rankings, and no way for a child to be judged
   against a stranger.
3. **It works fully offline, and family features stay on the family's own hardware.** Solo play needs
   no network. An optional **family server** (deployed on the home LAN) adds switchable profiles,
   per‑song family high scores, a grown‑ups' song editor, and real‑time two‑device **duets**.

### 2.1 Cross‑cutting product principles

These principles bind every subsystem and are restated as requirements where they apply:

- **P1 — Encouragement‑only.** No subsystem shall present failure, ranking‑against‑others, or
  punitive feedback to the child. Difficulty is surfaced as an opportunity ("want to practise just
  that bit?").
- **P2 — Offline‑first.** Solo play shall never require the family server. Every server‑backed
  feature shall degrade gracefully to a local or cached experience when the server is unreachable.
- **P3 — Data minimisation & on‑premises storage.** Audio never leaves the device. On‑device rewards
  (sparkles, badges, streaks) stay in the browser. Profiles, photos, songs, and high scores live only
  on the family's own server. During duets, only tiny live score events cross the network, and they
  are not persisted.
- **P4 — LAN‑only, no accounts.** The family server is designed for home‑network use. It has no
  authentication by design; the client‑side parent gate is the only guard. It shall not be exposed to
  the public internet.
- **P5 — Kid‑first interaction.** One obvious primary action per screen, few words, large rounded
  type, chunky touch targets, and forgiving input.

---

## 3. Personas

| Persona | Description | Primary needs |
|---------|-------------|---------------|
| **Ada, the young singer (9)** | The primary user. Reads a little, taps a lot, sings freely, is easily discouraged by "wrong." | Songs in her key, instant encouragement, celebration, no judgement. |
| **Bea, the sister (7)** | A second singer sharing the device or a second device. | Her own profile and progress; duets with Ada. |
| **A grown‑up (parent/guardian)** | Sets the app up, manages content and safety, occasionally sings too. | Parental control, honest privacy, a way to add songs and manage profiles/avatars. |
| **The family** | The collective unit that owns the server and the shared high‑score board. | Shared, private, on‑premises fun; cooperative framing over competition. |

---

## 4. Subsystem catalogue

The product is decomposed into fourteen subsystems. Each has its own `L1.md` and `L2.md`.

| Code | Subsystem | Responsibility |
|------|-----------|----------------|
| **VP** | [voice-personalization](./voice-personalization/) | "Find My Voice" range capture and per‑song transposition into the singer's key. |
| **AE** | [audio-engine](./audio-engine/) | On‑device melody synthesis (transpose, tempo, count‑in, practice segments) real‑time microphone pitch detection, and listening on a chosen microphone. |
| **SL** | [song-library](./song-library/) | The song data model, the bundled public‑domain catalogue, the server songbook with offline cache/fallback, and song validation. |
| **SG** | [singing-gameplay](./singing-gameplay/) | The live "Sing!" experience: synchronised note pills, karaoke highlight, pitch‑driven avatar, per‑note live scoring capture, and the headphone tip before singing. |
| **SR** | [scoring-and-results](./scoring-and-results/) | Octave‑forgiving scoring, star/timing/braveness assessment, tricky‑part detection, the results screen, and practise‑the‑tricky‑part. |
| **RP** | [rewards-and-progression](./rewards-and-progression/) | Sparkles, levels and titles, badges, daily streak and goal ring, per‑song bests, and the progress ("Me") view. |
| **PP** | [player-profiles](./player-profiles/) | Switchable singer profiles, avatars, profile photos, per‑profile storage namespacing, and first‑run onboarding. |
| **HS** | [family-high-scores](./family-high-scores/) | Server‑owned per‑song family high scores, upsert‑if‑better semantics, and per‑song / per‑singer boards. |
| **DM** | [duet-multiplayer](./duet-multiplayer/) | Two‑device real‑time duets: room codes, the SignalR relay, synchronised start, opponent overlay, and combined results. |
| **CE** | [coaching-and-encouragement](./coaching-and-encouragement/) | The Twinkle mascot, tips and warm‑ups, celebration, and the encouragement‑only tone system. |
| **GC** | [grown-ups-corner](./grown-ups-corner/) | The parent gate, mic‑latency calibration, the microphone picker, the pitch strictness choice, voice re‑setup, the song and avatar managers, reset, and privacy disclosure. |
| **AS** | [application-shell](./application-shell/) | Client routing, screen shell and bottom navigation, the installable PWA, and offline caching. |
| **FS** | [family-server-platform](./family-server-platform/) | Backend architecture (Clean Architecture, EF Core + SQLite), REST/CORS/health surface, security posture, and graceful client degradation. |
| **CL** | [command-line-interface](./command-line-interface/) | `TwinkleTune.Cli` — the installable .NET operations tool (System.CommandLine + Microsoft.Extensions, command‑per‑file, SOLID) that seeds and administers the server's data store out‑of‑band. |

---

## 5. Glossary

| Term | Definition |
|------|------------|
| **Sparkle** | The universal reward point. Ten sparkles are awarded per landed note. Sparkles drive levels and the daily goal. |
| **Landed note** | A note the singer matched (within tolerance, octave‑folded) for at least half of the frames in which her voice was heard, and for a meaningful share of the note. |
| **Pitch strictness** | How closely a singer's pitch must match a note for it to count: one of three levels a grown‑up chooses per singer — Gentle (±80 cents), Just right (±65), or Precise (±50, the default). Kept on the device. |
| **Octave folding / pitch class** | Comparing sung and target pitch modulo an octave, so a child singing the right note in a different octave still counts as correct. |
| **Shift / transpose** | The number of semitones a song is moved so its notes sit inside the singer's voice range. |
| **Range (voice range)** | A singer's lowest and highest comfortable notes, captured by "Find My Voice" and stored per singer. |
| **Streak** | The longest run of consecutive landed notes in a performance (in‑song), or consecutive days sung (daily). |
| **Tricky part** | The phrase in a song with the lowest landed ratio, offered afterward as an optional practice loop — never a penalty. |
| **Duet room** | An ephemeral, in‑memory, 4‑letter‑code room hosting exactly two singers for a synchronised head‑to‑head song. |
| **Family server** | The optional self‑hosted .NET backend that stores profiles, songs, photos, and high scores on the home LAN. |
| **Seed song** | One of the seven bundled public‑domain melodies, present both in the offline bundle and in the server's seed data. |
| **Family CLI (`TwinkleTune.Cli`)** | The installable .NET command‑line tool a grown‑up runs to administer the family server's data store out‑of‑band from the running host (see CL subsystem). |
| **Seed command** | The CLI's `twinkletune seed` command that idempotently writes the default avatars and seven seed songs — the product's seeding mechanism, replacing implicit start‑up seeding. |
| **Parent gate** | A client‑side challenge (a simple arithmetic question) that guards the Grown‑Ups Corner and destructive actions. |
| **No‑mic mode** | A "just for fun" play mode with no microphone; it never earns scored badges or high scores. |
| **Microphone choice** | The microphone a grown‑up picked for a device in the Grown‑Ups Corner. One per device, shared by every singer on it, kept on the device and never synced. |
| **System default** | The microphone the browser hands over when none is named. The app listens on it when there is no microphone choice, or when the chosen microphone is not plugged in. |
| **Headphone tip** | Twinkle's one‑line suggestion, before singing, that headphones or a headset help her hear just the singer. A tip, never a gate. |

---

## 6. Document conventions & maintenance

- Source references use repository‑relative paths (e.g. `frontend/src/state/scoring.ts`) and, where
  useful, a symbol or line anchor.
- Numeric constants quoted in acceptance criteria are the values in the shipped baseline; any change
  to a constant is a change to the requirement and shall be reflected here.
- When code and specification disagree, that is a defect in one of them; raise it rather than silently
  trusting either.

### Revision history

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-07-18 | Requirements reverse‑engineered from the v1 implementation | Initial baseline covering all thirteen subsystems. |
| 1.1 | 2026-11-09 | Voice‑comprehension improvements | Landed notes judged on sung frames with a timing tolerance (SR-L2-2, SR-L2-18, SG-L2-9, SG-L2-10, SG-L2-25). |
| 1.2 | 2026-11-09 | Voice‑comprehension improvements | Automatic pipeline latency compensation (AE-L2-18, SG-L2-19, GC-L2-4). |
| 1.3 | 2026-11-09 | Voice‑comprehension improvements | Band‑limited pitch detection and in‑band level gate (AE-L2-10, AE-L2-11, AE-L2-19, AE-L2-20). |
| 1.4 | 2026-11-09 | Voice‑comprehension improvements | Note evidence measured in time, independent of frame rate (SR-L2-2, SR-L2-19, SG-L2-9). |
| 1.5 | 2026-11-09 | Voice‑comprehension improvements | Fixed‑step pitch analysis independent of frame pacing (AE-L2-21, SG-L2-26, SR-L2-19). |
| 1.6 | 2026-11-09 | Voice‑comprehension improvements | Find My Voice capture window on the fixed step (VP-L2-3, VP-L2-4). |
| 1.7 | 2026-11-10 | Sing screen mock parity | Pitch lanes drawn by every scene renderer (SG-L2-27). |
| 1.8 | 2026-11-10 | Adjustable pitch strictness | A grown‑up chooses Gentle, Just right, or Precise per singer; the hit tolerance follows it (GC-L1-8, GC-L2-3, GC-L2-11, SR-L2-2, SR-L2-20, SG-L2-9, SG-L2-25, PP-L2-1, FS-L2-16). A dialog taller than the screen scrolls (AS-L2-6). |
| 1.9 | 2026-11-10 | Microphone choice and headphone guidance | A grown‑up can pick the microphone the device listens on, with the system default as fallback (AE-L1-8, AE-L2-14, AE-L2-22, GC-L1-9, GC-L2-3, GC-L2-9, GC-L2-12, FS-L2-16); a headphone tip before singing (SG-L1-10, SG-L2-28). |
| 1.10 | 2026-11-10 | Quinntyne Brown, Claude | Added the **Command‑Line Interface (CL)** subsystem (`TwinkleTune.Cli`): installable .NET tool, System.CommandLine + Microsoft.Extensions, command‑per‑file/SOLID, seeding moved from server start‑up into the `seed` command (ADR‑0003). FS‑L2‑4 updated to reflect the move. |
