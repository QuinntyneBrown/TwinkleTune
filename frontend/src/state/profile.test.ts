// Acceptance Test
// Traces to: GC-L2-11, PP-L2-1, FS-L2-16
// Description: A singer's pitch strictness level stays on the device through every exchange with the family server

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type ApiSinger } from '../api/client'
import { activateSinger, applySingerToProfile, pushProfileToServer } from './profile'
import { pitchStrictness } from './scoring'
import { profileKey, store } from './store'

const singer = (over: Partial<ApiSinger> = {}): ApiSinger => ({
  id: 'ada',
  name: 'Ada',
  avatarId: 'unicorn',
  avatarEmoji: '🦄',
  hasPhoto: false,
  rangeLow: 59,
  rangeHigh: 76,
  ...over,
})

describe('pitch strictness and the family server', () => {
  beforeEach(() => {
    for (const id of ['ada', 'bea']) {
      store.switchKey(profileKey(id))
      store.reset()
    }
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the device’s level when the profile is rebuilt from the server’s record', () => {
    store.switchKey(profileKey('ada'))
    store.set({ profile: { name: 'Ada', avatar: '🦄', range: null, latencyMs: 40, strictness: 'gentle' } })

    applySingerToProfile(singer({ name: 'Ada Lovelace' }))

    const profile = store.get().profile
    expect(profile?.name).toBe('Ada Lovelace')
    expect(profile?.range).toEqual({ low: 59, high: 76 })
    expect(profile?.latencyMs).toBe(40)
    expect(profile?.strictness).toBe('gentle')
  })

  it('shows each singer her own level as the active singer changes', () => {
    activateSinger(singer())
    store.update((s) => {
      if (s.profile) s.profile.strictness = 'gentle'
    })

    activateSinger(singer({ id: 'bea', name: 'Bea', avatarEmoji: '🐱' }))
    expect(pitchStrictness(store.get().profile?.strictness)).toBe('precise')

    activateSinger(singer())
    expect(store.get().profile?.strictness).toBe('gentle')
  })

  it('never sends the level to the family server', async () => {
    const update = vi.spyOn(api.singers, 'update').mockResolvedValue(singer())
    activateSinger(singer())
    store.update((s) => {
      if (s.profile) s.profile.strictness = 'gentle'
    })

    await pushProfileToServer()

    expect(update).toHaveBeenCalledTimes(1)
    const [id, body] = update.mock.calls[0]
    expect(id).toBe('ada')
    expect(Object.keys(body).sort()).toEqual(['avatarId', 'name', 'rangeHigh', 'rangeLow'])
    expect(JSON.stringify(body)).not.toContain('gentle')
  })
})
