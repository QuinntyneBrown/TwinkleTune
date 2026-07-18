import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const marketingUrl = 'http://127.0.0.1:4175'

export default defineConfig({
  testDir: './tests-marketing',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-marketing' }]],
  use: {
    baseURL: marketingUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort ../marketing',
    cwd: path.resolve(__dirname, '..', 'frontend'),
    url: marketingUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
