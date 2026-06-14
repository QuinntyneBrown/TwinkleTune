import { test, expect } from '../fixtures/test'
import { seedApp, todayISO } from '../fixtures/seed'

test.describe('My star journey', () => {
  test('shows level, sparkles, streak week, badges, and mastered songs', async ({
    page,
    mePage,
  }) => {
    const today = todayISO()
    await seedApp(page, {
      sparkles: 310,
      singDays: [today],
      badges: { 'first-song': today },
      bests: { twinkle: { stars: 2, accuracy: 0.7, plays: 3 } },
    })
    await mePage.goto()

    await expect(mePage.header).toHaveText("Quinn's Star Journey")
    await expect(mePage.levelLine).toContainText('Level 2 Chick')
    await expect(mePage.levelCard).toContainText('290 ✨ to Level 3!')
    await expect(mePage.levelCard).toContainText('✨ 310 sparkles collected')

    await expect(mePage.doneDays).toHaveCount(1)
    await expect(mePage.doneDays.first()).toContainText('⭐')

    await expect(mePage.badges).toHaveCount(6)
    await expect(mePage.badge('First Song')).not.toHaveClass(/locked/)
    await expect(mePage.badge('First Song')).toContainText('🎤')
    await expect(mePage.lockedBadges).toHaveCount(5)

    await expect(mePage.masteredRows).toHaveCount(1)
    await expect(mePage.masteredRows.first()).toContainText('Twinkle Twinkle Little Star')
    await expect(mePage.masteredRows.first()).toContainText('★★☆')

    await expect(mePage.growth).toContainText('Your voice goes from A3 to G4')
    await expect(mePage.growth).toContainText('11 notes')
  })

  test('a fresh singer sees invitations instead of stats', async ({
    page,
    mePage,
    voiceSetupPage,
  }) => {
    await seedApp(page, { range: null })
    await mePage.goto()

    await expect(mePage.masteredRows).toHaveCount(0)
    await expect(page.getByText('Sing your first song')).toBeVisible()
    await expect(mePage.lockedBadges).toHaveCount(6)

    await expect(mePage.growth).toContainText('Find your voice!')
    await mePage.growth.click()
    await expect(voiceSetupPage.title).toBeVisible()
  })
})
