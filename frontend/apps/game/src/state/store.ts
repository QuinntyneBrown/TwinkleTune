import type { Song } from '../songs/types'
import type { VoiceRange } from '@twinkletune/audio-engine'
import type { SongSummary } from './scoring'
import { evaluateBadges } from './badges'

export type { VoiceRange }

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Profile {
  name: string
  avatar: string
  range: VoiceRange | null
  /** mic latency compensation in ms (grown-ups setting; a device property, kept per device) */
  latencyMs: number
  /** server singer id when linked to the family server; null/undefined = local-only profile */
  singerId?: string | null
  avatarId?: string | null
  /** photo URL on the family server, shown instead of the emoji when present */
  photoUrl?: string | null
}

export interface SongBest {
  stars: number
  accuracy: number
  plays: number
}

export interface AppState {
  profile: Profile | null
  sparkles: number
  /** ISO dates (YYYY-MM-DD) on which at least one song was sung */
  singDays: string[]
  /** plays per ISO date, for the daily goal ring */
  plays: Record<string, number>
  bests: Record<string, SongBest>
  /** badge id -> ISO date earned */
  badges: Record<string, string>
  lastResult: SongSummary | null
  lastSongId: string | null
  lastNewBadges: string[]
}

const KEY = 'twinkletune:v1'

const emptyState = (): AppState => ({
  profile: null,
  sparkles: 0,
  singDays: [],
  plays: {},
  bests: {},
  badges: {},
  lastResult: null,
  lastSongId: null,
  lastNewBadges: [],
})

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return todayISO(date)
}

/** Consecutive sing-days ending today (or yesterday, so a streak isn't "lost" mid-day). */
export function streakCount(singDays: readonly string[], today: string): number {
  const set = new Set(singDays)
  let cursor = set.has(today) ? today : shiftISO(today, -1)
  let count = 0
  while (set.has(cursor)) {
    count++
    cursor = shiftISO(cursor, -1)
  }
  return count
}

export interface Store {
  get(): AppState
  set(patch: Partial<AppState>): void
  update(fn: (s: AppState) => void): void
  /** Re-point the store at another profile's blob (per-singer namespacing). */
  switchKey(key: string): void
  reset(): void
}

export function createStore(storage: StorageLike, initialKey: string = KEY): Store {
  let key = initialKey

  const load = (): AppState => {
    try {
      const raw = storage.getItem(key)
      if (raw) return { ...emptyState(), ...(JSON.parse(raw) as AppState) }
    } catch {
      /* corrupted state -> start fresh */
    }
    return emptyState()
  }

  let state = load()
  const save = () => storage.setItem(key, JSON.stringify(state))

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      save()
    },
    update(fn) {
      fn(state)
      save()
    },
    switchKey(newKey) {
      key = newKey
      state = load()
    },
    reset() {
      state = emptyState()
      storage.removeItem(key)
    },
  }
}

/** Record a completed play: sparkles, streak day, bests, badges. Returns newly earned badge ids. */
export function recordPlay(store: Store, song: Song, summary: SongSummary, today: string): string[] {
  let newBadges: string[] = []
  store.update((s) => {
    s.sparkles += summary.sparkles
    if (!s.singDays.includes(today)) s.singDays.push(today)
    s.plays[today] = (s.plays[today] ?? 0) + 1

    const best = s.bests[song.id] ?? { stars: 0, accuracy: 0, plays: 0 }
    s.bests[song.id] = {
      stars: Math.max(best.stars, summary.noMic ? 0 : summary.stars),
      accuracy: Math.max(best.accuracy, summary.noMic ? 0 : summary.accuracy),
      plays: best.plays + 1,
    }

    const totalPlays = Object.values(s.bests).reduce((sum, b) => sum + b.plays, 0)
    newBadges = evaluateBadges({
      totalPlays,
      streak: streakCount(s.singDays, today),
      summary,
      songDifficulty: song.difficulty,
      earned: new Set(Object.keys(s.badges)),
    })
    for (const id of newBadges) s.badges[id] = today

    s.lastResult = summary
    s.lastSongId = song.id
    s.lastNewBadges = newBadges
  })
  return newBadges
}

export function songsSungOn(state: AppState, day: string): number {
  return state.plays[day] ?? 0
}

/** Level = 1 + one level per 300 sparkles. */
export function level(sparkles: number): number {
  return Math.floor(sparkles / 300) + 1
}

export function sparklesToNextLevel(sparkles: number): number {
  return 300 - (sparkles % 300)
}

const LEVEL_TITLES = ['Hatchling', 'Chick', 'Fledgling', 'Songbird', 'Skylark', 'Nightingale', 'Superstar']
export function levelTitle(lvl: number): string {
  return LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)]
}

const memoryStorage = (): StorageLike => {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

const rootStorage: StorageLike = typeof localStorage !== 'undefined' ? localStorage : memoryStorage()

/* ---- per-singer profile namespacing -------------------------------------- */

const ACTIVE_KEY = 'twinkletune:active-singer'

export const profileKey = (singerId: string): string => `${KEY}:${singerId}`

export function getActiveSingerId(): string | null {
  return rootStorage.getItem(ACTIVE_KEY)
}

export function setActiveSingerId(id: string | null): void {
  if (id === null) rootStorage.removeItem(ACTIVE_KEY)
  else rootStorage.setItem(ACTIVE_KEY, id)
}

/**
 * One-time migration: the pre-profiles blob ('twinkletune:v1') is adopted by the
 * first server profile that claims it, so nobody loses sparkles or badges.
 */
export function adoptLegacyState(singerId: string): void {
  const target = profileKey(singerId)
  if (rootStorage.getItem(target) === null) {
    const legacy = rootStorage.getItem(KEY)
    if (legacy !== null) {
      rootStorage.setItem(target, legacy)
      rootStorage.removeItem(KEY)
    }
  }
}

const activeId = getActiveSingerId()
export const store: Store = createStore(rootStorage, activeId ? profileKey(activeId) : KEY)
