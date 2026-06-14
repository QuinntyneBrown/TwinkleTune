import { test, expect } from '../fixtures/test'
import { seedApp } from '../fixtures/seed'

const ALL_TITLES = [
  'Twinkle Twinkle Little Star',
  'Mary Had a Little Lamb',
  'Hot Cross Buns',
  'London Bridge',
  'Old MacDonald',
  'Row, Row, Row Your Boat',
]

test.describe('Pick a Song', () => {
  test('lists all six songs, tuned to the saved voice', async ({ page, songsPage }) => {
    await seedApp(page)
    await songsPage.goto()

    await expect(songsPage.cards).toHaveCount(6)
    for (const title of ALL_TITLES) {
      await expect(songsPage.card(title)).toBeVisible()
    }
    await expect(songsPage.inKeyBadges).toHaveCount(6)
    await expect(songsPage.card('Hot Cross Buns')).toContainText('0:10')
    await expect(songsPage.card('Hot Cross Buns')).toContainText('Easy')
    await expect(songsPage.card('Row, Row, Row Your Boat')).toContainText('Brave')
  })

  test('difficulty chips filter the list', async ({ page, songsPage }) => {
    await seedApp(page)
    await songsPage.goto()

    await songsPage.filterChip('Easy').click()
    await expect(songsPage.filterChip('Easy')).toHaveAttribute('aria-selected', 'true')
    await expect(songsPage.visibleCards).toHaveCount(3)
    await expect(songsPage.card('London Bridge')).toBeHidden()

    await songsPage.filterChip('Brave').click()
    await expect(songsPage.visibleCards).toHaveCount(1)
    await expect(songsPage.card('Row, Row, Row Your Boat')).toBeVisible()

    await songsPage.filterChip('All').click()
    await expect(songsPage.visibleCards).toHaveCount(6)
  })

  test('songs prompt for voice setup when no range is saved', async ({
    page,
    songsPage,
    voiceSetupPage,
  }) => {
    await seedApp(page, { range: null })
    await songsPage.goto()

    await expect(songsPage.findVoiceCtas).toHaveCount(6)
    await songsPage.findVoiceCtas.first().click()
    await expect(voiceSetupPage.title).toBeVisible()
  })

  test('remembers the last song for an instant encore', async ({
    page,
    songsPage,
    singPage,
  }) => {
    await seedApp(page, { lastSongId: 'mary' })
    await songsPage.goto()

    await expect(songsPage.againCard).toContainText('Mary Had a Little Lamb')
    await songsPage.againPlayButton('Mary Had a Little Lamb').click()
    await expect(page).toHaveURL(/#\/sing\?song=mary$/)
    await expect(singPage.title).toHaveText('Mary Had a Little Lamb')
  })

  test('the play arrow opens the sing screen', async ({ page, songsPage, singPage }) => {
    await seedApp(page)
    await songsPage.goto()

    await songsPage.playButton('Twinkle Twinkle Little Star').click()
    await expect(page).toHaveURL(/#\/sing\?song=twinkle$/)
    await expect(singPage.title).toHaveText('Twinkle Twinkle Little Star')
    await expect(singPage.startButton).toBeVisible()
  })
})
