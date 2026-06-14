import { test, expect } from '../fixtures/test'
import { readState, seedApp } from '../fixtures/seed'

test.describe("Twinkle's Tips", () => {
  test('doing a warm-up earns sparkles', async ({ page, tipsPage }) => {
    await seedApp(page)
    await tipsPage.goto()

    await expect(tipsPage.heading).toBeVisible()
    await expect(tipsPage.tipCards).toHaveCount(6)

    await tipsPage.tipCard('The bumblebee hum').click()
    const dialog = tipsPage.tipDialog('The bumblebee hum')
    await expect(dialog.locator('ol.tip-steps li')).toHaveCount(4)

    await tipsPage.didItButton('The bumblebee hum').click()
    await expect(tipsPage.toast('+5 sparkles')).toBeVisible()
    await expect(dialog).toHaveCount(0)

    const state = await readState(page)
    expect(state.sparkles).toBe(5)
  })

  test('category chips filter the warm-up games', async ({ page, tipsPage }) => {
    await seedApp(page)
    await tipsPage.goto()

    await tipsPage.categoryChip('Warm-ups').click()
    await expect(tipsPage.visibleTipCards).toHaveCount(2)
    await expect(tipsPage.tipCard('Siren like a firetruck')).toBeVisible()
    await expect(tipsPage.tipCard('Stand like a star')).toBeHidden()

    await tipsPage.categoryChip('All').click()
    await expect(tipsPage.visibleTipCards).toHaveCount(6)
  })

  test("the hero tip opens Twinkle's favourite", async ({ page, tipsPage }) => {
    await seedApp(page)
    await tipsPage.goto()

    await tipsPage.heroTryButton.click()
    const dialog = tipsPage.tipDialog('Breathe like a balloon')
    await expect(dialog).toContainText('Breathe like a balloon')

    await tipsPage.maybeLaterButton('Breathe like a balloon').click()
    await expect(dialog).toHaveCount(0)
  })
})
