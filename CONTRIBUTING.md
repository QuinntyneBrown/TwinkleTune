# Contributing to TwinkleTune ⭐

Thanks for your interest in making TwinkleTune better! Contributions of all
kinds are welcome — bug reports, fixes, new songs, accessibility improvements,
and documentation.

## Getting set up

```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
```

Before opening a pull request, make sure these both pass (run from `frontend/`):

```bash
npm test         # unit tests (scoring, store, badges, songs)
npm run build    # type-check + production build
```

## Project principles

TwinkleTune is built for young kids. Keep these in mind for any change:

- **Encouragement only.** There is no negative feedback anywhere in the app —
  no red X's, no "wrong", no scores that feel like failure. Tricky phrases
  become invitations to practice, never penalties.
- **One big obvious action per screen.** Few words, big rounded type, chunky
  toy-like buttons.
- **Privacy first.** All data stays in `localStorage`. No accounts, no
  analytics, and no audio ever leaves the device. Don't add network calls.
- **The mockups are the visual source of truth.** Check `docs/mocks/`
  (start at `docs/mocks/index.html`) before changing any UI.

## Adding songs

Songs are hand-encoded note data, not recordings, in `frontend/src/songs/`.
Only **public-domain** melodies can be accepted — please note the song's
provenance in your pull request.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep changes focused — one feature or fix per pull request.
3. Add or update unit tests for anything in `src/audio/`, `src/songs/`, or
   `src/state/`.
4. Make sure `npm test` and `npm run build` pass.
5. Open the pull request with a short description of what changed and why.

## Reporting bugs

Open a [GitHub issue](https://github.com/QuinntyneBrown/TwinkleTune/issues)
with steps to reproduce, what you expected, and what happened instead.
Browser and device details help a lot, since pitch detection behaves
differently across microphones.

For security issues, please **don't** open a public issue — see
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
