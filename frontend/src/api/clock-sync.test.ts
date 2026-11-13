// Acceptance Test
// Traces to: DM-L2-21
// Description: A device places the shared duet start on the server's clock, however wrong its own clock is

import { describe, expect, it } from 'vitest'
import { delayUntil, estimateClockOffset, MAX_START_WAIT_MS } from './clock-sync'

describe('DM-L2-21 — measuring the offset from the server clock', () => {
  it('reads the server time against the midpoint of the round trip', () => {
    // sent at 1000, answered at 1040: the server read its clock about half-way, at device time 1020
    expect(estimateClockOffset([{ sentAt: 1000, receivedAt: 1040, serverTime: 91_020 }])).toBe(90_000)
  })

  it('is negative when the device clock runs ahead', () => {
    expect(estimateClockOffset([{ sentAt: 5000, receivedAt: 5010, serverTime: 3005 }])).toBe(-2000)
  })

  it('trusts the sample with the shortest round trip', () => {
    const offset = estimateClockOffset([
      { sentAt: 1000, receivedAt: 1400, serverTime: 1390 }, // slow and lopsided: would read as 190
      { sentAt: 2000, receivedAt: 2010, serverTime: 2055 }, // quick: 50
      { sentAt: 3000, receivedAt: 3120, serverTime: 3020 }, // slow the other way: would read as -40
    ])
    expect(offset).toBe(50)
  })

  it('assumes the clocks agree when there is nothing to go on', () => {
    expect(estimateClockOffset([])).toBe(0)
  })
})

describe('DM-L2-21 — waiting for the shared start', () => {
  it('waits three seconds for a start three seconds ahead, on a device 90 seconds behind', () => {
    const serverNow = 1_000_000
    const deviceNow = serverNow - 90_000
    expect(delayUntil(serverNow + 3000, deviceNow, 90_000)).toBe(3000)
  })

  it('waits three seconds on a device two seconds ahead', () => {
    const serverNow = 1_000_000
    expect(delayUntil(serverNow + 3000, serverNow + 2000, -2000)).toBe(3000)
  })

  it('does not wait for a start that has already passed', () => {
    expect(delayUntil(1_000_000, 1_000_500, 0)).toBe(0)
  })

  it('never waits longer than the cap, whatever the clocks say', () => {
    expect(delayUntil(1_000_000 + 93_000, 1_000_000, 0)).toBe(MAX_START_WAIT_MS)
    expect(MAX_START_WAIT_MS).toBe(6000)
  })
})
