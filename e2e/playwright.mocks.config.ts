import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const mocksUrl = 'http://127.0.0.1:4177'

export default defineConfig({
  testDir: './tests-mocks',
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // The dev server hands out 12 static pages to 3 viewport projects at once;
  // more than a handful of workers just makes Vite the bottleneck and the
  // navigations start timing out.
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-mocks' }]],
  use: {
    baseURL: mocksUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 20_000,
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
      name: 'tablet-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177 --strictPort ../docs/mocks',
    cwd: path.resolve(__dirname, '..', 'frontend'),
    url: mocksUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
