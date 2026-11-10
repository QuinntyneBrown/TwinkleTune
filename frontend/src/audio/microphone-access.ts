import { listMicrophonesFrom, type MicrophoneListing } from './microphone'

/**
 * The browser side of choosing a microphone. Names and identifiers read here
 * stay on the device: nothing in this module, or anything it feeds, makes a
 * network call.
 */

/** The device's microphones as the browser reports them right now. */
export async function listMicrophones(): Promise<MicrophoneListing> {
  try {
    const media = navigator.mediaDevices
    if (!media || typeof media.enumerateDevices !== 'function') return listMicrophonesFrom(null)
    return listMicrophonesFrom(await media.enumerateDevices())
  } catch {
    return listMicrophonesFrom(null)
  }
}

/**
 * A browser shares microphone names only once the microphone has been
 * allowed. This asks for it for that purpose alone: the stream is stopped at
 * once and nothing is analysed. Resolves false when the request is refused.
 */
export async function revealMicrophoneNames(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/** Calls `listener` when a microphone is plugged in or removed. Returns the unsubscribe. */
export function onMicrophonesChanged(listener: () => void): () => void {
  const media = navigator.mediaDevices
  if (!media || typeof media.addEventListener !== 'function') return () => {}
  media.addEventListener('devicechange', listener)
  return () => media.removeEventListener('devicechange', listener)
}
