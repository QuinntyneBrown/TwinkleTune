import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:5240'

/** First-run flow: name + "Let's Sing!" creates a server-linked singer. */
async function createProfile(page: Page, name: string): Promise<void> {
  await page.goto('/')
  await page.fill('#kid-name', name)
  await page.getByRole('button', { name: /Let's Sing/ }).click()
  await expect(page).toHaveURL(/#\/(voice|home)/, { timeout: 15_000 })
}

test('the family server is healthy and seeds the songbook', async ({ request }) => {
  const health = await request.get(`${API}/health`)
  expect(health.ok()).toBeTruthy()

  const songs = (await (await request.get(`${API}/api/songs`)).json()) as Array<{ title: string }>
  expect(songs.length).toBeGreaterThanOrEqual(6)
  expect(songs.map((s) => s.title)).toContain('Twinkle Twinkle Little Star')

  const avatars = (await (await request.get(`${API}/api/avatars`)).json()) as Array<{ emoji: string }>
  expect(avatars.map((a) => a.emoji)).toContain('🦄')
})

test('welcome links the new singer to the family server', async ({ page }) => {
  await createProfile(page, 'LinkKid')
  const activeSinger = await page.evaluate(() => localStorage.getItem('twinkletune:active-singer'))
  expect(activeSinger).not.toBeNull()

  // her profile is visible on the profiles screen
  await page.goto('/#/profiles')
  await expect(page.locator('.profile-card', { hasText: 'LinkKid' })).toBeVisible()
})

test('songs come from the server with duet buttons and score boards', async ({ page }) => {
  await createProfile(page, 'SongKid')
  await page.goto('/#/songs')
  await expect(page.locator('.song').first()).toBeVisible()
  await expect(page.locator('[data-duet]').first()).toBeVisible()
  await page.locator('[data-board]').first().click()
  await expect(page.getByRole('dialog')).toContainText(/No scores yet|%/)
})

test('two singers on two devices reach a live duet', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const zoe = await ctxA.newPage()
  const mia = await ctxB.newPage()

  await createProfile(zoe, 'Zoe')
  await createProfile(mia, 'Mia')

  // Zoe makes a room and reads out the code
  await zoe.goto('/#/duet')
  await zoe.getByRole('button', { name: /Make a room/ }).click()
  await expect(zoe.locator('.duet-code')).toBeVisible({ timeout: 15_000 })
  const code = ((await zoe.locator('.duet-code').textContent()) ?? '').replace(/\s/g, '')
  expect(code).toMatch(/^[A-Z]{4}$/)

  // Mia joins with the code
  await mia.goto('/#/duet')
  await mia.getByRole('button', { name: /Join with a code/ }).click()
  await mia.locator('.code-input').fill(code)
  await mia.getByRole('button', { name: /Join the duet/ }).click()

  // both lobbies fill up; Zoe starts the song
  const startBtn = zoe.getByRole('button', { name: /Start the duet/ })
  await expect(startBtn).toBeVisible({ timeout: 15_000 })
  await startBtn.click()

  // the synchronized start lands both singers on the duet sing screen
  await expect(zoe).toHaveURL(/duet=1/, { timeout: 15_000 })
  await expect(mia).toHaveURL(/duet=1/, { timeout: 15_000 })
  await expect(zoe.locator('.opponent-chip')).toContainText('Mia')
  await expect(mia.locator('.opponent-chip')).toContainText('Zoe')

  await ctxA.close()
  await ctxB.close()
})
