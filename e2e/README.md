# TwinkleTune E2E tests

Playwright end-to-end tests for the app in `../frontend`, written with the Page Object Model:

```
fixtures/   fake-mic (getUserMedia → controllable oscillator), localStorage seeding, test fixtures
pages/      one page object per screen + shared components (bottom nav, parent gate, settings)
tests/      one spec per major behaviour
```

The dev server is started automatically (port 5174). The microphone is never used for real:
`FakeMic.use(hz)` swaps `getUserMedia` for a sine-wave oscillator the tests can re-tune live,
which makes pitch detection (voice setup, singing, tuner) fully deterministic.

## Run

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # headless run
npm run test:headed               # watch it happen
npm run report                    # open the HTML report
```

## Full-stack suite

`npm run test:server` (config: `playwright.server.config.ts`, specs: `tests-server/`) boots the
real .NET backend on an **isolated database** under `e2e/.tmp` plus a frontend wired to it, then
covers server-linked profiles, the seeded songbook, high-score boards, and a real two-browser-context
duet over SignalR. Requires the .NET 10 SDK.
