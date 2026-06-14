import { test, expect } from '../fixtures/test'
import { readState, seedApp } from '../fixtures/seed'

test.describe('Grown-Ups Corner', () => {
  test('the parent gate blocks wrong answers and opens on the right one', async ({
    page,
    mePage,
  }) => {
    await seedApp(page)
    await mePage.goto()

    await mePage.gearButton.click()
    await expect(mePage.gate.dialog).toContainText('For grown-ups only')

    await mePage.gate.answerWrong()
    await expect(mePage.settings.dialog).toHaveCount(0)
    await expect(mePage.gate.dialog).toBeVisible()

    await mePage.gate.solve()
    await expect(mePage.settings.dialog).toContainText('Grown-Ups Corner')
    await expect(mePage.settings.dialog).toContainText('Badges & streaks stay on this device')
  })

  test('the mic timing offset is saved as it moves', async ({ page, mePage }) => {
    await seedApp(page)
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.setLatency(100)
    await expect(mePage.settings.latencyLabel).toHaveText('100 ms')

    const state = await readState(page)
    expect(state.profile.latencyMs).toBe(100)
  })

  test('voice setup can be redone from settings', async ({ page, mePage, voiceSetupPage }) => {
    await seedApp(page)
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.dialog).toContainText('A3 – G4')
    await mePage.settings.redoVoiceLink.click()
    await expect(voiceSetupPage.title).toBeVisible()
  })

  test('"start everything over" needs confirmation, then erases this device', async ({
    page,
    mePage,
    welcomePage,
  }) => {
    await seedApp(page, { sparkles: 310 })
    await mePage.goto()

    // first pass: back out of the confirmation
    await mePage.openSettings()
    await mePage.settings.resetButton.click()
    await expect(mePage.settings.confirmDialog).toContainText('Really start over?')
    await mePage.settings.keepButton.click()
    expect((await readState(page)).profile.name).toBe('Quinn')

    // second pass: really erase
    await mePage.openSettings()
    await mePage.settings.resetButton.click()
    await mePage.settings.eraseButton.click()

    await expect(page).toHaveURL(/#\/welcome$/)
    await expect(welcomePage.nameInput).toHaveValue('')
    expect(await readState(page)).toBeNull()
  })

  test('the gate is reachable from the welcome screen too', async ({ page, welcomePage }) => {
    await page.goto('/')

    await welcomePage.grownUpsButton.click()
    await expect(welcomePage.gate.dialog).toBeVisible()
    await welcomePage.gate.solve()

    const settings = page.getByRole('dialog', { name: 'Grown-ups corner' })
    await expect(settings).toContainText('Badges & streaks stay on this device')
    await settings.getByRole('button', { name: 'Close' }).click()
    await expect(settings).toHaveCount(0)
  })
})
