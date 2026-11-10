/**
 * Which microphone to listen on. Pure decisions only (no DOM, no Web Audio):
 * the browser calls live in microphone-access.ts.
 */

export interface MicrophoneInfo {
  deviceId: string
  label: string
}

/** The microphone a grown-up picked for this device: its identifier and name when picked. */
export type MicrophoneChoice = MicrophoneInfo

export interface MicrophoneListing {
  /** false when the browser cannot list devices at all */
  supported: boolean
  /** true when microphones are listed with their names withheld (no permission yet) */
  namesHidden: boolean
  microphones: MicrophoneInfo[]
}

interface DeviceLike {
  kind: string
  deviceId: string
  label: string
}

/** the browser's own stand-ins for "whatever the system default is" */
const ALIASES = new Set(['default', 'communications'])

/** What the browser's device list says about microphones; `null` = it cannot list. */
export function listMicrophonesFrom(devices: readonly DeviceLike[] | null): MicrophoneListing {
  if (devices === null) return { supported: false, namesHidden: false, microphones: [] }
  const inputs = devices.filter((d) => d.kind === 'audioinput')
  const named = inputs.filter((d) => d.label !== '' && !ALIASES.has(d.deviceId))
  return {
    supported: true,
    namesHidden: inputs.length > 0 && inputs.every((d) => d.label === ''),
    microphones: named.map((d) => ({ deviceId: d.deviceId, label: d.label })),
  }
}

/**
 * The device identifier to ask the browser for, or `null` for the system
 * default. Identifiers can change between visits, so a listed microphone with
 * the saved name stands in for a saved identifier that is gone. When the
 * browser cannot say what is plugged in, the saved identifier is worth a try.
 */
export function resolveMicrophone(choice: MicrophoneChoice | null, listing: MicrophoneListing): string | null {
  if (!choice) return null
  if (!listing.supported || listing.namesHidden) return choice.deviceId
  const byId = listing.microphones.find((m) => m.deviceId === choice.deviceId)
  if (byId) return byId.deviceId
  const byName = choice.label === '' ? undefined : listing.microphones.find((m) => m.label === choice.label)
  return byName ? byName.deviceId : null
}

/** Browser processing stays off so the pitch reaches the detector untouched. */
export function microphoneConstraints(deviceId: string | null): MediaTrackConstraints {
  const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  return deviceId === null ? base : { ...base, deviceId: { exact: deviceId } }
}
