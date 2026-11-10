import { test, expect } from '../fixtures/test'
import { FakeMic } from '../fixtures/fake-mic'
import { readMicrophone, readState, seedApp } from '../fixtures/seed'

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

  // Traces to: GC-L2-11
  test('pitch strictness opens on Precise for a singer nobody has chosen a level for', async ({
    page,
    mePage,
  }) => {
    await seedApp(page)
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.strictnessGroup).toHaveAccessibleName(/Pitch matching/)
    await expect(mePage.settings.strictnessGroup.getByRole('radio')).toHaveCount(3)
    await expect(mePage.settings.strictnessChoice('Precise')).toBeChecked()
    await expect(mePage.settings.strictnessChoice('Gentle')).not.toBeChecked()
    await expect(mePage.settings.strictnessChoice('Just right')).not.toBeChecked()
  })

  // Traces to: GC-L2-11
  test('a chosen pitch strictness saves at once and is still chosen after a reload', async ({
    page,
    welcomePage,
    voiceSetupPage,
    mePage,
  }) => {
    // onboard through the app: a seeded state would be re-seeded by the reload
    await page.goto('/')
    await welcomePage.completeOnboarding('Echo', '🐱')
    await voiceSetupPage.laterLink.click()
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.chooseStrictness('Gentle')
    await expect(mePage.settings.strictnessChoice('Gentle')).toBeChecked()
    await expect(mePage.settings.strictnessChoice('Precise')).not.toBeChecked()
    expect((await readState(page)).profile.strictness).toBe('gentle')

    await page.reload()
    await mePage.openSettings()
    await expect(mePage.settings.strictnessChoice('Gentle')).toBeChecked()
  })

  // Traces to: GC-L2-11
  test('a stored pitch strictness is the one shown as chosen', async ({ page, mePage }) => {
    await seedApp(page, { strictness: 'just-right' })
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.strictnessChoice('Just right')).toBeChecked()
    await expect(mePage.settings.strictnessChoice('Precise')).not.toBeChecked()
  })

  // Traces to: GC-L2-11
  test('a stored pitch strictness the app does not know reads as Precise', async ({
    page,
    mePage,
  }) => {
    await seedApp(page, { strictness: 'strictest' as never })
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.strictnessChoice('Precise')).toBeChecked()
  })

  // Traces to: AS-L2-6
  test('on a screen shorter than the dialog, it scrolls so Close can be reached', async ({
    page,
    mePage,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await seedApp(page)
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.closeButton.scrollIntoViewIfNeeded()
    await expect(mePage.settings.closeButton).toBeInViewport({ ratio: 1 })
    await mePage.settings.closeButton.click()
    await expect(mePage.settings.dialog).toHaveCount(0)
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

  // Traces to: GC-L2-3, GC-L2-12
  test('the microphone picker lists the device\'s microphones, starting on the system default', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.microphoneOptions).toHaveText([
      'System default',
      'Built-in microphone',
      "Ada's headset",
    ])
    await expect(mePage.settings.selectedMicrophone).toHaveText('System default')
    await expect(mePage.settings.microphoneHint).toHaveText(
      'A headset works best: it stops the tablet hearing its own melody',
    )
    await expect(mePage.settings.showMicrophonesButton).toBeHidden()
    expect(await readMicrophone(page)).toBeNull()
  })

  // Traces to: GC-L2-12, AE-L2-22
  test('a picked microphone is saved at once, survives a reload, and is what the next song listens on', async ({
    page,
    fakeMic,
    mePage,
    singPage,
  }) => {
    await seedApp(page)
    await fakeMic.use(FakeMic.C4)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.chooseMicrophone("Ada's headset")
    expect(await readMicrophone(page)).toEqual(FakeMic.HEADSET) // no save button

    await page.reload()
    await mePage.openSettings()
    await expect(mePage.settings.selectedMicrophone).toHaveText("Ada's headset")
    await mePage.settings.closeButton.click()

    await singPage.open('hotcrossbuns')
    await singPage.startButton.click()
    await expect(singPage.stageLabel).toHaveText(/MOVE YOUR STAR/)
    expect(await fakeMic.requests()).toEqual([FakeMic.HEADSET.deviceId])
  })

  // Traces to: GC-L2-12
  test('picking the system default forgets the microphone choice', async ({ page, fakeMic, mePage }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await mePage.goto()
    await mePage.openSettings()
    await expect(mePage.settings.selectedMicrophone).toHaveText("Ada's headset")

    await mePage.settings.chooseMicrophone('System default')

    await expect(mePage.settings.selectedMicrophone).toHaveText('System default')
    expect(await readMicrophone(page)).toBeNull()
  })

  // Traces to: GC-L2-12, FS-L2-16
  test('the microphone choice stays on the device: it is no part of the singer\'s state', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.chooseMicrophone("Ada's headset")

    expect(await readMicrophone(page)).toEqual(FakeMic.HEADSET)
    expect(JSON.stringify(await readState(page))).not.toContain('headset')
  })

  // Traces to: GC-L2-9, GC-L2-12
  test('"start everything over" also forgets the microphone choice, and says so', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET])
    await mePage.goto()

    // backing out keeps it
    await mePage.openSettings()
    await mePage.settings.resetButton.click()
    await expect(mePage.settings.confirmDialog).toContainText(
      'This erases the profile, sparkles, badges, voice range and microphone choice on this device.',
    )
    await mePage.settings.keepButton.click()
    expect(await readMicrophone(page)).toEqual(FakeMic.HEADSET)

    await mePage.openSettings()
    await mePage.settings.resetButton.click()
    await mePage.settings.eraseButton.click()

    await expect(page).toHaveURL(/#\/welcome$/)
    expect(await readMicrophone(page)).toBeNull()
  })

  // Traces to: GC-L2-12
  test('a tablet with one microphone lists it beside the system default', async ({ page, fakeMic, mePage }) => {
    await seedApp(page)
    await fakeMic.plugIn([FakeMic.BUILT_IN])
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.microphoneOptions).toHaveText(['System default', 'Built-in microphone'])
    await mePage.settings.chooseMicrophone('Built-in microphone')
    expect(await readMicrophone(page)).toEqual(FakeMic.BUILT_IN)
  })

  // Traces to: GC-L2-12, AE-L2-22
  test('when the browser has not shared microphone names, "Show microphones" asks once, listens to nothing, and lists them', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page)
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET], { namesHidden: true })
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.showMicrophonesButton).toBeVisible()
    await expect(mePage.settings.microphoneSelect).toBeHidden()
    await expect(mePage.settings.microphoneHint).toHaveText(
      'Allow the microphone once to see the ones on this device',
    )
    expect(await fakeMic.requests()).toEqual([]) // opening the hub asks for nothing

    await mePage.settings.showMicrophonesButton.click()

    await expect(mePage.settings.microphoneOptions).toHaveText([
      'System default',
      'Built-in microphone',
      "Ada's headset",
    ])
    await expect(mePage.settings.showMicrophonesButton).toBeHidden()
    await expect(mePage.settings.microphoneHint).toHaveText(
      'A headset works best: it stops the tablet hearing its own melody',
    )
    expect(await fakeMic.requests()).toEqual([null])
    expect(await fakeMic.openStreams()).toBe(0) // the stream opened for the names was stopped at once
  })

  // Traces to: GC-L2-12
  test('declining the microphone in the picker is explained in words, and nothing saved changes', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.plugIn([FakeMic.BUILT_IN, FakeMic.HEADSET], { namesHidden: true })
    await fakeMic.deny()
    await mePage.goto()
    await mePage.openSettings()

    await mePage.settings.showMicrophonesButton.click()

    await expect(mePage.settings.microphoneHint).toHaveText(
      "The microphone was not allowed, so the names stay hidden. You can allow it in the browser's settings.",
    )
    await expect(mePage.settings.showMicrophonesButton).toBeVisible()
    expect(await readMicrophone(page)).toEqual(FakeMic.HEADSET)
  })

  // Traces to: GC-L2-12
  test('a remembered microphone that is not plugged in stays selected, marked in words, and is kept', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page, { microphone: FakeMic.HEADSET })
    await fakeMic.plugIn([FakeMic.BUILT_IN])
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.microphoneOptions).toHaveText([
      'System default',
      'Built-in microphone',
      "Ada's headset (not plugged in)",
    ])
    await expect(mePage.settings.selectedMicrophone).toHaveText("Ada's headset (not plugged in)")
    await expect(mePage.settings.microphoneHint).toHaveText(
      "Ada's headset is not plugged in, so the system default is listening for now",
    )
    expect(await readMicrophone(page)).toEqual(FakeMic.HEADSET)

    // and when it comes back while the hub is open, the picker catches up by itself
    await fakeMic.plugInNow(FakeMic.HEADSET)
    await expect(mePage.settings.selectedMicrophone).toHaveText("Ada's headset")
    await expect(mePage.settings.microphoneHint).toHaveText(
      'A headset works best: it stops the tablet hearing its own melody',
    )
  })

  // Traces to: GC-L2-12
  test('a microphone plugged in while the hub is open appears in the picker', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page)
    await fakeMic.plugIn([FakeMic.BUILT_IN])
    await mePage.goto()
    await mePage.openSettings()
    await expect(mePage.settings.microphoneOptions).toHaveText(['System default', 'Built-in microphone'])

    await fakeMic.plugInNow(FakeMic.HEADSET)

    await expect(mePage.settings.microphoneOptions).toHaveText([
      'System default',
      'Built-in microphone',
      "Ada's headset",
    ])
    await expect(mePage.settings.selectedMicrophone).toHaveText('System default')
  })

  // Traces to: GC-L2-12, AE-L2-22
  test('a browser that cannot list microphones shows the system default alone, and says why', async ({
    page,
    fakeMic,
    mePage,
  }) => {
    await seedApp(page)
    await fakeMic.cannotList()
    await mePage.goto()
    await mePage.openSettings()

    await expect(mePage.settings.microphoneOptions).toHaveText(['System default'])
    await expect(mePage.settings.microphoneSelect).toBeDisabled()
    await expect(mePage.settings.microphoneHint).toHaveText('This browser picks the microphone itself')
    await expect(mePage.settings.showMicrophonesButton).toBeHidden()
  })
})
