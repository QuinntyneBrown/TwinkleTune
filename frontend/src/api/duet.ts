import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { API_URL } from './client'

export interface DuetPlayerInfo {
  singerId: string
  name: string
  avatar: string
}

export interface DuetTick {
  landed: number
  streak: number
  sparkles: number
  noteIdx: number
}

export interface DuetSummary {
  singerId: string
  name: string
  landed: number
  total: number
  stars: number
  sparkles: number
  maxStreak: number
  accuracy: number
}

export interface RoomState {
  code: string
  players: DuetPlayerInfo[]
  songId: string | null
  startAtUtc: string | null
}

export interface DuetResult {
  players: DuetSummary[]
  combinedSparkles: number
}

/** One singer's seat in a room snapshot: who she is and how far she has got. */
export interface PlayerSnapshot {
  info: DuetPlayerInfo
  lastTick: DuetTick | null
  summary: DuetSummary | null
}

/** The room as it stands, handed back by the server when a dropped singer rejoins. */
export interface RoomSnapshot {
  code: string
  players: PlayerSnapshot[]
  songId: string | null
  startAtUtc: string | null
  result: DuetResult | null
}

/** The other singer's seat in a snapshot: her latest tick and summary, for the opponent chip. */
export function buddyIn(room: RoomSnapshot, me: DuetPlayerInfo): PlayerSnapshot | null {
  return room.players.find((p) => p.info.singerId !== me.singerId || p.info.name !== me.name) ?? null
}

/** The part of a SignalR connection the duet client uses, so a test can stand in for the hub. */
export interface DuetConnection {
  invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T>
  on(event: string, handler: (...args: never[]) => void): void
  onreconnected(handler: () => void): void
  stop(): Promise<void>
}

/** Thin wrapper over the SignalR hub so screens never touch the connection directly. */
export class DuetClient {
  /** the room this connection sits in, so a reconnect knows where to go back to */
  private seat: { code: string; singerId: string } | null = null
  /** the finish summary of the song in progress, in case it was sent into a dead line */
  private sentSummary: DuetSummary | null = null
  private resync: ((room: RoomSnapshot) => void) | null = null

  private constructor(private conn: DuetConnection) {
    // an automatic reconnect comes back on a new connection the room has never seen
    conn.onreconnected(() => void this.rejoin())
    conn.on('SongStarted', () => {
      this.sentSummary = null
    })
  }

  static async connect(): Promise<DuetClient> {
    const conn = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/duet`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()
    await conn.start()
    return new DuetClient(conn)
  }

  /** Wraps a connection that is already started. */
  static over(conn: DuetConnection): DuetClient {
    return new DuetClient(conn)
  }

  async createRoom(info: DuetPlayerInfo): Promise<RoomState> {
    const room = await this.conn.invoke<RoomState>('CreateRoom', info)
    this.seat = { code: room.code, singerId: info.singerId }
    return room
  }

  async joinRoom(code: string, info: DuetPlayerInfo): Promise<RoomState> {
    const room = await this.conn.invoke<RoomState>('JoinRoom', code, info)
    this.seat = { code: room.code, singerId: info.singerId }
    return room
  }

  /**
   * Takes her seat back on the new connection and hands the screen the room as it stands.
   * A finish the server never received is sent again, so the combined result can still arrive.
   */
  private async rejoin(): Promise<void> {
    const seat = this.seat
    if (!seat) return
    try {
      const room = await this.conn.invoke<RoomSnapshot>('RejoinRoom', seat.code, seat.singerId)
      const mine = room.players.find((p) => p.info.singerId === seat.singerId)
      if (this.sentSummary && !mine?.summary) {
        void this.conn.invoke('FinishSong', this.sentSummary).catch(() => {})
      }
      this.resync?.(room)
    } catch {
      /* the room closed while she was away; her own song carries on */
    }
  }

  /** Called with the room as it stands after a reconnect. One screen listens at a time. */
  onResync(cb: (room: RoomSnapshot) => void): void {
    this.resync = cb
  }

  startSong(songId: string): Promise<void> {
    return this.conn.invoke('StartSong', songId)
  }

  sendTick(tick: DuetTick): void {
    void this.conn.invoke('ScoreTick', tick).catch(() => {})
  }

  finish(summary: DuetSummary): Promise<void> {
    this.sentSummary = summary
    return this.conn.invoke('FinishSong', summary)
  }

  onPlayerJoined(cb: (p: DuetPlayerInfo) => void): void {
    this.conn.on('PlayerJoined', cb)
  }
  onPlayerLeft(cb: (p: DuetPlayerInfo) => void): void {
    this.conn.on('PlayerLeft', cb)
  }
  onSongStarted(cb: (songId: string, startAtUtc: string) => void): void {
    this.conn.on('SongStarted', cb)
  }
  onOpponentTick(cb: (t: DuetTick) => void): void {
    this.conn.on('OpponentTick', cb)
  }
  onOpponentFinished(cb: (s: DuetSummary) => void): void {
    this.conn.on('OpponentFinished', cb)
  }
  onDuetResult(cb: (r: DuetResult) => void): void {
    this.conn.on('DuetResult', cb)
  }

  async leave(): Promise<void> {
    this.seat = null
    try {
      await this.conn.invoke('LeaveRoom')
    } catch {
      /* already gone */
    }
    await this.conn.stop()
  }
}

/**
 * The duet session lives across the lobby → sing → results navigation.
 * Screens stash the connection + room context here.
 */
export interface DuetSession {
  client: DuetClient
  code: string
  me: DuetPlayerInfo
  opponent: DuetPlayerInfo | null
  result: DuetResult | null
  mySummary: DuetSummary | null
}

let session: DuetSession | null = null

export const duetSession = {
  get: (): DuetSession | null => session,
  set: (s: DuetSession | null): void => {
    session = s
  },
  async end(): Promise<void> {
    if (session) {
      await session.client.leave()
      session = null
    }
  },
}
