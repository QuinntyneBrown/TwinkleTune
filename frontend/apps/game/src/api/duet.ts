import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr'
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

/** Thin wrapper over the SignalR hub so screens never touch the connection directly. */
export class DuetClient {
  private constructor(private conn: HubConnection) {}

  static async connect(): Promise<DuetClient> {
    const conn = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/duet`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()
    await conn.start()
    return new DuetClient(conn)
  }

  createRoom(info: DuetPlayerInfo): Promise<RoomState> {
    return this.conn.invoke<RoomState>('CreateRoom', info)
  }

  joinRoom(code: string, info: DuetPlayerInfo): Promise<RoomState> {
    return this.conn.invoke<RoomState>('JoinRoom', code, info)
  }

  startSong(songId: string): Promise<void> {
    return this.conn.invoke('StartSong', songId)
  }

  sendTick(tick: DuetTick): void {
    void this.conn.invoke('ScoreTick', tick).catch(() => {})
  }

  finish(summary: DuetSummary): Promise<void> {
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
