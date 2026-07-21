---
name: create-twinkletune-design-book
description: Generate and validate TwinkleTune's branded, production-reading engineering handbook PDF from docs/detailed-designs. Use when asked to create, regenerate, update, reproduce, or audit the project's consolidated software design documentation PDF, including feature narratives, L1/L2 traceability, C4/class/sequence figures, page-numbered contents, PDF bookmarks, running navigation, and brand styling.
---

# Create the TwinkleTune Design Book

Build the complete handbook with the bundled deterministic pipeline. Preserve the detailed-design sources; publish only after both structural and visual validation pass.

## Run the workflow

1. Locate the TwinkleTune repository root and confirm `docs/detailed-designs`, `e2e/package-lock.json`, and the assets in this skill exist.
2. Check the pinned toolchain:
   - Python 3.11 with the versions in `scripts/requirements.txt`
   - Pandoc 3.9
   - Playwright 1.60.0 installed from `e2e/package-lock.json`
   - Playwright's bundled Chromium installed locally
3. Install only missing pinned dependencies:

   ```powershell
   python -m pip install -r .codex/skills/create-twinkletune-design-book/scripts/requirements.txt
   Push-Location e2e
   npm ci
   npx playwright install chromium
   Pop-Location
   ```

4. Generate the default publication:

   ```powershell
   python .codex/skills/create-twinkletune-design-book/scripts/build_design_book.py --repo-root .
   ```

   The default output is `docs/TwinkleTune-Engineering-Design-Handbook.pdf`. Use `--output <path>` only when the user requests another filename. Use `--keep-build` only to diagnose intermediate Markdown, HTML, or raw PDF output.

5. Require the final JSON report to complete successfully. Report its page count, portrait/landscape counts, bookmarks, links, source-design count, source-diagram count, requirement-row count, literal-placeholder and review-marker counts, Header/Footer artifact counts, fingerprint-footer count, tagged-figure/alternative-text counts, fingerprinted-file count, and build-input fingerprint.
6. Render and inspect representative PDF pages: cover; handbook profile; system map; production-review notes; first and last contents pages; all 13 area openers; at least one feature opener; a dense requirements table; a tall C4 figure; a wide sequence/class figure; and the final page.

## Preserve reproducibility

- Keep the explicit `DOMAIN_SPECS` chapter manifest in `scripts/build_design_book.py`. If the source tree changes, update the manifest deliberately; do not replace it with incidental directory enumeration.
- Keep the authored README content and existing PNG/PlantUML pairs unchanged. The source gate requires exact README coverage, unique image references, PNG/PUML parity, and preservation of literal angle-bracket placeholders outside code spans.
- Use the repository-pinned Playwright and its bundled Chromium. Do not substitute a moving system Chrome or Edge build.
- Use the vendored Baloo 2 and Manrope font assets. Do not load live web fonts.
- Keep the two-pass render. The pagination pass locates every `AREA` and `DESIGN` marker; the final pass writes stable page numbers into the clickable contents section.
- Keep wide figures on named A4 landscape pages and smaller figures at intrinsic size within A4 portrait pages.
- Surface `<TO SUPPLY>` markers and duplicate requirement identifiers as review evidence. Do not silently reconcile or remove them.
- Treat the build-input fingerprint as a digest of the detailed-design READMEs, PNGs, PlantUML sources, brand assets, pinned package manifests, generator code, stylesheet, and vendored fonts.
- Keep the final full re-inventory immediately before publication. It catches added, removed, renamed, or modified inputs that appear while a long render is running.
- Expect content, pagination, links, bookmarks, and rendering to reproduce under the pinned toolchain. Do not promise a byte-identical PDF because PDF timestamps and serialization can vary between runs.

## Interpret failures

- Treat a manifest mismatch as a real source-set change. Inspect the added, removed, or renamed feature before updating `DOMAIN_SPECS`.
- Treat a browser image-count mismatch as a failed build. The renderer retries partial DOM loads, then stops rather than printing an incomplete handbook.
- Treat missing tags, figure alternative text, pagination artifacts, bookmarks, metadata, fonts, links, markers, orientations, literal placeholders, or image objects as a publication failure.
- Preserve the last validated PDF when diagnosing a failed regeneration. Use a temporary `--output` path if experimentation could replace it.
- When retaining intermediates, resolve any existing `<output-stem>-build` directory before rendering; never discover that conflict after publishing the PDF.

## Hand off the publication

Link the final PDF and this `SKILL.md`. State that the PDF is searchable, tagged, bookmarked, page-numbered, mixed-orientation, and generated from the validated build-input fingerprint only when the final JSON report proves those properties.
