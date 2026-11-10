import type { MicrophoneChoice } from '../audio/microphone'
import { rootStorage, type StorageLike } from './store'

/**
 * Settings that belong to the device, not to a singer: they sit under their
 * own storage keys, outside every singer's blob, so switching or resetting a
 * singer leaves them alone and no profile sync can carry them.
 */
export interface DeviceSettings {
  /** the microphone a grown-up picked, or null for the system default */
  getMicrophone(): MicrophoneChoice | null
  setMicrophone(choice: MicrophoneChoice | null): void
}

export const MICROPHONE_KEY = 'twinkletune:microphone'

export function createDeviceSettings(storage: StorageLike): DeviceSettings {
  return {
    getMicrophone() {
      try {
        const saved = JSON.parse(storage.getItem(MICROPHONE_KEY) ?? 'null') as Partial<MicrophoneChoice> | null
        if (saved && typeof saved.deviceId === 'string') {
          return { deviceId: saved.deviceId, label: typeof saved.label === 'string' ? saved.label : '' }
        }
      } catch {
        /* damaged value -> no choice */
      }
      return null
    },
    setMicrophone(choice) {
      if (choice === null) storage.removeItem(MICROPHONE_KEY)
      else storage.setItem(MICROPHONE_KEY, JSON.stringify({ deviceId: choice.deviceId, label: choice.label }))
    },
  }
}

export const deviceSettings: DeviceSettings = createDeviceSettings(rootStorage)
