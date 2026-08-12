/** Best-effort screen wake lock scoped to one singing screen lifecycle. */
export class SingingWakeLock {
  private sentinel: WakeLockSentinel | null = null
  private wanted = false
  private requesting = false

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  request(): void {
    this.wanted = true
    void this.acquire()
  }

  suspend(): void {
    this.wanted = false
    void this.releaseCurrent()
  }

  destroy(): void {
    this.suspend()
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  private async acquire(): Promise<void> {
    const wakeLock = (navigator as Partial<Pick<Navigator, 'wakeLock'>>).wakeLock
    if (!this.wanted || this.sentinel || this.requesting || document.visibilityState !== 'visible' || !wakeLock) {
      return
    }
    this.requesting = true
    try {
      const sentinel = await wakeLock.request('screen')
      if (!this.wanted || document.visibilityState !== 'visible') {
        await sentinel.release().catch(() => {})
        return
      }
      this.sentinel = sentinel
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null
      })
    } catch {
      /* wake lock is a progressive enhancement */
    } finally {
      this.requesting = false
    }
  }

  private async releaseCurrent(): Promise<void> {
    const sentinel = this.sentinel
    this.sentinel = null
    if (sentinel) await sentinel.release().catch(() => {})
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      if (this.wanted) void this.acquire()
    } else {
      // Browsers normally release automatically when hidden. Clear our local
      // reference too so visibility restoration can request a fresh sentinel.
      void this.releaseCurrent()
    }
  }
}
