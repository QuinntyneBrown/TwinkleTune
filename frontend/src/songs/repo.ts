import { api, type ApiSong } from '../api/client'
import { songs as bundledSongs } from './catalog'
import type { Song } from './types'

/**
 * Song source of truth at runtime: the family server when reachable,
 * else the last fetched list (cached), else the bundled six.
 * Solo play therefore never requires the network.
 */

const CACHE_KEY = 'twinkletune:songs-cache'

function fromApi(s: ApiSong): Song {
  return {
    id: s.id,
    title: s.title,
    emoji: s.emoji,
    art: (s.art >= 1 && s.art <= 4 ? s.art : 1) as Song['art'],
    bpm: s.bpm,
    difficulty: (s.difficulty >= 1 && s.difficulty <= 3 ? s.difficulty : 1) as Song['difficulty'],
    phrases: s.phrases,
  }
}

function readCache(): Song[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Song[]) : null
  } catch {
    return null
  }
}

let current: Song[] = readCache() ?? bundledSongs
let liveFromServer = false

export async function loadSongs(): Promise<{ songs: Song[]; online: boolean }> {
  try {
    const remote = await api.songs.list()
    current = remote.map(fromApi)
    liveFromServer = true
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(current))
    } catch {
      /* cache is best effort */
    }
    return { songs: current, online: true }
  } catch {
    liveFromServer = false
    return { songs: current, online: false }
  }
}

export function currentSongs(): Song[] {
  return current
}

export function songsAreLive(): boolean {
  return liveFromServer
}

export function getSongById(id: string): Song | undefined {
  return current.find((s) => s.id === id) ?? bundledSongs.find((s) => s.id === id)
}

/** Server song ids are GUIDs; bundled fallback ids are slugs like 'twinkle'. */
export function isServerSongId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
