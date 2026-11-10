// Acceptance Test
// Traces to: GC-L2-12, FS-L2-16
// Description: The microphone choice is remembered per device, outside every singer's state

import { describe, expect, it } from 'vitest'
import { createDeviceSettings, MICROPHONE_KEY } from './device'
import { createStore, profileKey, type StorageLike } from './store'

const fakeStorage = (): StorageLike & { keys(): string[] } => {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  }
}

const headset = { deviceId: 'id-headset', label: "Ada's headset" }

describe('device settings: microphone choice (GC-L2-12)', () => {
  it('has no choice until a grown-up makes one', () => {
    expect(createDeviceSettings(fakeStorage()).getMicrophone()).toBeNull()
  })

  it('saves a choice at once, so a fresh load of the app reads it back', () => {
    const storage = fakeStorage()
    createDeviceSettings(storage).setMicrophone(headset)
    expect(createDeviceSettings(storage).getMicrophone()).toEqual(headset)
  })

  it('forgets the choice when the system default is picked', () => {
    const storage = fakeStorage()
    const device = createDeviceSettings(storage)
    device.setMicrophone(headset)
    device.setMicrophone(null)
    expect(device.getMicrophone()).toBeNull()
    expect(storage.keys()).not.toContain(MICROPHONE_KEY)
  })

  it('is shared by every singer: switching the active singer does not change it', () => {
    const storage = fakeStorage()
    const device = createDeviceSettings(storage)
    const store = createStore(storage, profileKey('ada'))
    store.update((s) => (s.sparkles = 10))
    device.setMicrophone(headset)

    store.switchKey(profileKey('bea'))
    store.update((s) => (s.sparkles = 20))

    expect(device.getMicrophone()).toEqual(headset)
  })

  it('is not part of any singer\'s state blob', () => {
    const storage = fakeStorage()
    const store = createStore(storage, profileKey('ada'))
    store.update((s) => (s.sparkles = 10))
    createDeviceSettings(storage).setMicrophone(headset)

    expect(storage.getItem(profileKey('ada'))).not.toContain('headset')
    expect(JSON.parse(storage.getItem(MICROPHONE_KEY) as string)).toEqual(headset)
  })

  it('is left alone by a singer\'s store reset, and forgotten only when asked', () => {
    const storage = fakeStorage()
    const device = createDeviceSettings(storage)
    const store = createStore(storage)
    device.setMicrophone(headset)

    store.reset()
    expect(device.getMicrophone()).toEqual(headset)

    device.setMicrophone(null)
    expect(device.getMicrophone()).toBeNull()
  })

  it('reads a damaged value as no choice', () => {
    const storage = fakeStorage()
    storage.setItem(MICROPHONE_KEY, '{not json')
    expect(createDeviceSettings(storage).getMicrophone()).toBeNull()
    storage.setItem(MICROPHONE_KEY, JSON.stringify({ label: 'no identifier' }))
    expect(createDeviceSettings(storage).getMicrophone()).toBeNull()
  })
})
