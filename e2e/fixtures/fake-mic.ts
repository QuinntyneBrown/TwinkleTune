import type { Page } from '@playwright/test'

export interface FakeMicrophone {
  deviceId: string
  label: string
}

interface FakeMicPatch {
  hz?: number
  denied?: boolean
  devices?: FakeMicrophone[]
  namesHidden?: boolean
  unlistable?: boolean
}

/**
 * Runs in the page before the app. Every FakeMic method that must act before
 * navigation adds one call of this with its own patch; the first call installs
 * the stand-ins, later calls only change what they do.
 */
function installFakeMic(patch: FakeMicPatch): void {
  interface State {
    hz: number
    denied: boolean
    devices: { deviceId: string; label: string }[] | null
    namesHidden: boolean
    unlistable: boolean
    granted: boolean
    requests: (string | null)[]
    streams: MediaStream[]
    osc: OscillatorNode | null
    gain: GainNode | null
  }
  const w = window as unknown as Record<string, unknown>
  const fresh = !w.__fakeMic
  const state = (w.__fakeMic ??= {
    hz: 220,
    denied: false,
    devices: null,
    namesHidden: false,
    unlistable: false,
    granted: false,
    requests: [],
    streams: [],
    osc: null,
    gain: null,
  }) as State
  Object.assign(state, patch)
  if (state.unlistable) {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: undefined })
  }
  if (!fresh) return

  w.__fakeMicHz = state.hz
  w.__setFakeMic = (nextHz: number, on = true) => {
    state.hz = nextHz
    w.__fakeMicHz = nextHz
    if (state.osc) state.osc.frequency.value = nextHz
    if (state.gain) state.gain.gain.value = on ? 0.5 : 0.0001
  }

  navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    const audio = constraints?.audio
    const wanted = typeof audio === 'object' ? (audio.deviceId as { exact?: string } | undefined)?.exact ?? null : null
    state.requests.push(wanted)
    if (state.denied) throw new DOMException('Permission denied by test', 'NotAllowedError')
    if (wanted !== null && state.devices && !state.devices.some((d) => d.deviceId === wanted)) {
      throw new DOMException('No such microphone in this test', 'OverconstrainedError')
    }
    state.granted = true
    const ctx = new AudioContext()
    void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const dest = ctx.createMediaStreamDestination()
    osc.type = 'sine'
    osc.frequency.value = state.hz
    gain.gain.value = 0.5
    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    state.osc = osc
    state.gain = gain
    state.streams.push(dest.stream)
    return dest.stream
  }

  const nativeEnumerate = navigator.mediaDevices.enumerateDevices?.bind(navigator.mediaDevices)
  if (!state.unlistable) {
    navigator.mediaDevices.enumerateDevices = async () => {
      if (state.devices === null) return nativeEnumerate ? nativeEnumerate() : []
      // like a real browser: no names and no identifiers until the microphone has been allowed
      const hidden = state.namesHidden && !state.granted
      return state.devices.map((d) => {
        const info = {
          kind: 'audioinput' as const,
          deviceId: hidden ? '' : d.deviceId,
          label: hidden ? '' : d.label,
          groupId: '',
        }
        return { ...info, toJSON: () => info }
      })
    }
  }
}

/**
 * Deterministic stand-in for the microphone. `use()` replaces getUserMedia
 * with a Web Audio oscillator stream so pitch detection hears a clean,
 * test-controlled tone; `deny()` simulates a blocked mic permission.
 * `plugIn()` gives the page a list of microphones, so a test can see which
 * one the app asked for (`requests()`) and what happens when one is missing.
 *
 * `use()`/`deny()`/`plugIn()`/`cannotList()` must be called BEFORE the page navigates.
 */
export class FakeMic {
  constructor(private readonly page: Page) {}

  /** Common test frequencies. */
  static readonly A3 = 220
  static readonly A4 = 440
  static readonly C4 = 261.63

  /** `hz` sung `cents` sharp (or flat, when negative): a steady, slightly out-of-tune voice. */
  static detuned(hz: number, cents: number): number {
    return hz * Math.pow(2, cents / 1200)
  }

  /** A believable set of microphones for a family tablet. */
  static readonly BUILT_IN: FakeMicrophone = { deviceId: 'mic-built-in', label: 'Built-in microphone' }
  static readonly HEADSET: FakeMicrophone = { deviceId: 'mic-headset', label: "Ada's headset" }

  async use(hz: number): Promise<void> {
    await this.page.addInitScript(installFakeMic, { hz })
  }

  async deny(): Promise<void> {
    await this.page.addInitScript(installFakeMic, { denied: true })
  }

  /**
   * The microphones the browser reports. With `namesHidden`, names and
   * identifiers stay empty until the page has been given a stream, as in a
   * browser where microphone permission has not been granted yet. Asking for
   * a microphone that is not in the list is refused the way a browser refuses
   * an unplugged one.
   */
  async plugIn(microphones: FakeMicrophone[], opts: { namesHidden?: boolean } = {}): Promise<void> {
    await this.page.addInitScript(installFakeMic, { devices: microphones, namesHidden: opts.namesHidden ?? false })
  }

  /** A browser with no way to list devices at all. */
  async cannotList(): Promise<void> {
    await this.page.addInitScript(installFakeMic, { unlistable: true })
  }

  /** Plug one more microphone in while the page is live; the browser announces the change. */
  async plugInNow(microphone: FakeMicrophone): Promise<void> {
    await this.page.evaluate((mic) => {
      const state = (window as unknown as { __fakeMic: { devices: FakeMicrophone[] | null } }).__fakeMic
      state.devices = [...(state.devices ?? []), mic]
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'))
    }, microphone)
  }

  /** Every microphone the app has asked for so far, in order; `null` is the system default. */
  requests(): Promise<(string | null)[]> {
    return this.page.evaluate(
      () => (window as unknown as { __fakeMic: { requests: (string | null)[] } }).__fakeMic.requests,
    )
  }

  /** How many of the streams handed to the app are still open. */
  openStreams(): Promise<number> {
    return this.page.evaluate(
      () =>
        (window as unknown as { __fakeMic: { streams: MediaStream[] } }).__fakeMic.streams.filter((s) =>
          s.getTracks().some((t) => t.readyState === 'live'),
        ).length,
    )
  }

  /** Change the "sung" pitch while the page is live. */
  async setHz(hz: number): Promise<void> {
    await this.page.evaluate((v) => {
      ;(window as unknown as { __setFakeMic(hz: number, on?: boolean): void }).__setFakeMic(v)
    }, hz)
  }

  /** Go quiet (below the app's RMS gate) without stopping the stream. */
  async mute(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __fakeMicHz: number; __setFakeMic(hz: number, on?: boolean): void }
      w.__setFakeMic(w.__fakeMicHz, false)
    })
  }
}
