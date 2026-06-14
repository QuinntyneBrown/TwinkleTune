/**
 * REST client for the TwinkleTune family server.
 * Solo play NEVER requires this — every caller must degrade gracefully offline.
 */

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5240'

export interface ApiAvatar {
  id: string
  emoji: string
  name: string
}

export interface ApiSinger {
  id: string
  name: string
  avatarId: string | null
  avatarEmoji: string | null
  hasPhoto: boolean
  rangeLow: number | null
  rangeHigh: number | null
}

export interface ApiSongNote {
  midi: number
  start: number
  dur: number
  syll: string
}
export interface ApiSongPhrase {
  lyric: string
  notes: ApiSongNote[]
}
export interface ApiSong {
  id: string
  title: string
  emoji: string
  art: number
  bpm: number
  difficulty: number
  isSeed: boolean
  phrases: ApiSongPhrase[]
}

export interface SaveSongRequest {
  title: string
  emoji: string
  art: number
  bpm: number
  difficulty: number
  phrases: ApiSongPhrase[]
}

export interface ApiHighScore {
  songId: string
  singerId: string
  singerName: string
  singerAvatar: string | null
  singerHasPhoto: boolean
  stars: number
  accuracy: number
  sparkles: number
  maxStreak: number
  achievedAt: string
}

export interface SubmitHighScoreResult {
  improved: boolean
  score: ApiHighScore
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly errors: string[] = [],
  ) {
    super(message)
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let message = `Server said ${response.status}`
    let errors: string[] = []
    try {
      const body = (await response.json()) as { error?: string; errors?: string[] }
      if (body.error) message = body.error
      if (body.errors?.length) {
        errors = body.errors
        message = body.errors[0]
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, errors)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

let onlineCheck: { at: number; result: boolean } | null = null

/** Cheap reachability probe, cached for 10 seconds. */
export async function serverOnline(): Promise<boolean> {
  if (onlineCheck && Date.now() - onlineCheck.at < 10_000) return onlineCheck.result
  let result = false
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(1500) })
    result = response.ok
  } catch {
    result = false
  }
  onlineCheck = { at: Date.now(), result }
  return result
}

export const api = {
  avatars: {
    list: () => req<ApiAvatar[]>('/api/avatars'),
    create: (emoji: string, name: string) =>
      req<ApiAvatar>('/api/avatars', { method: 'POST', body: JSON.stringify({ emoji, name }) }),
    update: (id: string, emoji: string, name: string) =>
      req<ApiAvatar>(`/api/avatars/${id}`, { method: 'PUT', body: JSON.stringify({ emoji, name }) }),
    remove: (id: string) => req<void>(`/api/avatars/${id}`, { method: 'DELETE' }),
  },

  singers: {
    list: () => req<ApiSinger[]>('/api/singers'),
    get: (id: string) => req<ApiSinger>(`/api/singers/${id}`),
    create: (body: { name: string; avatarId: string | null; rangeLow: number | null; rangeHigh: number | null }) =>
      req<ApiSinger>('/api/singers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; avatarId: string | null; rangeLow: number | null; rangeHigh: number | null }) =>
      req<ApiSinger>(`/api/singers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => req<void>(`/api/singers/${id}`, { method: 'DELETE' }),
    uploadPhoto: (id: string, file: File) => {
      const form = new FormData()
      form.append('photo', file)
      return req<ApiSinger>(`/api/singers/${id}/photo`, { method: 'PUT', body: form })
    },
    photoUrl: (id: string) => `${API_URL}/api/singers/${id}/photo`,
  },

  songs: {
    list: () => req<ApiSong[]>('/api/songs'),
    create: (body: SaveSongRequest) => req<ApiSong>('/api/songs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: SaveSongRequest) =>
      req<ApiSong>(`/api/songs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => req<void>(`/api/songs/${id}`, { method: 'DELETE' }),
  },

  highscores: {
    submit: (body: {
      songId: string
      singerId: string
      stars: number
      accuracy: number
      sparkles: number
      maxStreak: number
    }) => req<SubmitHighScoreResult>('/api/highscores', { method: 'POST', body: JSON.stringify(body) }),
    forSong: (songId: string) => req<ApiHighScore[]>(`/api/songs/${songId}/highscores`),
    forSinger: (singerId: string) => req<ApiHighScore[]>(`/api/singers/${singerId}/highscores`),
  },
}
