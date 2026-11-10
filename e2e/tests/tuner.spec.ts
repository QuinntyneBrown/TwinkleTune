import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'
import { seedApp } from '../fixtures/seed'

test.describe('Developer tuner (#/tuner)', () => {
  test('detects the sung note without needing a profile', async ({
    page,
    fakeMic,
    tunerPage,
  }) => {
    await fakeMic.use(FakeMic.A4)
    await tunerPage.goto()

    await expect(tunerPage.heading).toBeVisible()
    await tunerPage.toggleButton.click()

    await expect(tunerPage.note).toHaveText('A4', { timeout: 15_000 })
    await expect(tunerPage.hz).toContainText('Hz')
    await expect(tunerPage.clarity).toContainText('clarity')

    await tunerPage.toggleButton.click()
    await expect(tunerPage.toggleButton).toContainText('Start listening')
  })

  test('shows a mic hint when the microphone is blocked', async ({
    page,
    fakeMic,
    tunerPage,
  }) => {
    await fakeMic.deny()
    await tunerPage.goto()

    await tunerPage.toggleButton.click()
    await expect(tunerPage.note).toHaveText('mic?')
  })

  // Traces to: AE-L2-22, GC-L2-12
  test('listens on the microphone the grown-up chose', async ({ page, fakeMic, tunerPage }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.use(FakeMic.A4)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await tunerPage.goto()

    await tunerPage.toggleButton.click()
    await expect(tunerPage.note).toHaveText('A4', { timeout: 15_000 })

    expect(await fakeMic.requests()).toEqual([FakeMic.HEADSET.deviceId])
  })

  // Traces to: AE-L2-22
  test('listens on the system default when the chosen microphone is not plugged in', async ({
    page,
    fakeMic,
    tunerPage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.use(FakeMic.A4)
    await fakeMic.plugIn([FakeMic.BUILT_IN])
    await tunerPage.goto()

    await tunerPage.toggleButton.click()
    await expect(tunerPage.note).toHaveText('A4', { timeout: 15_000 })

    expect(await fakeMic.requests()).toEqual([null])
  })
})
