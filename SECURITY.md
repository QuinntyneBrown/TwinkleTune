# Security Policy

TwinkleTune is a client-only web app aimed at children, so privacy and safety
issues are taken seriously even though the attack surface is small: there is
no backend, no accounts, and no data leaves the device — everything lives in
`localStorage`, and microphone audio is processed in-browser only.

## Supported versions

Only the latest code on the `main` branch is supported with security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Instead, report privately via one of:

- **GitHub private vulnerability reporting** —
  [Report a vulnerability](https://github.com/QuinntyneBrown/TwinkleTune/security/advisories/new)
- **Email** — quinntynebrown@gmail.com with "TwinkleTune security" in the
  subject line

Please include:

- A description of the issue and its impact
- Steps to reproduce (a minimal example helps)
- Browser/device details if relevant

You can expect an acknowledgement within a few days. Please allow a
reasonable window to fix the issue before any public disclosure.

## Scope

Reports especially welcome:

- Anything that could exfiltrate data (audio, voice range, progress) off the
  device
- Cross-site scripting or content injection in the app or service worker
- Weaknesses in the parent gate for the Grown-Ups Corner
- Supply-chain issues in the (small) dependency set

Out of scope: issues requiring physical access to an unlocked device, and
vulnerabilities in third-party hosting platforms.
