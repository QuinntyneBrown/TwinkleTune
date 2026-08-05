import { expect, test, type Page } from '@playwright/test'

/**
 * The mockups in docs/mocks are the visual source of truth, so they have to
 * survive every form factor the app claims to support. These checks are
 * structural rather than pixel-exact: no page may overflow horizontally, and
 * the navigation has to change shape between phone and desktop.
 */

const PAGES = [
  'index.html',
  '01-welcome.html',
  '02-voice-setup.html',
  '03-home.html',
  '04-songs.html',
  '05-sing.html',
  '06-results.html',
  '07-tips.html',
  '08-progress.html',
  '09-dialogs.html',
  '10-profiles.html',
  '11-duet.html',
]

/** Pages that render the four-tab main navigation. */
const NAV_PAGES = ['03-home.html', '04-songs.html', '07-tips.html', '08-progress.html']

async function open(page: Page, file: string) {
  // `domcontentloaded`, not `load`: the mockups pull Baloo 2 + Nunito from
  // Google Fonts, and waiting on that (plus 11 preview iframes on the gallery)
  // stalls far longer than the layout assertions below need.
  await page.goto(`/${file}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main.screen')).toBeVisible()
}

for (const file of PAGES) {
  test(`${file} never scrolls sideways`, async ({ page }) => {
    await open(page, file)

    const { clientWidth, scrollWidth } = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test(`${file} fills the viewport it is given`, async ({ page }) => {
    await open(page, file)

    const viewport = page.viewportSize()!
    const screen = await page.locator('main.screen').boundingBox()
    expect(screen).not.toBeNull()

    // The column must never exceed the viewport...
    expect(screen!.width).toBeLessThanOrEqual(viewport.width)

    // ...and on a wide viewport it must actually use the space rather than
    // sitting there as a 470px phone ribbon.
    if (viewport.width >= 1180) {
      expect(screen!.width).toBeGreaterThan(700)
    }
  })
}

for (const file of NAV_PAGES) {
  test(`${file} navigation matches the form factor`, async ({ page }) => {
    await open(page, file)

    const viewport = page.viewportSize()!
    const nav = await page.locator('nav.bottomnav').boundingBox()
    expect(nav).not.toBeNull()

    if (viewport.width >= 980) {
      // desktop: a tall rail pinned to the left edge
      expect(nav!.height).toBeGreaterThan(nav!.width)
      expect(nav!.x).toBeLessThan(300)
    } else {
      // phone / small tablet: a wide pill along the bottom
      expect(nav!.width).toBeGreaterThan(nav!.height)
      expect(nav!.y).toBeGreaterThan(viewport.height / 2)
    }

    // the content column must not sit underneath the rail
    const screen = await page.locator('main.screen').boundingBox()
    if (viewport.width >= 980) {
      expect(screen!.x).toBeGreaterThanOrEqual(nav!.x + nav!.width)
    }
  })
}

test('the phone column keeps its original 470px cap', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width >= 700, 'phone-width behaviour only')

  await open(page, '03-home.html')
  const screen = await page.locator('main.screen').boundingBox()
  expect(screen!.width).toBeLessThanOrEqual(470)
})

test('the gallery links every screen', async ({ page }) => {
  await open(page, 'index.html')

  for (const file of PAGES.filter((f) => f !== 'index.html')) {
    await expect(page.locator(`.gallery a[href="${file}"]`).first()).toBeAttached()
  }
})

test('the song list shows the shipped public-domain catalogue', async ({ page }) => {
  await open(page, '04-songs.html')

  for (const title of [
    'Twinkle Twinkle Little Star',
    'Mary Had a Little Lamb',
    'Hot Cross Buns',
    'London Bridge',
    'Old MacDonald',
    'Row, Row, Row Your Boat',
    'Jesus Loves Me',
  ]) {
    await expect(page.locator('.song-body strong', { hasText: title }).first()).toBeVisible()
  }
})
