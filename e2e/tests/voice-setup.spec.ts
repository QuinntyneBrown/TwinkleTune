import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'
import { readState, seedApp } from '../fixtures/seed'

test.describe('Find My Voice', () => {
  test('captures a low and a high note, then tunes every song', async ({
    page,
    fakeMic,
    voiceSetupPage,
    songsPage,
  }) => {
    await seedApp(page, { range: null })
    await fakeMic.use(FakeMic.A3) // hum a steady A3 (MIDI 57)
    await voiceSetupPage.goto()

    await expect(voiceSetupPage.title).toBeVisible()
    await voiceSetupPage.readyButton.click()

    // the held low note locks in (its rung label is covered by the singer dot
    // while the singer stays on that note, so assert the capture by class)
    await expect(voiceSetupPage.toast(/cozy low note: A3/)).toBeVisible({ timeout: 15_000 })
    await expect(voiceSetupPage.capturedRungs).toHaveCount(1)
    await expect(voiceSetupPage.bubble).toContainText('highest comfy')

    // still humming the same note for the "high" step → Twinkle nudges upward
    await expect(voiceSetupPage.toast(/reach a little higher/)).toBeVisible({ timeout: 15_000 })

    // jump up an octave → the high note locks in and the range is saved
    await fakeMic.setHz(FakeMic.A4)
    await expect(voiceSetupPage.voiceFoundDialog).toBeVisible({ timeout: 15_000 })
    await expect(voiceSetupPage.voiceFoundDialog).toContainText('You sing from A3 up to A4')

    const state = await readState(page)
    expect(state.profile.range).toEqual({ low: 57, high: 69 })

    await voiceSetupPage.toMySongsButton.click()
    await expect(page).toHaveURL(/#\/songs$/)
    await expect(songsPage.inKeyBadges).toHaveCount(7)
  })

  test('a blocked microphone gets a friendly dialog, not an error', async ({
    page,
    fakeMic,
    voiceSetupPage,
    homePage,
  }) => {
    await seedApp(page, { range: null })
    await fakeMic.deny()
    await voiceSetupPage.goto()

    await voiceSetupPage.readyButton.click()
    await expect(voiceSetupPage.micDeniedDialog).toContainText("Twinkle can't hear you")

    await voiceSetupPage.doLaterButton.click()
    await expect(page).toHaveURL(/#\/home$/)
    await expect(homePage.findVoiceCard).toBeVisible()
  })

  test('"Later" skips voice setup without saving a range', async ({
    page,
    voiceSetupPage,
    homePage,
  }) => {
    await seedApp(page, { range: null })
    await voiceSetupPage.goto()

    await voiceSetupPage.laterLink.click()
    await expect(page).toHaveURL(/#\/home$/)
    await expect(homePage.findVoiceCard).toBeVisible()

    const state = await readState(page)
    expect(state.profile.range).toBeNull()
  })
})
