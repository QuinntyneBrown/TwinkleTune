# Security Policy

TwinkleTune is an app for children, so privacy and safety issues are taken seriously.

## How TwinkleTune is built

Knowing the design helps in judging what is a vulnerability and what is intended.

- **The app** is an offline-first PWA. Pitch detection, scoring and rewards run entirely in the
  browser. Singing audio is never recorded, stored or sent anywhere. Badges, streaks and sparkles
  stay in the device's `localStorage`. There are no accounts, no analytics and no third-party
  network calls.
- **The family server** is optional and self-hosted. It stores profiles, songs, photos and high
  scores in one SQLite file and a photos folder under `backend/data/`, and relays live score
  events between two devices during a duet.
- **The family server has no authentication, by design.** It is meant to run on a trusted home
  network, with CORS restricted to the origins listed in `Cors:Origins`. It must never be exposed
  to the internet, and this project never deploys it.
- **What is deployed publicly** is static only: the marketing site at
  [twinkletune.app](https://twinkletune.app) and the PWA at `/app`.

## Supported versions

Only the latest code on the `main` branch is supported with security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Instead, report privately via one of:

- **GitHub private vulnerability reporting**:
  [Report a vulnerability](https://github.com/QuinntyneBrown/TwinkleTune/security/advisories/new)
- **Email**: quinntynebrown@gmail.com with "TwinkleTune security" in the subject line

Please include:

- A description of the issue and its impact
- Steps to reproduce (a minimal example helps)
- Whether the family server was involved, and how it was reachable
- Browser and device details if relevant

You can expect an acknowledgement within a few days. Please allow a reasonable window to fix the
issue before any public disclosure.

## Scope

Reports especially welcome:

- Anything that sends singing audio, or any data about a child, off the device or off the home
  network
- Cross-site scripting or content injection in the app, the service worker or the marketing site,
  including through song data, singer names or uploaded photos
- Weaknesses in the parent gate in front of the Grown-Ups Corner and destructive actions
- Family server flaws that go beyond its intended trust model: for example path traversal or
  unsafe file handling in photo upload, injection, a bypass of the CORS origin restriction, or a
  way for a web page outside the allowed origins to reach it
- Anything in the public deployment that exposes the family server or data it holds
- Supply-chain issues in the dependency set or the CI/CD pipeline

Out of scope:

- The absence of authentication on the family server when it is reached from the home network it
  is designed for. Anyone on that network can read and change its data; that is the documented
  trust model.
- Problems that arise only because the family server was exposed to the internet against this
  guidance
- Issues requiring physical access to an unlocked device
- Vulnerabilities in third-party hosting platforms
