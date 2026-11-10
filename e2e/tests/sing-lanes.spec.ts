// Acceptance Test
// Traces to: SG-L2-27
// Description: The sing stage shows the mock's six pitch lanes over the scene's backdrop
import { test, expect } from '../fixtures/test'
import { seedApp } from '../fixtures/seed'

test.describe('Pitch lanes on the sing stage', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
    })
    await seedApp(page)
  })

  test('the animated Canvas2D scene draws six lanes', async ({ singPage }) => {
    await singPage.open('twinkle')
    await expect(singPage.reactiveScene).toHaveAttribute('data-renderer', 'canvas2d')

    const { onLane, between } = await singPage.sceneLaneCoverage()
    for (const share of onLane) expect(share).toBeGreaterThan(0.8)
    for (const share of between) expect(share).toBeLessThan(0.2)
  })

  test('the still scene for reduced motion draws six lanes', async ({ page, singPage }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await singPage.open('twinkle')
    await expect(singPage.reactiveScene).toHaveAttribute('data-renderer', 'static')

    const { onLane, between } = await singPage.sceneLaneCoverage()
    for (const share of onLane) expect(share).toBeGreaterThan(0.8)
    for (const share of between) expect(share).toBeLessThan(0.2)
  })
})
