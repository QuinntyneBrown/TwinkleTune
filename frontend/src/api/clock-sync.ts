/**
 * Two tablets rarely agree on the time, so a duet's shared start instant is placed on the
 * family server's clock. Pure maths, kept free of the connection so it can be tested on its own.
 */

/** One "what time is it?" round trip to the server. All times are epoch milliseconds. */
export interface ClockSample {
  /** device time when the question was sent */
  sentAt: number
  /** device time when the answer arrived */
  receivedAt: number
  /** the server's answer */
  serverTime: number
}

/** The longest a singer waits for the shared start, whatever the clocks say. */
export const MAX_START_WAIT_MS = 6000

/**
 * Milliseconds to add to the device clock to get the server clock.
 *
 * The server read its clock somewhere inside the round trip; the midpoint is the best guess, and
 * the shorter the round trip the less that guess can be off. So the quickest sample wins.
 */
export function estimateClockOffset(samples: ClockSample[]): number {
  if (samples.length === 0) return 0
  const best = samples.reduce((a, b) => (b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a))
  return best.serverTime - (best.sentAt + best.receivedAt) / 2
}

/**
 * How long to wait, from `deviceNow`, for an instant on the server's clock. Never negative, and
 * capped so a wrong clock or a late message cannot leave a singer waiting.
 */
export function delayUntil(serverInstant: number, deviceNow: number, offsetMs: number): number {
  return Math.max(0, Math.min(MAX_START_WAIT_MS, serverInstant - (deviceNow + offsetMs)))
}
