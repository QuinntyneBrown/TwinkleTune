// Acceptance Test
// Traces to: DM-L2-19
// Description: After an automatic reconnect the duet client rejoins its room by itself and hands the screens the room as it stands

import { describe, expect, it } from 'vitest'
import { buddyIn, DuetClient, type DuetConnection, type DuetSummary, type RoomSnapshot } from './duet'

const zoe = { singerId: 'zoe-id', name: 'Zoe', avatar: '🦄' }
const mia = { singerId: 'mia-id', name: 'Mia', avatar: '🐱' }

const miaSummary: DuetSummary = {
  singerId: mia.singerId, name: 'Mia', landed: 15, total: 20, stars: 2, sparkles: 150, maxStreak: 6, accuracy: 0.75,
}

function snapshot(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'KWTM',
    players: [
      { info: zoe, lastTick: { landed: 5, streak: 5, sparkles: 50, noteIdx: 6 }, summary: null },
      { info: mia, lastTick: null, summary: null },
    ],
    songId: 'song-1',
    startAtUtc: '2026-06-12T12:00:03Z',
    result: null,
    ...over,
  }
}

/** Stands in for the SignalR connection: records what the client invokes and lets a test drop the line. */
class FakeHub implements DuetConnection {
  calls: Array<{ method: string; args: unknown[] }> = []
  rejoinAnswer: RoomSnapshot | Error = snapshot()
  private reconnected: Array<() => void> = []
  private handlers = new Map<string, Array<(...args: never[]) => void>>()

  invoke<T>(method: string, ...args: unknown[]): Promise<T> {
    this.calls.push({ method, args })
    if (method === 'CreateRoom' || method === 'JoinRoom') {
      return Promise.resolve({ code: 'KWTM', players: [zoe, mia], songId: null, startAtUtc: null } as T)
    }
    if (method === 'RejoinRoom') {
      return this.rejoinAnswer instanceof Error
        ? Promise.reject(this.rejoinAnswer)
        : Promise.resolve(this.rejoinAnswer as T)
    }
    return Promise.resolve(undefined as T)
  }
  on(event: string, handler: (...args: never[]) => void): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
  }
  onreconnected(handler: () => void): void {
    this.reconnected.push(handler)
  }
  stop(): Promise<void> {
    return Promise.resolve()
  }

  /** The line dropped and SignalR's automatic reconnection brought it back. */
  async reconnect(): Promise<void> {
    this.reconnected.forEach((h) => h())
    await new Promise((r) => setTimeout(r, 0))
  }
  raise(event: string, ...args: unknown[]): void {
    for (const h of this.handlers.get(event) ?? []) (h as (...a: unknown[]) => void)(...args)
  }
  invoked(method: string): unknown[][] {
    return this.calls.filter((c) => c.method === method).map((c) => c.args)
  }
}

describe('DM-L2-19 — the snapshot tells a rejoining singer how her buddy is doing', () => {
  it("finds the other singer's seat and her latest tick", () => {
    expect(buddyIn(snapshot(), mia)?.info).toEqual(zoe)
    expect(buddyIn(snapshot(), mia)?.lastTick?.sparkles).toBe(50)
    expect(buddyIn(snapshot(), zoe)?.info).toEqual(mia)
  })

  it('finds nobody while she is alone in the room', () => {
    expect(buddyIn(snapshot({ players: [snapshot().players[1]] }), mia)).toBeNull()
  })
})

describe('DM-L2-19 — the duet client rejoins after a reconnect', () => {
  it('rejoins the room it joined and hands the snapshot to the screen', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.joinRoom('KWTM', mia)
    const seen: RoomSnapshot[] = []
    client.onResync((room) => seen.push(room))

    await hub.reconnect()

    expect(hub.invoked('RejoinRoom')).toEqual([['KWTM', mia.singerId]])
    expect(seen).toEqual([snapshot()])
  })

  it('rejoins the room it made', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.createRoom(zoe)

    await hub.reconnect()

    expect(hub.invoked('RejoinRoom')).toEqual([['KWTM', zoe.singerId]])
  })

  it('has nothing to rejoin before a room or after leaving it', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await hub.reconnect()
    await client.joinRoom('KWTM', mia)
    await client.leave()
    await hub.reconnect()

    expect(hub.invoked('RejoinRoom')).toEqual([])
  })

  it('re-sends a finish the server never received', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.joinRoom('KWTM', mia)
    await client.finish(miaSummary) // sent into a dead line
    hub.calls = []

    await hub.reconnect()

    expect(hub.invoked('FinishSong')).toEqual([[miaSummary]])
  })

  it('does not re-send a finish the server already has', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.joinRoom('KWTM', mia)
    await client.finish(miaSummary)
    hub.calls = []
    hub.rejoinAnswer = snapshot({
      players: [snapshot().players[0], { info: mia, lastTick: null, summary: miaSummary }],
    })

    await hub.reconnect()

    expect(hub.invoked('FinishSong')).toEqual([])
  })

  it('forgets the last finish when a new song starts', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.joinRoom('KWTM', mia)
    await client.finish(miaSummary)
    hub.raise('SongStarted', 'song-2', '2026-06-12T12:05:03Z')
    hub.calls = []

    await hub.reconnect()

    expect(hub.invoked('FinishSong')).toEqual([])
  })

  it('carries on quietly when the room closed while she was away', async () => {
    const hub = new FakeHub()
    const client = DuetClient.over(hub)
    await client.joinRoom('KWTM', mia)
    const seen: RoomSnapshot[] = []
    client.onResync((room) => seen.push(room))
    hub.rejoinAnswer = new Error('That room has closed — make a new one!')

    await hub.reconnect()

    expect(seen).toEqual([])
  })
})
