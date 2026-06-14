import { test, expect } from '../fixtures/test'
import { makeSummary, seedApp } from '../fixtures/seed'

test.describe('Results & celebration', () => {
  test('a three-star song gets the full celebration', async ({ page, resultsPage }) => {
    await seedApp(page, {
      range: null,
      lastResult: makeSummary(),
      lastSongId: 'twinkle',
      lastNewBadges: ['show-stopper'],
    })
    await resultsPage.goto()

    await expect(resultsPage.headline).toContainText('Super Singing, Quinn!')
    await expect(resultsPage.songSubtitle).toHaveText('Twinkle Twinkle Little Star')
    await expect(resultsPage.filledStars).toHaveCount(3)
    await expect(resultsPage.emptyStars).toHaveCount(0)
    await expect(resultsPage.scoreCard).toContainText('You landed 36 of 42 notes!')
    await expect(resultsPage.marks).toContainText('Pitch')
    await expect(resultsPage.marks).toContainText('Timing')
    await expect(resultsPage.marks).toContainText('Braveness')
    await expect(resultsPage.badgeToasts).toHaveText(['🎭 New badge: Show Stopper!'])
    await expect(resultsPage.coachBubble).toContainText('magical')
    await expect(resultsPage.practiceButton).toHaveCount(0)
    await expect(resultsPage.singAgainLink).toHaveAttribute('href', '#/sing?song=twinkle')
  })

  test('a tricky phrase becomes a practice invitation', async ({
    page,
    resultsPage,
    singPage,
  }) => {
    await seedApp(page, {
      range: null,
      lastResult: makeSummary({
        stars: 2,
        pitchStars: 2,
        landed: 30,
        accuracy: 30 / 42,
        trickyPhrase: 1,
        trickyLyric: 'How I wonder what you are',
      }),
      lastSongId: 'twinkle',
    })
    await resultsPage.goto()

    await expect(resultsPage.headline).toContainText('Beautiful Singing, Quinn!')
    await expect(resultsPage.filledStars).toHaveCount(2)
    await expect(resultsPage.emptyStars).toHaveCount(1)
    await expect(resultsPage.coachBubble).toContainText('was tricky')

    await expect(resultsPage.practiceButton).toHaveAttribute(
      'href',
      '#/sing?song=twinkle&practice=1&slow=1',
    )
    await resultsPage.practiceButton.click()
    await expect(singPage.title).toContainText('Practice:')
    await expect(singPage.title).toContainText('How I wonder what you are')
    await expect(singPage.turtleChip).toBeVisible()
  })

  test('visiting results with nothing sung goes home', async ({ page, homePage }) => {
    await seedApp(page)
    await page.goto('/#/results')
    await expect(homePage.greeting).toContainText('Hi, Quinn!')
  })
})
