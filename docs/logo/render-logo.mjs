/**
 * Renders the TwinkleTune logo lockup to transparent PNGs for the root README.
 *
 *   node docs/logo/render-logo.mjs
 *
 * Writes twinkletune-logo.png (for light grounds) and twinkletune-logo-dark.png
 * (for dark grounds) at 2x, from logo.html. Playwright is borrowed from
 * e2e/node_modules, as docs/stickers/render-stickers.mjs does.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const moduleRoot = process.env.TWINKLETUNE_MODULE_ROOT ?? path.join(repoRoot, 'e2e')

const require = createRequire(pathToFileURL(path.join(moduleRoot, 'package.json')))
const { chromium } = require('@playwright/test')

const browser = await chromium.launch({
  args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
})

try {
  for (const { file, dark } of [
    { file: 'twinkletune-logo.png', dark: false },
    { file: 'twinkletune-logo-dark.png', dark: true },
  ]) {
    const context = await browser.newContext({ deviceScaleFactor: 2 })
    const page = await context.newPage()
    await page.goto(pathToFileURL(path.join(here, 'logo.html')).href, { waitUntil: 'load' })
    if (dark) await page.evaluate(() => document.body.classList.add('dark'))

    // Hard-fail rather than silently shipping a fallback font.
    const loaded = await page.evaluate(async () => {
      const spec = '800 92px "Baloo 2"'
      await document.fonts.load(spec).catch(() => {})
      await document.fonts.ready
      return document.fonts.check(spec)
    })
    if (!loaded) throw new Error('Baloo 2 did not load')

    await page.locator('.logo').screenshot({ path: path.join(here, file), omitBackground: true })
    await context.close()
    console.log(`✓ ${file}`)
  }
} finally {
  await browser.close()
}
