import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // several tests run real-time Web Audio + rAF pitch detection; more parallel
  // workers starve the animation frames and make captures/scoring flaky
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    launchOptions: {
      // Web Audio must start without a fresh user gesture (fake mic streams,
      // song synthesis) and should stay silent on the machine running tests.
      args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port=5174 --strictPort',
    cwd: path.resolve(__dirname, '..', 'frontend'),
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
