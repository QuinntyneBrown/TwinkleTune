import { test, expect } from '../fixtures/test'
import { seedApp, todayISO } from '../fixtures/seed'

test.describe('Home', () => {
  test('greets the singer with level, streak, and daily goal', async ({ page, homePage }) => {
    const today = todayISO()
    await seedApp(page, {
      sparkles: 310,
      singDays: [today],
      plays: { [today]: 1 },
      bests: { twinkle: { stars: 2, accuracy: 0.7, plays: 3 } },
    })
    await homePage.goto()

    await expect(homePage.greeting).toContainText('Hi, Quinn!')
    await expect(homePage.levelLine).toHaveText('Level 2 Chick')
    await expect(homePage.streakChip).toContainText('1-day streak')
    await expect(homePage.goalRing).toHaveText('1/3')
    await expect(homePage.goalCard).toContainText('just 2 more to go!')
    await expect(homePage.mySongsTile).toContainText('1 song mastered')
    await expect(homePage.tipOfTheDay).toContainText('Tip of the day')
  })

  test('invites voice setup until a range is saved', async ({
    page,
    homePage,
    voiceSetupPage,
  }) => {
    await seedApp(page, { range: null })
    await homePage.goto()

    await expect(homePage.coachBubble).toContainText('Shall we find your voice first?')
    await expect(homePage.findVoiceCard).toBeVisible()

    await homePage.findVoiceCard.click()
    await expect(voiceSetupPage.title).toBeVisible()
  })

  test('the hero tile leads to the song list', async ({ page, homePage, songsPage }) => {
    await seedApp(page)
    await homePage.goto()

    await expect(homePage.heroTile).toContainText('Every song in YOUR key')
    await homePage.heroTile.click()
    await expect(page).toHaveURL(/#\/songs$/)
    await expect(songsPage.heading).toBeVisible()
  })
})
