import type { Page } from '@playwright/test'

/**
 * Make the page draw only one animation frame in `every`, like a tablet that
 * cannot keep up (15 ≈ four frames a second on a 60 Hz display). Audio is not
 * slowed: only `requestAnimationFrame` callbacks are held back.
 *
 * Must be called BEFORE the page navigates.
 */
export async function slowDisplay(page: Page, every: number): Promise<void> {
  await page.addInitScript((step) => {
    const nativeRaf = window.requestAnimationFrame.bind(window)
    const waiting = new Map<number, FrameRequestCallback>()
    let nextId = 1
    let frame = 0

    window.requestAnimationFrame = (callback) => {
      const id = nextId++
      waiting.set(id, callback)
      return id
    }
    window.cancelAnimationFrame = (id) => {
      waiting.delete(id)
    }

    const pump = (now: number) => {
      if (++frame % step === 0) {
        const due = [...waiting.values()]
        waiting.clear()
        for (const callback of due) callback(now)
      }
      nativeRaf(pump)
    }
    nativeRaf(pump)
  }, every)
}
