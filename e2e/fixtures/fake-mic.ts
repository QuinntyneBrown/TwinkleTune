import type { Page } from '@playwright/test'

/**
 * Deterministic stand-in for the microphone. `use()` replaces getUserMedia
 * with a Web Audio oscillator stream so pitch detection hears a clean,
 * test-controlled tone; `deny()` simulates a blocked mic permission.
 *
 * `use()`/`deny()` must be called BEFORE the page navigates.
 */
export class FakeMic {
  constructor(private readonly page: Page) {}

  /** Common test frequencies. */
  static readonly A3 = 220
  static readonly A4 = 440
  static readonly C4 = 261.63

  async use(hz: number): Promise<void> {
    await this.page.addInitScript((startHz) => {
      const live: { osc: OscillatorNode | null; gain: GainNode | null } = { osc: null, gain: null }
      const w = window as unknown as Record<string, unknown>
      w.__fakeMicHz = startHz
      w.__setFakeMic = (nextHz: number, on = true) => {
        w.__fakeMicHz = nextHz
        if (live.osc) live.osc.frequency.value = nextHz
        if (live.gain) live.gain.gain.value = on ? 0.5 : 0.0001
      }
      navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext()
        void ctx.resume()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const dest = ctx.createMediaStreamDestination()
        osc.type = 'sine'
        osc.frequency.value = w.__fakeMicHz as number
        gain.gain.value = 0.5
        osc.connect(gain)
        gain.connect(dest)
        osc.start()
        live.osc = osc
        live.gain = gain
        return dest.stream
      }
    }, hz)
  }

  async deny(): Promise<void> {
    await this.page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied by test', 'NotAllowedError'))
    })
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
