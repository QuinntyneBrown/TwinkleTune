import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'
import { readState, seedApp } from '../fixtures/seed'

test.describe('Sing a song', () => {
  test('no-mic "just for fun" play finishes the song and records the day', async ({
    page,
    fakeMic,
    singPage,
    resultsPage,
    homePage,
  }) => {
    await seedApp(page) // default range → Hot Cross Buns needs no transposition
    await fakeMic.deny()
    await singPage.open('hotcrossbuns')

    await expect(singPage.title).toHaveText('Hot Cross Buns')
    await expect(singPage.keyChip).toContainText('Your key')
    await singPage.startButton.click()

    await expect(singPage.micDialog).toContainText('Can Twinkle hear you sing?')
    await singPage.singForFunButton.click()
    await expect(singPage.stageLabel).toHaveText(/HAVE FUN/)

    await singPage.waitForResults()

    await expect(resultsPage.headline).toContainText('What a fun sing-along, Quinn!')
    await expect(resultsPage.scoreCard).toContainText('You sang the whole song!')
    await expect(resultsPage.starsRow).toHaveCount(0)
    await expect(resultsPage.badgeToasts).toHaveText(['🎤 New badge: First Song!'])

    const state = await readState(page)
    expect(state.bests.hotcrossbuns.plays).toBe(1)
    expect(state.badges['first-song']).toBeTruthy()
    expect(state.lastResult.noMic).toBe(true)

    await homePage.goto()
    await expect(homePage.goalRing).toHaveText('1/3')
    await expect(homePage.goalCard).toContainText('just 2 more to go!')
  })

  test('live singing moves the star, lands notes, and offers practice', async ({
    page,
    fakeMic,
    singPage,
    resultsPage,
  }) => {
    await seedApp(page)
    await fakeMic.use(FakeMic.C4) // a steady C matches every C in Hot Cross Buns (octave-forgiving)
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)

    // the star wakes up because a voice is detected
    await expect(singPage.singer).not.toHaveClass(/quiet/)

    // landed C notes pay out sparkles while the song plays
    await expect(singPage.sparklesPill).toHaveText(/✨ [1-9]\d*/, { timeout: 20_000 })

    await singPage.waitForResults()

    await expect(resultsPage.starsRow).toBeVisible()
    expect(await resultsPage.filledStars.count()).toBeGreaterThanOrEqual(1)
    await expect(resultsPage.scoreCard).toContainText(/You landed \d+ of 17 notes/)
    await expect(resultsPage.marks).toContainText('Pitch')

    const state = await readState(page)
    expect(state.bests.hotcrossbuns.stars).toBeGreaterThanOrEqual(1)
    expect(state.sparkles).toBeGreaterThan(0)

    // a constant tone always leaves a shaky phrase → practice invitation
    await expect(resultsPage.practiceButton).toHaveAttribute('href', /practice=\d+&slow=1/)
    await resultsPage.practiceButton.click()
    await expect(singPage.title).toContainText('Practice:')
    await expect(singPage.turtleChip).toBeVisible()
  })

  test('a shifted song explains its new key, and pause works', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    // voice centered lower than Twinkle's notes → the song is moved 3 notes down
    await seedApp(page, { range: { low: 55, high: 67 } })
    await fakeMic.use(FakeMic.C4)
    await singPage.open('twinkle')

    await singPage.startButton.click()
    await expect(singPage.tunedDialog).toContainText('Tuned just for YOU!')
    await expect(singPage.tunedDialog).toContainText('3 notes lower')
    await singPage.tunedGoButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)

    await singPage.pauseButton.click()
    await expect(singPage.pausedDialog).toContainText('Taking a breather?')
    await singPage.resumeButton.click()
    await expect(singPage.countdown).toBeVisible()

    await singPage.pauseButton.click()
    await singPage.pickAnotherButton.click()
    await expect(page).toHaveURL(/#\/songs$/)
  })

  test('the mic dialog can bail back to the song list', async ({
    page,
    fakeMic,
    singPage,
    songsPage,
  }) => {
    await seedApp(page)
    await fakeMic.deny()
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await singPage.backToSongsButton.click()
    await expect(page).toHaveURL(/#\/songs$/)
    await expect(songsPage.heading).toBeVisible()
  })

  test('an unknown song id bounces back to the song list', async ({ page, songsPage }) => {
    await seedApp(page)
    await page.goto('/#/sing?song=doesnotexist')
    await page.waitForURL(/#\/songs$/)
    await expect(songsPage.heading).toBeVisible()
  })
})
