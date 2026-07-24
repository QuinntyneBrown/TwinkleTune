# TwinkleTune Sticker Sheets

Print-ready promotional sticker sheets for handing out to kids (ages 5-9) at
events, in mailers, or alongside the app. Built with the same mascot artwork,
color palette, and typefaces (Baloo 2 / Manrope) as the marketing site and
in-app UI, so they read as unmistakably TwinkleTune.

## The sheets

| File | Theme | Stickers |
|------|-------|----------|
| `TwinkleTune-Stickers-1-Twinkle-and-Friends.pdf` | Twinkle mascot, round stickers | 12 |
| `TwinkleTune-Stickers-2-Stars-and-Sparkles.pdf` | Stars, music notes, and word bubbles | 20 |
| `TwinkleTune-Stickers-3-Practice-Awards.pdf` | Rosette-style practice/award badges | 6 |

Each is one US Letter (8.5in x 11in) page with dashed cut lines around every
sticker. Print on sticker/label paper (matte works well for crayon and marker)
at 100% scale ("Fit to page" can shrink the circles) with background graphics
enabled.

## Source files

- `sheet-*.html` — the source for each sheet (plain HTML/CSS/inline SVG, no
  build step).
- `stickers.css` — shared styles: brand color variables, page size, the
  Twinkle mascot's star-shape SVG classes.
- `fonts/` — local copies of the Baloo 2 and Manrope variable fonts (same
  files used by the engineering design handbook) so the PDFs render correctly
  offline, without depending on Google Fonts.
- `render.mjs` — a small Playwright script that opens each sheet in headless
  Chromium and exports it to PDF (and a PNG preview for quick review). It
  reuses the Chromium install already downloaded for the Playwright E2E
  suite (`e2e/node_modules`) rather than adding a second copy of the
  dependency.
- `preview-*.png` — quick-look screenshots of each sheet.

## Regenerating the PDFs

After editing a `sheet-*.html` file, re-run:

```sh
node docs/stickers/render.mjs
```

This requires the E2E workspace's dependencies to be installed once
(`cd e2e && npm install`), since it borrows that Playwright/Chromium install.
