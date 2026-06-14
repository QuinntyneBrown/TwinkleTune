import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'

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
})
