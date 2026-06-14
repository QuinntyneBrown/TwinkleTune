import { test, expect } from '../fixtures/test'
import { seedApp } from '../fixtures/seed'

test.describe('Routing', () => {
  test('every screen falls back to welcome until a profile exists', async ({
    page,
    welcomePage,
  }) => {
    await page.goto('/#/songs')
    await expect(welcomePage.logo).toContainText('TwinkleTune')

    await page.goto('/#/me')
    await expect(welcomePage.logo).toContainText('TwinkleTune')
  })

  test('unknown routes land on home', async ({ page, homePage }) => {
    await seedApp(page)
    await page.goto('/#/abracadabra')
    await expect(homePage.greeting).toContainText('Hi, Quinn!')
  })

  test('the bottom nav moves between the main screens', async ({
    page,
    homePage,
    songsPage,
    tipsPage,
    mePage,
  }) => {
    await seedApp(page)
    await homePage.goto()

    await homePage.nav.tab('songs').click()
    await expect(songsPage.heading).toBeVisible()
    await expect(songsPage.nav.activeTab()).toHaveAttribute('href', '#/songs')

    await songsPage.nav.tab('tips').click()
    await expect(tipsPage.heading).toBeVisible()

    await tipsPage.nav.tab('me').click()
    await expect(mePage.header).toContainText("Quinn's Star Journey")

    await mePage.nav.tab('home').click()
    await expect(homePage.greeting).toContainText('Hi, Quinn!')
    await expect(homePage.nav.activeTab()).toHaveAttribute('href', '#/home')
  })
})
