import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'
import { readState, seedApp } from '../fixtures/seed'
import { slowDisplay } from '../fixtures/slow-display'

test.describe('Sing a song', () => {
  test('falls back to Canvas2D and manages the singing wake lock', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
      const stats = { requests: 0, releases: 0 }
      Object.defineProperty(window, '__wakeLockStats', { value: stats })
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            stats.requests++
            const sentinel = new EventTarget() as EventTarget & { release: () => Promise<void> }
            sentinel.release = async () => {
              stats.releases++
              sentinel.dispatchEvent(new Event('release'))
            }
            return sentinel
          },
        },
      })
    })
    await seedApp(page)
    await fakeMic.deny()
    await singPage.open('hotcrossbuns')

    await expect(singPage.reactiveScene).toHaveAttribute('data-renderer', 'canvas2d')
    await singPage.startButton.click()
    await singPage.singForFunButton.click()
    await expect.poll(() => page.evaluate(() => (window as any).__wakeLockStats.requests)).toBe(1)

    await singPage.pauseButton.click()
    await expect.poll(() => page.evaluate(() => (window as any).__wakeLockStats.releases)).toBe(1)
    await singPage.resumeButton.click()
    await expect.poll(() => page.evaluate(() => (window as any).__wakeLockStats.requests)).toBe(2)
  })

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

  // Traces to: SR-L2-19, AE-L2-21, SG-L2-26
  test('a display drawing four frames a second still credits every note that was sung', async ({
    page,
    fakeMic,
    singPage,
    resultsPage,
  }) => {
    await slowDisplay(page, 15) // one animation frame in fifteen
    await seedApp(page)
    await fakeMic.use(FakeMic.C4) // a steady C: exactly the seven Cs of Hot Cross Buns are sung
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await singPage.waitForResults()

    await expect(resultsPage.scoreCard).toContainText('You landed 7 of 17 notes')
  })

  // A steady C sung 60 cents sharp: outside Precise (50 cents), inside Gentle (80 cents).
  // Hot Cross Buns has seven Cs; nothing else in it is within reach of this pitch.
  // Traces to: SR-L2-20, GC-L2-11
  test('a singer on Gentle lands notes that the same singing misses on Precise', async ({
    page,
    fakeMic,
    singPage,
    resultsPage,
  }) => {
    await seedApp(page, { strictness: 'gentle' })
    await fakeMic.use(FakeMic.detuned(FakeMic.C4, 60))
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await singPage.waitForResults()

    await expect(resultsPage.scoreCard).toContainText('You landed 7 of 17 notes')
  })

  // Traces to: SR-L2-20
  test('a singer with no chosen level is judged as Precise', async ({
    page,
    fakeMic,
    singPage,
    resultsPage,
  }) => {
    await seedApp(page)
    await fakeMic.use(FakeMic.detuned(FakeMic.C4, 60))
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await singPage.waitForResults()

    await expect(resultsPage.scoreCard).toContainText('You landed 0 of 17 notes')
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

  // Traces to: AE-L2-14
  test('with no microphone chosen, the song listens on the system default', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await seedApp(page)
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)

    expect(await fakeMic.requests()).toEqual([null])
  })

  // Traces to: AE-L2-22, AE-L2-14, GC-L2-12
  test('the song listens on the microphone the grown-up chose', async ({ page, fakeMic, singPage }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)
    await expect(singPage.singer).not.toHaveClass(/quiet/)

    expect(await fakeMic.requests()).toEqual([FakeMic.HEADSET.deviceId])
  })

  // Traces to: AE-L2-22
  test('a chosen microphone whose identifier changed is found again by its name', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await seedApp(page, { microphone: { deviceId: 'mic-headset-last-visit', label: FakeMic.HEADSET.label } })
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)

    expect(await fakeMic.requests()).toEqual([FakeMic.HEADSET.deviceId])
  })

  // Traces to: AE-L2-22, GC-L2-12
  test('a chosen microphone that is not plugged in is no trouble: the song starts on the system default', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN]) // the headset was left in another room
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)
    await expect(singPage.micDialog).toHaveCount(0)
    await expect(singPage.singer).not.toHaveClass(/quiet/)

    expect(await fakeMic.requests()).toEqual([null])
  })

  // Traces to: AE-L2-22
  test('when the browser withholds microphone names, a stale choice still falls back to the system default', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await seedApp(page, { microphone: { deviceId: 'mic-gone', label: 'Old headset' } })
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN], { namesHidden: true })
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)
    await expect(singPage.micDialog).toHaveCount(0)

    // it could not know, so it tried the saved microphone first, then the default
    expect(await fakeMic.requests()).toEqual(['mic-gone', null])
  })

  // Traces to: AE-L2-14, SG-L2-20
  test('a denied microphone still leads to the microphone dialog when one was chosen', async ({
    page,
    fakeMic,
    singPage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await fakeMic.deny()
    await singPage.open('hotcrossbuns')

    await singPage.startButton.click()
    await expect(singPage.micDialog).toContainText('Can Twinkle hear you sing?')

    // a refusal is not papered over by asking again for another microphone
    expect(await fakeMic.requests()).toEqual([FakeMic.HEADSET.deviceId])
  })

  test('an unknown song id bounces back to the song list', async ({ page, songsPage }) => {
    await seedApp(page)
    await page.goto('/#/sing?song=doesnotexist')
    await page.waitForURL(/#\/songs$/)
    await expect(songsPage.heading).toBeVisible()
  })
})
