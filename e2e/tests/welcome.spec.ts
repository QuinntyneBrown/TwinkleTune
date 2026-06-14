import { test, expect } from '../fixtures/test'
import { readState, seedApp } from '../fixtures/seed'

test.describe('Welcome & onboarding', () => {
  test('creates a profile and continues to voice setup', async ({ page, welcomePage }) => {
    await page.goto('/')

    await expect(welcomePage.logo).toContainText('TwinkleTune')
    await welcomePage.nameInput.fill('Nova')
    await welcomePage.avatar('🐸').click()
    await expect(welcomePage.avatar('🐸')).toHaveAttribute('aria-pressed', 'true')
    await expect(welcomePage.avatar('🦄')).toHaveAttribute('aria-pressed', 'false')

    await welcomePage.letsSingButton.click()

    await expect(page).toHaveURL(/#\/voice$/)
    const state = await readState(page)
    expect(state.profile).toMatchObject({ name: 'Nova', avatar: '🐸', range: null })
  })

  test('falls back to the name Superstar when left blank', async ({ page, welcomePage }) => {
    await page.goto('/')
    await welcomePage.letsSingButton.click()

    await expect(page).toHaveURL(/#\/voice$/)
    const state = await readState(page)
    expect(state.profile.name).toBe('Superstar')
  })

  test('a returning singer with a saved range goes straight home', async ({
    page,
    welcomePage,
    homePage,
  }) => {
    await seedApp(page)
    await welcomePage.goto()

    await expect(welcomePage.nameInput).toHaveValue('Quinn')
    await welcomePage.letsSingButton.click()

    await expect(page).toHaveURL(/#\/home$/)
    await expect(homePage.greeting).toContainText('Hi, Quinn!')
  })
})
