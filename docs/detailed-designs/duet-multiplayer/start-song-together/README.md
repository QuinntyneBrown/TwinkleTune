# Start the Song Together

## Overview

Two singers in two rooms of the same house press start once, and both songs
begin. This feature is the moment of agreement: the server refuses to start
unless both singers are present, clears anything left over from a previous run,
and takes both devices to the singing screen. There each singer taps
`I'm ready! 🎤🎤`, and only when both have does the server fix one start instant
slightly in the future and tell both devices. The near-future instant exists
because a message takes a moment to arrive; each device places it on the
server's clock because two tablets on the same home network do not agree on the
current instant; and the count-in that opens every song widens the window in
which a small remaining disagreement does not matter.

The terms below are used throughout.

- synchronised start — single server-issued moment that both devices treat as the
  beginning of the same performance
- start lead — interval by which the server places the start time ahead of the
  moment the start is requested, fixed at 3 seconds
- clock skew — difference between two devices' notions of the current instant
- ready handshake — each singer telling the server she is ready, with the start
  instant issued only once both have
- shared start instant — `SingAtUtc`, the moment on the server's clock at which
  both devices begin the count-in
- clock offset — milliseconds to add to a device's clock to get the server's,
  measured from a server-time round trip
- count-in — four metronome clicks played before the first note, during which the
  beat position is negative
- summary reset — clearing of both players' stored finish summaries when a song
  starts, so a second run is not judged against the first
- per-phrase comparison — comparing two performances a phrase at a time rather
  than instant by instant, so a momentary network delay does not distort the
  result

The feature sits between the lobby, which supplies the chosen song, and the
singing screen, which runs the gameplay loop and the opponent overlay.

## Description

Frontend — TwinkleTune web app (`frontend/src/screens/duet.ts`):

- **start action** — the lobby's `Start the duet! 🎤🎤` button reads the selected
  `songId` and calls `c.startSong(songId)`; a rejection raises the toast
  `Need both singers in the room!`.
- **`onSongStarted` subscription** — registered in `wireRoomEvents(c)`. It
  resolves the opponent from `lobbyRoom.players`, sets `handedOff = true` so the
  screen teardown does not end the session, and navigates to
  `#/sing?song={songId}&duet=1`.

Frontend — duet API adapter (`frontend/src/api/duet.ts`):

- **`DuetClient.startSong(songId)`** — invokes the hub method `StartSong` and
  returns the invocation promise, so a refusal is observable to the caller.
- **`DuetClient.onSongStarted(cb)`** — registers a handler for the `SongStarted`
  event with the signature `(songId: string, startAtUtc: string) => void`.

Frontend — singing screen and player
(`frontend/src/screens/sing.ts`, `frontend/src/audio/player.ts`):

- **`renderSing(root, params)`** — reads `duet` from `duetSession.get()` when
  `params.get('duet') === '1'`, and returns to `#/duet` when the session is
  absent. In duet mode the start control reads `I'm ready! 🎤🎤`.
- **`go()`** — what the start flow calls once the microphone is listening (or
  she chose to sing for fun). Solo it calls `begin()`. In a duet it shows
  `Waiting for <buddy>… ⏳` with a quiet `Leave the duet 👋` in place of the start
  button and invokes `duet.client.ready()`; a ready that cannot be sent starts
  her own song at once.
- **`startTogether(waitMs)`** — ends the wait: shows `Here we go! 🎤🎤` and calls
  `begin()` after `waitMs`. It is called by the `SingAt` handler with the wait
  the client worked out, by a `PlayerLeft` with zero so she is never left
  waiting, and by a resync whose snapshot carries a `singAtUtc` she missed.
- **`begin(from = fromBeat, countIn = 4)`** — starts `SongPlayer` with
  `countInBeats: countIn` and begins the animation frame loop.
- **`SongPlayer.start(song, opts)`** — schedules `countInBeats` clicks from `t0`,
  the first at 1568 Hz and the rest at 1046 Hz, and places the first note at
  `t0 + countInBeats · spb`.
- **`SongPlayer.currentBeat()`** — returns `startBeat - countIn` before playback
  and advances from there, so the beat position is negative through the count-in.

Frontend — clock (`frontend/src/api/clock-sync.ts`, `frontend/src/api/duet.ts`):

- **`estimateClockOffset(samples)`** — each `ClockSample` holds the device time a
  `ServerTime` question was sent, the device time its answer arrived, and the
  server's answer. The offset is the answer minus the midpoint of the round
  trip, taken from the sample with the shortest round trip; no samples means
  zero.
- **`delayUntil(serverInstant, deviceNow, offsetMs)`** — the instant minus the
  device time corrected by the offset, never below zero and never above
  `MAX_START_WAIT_MS`.
- **`DuetClient.measureClockOffset(rounds = 3)`** — takes the samples through the
  hub when the duet singing screen opens.
- **`DuetClient.ready()`**, **`onSingAt(cb)`**, **`waitUntil(instant)`** — invoke
  `Ready`, and turn a `SingAt` instant (or one found in a snapshot) into the
  wait the screen needs.

Backend — TwinkleTune API application (`backend/src/TwinkleTune.Api/Hubs/DuetHub.cs`):

- **`Ready()`** — calls `rooms.MarkReady` and, when the result carries a
  `SingAtUtc`, sends `SingAt` with it to `Clients.Group(code)`.
- **`ServerTime()`** — returns `time.GetUtcNow()` from the injected
  `TimeProvider`.

- **`StartSong(Guid songId)`** — calls `rooms.StartSong` and throws
  `HubException("You need two singers in the room to start!")` when the service
  returns `null`; otherwise it sends `SongStarted` with `start.SongId` and
  `start.StartAtUtc` to `Clients.Group(start.Code)`, reaching both players.

Backend — Application and Domain
(`backend/src/TwinkleTune.Application/Duet/RoomService.cs`):

- **`RoomService.StartSong(connectionId, songId)`** — resolves the room from the
  connection mapping and returns `null` when no room is found or when
  `room.Players.Count < MaxPlayers`. Otherwise, inside `lock (room)`, it records
  `room.SongId`, sets `room.StartAtUtc = time.GetUtcNow().AddSeconds(3)`, stamps
  `room.LastActivity`, sets every `p.Summary` to `null`, and returns a
  `StartResult`.
- **`StartResult`** — record carrying `Code`, `SongId`, and `StartAtUtc`.
- **`RoomService.MarkReady(connectionId)`** — marks the player ready and, when
  both players are ready and no instant is set yet, sets
  `room.SingAtUtc = time.GetUtcNow() + StartLead`. It returns a `ReadyResult`
  with the code and the instant, which is `null` while she waits. `StartSong`
  clears every `Ready` flag and `SingAtUtc`, so a new song needs both again.
- **`TimeProvider time`** — injected clock, so `StartAtUtc` and `SingAtUtc` are
  deterministic under test.

Constants (the shipped baseline): start lead `3` seconds, `MaxPlayers = 2`,
count-in `4` beats (`2` beats on a practice repeat), `MAX_START_WAIT_MS = 6000`,
`3` server-time rounds.

`StartAtUtc` still travels with `SongStarted`, but nothing aligns to it: by the
time both singers have tapped `I'm ready! 🎤🎤` it has passed. The instant the
devices align to is `SingAtUtc`. The per-phrase comparison of the two
performances that ADR-0001 names as the latency-variance mitigation is
`<TO SUPPLY>`.

Coverage: `RoomServiceTests` exercises the refusal below two players and the
3-second lead; `DuetFlowTests` exercises the `SongStarted` broadcast to both
connections; `RoomReadyTests` and `DuetReadyStartTests` exercise the ready
handshake and the shared instant; `clock-sync.test.ts` and `duet.test.ts`
exercise the offset and the wait; `e2e/tests-server/duet.spec.ts` takes two
browsers through the wait and the shared count-in.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement
refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `DM-L2-4` | `DM-L1-1, DM-L1-4` | Starting a song shall require two players; on start the server shall set a start time approximately 3 seconds in the future, clear any prior summaries, and broadcast `SongStarted` with the song id and start time to both clients. A start attempted with fewer than two players shall be refused. |
| `DM-L2-5` | `DM-L1-4` | The synchronised start shall combine the server-issued future start time with the gameplay count-in so that small clock differences between devices do not desynchronise the shared start; result comparison shall be per phrase rather than instantaneous. |
| `DM-L2-20` | `DM-L1-4` | Each singer shall say she is ready on the singing screen; the server shall issue one shared start instant approximately 3 seconds ahead only when both are ready, and a singer shall never be left waiting. |
| `DM-L2-21` | `DM-L1-4` | The client shall measure its offset from the server's clock and place the shared start instant with it, waiting never less than zero and never more than 6 seconds. |

## Diagrams

### System context

Both singers reach the same family server, and the server alone decides when the
shared song begins (`DM-L2-4`).

![C4 system context for starting the song together](diagrams/c4-context.png)

### Containers

One device invokes `StartSong` on the hub; the hub broadcasts `SongStarted` to
the room group so both web apps navigate to the singing screen (`DM-L2-4`).

![C4 container view for starting the song together](diagrams/c4-container.png)

### Components

`RoomService.StartSong` enforces the two-player precondition and stamps the
3-second lead, and `SongPlayer` supplies the four-beat count-in that absorbs the
remaining skew (`DM-L2-4`, `DM-L2-5`).

![C4 component view for starting the song together](diagrams/c4-component.png)

### Class structure

`StartResult` carries the code, song id, and start time from `RoomService` to
`DuetHub`, and `SongPlayer` holds the count-in that the beat clock offsets
against (`DM-L2-4`, `DM-L2-5`).

![Class diagram for starting the song together](diagrams/class-structure.png)

### Behaviour — start a song for both devices

The `alt` shows the refusal below two players and the accepted path that stamps
`StartAtUtc = now + 3s` and clears prior summaries (`DM-L2-4`); both devices
receive one broadcast and each opens its own four-beat count-in (`DM-L2-5`).

![Sequence diagram for starting a song for both devices](diagrams/sequence-start-song.png)

### Behaviour — both singers ready, one shared count-in

Each device measures its clock offset when the singing screen opens. The first
singer to tap waits; the second tap makes the server stamp
`SingAtUtc = now + 3s`, and each device waits until that instant on the server's
clock before its four-beat count-in (`DM-L2-20`, `DM-L2-21`, `DM-L2-5`).

![Sequence diagram for the ready handshake and the shared count-in](diagrams/sequence-ready-and-count-in.png)
