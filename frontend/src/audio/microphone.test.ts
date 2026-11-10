// Acceptance Test
// Traces to: AE-L2-22, AE-L2-14
// Description: Given the saved microphone choice and what is plugged in, decide what to ask the browser for

import { describe, expect, it } from 'vitest'
import {
  listMicrophonesFrom,
  microphoneConstraints,
  resolveMicrophone,
  type MicrophoneListing,
} from './microphone'

const builtIn = { deviceId: 'id-built-in', label: 'Built-in microphone' }
const headset = { deviceId: 'id-headset', label: "Ada's headset" }

const listing = (over: Partial<MicrophoneListing> = {}): MicrophoneListing => ({
  supported: true,
  namesHidden: false,
  microphones: [builtIn, headset],
  ...over,
})

describe('listMicrophonesFrom (AE-L2-22)', () => {
  it('keeps the real microphones and drops other devices and the browser\'s own aliases', () => {
    const result = listMicrophonesFrom([
      { kind: 'audioinput', deviceId: 'default', label: 'Default - Built-in microphone' },
      { kind: 'audioinput', deviceId: 'communications', label: 'Communications - Built-in microphone' },
      { kind: 'audioinput', ...builtIn },
      { kind: 'audioinput', ...headset },
      { kind: 'audiooutput', deviceId: 'id-speaker', label: 'Speaker' },
      { kind: 'videoinput', deviceId: 'id-camera', label: 'Camera' },
    ])
    expect(result).toEqual({ supported: true, namesHidden: false, microphones: [builtIn, headset] })
  })

  it('reports names as withheld when the browser lists microphones without names', () => {
    const result = listMicrophonesFrom([
      { kind: 'audioinput', deviceId: '', label: '' },
      { kind: 'audiooutput', deviceId: '', label: '' },
    ])
    expect(result).toEqual({ supported: true, namesHidden: true, microphones: [] })
  })

  it('reports a device with no microphone at all as an empty list, not as withheld names', () => {
    expect(listMicrophonesFrom([])).toEqual({ supported: true, namesHidden: false, microphones: [] })
  })

  it('reports a browser that cannot list devices', () => {
    expect(listMicrophonesFrom(null)).toEqual({ supported: false, namesHidden: false, microphones: [] })
  })
})

describe('resolveMicrophone (AE-L2-22)', () => {
  it('asks for the system default when no microphone was chosen', () => {
    expect(resolveMicrophone(null, listing())).toBeNull()
  })

  it('asks for the chosen microphone when its identifier is listed', () => {
    expect(resolveMicrophone(headset, listing())).toBe('id-headset')
  })

  it('finds the chosen microphone by name when its identifier has changed', () => {
    const rotated = listing({ microphones: [builtIn, { deviceId: 'id-new', label: "Ada's headset" }] })
    expect(resolveMicrophone(headset, rotated)).toBe('id-new')
  })

  it('asks for the system default when the chosen microphone is not plugged in', () => {
    expect(resolveMicrophone(headset, listing({ microphones: [builtIn] }))).toBeNull()
  })

  it('does not match a microphone on an empty name', () => {
    const unnamedChoice = { deviceId: 'id-gone', label: '' }
    const unnamedListed = listing({ microphones: [{ deviceId: 'id-other', label: '' }] })
    expect(resolveMicrophone(unnamedChoice, unnamedListed)).toBeNull()
  })

  it('tries the saved identifier when the browser withholds the names', () => {
    expect(resolveMicrophone(headset, listing({ namesHidden: true, microphones: [] }))).toBe('id-headset')
  })

  it('tries the saved identifier when the browser cannot list microphones', () => {
    expect(resolveMicrophone(headset, listing({ supported: false, microphones: [] }))).toBe('id-headset')
  })
})

describe('microphoneConstraints (AE-L2-14)', () => {
  it('asks for the system default with browser processing off, naming no device', () => {
    expect(microphoneConstraints(null)).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    })
  })

  it('names the chosen microphone exactly, still with browser processing off', () => {
    expect(microphoneConstraints('id-headset')).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      deviceId: { exact: 'id-headset' },
    })
  })
})
