# TwinkleTune design system

Extracted from [docs/mocks](../mocks/README.md) on 2026-11-09 with the `extracting-design-systems`
skill. Open [index.html](index.html) locally (no server, no build, no network).

The system is the mocks' visual language written down once: 12 foundations,
54 components with every state in both themes, and 8 patterns. The mocks now load
their tokens and component styles from here (`docs/mocks/assets/tokens.css` and `ui.css` import
this folder's files), so a change here shows up in every mock.

Class names are the mocks' and the app's (`.btn`, `.btn-pink`, `.chip.active`, `.modal` …): they
are a contract with the Playwright page objects in `e2e/pages/` and are kept as they are.

The app (`frontend/src/styles/`) still uses the pre-extraction values. Adopting these tokens there,
including the contrast fixes below, is a production change and needs its own requirement, design
and acceptance tests (AGENTS.md).

## Foundations

| Page | Covers |
|---|---|
| [Color](foundations/color.html) | Brand ramps, semantic roles, both themes and every contrast pair. |
| [Typography](foundations/typography.html) | Baloo 2 and Nunito, the type scale, weights and role shorthands. |
| [Spacing](foundations/spacing.html) | The 4px scale and the inside/between rules. |
| [Layout](foundations/layout.html) | The one-column child screen, breakpoints, grid, gutters and margins. |
| [Elevation](foundations/elevation.html) | Soft blue shadows, the toy lip, surfaces and z-order. |
| [Shape](foundations/shape.html) | Radii from 4px to full, and border widths. |
| [Motion](foundations/motion.html) | Durations, springy easings, entrances and reduced motion. |
| [Iconography](foundations/iconography.html) | Emoji as the icon set, sizes and labelling rules. |
| [Theming](foundations/theming.html) | Sky studio and night studio, token tiers, adding a theme. |
| [Responsive](foundations/responsive.html) | Mobile first, one column, touch rules and the test matrix. |
| [Accessibility](foundations/accessibility.html) | The WCAG 2.2 AA commitments every component keeps. |
| [Content](foundations/content.html) | Encouragement-only voice, casing, numbers and microcopy. |

## Components

| Component | Group | Variants | States | Source mocks |
|---|---|---|---|---|
| [Button](components/button.html) | Actions | Blue, White, Pink, Gold, Danger | Default, Hover, Focus, Pressed, Disabled, Busy | [dialogs/confirm-reset/default](../mocks/dialogs/confirm-reset/default.html), [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/pause/default](../mocks/dialogs/pause/default.html) |
| [Icon button](components/icon-button.html) | Actions | Round, Row, Mini | Default, Hover, Focus, Pressed, Disabled | [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [index](../mocks/index.html), [pages/me/default](../mocks/pages/me/default.html) |
| [Link](components/link.html) | Actions | Quiet (link), Quiet (button) | Default, Hover, Focus, Pressed, Disabled | [dialogs/confirm-reset/default](../mocks/dialogs/confirm-reset/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [dialogs/tip/default](../mocks/dialogs/tip/default.html) |
| [Menu](components/menu.html) | Actions | Action, Danger | Default, Hover, Focus, Pressed, Disabled, Checked | [dialogs/avatar-manager/default](../mocks/dialogs/avatar-manager/default.html), [dialogs/confirm-delete-song/default](../mocks/dialogs/confirm-delete-song/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html) |
| [Text field](components/text-field.html) | Inputs | Child, Grown-up, Room code | Empty, Filled, Hover, Focus, Invalid, Disabled, Read-only | [dialogs/avatar-editor/default](../mocks/dialogs/avatar-editor/default.html), [dialogs/singer-editor/default](../mocks/dialogs/singer-editor/default.html), [dialogs/singer-editor/invalid](../mocks/dialogs/singer-editor/invalid.html) |
| [Textarea](components/textarea.html) | Inputs | Default, Hover, Focus, Invalid, Disabled, Read-only | Example | [dialogs/song-editor/default](../mocks/dialogs/song-editor/default.html), [dialogs/song-editor/edit](../mocks/dialogs/song-editor/edit.html), [dialogs/song-editor/failed](../mocks/dialogs/song-editor/failed.html) |
| [Select](components/select.html) | Inputs | Child, Medium, Small | Default, Hover, Focus, Invalid, Disabled | [dialogs/song-editor/default](../mocks/dialogs/song-editor/default.html), [dialogs/song-editor/edit](../mocks/dialogs/song-editor/edit.html), [index](../mocks/index.html) |
| [Checkbox](components/checkbox.html) | Inputs | Unchecked, Checked, Indeterminate | Default, Hover, Focus, Invalid, Disabled | [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [index](../mocks/index.html) |
| [Radio group](components/radio-group.html) | Inputs | Not chosen, Chosen, Card, chosen | Default, Hover, Focus, Disabled | [dialogs/song-editor/default](../mocks/dialogs/song-editor/default.html), [index](../mocks/index.html), [pages/profiles/default](../mocks/pages/profiles/default.html) |
| [Switch](components/switch.html) | Inputs | Off, On | Default, Hover, Focus, Disabled | [dialogs/confirm-reset/default](../mocks/dialogs/confirm-reset/default.html), [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [index](../mocks/index.html) |
| [Slider](components/slider.html) | Inputs | Lowest (−300 ms), Zero, Highest (+300 ms) | Default, Focus (tab here), Disabled | [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [index](../mocks/index.html) |
| [File upload](components/file-upload.html) | Inputs | Empty, Focus, Dragging, Chosen, Uploading, Failed | Drop zone, Notes | [dialogs/singer-editor/default](../mocks/dialogs/singer-editor/default.html), [dialogs/singer-editor/edit](../mocks/dialogs/singer-editor/edit.html), [dialogs/singer-editor/failed](../mocks/dialogs/singer-editor/failed.html) |
| [Form field](components/form-field.html) | Inputs | Default, Focus, Invalid, Success, Disabled, Read-only | Example, What changes | [dialogs/avatar-editor/default](../mocks/dialogs/avatar-editor/default.html), [dialogs/avatar-editor/invalid](../mocks/dialogs/avatar-editor/invalid.html), [dialogs/singer-editor/invalid](../mocks/dialogs/singer-editor/invalid.html) |
| [Form layout](components/form-layout.html) | Inputs | Default, Invalid, Busy, Failed | Example, Behaviour | [dialogs/avatar-editor/default](../mocks/dialogs/avatar-editor/default.html), [dialogs/singer-editor/edit](../mocks/dialogs/singer-editor/edit.html), [dialogs/song-editor/default](../mocks/dialogs/song-editor/default.html) |
| [Avatar picker](components/avatar-picker.html) | Inputs | Emoji | Default, Hover, Focus, Pressed, Picked, Picked + focus, Disabled | [dialogs/singer-editor/default](../mocks/dialogs/singer-editor/default.html), [dialogs/singer-editor/edit](../mocks/dialogs/singer-editor/edit.html), [dialogs/singer-editor/invalid](../mocks/dialogs/singer-editor/invalid.html) |
| [Number pad](components/number-pad.html) | Inputs | Answer key | Default, Hover, Focus, Pressed, Shake (other answer) | [dialogs/parent-gate/default](../mocks/dialogs/parent-gate/default.html), [dialogs/parent-gate/invalid](../mocks/dialogs/parent-gate/invalid.html), [index](../mocks/index.html) |
| [Top bar](components/top-bar.html) | Navigation | Back button, Quiet link, Action | Default, Hover, Focus, Pressed | [index](../mocks/index.html), [pages/duet/default](../mocks/pages/duet/default.html), [pages/profiles/default](../mocks/pages/profiles/default.html) |
| [Bottom nav](components/bottom-nav.html) | Navigation | Songs | Default, Hover, Focus, Current, Current + focus | [index](../mocks/index.html), [pages/duet/default](../mocks/pages/duet/default.html), [pages/home/default](../mocks/pages/home/default.html) |
| [Sidebar nav](components/sidebar-nav.html) | Navigation | Link | Default, Hover, Focus, Current, Current + focus | [dialogs/avatar-manager/default](../mocks/dialogs/avatar-manager/default.html), [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html) |
| [Tabs](components/tabs.html) | Navigation | Pill, Underline | Default, Hover, Focus, Selected, Selected + focus, Disabled | [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/song-board/default](../mocks/dialogs/song-board/default.html), [index](../mocks/index.html) |
| [Breadcrumb](components/breadcrumb.html) | Navigation | Item | Default, Hover, Focus, Current | [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/song-editor/edit](../mocks/dialogs/song-editor/edit.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html) |
| [Pagination](components/pagination.html) | Navigation | Page, Next | Default, Hover, Focus, Current, Disabled | [dialogs/song-board/default](../mocks/dialogs/song-board/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [index](../mocks/index.html) |
| [Stepper](components/stepper.html) | Navigation | 1 · Get ready, 2 · Lowest note, 3 · Highest note | Dots, Label, Mock | [dialogs/voice-found/default](../mocks/dialogs/voice-found/default.html), [index](../mocks/index.html), [pages/voice-setup/default](../mocks/pages/voice-setup/default.html) |
| [Skip link](components/skip-link.html) | Navigation | Default (hidden), Focus, Activated | Example, What happens | [dialogs/parent-gate/default](../mocks/dialogs/parent-gate/default.html), [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html) |
| [Card](components/card.html) | Containers | Static, Interactive | Default, Hover, Focus, Loading | [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html), [pages/home/empty](../mocks/pages/home/empty.html) |
| [Tile](components/tile.html) | Containers | Pink, White, Hero | Default, Hover (lift 2px), Focus, Pressed (shrink) | [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html), [pages/home/empty](../mocks/pages/home/empty.html) |
| [Dialog](components/dialog.html) | Containers | Default, Busy, Invalid, Failed, Loading | What changes, Example | [dialogs/confirm-reset/default](../mocks/dialogs/confirm-reset/default.html), [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [dialogs/mic-ask/default](../mocks/dialogs/mic-ask/default.html) |
| [Tooltip](components/tooltip.html) | Containers | Icon button, Pill | Hidden (default), Visible on hover, Visible on focus | [dialogs/tuned-for-you/default](../mocks/dialogs/tuned-for-you/default.html), [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html) |
| [Divider](components/divider.html) | Containers | — | Action | [dialogs/grown-ups-corner/default](../mocks/dialogs/grown-ups-corner/default.html), [index](../mocks/index.html), [pages/duet/default](../mocks/pages/duet/default.html) |
| [Container](components/container.html) | Containers | — | Action | [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html), [pages/profiles/default](../mocks/pages/profiles/default.html) |
| [List](components/list.html) | Data display | Tip card, List item | Default, Hover, Focus, Pressed, Selected | [dialogs/avatar-manager/default](../mocks/dialogs/avatar-manager/default.html), [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [dialogs/song-manager/failed](../mocks/dialogs/song-manager/failed.html) |
| [Song row](components/song-row.html) | Data display | Play, Mini button, Row | Default, Hover, Focus, Pressed | [index](../mocks/index.html), [pages/songs/default](../mocks/pages/songs/default.html), [pages/songs/empty](../mocks/pages/songs/empty.html) |
| [Table](components/table.html) | Data display | Data row, Ada | Default, Hover, Selected | [dialogs/song-board/default](../mocks/dialogs/song-board/default.html), [dialogs/song-board/empty](../mocks/dialogs/song-board/empty.html), [dialogs/song-board/failed](../mocks/dialogs/song-board/failed.html) |
| [Description list](components/description-list.html) | Data display | — | Action | [dialogs/song-manager/default](../mocks/dialogs/song-manager/default.html), [dialogs/voice-found/default](../mocks/dialogs/voice-found/default.html), [index](../mocks/index.html) |
| [Avatar](components/avatar.html) | Data display | Large | Emoji, Photo, Photo unavailable, Inside a link, focused | [dialogs/singer-editor/edit](../mocks/dialogs/singer-editor/edit.html), [index](../mocks/index.html), [pages/duet/lobby-ready](../mocks/pages/duet/lobby-ready.html) |
| [Pill](components/pill.html) | Data display | Find my voice | Default, Hover, Focus, Pressed, Disabled | [index](../mocks/index.html), [pages/profiles/default](../mocks/pages/profiles/default.html), [pages/sing/default](../mocks/pages/sing/default.html) |
| [Chip](components/chip.html) | Data display | Unselected, Selected | Default, Hover, Focus, Pressed, Disabled | [index](../mocks/index.html), [pages/songs/default](../mocks/pages/songs/default.html), [pages/songs/filtered](../mocks/pages/songs/filtered.html) |
| [Reward badge](components/reward-badge.html) | Data display | Perfect Ten | Earned, Still to earn, Just earned (Results) | [index](../mocks/index.html), [pages/me/default](../mocks/pages/me/default.html), [pages/me/empty](../mocks/pages/me/empty.html) |
| [Star rating](components/star-rating.html) | Data display | Inline | 1 star, 2 stars, 3 stars, No-mic | [dialogs/song-board/default](../mocks/dialogs/song-board/default.html), [index](../mocks/index.html), [pages/me/default](../mocks/pages/me/default.html) |
| [Progress ring](components/progress-ring.html) | Data display | 3 songs | Start of day, 1 song, 2 songs, Complete | [index](../mocks/index.html), [pages/home/default](../mocks/pages/home/default.html), [pages/home/empty](../mocks/pages/home/empty.html) |
| [Week streak](components/week-streak.html) | Data display | Disc, Classes | Idle, Done, Today, not sung yet, Today, sung | [index](../mocks/index.html), [pages/me/default](../mocks/pages/me/default.html), [pages/me/empty](../mocks/pages/me/empty.html) |
| [Coach bubble](components/coach-bubble.html) | Singing | Explaining, Instructing (live), Cheering, Gentle nudge, Celebrating | Example, When | [index](../mocks/index.html), [pages/duet/default](../mocks/pages/duet/default.html), [pages/home/default](../mocks/pages/home/default.html) |
| [Pitch stage](components/pitch-stage.html) | Singing | Note bar, Singer's star, Streak chip, Cheer | Default, Now / active, Landed / on note, Quiet / hidden | [index](../mocks/index.html), [pages/sing/countdown](../mocks/pages/sing/countdown.html), [pages/sing/default](../mocks/pages/sing/default.html) |
| [Lyrics](components/lyrics.html) | Singing | Syllable, Class | Upcoming, Now, Sung | [index](../mocks/index.html), [pages/sing/countdown](../mocks/pages/sing/countdown.html), [pages/sing/default](../mocks/pages/sing/default.html) |
| [Voice ladder](components/voice-ladder.html) | Singing | Rung | Idle, Lit (passed), Now, Captured | [dialogs/mic-denied/default](../mocks/dialogs/mic-denied/default.html), [dialogs/voice-found/default](../mocks/dialogs/voice-found/default.html), [index](../mocks/index.html) |
| [Duet code](components/duet-code.html) | Singing | Code field | Empty, Hover, Focus, typing, Full, Invalid, Disabled | [index](../mocks/index.html), [pages/duet/error](../mocks/pages/duet/error.html), [pages/duet/join](../mocks/pages/duet/join.html) |
| [Toast](components/toast.html) | Feedback | White, Gold, Pink | Entering / shown, Leaving (.bye), Stays for | [dialogs/singer-editor/failed](../mocks/dialogs/singer-editor/failed.html), [dialogs/singer-editor/invalid](../mocks/dialogs/singer-editor/invalid.html), [index](../mocks/index.html) |
| [Alert](components/alert.html) | Feedback | Info, Success, Warning, Gentle, Danger | Message only, With title, With action, Dismissible | [dialogs/mic-denied/default](../mocks/dialogs/mic-denied/default.html), [dialogs/song-editor/failed](../mocks/dialogs/song-editor/failed.html), [dialogs/song-editor/invalid](../mocks/dialogs/song-editor/invalid.html) |
| [Inline message](components/inline-message.html) | Feedback | Hint, Error, Success | Field default, Field focused, Field invalid, Field disabled | [dialogs/avatar-editor/invalid](../mocks/dialogs/avatar-editor/invalid.html), [dialogs/singer-editor/invalid](../mocks/dialogs/singer-editor/invalid.html), [dialogs/song-editor/invalid](../mocks/dialogs/song-editor/invalid.html) |
| [Progress bar](components/progress-bar.html) | Feedback | Blue, Gold, Pink | Empty (0%), Partway, Full (100%), Animating in, Indeterminate | [index](../mocks/index.html), [pages/me/default](../mocks/pages/me/default.html), [pages/me/empty](../mocks/pages/me/empty.html) |
| [Spinner](components/spinner.html) | Feedback | Who's singing, Button | Waiting, Taking longer (after 5s), Done, Could not load | [dialogs/avatar-manager/loading](../mocks/dialogs/avatar-manager/loading.html), [dialogs/song-board/loading](../mocks/dialogs/song-board/loading.html), [dialogs/song-manager/loading](../mocks/dialogs/song-manager/loading.html) |
| [Skeleton](components/skeleton.html) | Feedback | Song manager | Loading, Loaded, Nothing there, Could not load | [dialogs/avatar-manager/loading](../mocks/dialogs/avatar-manager/loading.html), [dialogs/song-board/loading](../mocks/dialogs/song-board/loading.html), [dialogs/song-manager/loading](../mocks/dialogs/song-manager/loading.html) |
| [Empty state](components/empty-state.html) | Feedback | Who's singing, Songs I shine at, Song board | Loading, Empty, Has content, Server unreachable | [dialogs/song-board/empty](../mocks/dialogs/song-board/empty.html), [index](../mocks/index.html), [pages/duet/error](../mocks/pages/duet/error.html) |
| [Error page](components/error-page.html) | Feedback | Offline, Something broke | Default, Action hover, Action focus, Checking again, Recovered | [dialogs/mic-denied/default](../mocks/dialogs/mic-denied/default.html), [index](../mocks/index.html), [pages/duet/error](../mocks/pages/duet/error.html) |

## Patterns

| Pattern | Covers |
|---|---|
| [Forms](patterns/forms.html) | Grown-up forms: layout, validation timing, the validation box, submit states. |
| [Feedback and loading](patterns/feedback-and-loading.html) | Which feedback for which moment, and how loading looks. |
| [Empty and error states](patterns/empty-and-error-states.html) | Copy formulas and fail-soft rules. |
| [Navigation and page structure](patterns/navigation.html) | Bottom nav, top bar, back behaviour, one action per screen. |
| [Dialogs and overlays](patterns/dialogs-and-overlays.html) | When to use a dialog, the parent gate, stacking. |
| [Data tables and lists](patterns/data-tables-and-lists.html) | Song lists, managers and family high scores. |
| [Notifications](patterns/notifications.html) | Toasts: which look, timing, stacking. |
| [Content and tone](patterns/content-and-tone.html) | Encouragement only: voice, words, microcopy library. |

## Tokens

- [`tokens/tokens.css`](tokens/tokens.css): the single source of truth. Primitives (`--palette-*`, `--font-*`), semantic tokens (`--color-*`, `--gradient-*`, `--space-*`, `--size-*`, `--radius-*`, `--shadow-*`, `--lip-*`, `--duration-*`, `--ease-*`, `--z-*`, `--layout-*`, `--target-*`), light (“sky studio”) and dark (“the studio at night”) themes, reduced-motion, more-contrast and forced-colours overrides.
- [`tokens/tokens.json`](tokens/tokens.json): DTCG export generated from `tokens.css` (dark values under `$extensions`).
- [`tokens/contrast-pairs.json`](tokens/contrast-pairs.json): every foreground/background pairing the components rely on, checked in both themes.
- [`assets/components.css`](assets/components.css): the component styles, token-only, with `data-state` hooks for documentation.
- `assets/ds.css`, `assets/ds.js`: documentation-site chrome only.

Light is the product as it ships. Dark is defined for every token but not implemented in the app.

## Drift found in the mocks

| ID | Mock | Issue | Resolution |
|---|---|---|---|
| D01 | every mock with `.btn`, `.play`, `.chip.active` | White label on brand blue `#5EA8DA` was 2.60:1. | Accent moved to `--palette-sky-600` (4.75:1); brand blue kept as `--color-accent-graphic` for fills and rings. |
| D02 | all pages (secondary text, tagline, meta) | `--ink-soft` was 3.82:1 on white and 2.68:1 on the sky. | `--color-fg-muted` = `--palette-ink-600` (6.56:1 / 4.60:1). |
| D03 | welcome, sing, me, dialogs with inputs | Placeholders and the stage label (`--ink-faint`, 1.71:1), lyric context lines (`--ink-ghost`) and locked badge names (`--ink-locked`, 2.14:1) failed text contrast. | All use `--color-fg-subtle` (≥ 4.66:1 on every surface). |
| D04 | welcome, sing, tips, songs, profiles | Blue text (wordmark, sung words, tip minutes, mini buttons, profile tag, countdown) was 2.6:1. | `--color-fg-accent` = `--palette-sky-700` (6.9:1 on cards, 4.84:1 on the sky). |
| D05 | songs, results, tips, toasts | Pink ink on pink was 3.61:1; the soft pink ink was lower. | `--color-gentle-fg` = `--palette-pink-700` (4.58:1); the soft variant is retired. |
| D06 | songs, sing | “In your key” mint ink was 4.39:1. | `--palette-mint-700` (5.59:1). |
| D07 | welcome, singer/song/avatar editors | Field edges in `--pale` were 1.37:1 against the input well (1.4.11). | Controls use `--color-border-strong` (3.70:1); dashed add-cards stay decorative on `--color-border-decor`. |
| D08 | every mock, dark theme | The night canvas (`#173759`) was lighter than its cards, so surfaces sank. | Canvas `--palette-night-900`; surfaces rise from night-800 to night-700. |
| D09 | assets/tokens.css | Twelve near-duplicate tints (five within 2% of each other). | Collapsed into sky-25, sky-50, sky-100 and gold-100. |
| D10 | pills, weekday letters, stage label, ladder label, profile tag | 37 font sizes from 10.5px to 110px, five of them below 12px. | A 12-step scale; nothing below 12px. |
| D11 | assets/ui.css | 35 spacing steps, most off the 4px grid (6, 10, 14, 18, 22, 26, 30, 34, 46px). | Snapped to the 4px scale (6/10→8, 14/18→16, 22→20, 26→24, 30/34→32, 46→48). |
| D12 | assets/ui.css | 14 corner radii between 4px and 32px. | xs 4, sm 8, md 16, lg 24, xl 32, full. |
| D13 | assets/ui.css | Seven drop shadows, five rings and glows in twelve colours. | Four elevation levels, two glows, two rings and three lip depths. |
| D14 | assets/ui.css | 41 distinct durations. | Five interaction durations plus stagger, progress, pulse, ambient and drift. |
| D15 | dialogs/* | `role="dialog"` without `aria-modal="true"`; no stated focus contract. | Dialog contract: `aria-modal`, labelled by its title, focus moves in, `Esc` closes, focus returns. |
| D16 | notifications/toast/* | The toast host is not a live region, so toasts are never announced. | `.toast-host` gets `role="status" aria-live="polite"`. |
| D17 | welcome, singer-editor | Avatar choices are named only by `title` and selected only by the `.picked` class. | `aria-label` + `aria-pressed` inside `role="group"`; `[aria-pressed=true]` styles the same as `.picked`. |
| D18 | songs, tips | Difficulty chips use `role="tab"` with no tab panel. | Documented as filter chips with `aria-pressed` (recommended), or full Tabs with `aria-controls`. |
| D19 | dialogs/song-editor/failed | Shows the raw browser message “Failed to fetch”. | Grown-up copy that says what happened and what to do next; the draft is kept. |
| D20 | assets/ui.css | Hover was `filter: brightness(1.05)`: invisible on pastels and wrong in dark. | Token hover backgrounds (`--btn-bg-hover` and friends). |
| D21 | every mock | The focus ring in `--blue` was 2.6:1 on white. | `--color-focus-ring` (4.75:1 on cards, 3.33:1 on the sky). |
| D22 | home, sing, results, me | The progress fill end against its track was 2.25:1. | Fill ends on `--color-border-strong` (3.3:1); the value is always also given in words. |
| D23 | songs, home | Mini buttons (🏆, Duet) and the tip arrow are smaller than the 52px child target. | Kept ≥ 24px with ≥ 8px between; the tip arrow grows to 44px. |
| D24 | every mock with `.link-quiet` | Quiet links were underlined with decorative pale dots. | Dotted underline in `--color-border-strong`, solid on hover. |
| D25 | profiles, me | The singing profile and today's disc were marked by a colour ring alone. | Keep the text tag (“SINGING NOW ⭐”) and `aria-current` alongside the ring. |
| D26 | every page with the bottom nav, me | Decorative emoji in nav items, badges and rows are read aloud (no `aria-hidden`). | Emoji that repeat a word are wrapped in `aria-hidden="true"`; emoji that carry meaning get a label. |
| D27 | welcome, singer-editor | The singer name field has no `autocomplete` hint. | `autocomplete="given-name"` on singer name fields (1.3.5). |
| D28 | sing (Frère Jacques) | French lyrics carry no `lang`, so screen readers mispronounce them. | Lyric lines of a song in another language carry `lang` (3.1.2). |
| D29 | notifications/toast, grown-up managers | Grown-up failure toasts dismiss themselves before they can be read. | Failures persist until dismissed, or move into the dialog's validation box; only good news auto-dismisses. |
| D30 | me, results | A locked badge dimmed the whole card to 62% opacity, pulling its name below 4.5:1. | Only the disc greys out; the card sits on glass and the name stays at full `--color-fg-subtle` contrast. |
| D31 | results | The result stars' `aria-label` sits on a plain ``, which screen readers ignore. | `role="img"` with a label in words (“2 of 3 stars”). |
| D32 | voice-setup | The step dots' `aria-label="Progress"` sits on a plain `` and is never announced. | `role="img"` labelled “Step 2 of 3: low notes”. |
| D33 | dialogs/* | The skip link stays focusable behind an open dialog, pointing at content that is inert. | Everything outside the dialog, skip link included, is inert while it is open; dialogs are named by `aria-labelledby` on their title (the parent gate's label and title disagreed). |
| D34 | dialogs/parent-gate/invalid | The shake is the only feedback when another answer is tapped, and reduced motion removes it. | A visually hidden `role="status"` line says “Try another answer”. |

Some example copy on the pages for components the mocks do not have yet (menu items, tab labels, sidebar groups, art-style names, sample settings, grown-up error messages, the no-results and error-page lines) is proposed, not shipped text; review it with the encouragement test before using it.

## Verification

Run on 2026-11-09 from the repository root.

| Check | Command | Result |
|---|---|---|
| Structure, sections, labels, links, no raw colour | `python .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system` | 75 pages (54 components, 8 patterns), 0 errors, 0 warnings |
| Contrast, both themes | `python .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css` | 116 passed, 0 failed, 0 unresolved (58 pairs × 2 themes) |
| DTCG export | `python .claude/skills/extracting-design-systems/scripts/tokens_to_json.py docs/design-system/tokens/tokens.css` | `tokens/tokens.json` written |
| Mocks still valid on the system's CSS | `python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks` | 29 screens, 92 mocks, 0 errors, 0 warnings |
| Token coverage | script: every `:root` token in a `data-token` cell on exactly one foundation page | 286 of 286, no duplicates |
| Reflow at 360px, live contrast, script errors | headless Chromium over all 75 pages, light and dark | no page-level horizontal overflow; no live `data-contrast` pair below its minimum; no page errors |

Screenshots reviewed (`.cache/shots`, not committed): `index.html`, Button, Dialog, Song row, Pitch stage, Color and the Forms pattern at 360 and 1280px in both themes, plus the mocks Home, Sing, Results and the singer editor before and after pointing them at the system. Fixes made from the review: wide doc tables now scroll in place on phones; nested `[data-theme="light"]` wrappers now restore light tokens inside a dark page; the bottom nav keeps its product width inside example stages; doc `h3` styles no longer override dialog titles.

Known differences between the mocks and the shipped app: the mocks now render the corrected values above (deeper button blue, darker muted and subtle text, 4px spacing, 12px type floor). `frontend/src/styles/` still has the pre-extraction values.
