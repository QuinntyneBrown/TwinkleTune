import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appUrl = process.env.TWINKLETUNE_APP_URL ?? 'http://127.0.0.1:5174'
const here = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.resolve(here, '..', '..', 'marketing', 'assets', 'screenshots')

const today = new Date().toLocaleDateString('en-CA')
const state = {
  profile: { name: 'Mia', avatar: '🦄', range: { low: 57, high: 69 }, latencyMs: 0 },
  sparkles: 1280,
  singDays: [today],
  plays: { [today]: 1 },
  bests: {
    twinkle: { stars: 3, accuracy: 0.93, plays: 5 },
    mary: { stars: 2, accuracy: 0.82, plays: 3 },
  },
  badges: { 'first-song': today },
  lastResult: {
    songId: 'twinkle',
    songTitle: 'Twinkle Twinkle Little Star',
    landed: 39,
    total: 42,
    accuracy: 39 / 42,
    stars: 3,
    pitchStars: 3,
    timingStars: 3,
    braveStars: 3,
    maxStreak: 18,
    sparkles: 390,
    trickyPhrase: null,
    trickyLyric: null,
    noMic: false,
  },
  lastSongId: 'twinkle',
  lastNewBadges: [],
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch()

async function capture(name, hash, appState) {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1.5,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  if (appState) {
    await page.addInitScript((value) => {
      localStorage.setItem('twinkletune:v1', JSON.stringify(value))
    }, appState)
  }

  await page.goto(`${appUrl}/${hash}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    animations: 'disabled',
  })
  await context.close()
}

try {
  await capture('welcome', '#/welcome')
  await capture('home', '#/home', state)
  await capture('songs', '#/songs', state)
  await capture('results', '#/results', state)
} finally {
  await browser.close()
}
