/**
 * Renders the TwinkleTune die-cut stickers to print-ready transparent PNGs.
 *
 *   node docs/stickers/render-stickers.mjs
 *
 * Playwright is not a dependency of this folder — it is borrowed from
 * e2e/node_modules, the same indirection
 * .codex/skills/create-twinkletune-design-book/scripts/render_pdf.mjs uses.
 *
 * Each sticker's .stage element is exactly 900 x 900 CSS px, which at
 * deviceScaleFactor 1 is 900 x 900 device px = 3 inches at 300 DPI.
 * omitBackground:true is what makes the outside of the die-cut transparent.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const moduleRoot = process.env.TWINKLETUNE_MODULE_ROOT ?? path.join(repoRoot, 'e2e')

const require = createRequire(pathToFileURL(path.join(moduleRoot, 'package.json')))
const { chromium } = require('@playwright/test')

const STICKERS = [
  { slug: 'sticker-1-twinkle-star', title: 'Twinkle the star' },
  { slug: 'sticker-2-wordmark-cloud', title: 'TwinkleTune wordmark cloud' },
  { slug: 'sticker-3-sparkle-dust', title: 'Mistakes are sparkle dust' },
]

/** PNG chunk reader — enough to assert dimensions and pixel format. */
function readPngHeader(buffer) {
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  const bitDepth = buffer.readUInt8(24)
  const colourType = buffer.readUInt8(25) // 6 = truecolour with alpha
  return { width, height, bitDepth, colourType }
}

const browser = await chromium.launch({
  args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
})

async function render(slug, { preview }) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1100 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const src = pathToFileURL(path.join(here, 'src', `${slug}.html`)).href
  await page.goto(src, { waitUntil: 'load' })

  if (preview) await page.evaluate(() => document.body.classList.add('preview'))

  // Force both faces to load — a sticker that only uses one of them would
  // otherwise leave the other unrequested — then hard-fail rather than
  // silently shipping a fallback font.
  const missing = await page.evaluate(async () => {
    const specs = [
      ['Baloo 2', '800 72px "Baloo 2"'],
      ['Nunito', '800 42px "Nunito"'],
    ]
    await Promise.all(specs.map(([, spec]) => document.fonts.load(spec).catch(() => {})))
    await document.fonts.ready
    return specs.filter(([, spec]) => !document.fonts.check(spec)).map(([name]) => name)
  })
  if (missing.length) {
    throw new Error(`${slug}: web fonts did not load: ${missing.join(', ')}`)
  }

  const out = path.join(here, preview ? `${slug}-preview.png` : `${slug}.png`)
  await page.locator('.stage').screenshot({
    path: out,
    omitBackground: !preview,
    animations: 'disabled',
  })
  await context.close()
  return out
}

/**
 * Decodes the exported PNG in the browser and reports the alpha bounding box.
 * That box is the die cut: whatever Jukebox's cut-line generator will trace.
 */
async function measureAlpha(pngPath) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const dataUri = `data:image/png;base64,${(await readFile(pngPath)).toString('base64')}`
  const result = await page.evaluate(async (uri) => {
    const img = new Image()
    img.src = uri
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, img.width, img.height)
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        if (data[(y * img.width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    const at = (x, y) => data[(y * img.width + x) * 4 + 3]
    return {
      minX, minY, maxX, maxY,
      corners: [
        at(0, 0),
        at(img.width - 1, 0),
        at(0, img.height - 1),
        at(img.width - 1, img.height - 1),
      ],
    }
  }, dataUri)
  await context.close()
  return result
}

try {
  for (const { slug, title } of STICKERS) {
    const printPath = await render(slug, { preview: false })
    const previewPath = await render(slug, { preview: true })

    const png = await readFile(printPath)
    const { width, height, colourType } = readPngHeader(png)
    if (width !== 900 || height !== 900) {
      throw new Error(`${slug}: expected 900x900, got ${width}x${height}`)
    }
    if (colourType !== 6) {
      throw new Error(`${slug}: expected RGBA (colour type 6), got ${colourType}`)
    }

    const { minX, minY, maxX, maxY, corners } = await measureAlpha(printPath)
    if (corners.some((a) => a !== 0)) {
      throw new Error(`${slug}: corners are not transparent (${corners.join(',')}) — omitBackground failed`)
    }
    if (minX < 2 || minY < 2 || maxX > width - 3 || maxY > height - 3) {
      throw new Error(
        `${slug}: artwork touches the canvas edge (x ${minX}-${maxX}, y ${minY}-${maxY}) — the die cut would be clipped`
      )
    }

    const artW = maxX - minX + 1
    const artH = maxY - minY + 1
    const inches = (px) => (px / 300).toFixed(2)
    console.log(
      `✓ ${title.padEnd(28)} ${path.basename(printPath).padEnd(30)} cut ${artW}x${artH}px (${inches(artW)}" x ${inches(artH)}")  margins L${minX} R${width - 1 - maxX} T${minY} B${height - 1 - maxY}`
    )
  }

  // Contact sheet, handy for reviewing all three at sticker size at once.
  const context = await browser.newContext({ viewport: { width: 1500, height: 620 } })
  const page = await context.newPage()
  // Inlined as data URIs — a setContent page has an opaque origin and cannot
  // load file:// images.
  const tiles = await Promise.all(
    STICKERS.map(async ({ slug, title }) => {
      const data = (await readFile(path.join(here, `${slug}.png`))).toString('base64')
      return `<figure><img src="data:image/png;base64,${data}" width="380"><figcaption>${title}</figcaption></figure>`
    })
  ).then((parts) => parts.join(''))
  await page.setContent(
    `<body style="margin:0;padding:40px;background:#F8FBFD;display:flex;gap:36px;align-items:flex-start;font:600 16px system-ui;color:#2B5876">
       <style>figure{margin:0;text-align:center}figcaption{margin-top:14px}img{display:block}</style>
       ${tiles}
     </body>`
  )
  await page.waitForTimeout(500)
  const sheet = path.join(here, 'contact-sheet.png')
  await page.locator('body').screenshot({ path: sheet })
  await context.close()
  console.log(`✓ ${'contact sheet'.padEnd(28)} ${path.basename(sheet)}`)

  await writeFile(
    path.join(here, '.render-stamp'),
    `rendered by render-stickers.mjs\nplaywright: ${require('playwright-core/package.json').version}\n`
  )
} finally {
  await browser.close()
}
