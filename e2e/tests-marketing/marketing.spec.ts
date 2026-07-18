import { expect, test, type Page } from '@playwright/test'

async function openMarketing(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toBeVisible()
}

test('presents the headline and primary call to action', async ({ page }) => {
  await openMarketing(page)

  await expect(
    page.getByRole('heading', { level: 1, name: /every voice has a place to shine/i }),
  ).toBeVisible()

  const primaryCta = page.locator('.hero-actions').getByRole('link', { name: /start singing free/i })
  await expect(primaryCta).toBeVisible()
  await expect(primaryCta).toHaveAttribute('href', '/app/')
})

test('loads every product screenshot asset', async ({ page }) => {
  await openMarketing(page)

  const screenshots = page.locator('img[src*="assets/screenshots/"]')
  const screenshotCount = await screenshots.count()
  expect(screenshotCount).toBeGreaterThanOrEqual(4)

  // Exercise native lazy loading by bringing each screenshot into view.
  for (let index = 0; index < screenshotCount; index += 1) {
    await screenshots.nth(index).scrollIntoViewIfNeeded()
  }

  await expect
    .poll(async () =>
      screenshots.evaluateAll((images) =>
        images.every((image) => {
          const screenshot = image as HTMLImageElement
          return screenshot.complete && screenshot.naturalWidth > 0 && screenshot.naturalHeight > 0
        }),
      ),
    )
    .toBe(true)

  const uniqueSources = await screenshots.evaluateAll((images) =>
    new Set(images.map((image) => new URL((image as HTMLImageElement).currentSrc).pathname)).size,
  )
  expect(uniqueSources).toBeGreaterThanOrEqual(4)

  const distortedScreenshots = await screenshots.evaluateAll(
    (images) =>
      images.filter((image) => {
        const screenshot = image as HTMLImageElement
        const naturalRatio = screenshot.naturalWidth / screenshot.naturalHeight
        // client dimensions measure the rendered image box without counting a
        // deliberate rotation on the surrounding phone mockup.
        const renderedRatio = screenshot.clientWidth / screenshot.clientHeight
        return Math.abs(naturalRatio - renderedRatio) > 0.01
      }).length,
  )
  expect(distortedScreenshots).toBe(0)
})

test('does not create horizontal page overflow', async ({ page }) => {
  await openMarketing(page)

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
})

test('mobile navigation is labelled and keyboard operable', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile navigation is only displayed at compact breakpoints')
  await openMarketing(page)

  const menuButton = page.locator('[data-menu-button]')
  const menu = page.locator('[data-mobile-menu]')

  await expect(menuButton).toBeVisible()
  await expect(menuButton).toHaveAccessibleName('Open navigation')
  await expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu')
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toHaveAttribute('aria-hidden', 'true')

  await menuButton.focus()
  await expect(menuButton).toBeFocused()
  await menuButton.press('Enter')

  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await expect(menuButton).toHaveAccessibleName('Close navigation')
  await expect(menu).toHaveAttribute('aria-hidden', 'false')
  await expect(menu).toHaveCSS('opacity', '1')
  await expect(menu).toHaveCSS('pointer-events', 'auto')
  const menuBounds = await menu.boundingBox()
  expect(menuBounds?.height).toBeGreaterThan((page.viewportSize()?.height ?? 0) - 100)
  await expect(menu.getByRole('link', { name: 'Why TwinkleTune' })).toBeVisible()
  await expect(menu.getByRole('link', { name: /open the app/i })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toHaveAccessibleName('Open navigation')
  await expect(menu).toHaveAttribute('aria-hidden', 'true')
  await expect(menu).toHaveCSS('opacity', '0')
  await expect(menu).toHaveCSS('pointer-events', 'none')
})

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' })

  test('keeps all reveal content available without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openMarketing(page)

    const revealItems = page.locator('[data-reveal]')
    expect(await revealItems.count()).toBeGreaterThan(0)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

    const hiddenItems = await revealItems.evaluateAll((items) =>
      items.filter((item) => {
        const style = getComputedStyle(item)
        const bounds = item.getBoundingClientRect()
        return (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number.parseFloat(style.opacity) === 0 ||
          bounds.width === 0 ||
          bounds.height === 0
        )
      }).length,
    )

    expect(hiddenItems).toBe(0)
    await expect(page.getByRole('heading', { name: /small screens\. big encouragement/i })).toBeVisible()
  })
})
