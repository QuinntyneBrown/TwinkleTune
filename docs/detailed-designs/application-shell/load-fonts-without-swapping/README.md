# Load Fonts Without Swapping

## Overview

TwinkleTune is drawn in two typefaces: **Baloo 2** for display text (screen
titles, song names, buttons) and **Nunito** for body text. Until this feature
existed, both arrived from Google Fonts at runtime, which meant a page was
painted first in whatever the device already had and then repainted in the real
typeface once the download finished. On an iPhone that repaint is unmissable —
the headings start out as a thin copperplate script and snap into a fat rounded
sans a moment later, and it happens again on later visits.

This feature removes the repaint entirely. The fonts are served from
TwinkleTune's own origin, their `@font-face` rules are declared inline in the
document head, the two most-used files are preloaded, and the faces are
declared `font-display: optional` — the one loading mode that forbids the
browser from swapping a typeface after text has been painted. A page therefore
paints once, in one font, and stays that way for its whole life.

The terms below are used throughout.

- webface — font the page downloads, as opposed to one already installed on the
  device
- fallback — installed font used for text whose webface is not available
- FOUT — *flash of unstyled text*; text painted in the fallback and then
  repainted in the webface
- FOIT — *flash of invisible text*; text held invisible while its webface loads
- block period — short window at the start of a font's load during which a
  browser will hold text invisible rather than paint it in the fallback
- swap period — window after the block period during which a browser will still
  replace the fallback with the webface once it arrives
- `font-display` — the descriptor that sets the length of those two periods
- subset — slice of a font covering one range of characters, e.g. `latin`
- variable font — single file carrying a continuous weight axis instead of one
  file per weight
- metric overrides — `size-adjust`, `ascent-override`, `descent-override` and
  `line-gap-override`, which re-scale a fallback so it occupies the same space
  as the webface it stands in for

Offline caching in general is covered by
[Cache For Offline](../cache-for-offline/README.md); this feature adds the font
files to that worker's pre-cache list and gives them their own branch in its
`fetch` handler.

## The problem

The old markup was two lines in `frontend/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:…&display=swap" rel="stylesheet">
```

Five separate faults combined to make the swap loud and repeated.

**1. `display=swap` asks for the swap.** `swap` means *zero block period,
infinite swap period*: paint immediately in the fallback, and replace it with
the webface no matter how late it turns up. That is a deliberate trade — it
favours reading the text early over reading it in the right font — and its
visible cost is exactly the flicker in the screenshot.

**2. The fallback was a script font.** The display stack was:

```css
--font-display: "Baloo 2", "Comic Sans MS", cursive;
```

No iPhone ships Comic Sans MS, so iOS resolved the stack to the generic
`cursive`, which on iOS is **Snell Roundhand** — a formal copperplate script.
Baloo 2 is a heavy rounded sans. The two fonts share no weight, width, or
skeleton, so the swap changed every line's shape *and* its wrapping. The body
stack had a milder version of the same bug: `"Segoe UI"` is a Windows font, so
iOS fell through to a generic sans.

**3. The download took three round trips.** The document had to be parsed to
find the `<link>`, then `fonts.googleapis.com` had to be resolved and connected
to and asked for a stylesheet, then that stylesheet had to be parsed to learn
the `fonts.gstatic.com` URLs, then *that* host had to be resolved and connected
to. Only `fonts.googleapis.com` was preconnected, so the second origin paid a
full DNS + TCP + TLS handshake from cold. On a phone on cellular this is
comfortably long enough to paint several screens in the fallback.

**4. The service worker could not cache them.** `sw.js` caches a response only
when `res.ok` is true. A cross-origin font fetched without CORS produces an
*opaque* response whose `ok` is `false`, so Google's fonts were never written to
the cache. Every visit re-fetched them over the network — which is why the
swap kept happening rather than settling after the first load. iOS Safari
evicts its own HTTP cache aggressively under memory pressure and re-runs pages
restored from the back/forward cache, so in practice the flicker recurred all
day.

**5. Nothing was preloaded.** Even the first byte of font data could not be
requested until the Google stylesheet had arrived and been parsed.

## The options

| Option | Never swaps? | Cost |
|---|---|---|
| `font-display: swap` (the old behaviour) | No — swapping is its defined behaviour | — |
| `font-display: fallback` | No — still swaps inside a ~3 s window | — |
| `font-display: block` | No — swaps out of *invisible* text instead of out of the fallback | Up to 3 s of blank headings |
| Preload only, keep `swap` | No — shortens the swap, does not remove it | — |
| Block rendering until `document.fonts.ready` | No — same as `block`, hand-rolled | Blank app on a slow link; a failed fetch blanks it forever |
| **`font-display: optional` + self-host + preload** | **Yes** | On a cold, slow first load the page may render in the fallback for that page view |

Only `optional` gives a *guarantee* rather than a shorter window. It sets a
~100 ms block period and **no swap period at all**: if the webface is not ready
when that window closes, the browser paints the fallback and keeps it for the
rest of the page's life, quietly finishing the download for next time. Nothing
the network does afterwards can cause a repaint.

The guarantee is only useful if the font is nearly always ready inside 100 ms,
which is what the rest of the feature buys: same-origin files (no extra DNS,
TCP, or TLS), rules inline in the head (no stylesheet round trip before the
request starts), `rel="preload"` (the request is issued in the first few
milliseconds of parsing), and a service-worker pre-cache (on every visit after
the first, the bytes are already local and the window is met trivially). The
residual case — a genuinely cold first load on a slow link — renders in a
fallback that has been metric-matched to Baloo 2 and Nunito, so it is a
different font at the same size and on the same baseline grid rather than a
different-looking page.

## Description

The feature is realized by `frontend/index.html`, `frontend/public/fonts/`,
`frontend/src/styles/twinkle.css` and `frontend/public/sw.js` for the app, and
by the equivalent files in `marketing/` for the landing page. No backend logic
participates.

- **Font files** — `frontend/public/fonts/` holds four woff2 files:
  `baloo2-v23-latin.woff2`, `baloo2-v23-latin-ext.woff2`,
  `nunito-v32-latin.woff2` and `nunito-v32-latin-ext.woff2`, about 135 KB in
  total. Each is a *variable* font carrying its family's whole weight axis
  (Baloo 2 `400 800`, Nunito `400 900`), so the four files replace what would
  otherwise be nine static weights. The Google Fonts version (`v23`, `v32`) is
  part of the filename, which makes the URL immutable and lets it be cached for
  a year. `marketing/assets/fonts/` holds the same four files for the landing
  page.
- **Inline `@font-face` block** — a `<style>` element in the `<head>` of both
  `frontend/index.html` and `marketing/index.html`. It declares the four real
  faces with `font-display: optional`, relative `url()`s, and the same
  `unicode-range` values Google publishes, so the `latin-ext` file is fetched
  only when a page actually contains an extended-latin character. The rules are
  inline rather than in a stylesheet so that they exist before any other
  resource has been fetched.
- **Preload links** — two `<link rel="preload" as="font" type="font/woff2"
  crossorigin>` elements per page, for the two `latin` files. `crossorigin` is
  required even same-origin, because font fetches are made in CORS mode and a
  preload without it would be discarded and the file fetched twice.
- **Fallback faces** — two further `@font-face` rules, `"Baloo 2 Fallback"` and
  `"Nunito Fallback"`, whose only sources are `local()` lookups
  (`Helvetica Neue`, `Arial`, `Segoe UI`, `Roboto`, covering iOS, macOS,
  Windows and Android). They carry metric overrides derived from the real
  fonts' own tables — Baloo 2 has x-height `.460`, ascent `1.078` and descent
  `.524`; Nunito has `.484`, `1.011` and `.353` — measured against a system-sans
  x-height of about `.52`. That yields `size-adjust: 88.5%` with ascent/descent
  overrides of `121.8%`/`59.2%` for Baloo 2, and `93.1%` with `108.6%`/`37.9%`
  for Nunito. A fallback rendering therefore keeps the same apparent size and
  the same line boxes, so nothing on the page shifts.
- **Font stacks** — `--font-display` and `--font-body` in
  `frontend/src/styles/twinkle.css`, and `--display` and `--body` in
  `marketing/assets/twinkletune.css`, now read
  `"Baloo 2", "Baloo 2 Fallback", system-ui, -apple-system, "Segoe UI", sans-serif`
  and the Nunito equivalent. `cursive` is deliberately gone: it was the reason
  the iPhone fell back to Snell Roundhand.
- **`PRECACHE`** — a new module constant in `frontend/public/sw.js` listing the
  four font paths. The `install` handler passes it to `cache.addAll` inside
  `event.waitUntil` before calling `self.skipWaiting()`; a rejection is
  swallowed, so a cold cache degrades to the ordinary fetch path rather than
  failing the install. `CACHE` moves to `'twinkletune-v2'` so the new generation
  replaces the old one.
- **Font branch in the `fetch` handler** — requests whose
  `request.destination === 'font'` are answered from the cache when an entry
  exists and are not revalidated in the background. Because the filenames carry
  a version, a cached entry can never be stale, and skipping the background
  fetch keeps the network off the critical path of a first paint.
- **Host headers** — `marketing/staticwebapp.config.json` serves `/app/fonts/*`
  and `/assets/fonts/*` with `cache-control: public, max-age=31536000,
  immutable`, and declares `.woff2` as `font/woff2`. Its
  `content-security-policy` drops `https://fonts.gstatic.com` from `font-src`
  and `https://fonts.googleapis.com` from `style-src`, both of which are now
  unused; the policy is `font-src 'self'`.

The app and the landing page are deployed from one Azure Static Web App — the
landing page at the root and the built app under `/app/` — so both are covered
by the one set of headers, and both had to move off Google Fonts before the
policy could be tightened.

## Requirements

This feature is a defect fix and a hardening pass over existing behaviour; it
mints no new requirement identifier. It serves `AS-L1-3` (a coherent look
across all screens) and `AS-L1-6` (a kid-first, accessible shell) by making
typography stable, and it strengthens `AS-L1-5` (work offline after first
visit) by removing the app's last third-party runtime dependency and adding the
fonts to the service worker's pre-cache.

## Verification

Loaded on an iPhone 13 viewport against the staged site, both `/` and `/app/`:

- font requests are `/app/fonts/baloo2-v23-latin.woff2` and
  `/app/fonts/nunito-v32-latin.woff2` (and the `/assets/fonts/` equivalents on
  the landing page) — the `latin-ext` files are correctly not fetched
- `document.fonts` reports `Baloo 2 400 800` and `Nunito 400 900` as `loaded`
- the total count of requests to any origin other than the site's own is zero
- with `**/*.woff2` aborted, both pages render in the metric-matched fallback
  with the layout intact, and no swap occurs when the block is lifted mid-page

`npm test` in `frontend/` passes (76 tests), and `npm run build` produces
`dist/fonts/` alongside the hashed asset bundle.
