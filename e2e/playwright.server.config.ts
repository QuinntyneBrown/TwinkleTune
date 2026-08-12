import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * Full-stack suite: boots the real .NET backend on an ISOLATED database
 * (e2e/.tmp — never the family one) plus a frontend wired to it, then
 * exercises profiles, the seeded songbook and a real two-context duet.
 *
 * Run with: npm run test:server
 */
export default defineConfig({
  testDir: './tests-server',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
        // fake mic so getUserMedia resolves headless without a prompt
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'dotnet run --project ../backend/src/TwinkleTune.Api --urls http://localhost:5240',
      url: 'http://localhost:5240/health',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ConnectionStrings__Default: `Data Source=${path.resolve(__dirname, '.tmp', 'e2e.db')}`,
        PhotosPath: path.resolve(__dirname, '.tmp', 'photos'),
        DataPath: path.resolve(__dirname, '.tmp'),
        Cors__Origins__0: 'http://localhost:5175',
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    },
    {
      command: 'npm run dev -- --port=5175 --strictPort',
      cwd: path.resolve(__dirname, '..', 'frontend', 'apps', 'game'),
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: 'http://localhost:5240' },
    },
  ],
})
