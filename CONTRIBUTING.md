# Contributing to TwinkleTune

Thank you for your interest in making TwinkleTune better. Contributions of all kinds are welcome:
bug reports, fixes, new public-domain songs, accessibility improvements and documentation.

## Before you start

- For anything larger than a small fix, open a
  [GitHub issue](https://github.com/QuinntyneBrown/TwinkleTune/issues) first so the approach can
  be agreed before you invest time in it.
- Read [`AGENTS.md`](AGENTS.md). It holds the architecture rules, the domain vocabulary and the
  development workflow that every change follows, whoever or whatever writes it.
- Read the ADRs in [`docs/adr/`](docs/adr/) that cover the area you are changing.

## Getting set up

You need [Node.js](https://nodejs.org/) 22 or later, and the
[.NET SDK](https://dotnet.microsoft.com/download) 10.0 if you are working on the family server.

```bash
# The app (solo play, fully offline)
cd frontend
npm install
npm run dev      # http://localhost:5173

# The family server (optional: profiles, duets, high scores, song editor)
cd backend
dotnet run --project src/TwinkleTune.Api    # http://localhost:5240

# End-to-end tests
cd e2e
npm install
npx playwright install chromium
```

See the [README](README.md#getting-started) for more on running the two together.

## Project principles

TwinkleTune is built for young children. These are not negotiable:

- **Encouragement only.** No red crosses, no "wrong", no score that reads as failure. Silence is
  not a wrong note. A tricky part is an invitation to practise, never a penalty. Every new string
  a child sees must pass this test.
- **One big obvious action per screen.** Few words, big rounded type (Baloo 2 and Nunito) and
  chunky toy-like buttons.
- **Privacy first.** Singing audio never leaves the device. No accounts, no analytics and no
  third-party network calls. Badges, streaks and sparkles stay in `localStorage`; profiles,
  songs, photos and high scores live only on the family server. Duets send only live score
  events.
- **Offline first.** Solo play must never depend on the network. Every server feature is a
  progressive enhancement, and server calls fail soft, never to an error the child sees.
- **Public-domain songs only.**

## How changes are made

A change to production behaviour starts with its documents and its tests, not its code:

1. **Requirement.** Add or update the requirement in [`docs/specs/`](docs/specs/README.md), with
   GIVEN/WHEN/THEN acceptance criteria.
2. **Design.** Add or update the detailed design in
   [`docs/detailed-designs/`](docs/detailed-designs/).
3. **Mock.** For a UI change, update the mock in [`docs/mocks/`](docs/mocks/). The mocks are the
   visual source of truth. Keep their class names and accessible names in the app, because the
   end-to-end tests depend on that parity.
4. **Implement in small slices, test first.** For each slice, write the acceptance test, run it
   and see it fail for the expected reason, then write only the code that makes it pass. Do not
   add tests afterwards, and do not weaken a test to make it pass.

Keep the requirement, design, mock and code aligned in the same pull request. Documentation-only
changes and fixes that restore already-specified behaviour do not need new requirements.

### Where tests go

| Change | Test |
|---|---|
| Frontend logic (scoring, note judging, range math, badges, store) | Vitest beside the module (`*.test.ts`) |
| The pitch and judging chain | The synthetic singer in `frontend/src/testing/` |
| Frontend behaviour | Playwright in `e2e/`, through a page object in `e2e/pages/` |
| Backend | Integration tests against the API, unit tests for services and validators |

Every new acceptance test file starts with a header naming the requirements it covers:

```typescript
// Acceptance Test
// Traces to: SR-L2-18
// Description: A synthesised singer 180 ms behind the beat still lands most notes
```

Test behaviour, not the shape of the codebase: no tests that assert file layout, naming or banned
APIs. Do not write tests for the mocks.

## Adding songs

A song is hand-encoded note data, never a recording. Bundled songs live in `frontend/src/songs/`.
Only **public-domain** melodies can be accepted, so state the song's provenance in your pull
request.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep the change focused: one feature or fix per pull request.
3. Run what CI runs for the areas you touched:

   | Area | Command |
   |---|---|
   | `frontend/` | `npm test` and `npm run build` |
   | `backend/` | `dotnet test` |
   | `e2e/` | `npm test`, plus `npm run test:server` or `npm run test:marketing` where relevant |

4. Open the pull request with a short description of what changed and why, and the requirement
   IDs it covers.

## Reporting bugs

Open a [GitHub issue](https://github.com/QuinntyneBrown/TwinkleTune/issues) with the steps to
reproduce, what you expected and what happened instead. Browser, device and microphone details
help a great deal, because pitch detection behaves differently across microphones. Say whether
the family server was running.

Do not open a public issue for a security problem. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
