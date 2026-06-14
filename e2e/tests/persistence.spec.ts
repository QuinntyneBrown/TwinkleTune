import { test, expect } from '../fixtures/test'
import { readState } from '../fixtures/seed'

test.describe('Persistence', () => {
  test('the profile survives a reload', async ({ page, welcomePage, voiceSetupPage, homePage }) => {
    await page.goto('/')
    await welcomePage.completeOnboarding('Echo', '🐱')
    await expect(page).toHaveURL(/#\/voice$/)

    await voiceSetupPage.laterLink.click()
    await expect(homePage.greeting).toContainText('Hi, Echo!')

    await page.reload()
    await expect(homePage.greeting).toContainText('Hi, Echo!')

    const state = await readState(page)
    expect(state.profile).toMatchObject({ name: 'Echo', avatar: '🐱' })
  })
})
