# TwinkleTune mocks

<!--
Cast and catalogue: reuse these in every mock so the story holds across screens.

Today      Thursday 12 November 2026
Ada        9, avatar 🦄, voice range B3–E5 (18 notes), Level 3 Fledgling, 760 sparkles,
           4-day streak (Mon–Thu), 1 of 3 songs sung today
           badges: First Song, 3-Day Streak, Show Stopper, Perfect Ten
           bests: Twinkle ★★★, Mary ★★★, Hot Cross Buns ★★☆, London Bridge ★★☆
Bea        7, avatar 🐱, brand new: no voice range, Level 1 Hatchling, nothing sung yet
Mum        avatar 🦊 plus a profile photo (assets/img/photo-mum.svg stands in for the upload)
Songbook   the seven bundled seed songs, plus one family-added song on the server: Frère Jacques 🔔
Avatars    🦄 Unicorn, 🐱 Kitten, 🐸 Frog, 🦊 Fox, 🐰 Bunny, 🐼 Panda, 🦖 Dino, 🐙 Octopus
Duet room  KWTM, Ada and Bea, singing Twinkle Twinkle Little Star
Shift      Ada's range moves Twinkle and London Bridge 3 notes higher
-->

Static HTML mocks of every TwinkleTune page, dialog and toast, one file per state. They are the
visual source of truth: a new or changed screen is mocked here before it is implemented.

The set follows the `writing-html-mocks` skill (`.claude/skills/writing-html-mocks/`): one token
file, one component kit, a manifest, a generated gallery and a generated coverage matrix.

**29 screens, 96 mocks:** 11 pages (47 states), 17 dialogs (43 states), 1 toast (6 states).

## Opening the mocks

Open [`index.html`](index.html) from disk. No server, no build, no network: the fonts are
self-hosted in `assets/fonts/`, as they are in the app.

| What | How |
|---|---|
| Move between the states of a screen | The floating mock bar at the bottom of every mock |
| Switch theme | `☾ Dark` in the mock bar, the `t` key, or `?theme=dark` |
| Follow a flow | Product buttons and links lead to the mock they open (Home → Songs → Sing → Pause → Results) |
| See the page exactly as the product | `?chrome=0`, or the `×` in the bar |
| Skip the entrance animations | `?motion=0` (automated browsers get this by default, so screenshots show settled screens) |

Yellow dashed **Note** boxes say what a static page cannot show: timers, animations, what a button
does next. On a wide window they sit to the right of the screen; on a phone, below it.

## Layout

```
docs/mocks/
  README.md                        this file; the coverage section is generated
  index.html                       gallery of every screen with state links (generated)
  manifest.json                    screens, states, routes and requirement IDs
  assets/
    tokens.css                     imports ../../design-system/tokens/tokens.css (the source of truth)
    ui.css                         imports ../../design-system/assets/components.css (the component kit)
    mock.css                       the mock bar and the notes (not product UI)
    mock.js                        theme, chrome and motion switches, click-through
    fonts/                         Baloo 2 and Nunito, the same files the app ships
    img/                           stand-in profile photo
  pages/<id>/<state>.html          one file per page state
  dialogs/<id>/<state>.html        one file per dialog state, shown over its page
  notifications/<id>/<state>.html  one file per toast state, shown on its page
```

## Cast and catalogue

Every mock uses the same family, on the same day.

| | |
|---|---|
| **Today** | Thursday 12 November 2026 |
| **Ada** (9, 🦄) | Voice range B3–E5, Level 3 Fledgling, 760 sparkles, a 4-day streak, one of three songs sung today. Four badges, four songs she shines at. |
| **Bea** (7, 🐱) | Brand new: no voice range, Level 1 Hatchling, nothing sung yet. She is the singer in every first-run and empty state. |
| **Mum** (🦊, with a photo) | The third singer on the family server. |
| **Songbook** | The seven bundled public-domain seed songs. The family server adds one family song, Frère Jacques 🔔. |
| **Duet** | Room `KWTM`: Ada and Bea singing Twinkle Twinkle Little Star. |

Durations, note counts, lyrics, syllables, badge names, level titles and every line of copy come
from the app's source (`frontend/src/songs/catalog.ts`, `state/`, `screens/`, `ui/`).

## How these mocks relate to the app

**The markup is the app's markup.** Each mock reproduces the DOM its screen module renders: the
same class names, the same accessible names, the same `data-*` hooks. The Playwright page objects
in `e2e/pages/` rely on that parity, so keep it when you change either side.

**The styles come from the design system.** The component kit began as a port of
`frontend/src/styles/twinkle.css` and `screens.css` (same selectors, same geometry) and was
extracted into [`docs/design-system`](../design-system/README.md) on 2026-11-09. `assets/tokens.css`
and `assets/ui.css` now only import `design-system/tokens/tokens.css` and
`design-system/assets/components.css`; change values there. Class names are unchanged. Extraction
corrected contrast, spacing, type and radius drift (see the design system's drift log), so the
mocks now show those corrected values while the app's stylesheets still carry the originals.

**Two themes, light by default.** Light is the product as it ships: a daytime "sky studio". Dark
is the same studio at night, defined in `tokens.css` because the skill asks every mock to work in
both themes; the app does not implement it (see Open questions). A mock always opens light, whatever
the operating system prefers, so what you see first is the shipped design.

**The mock bar** is the skill's floating pill at the bottom of the window. The app's own bottom
navigation lives in the same spot, so while the chrome is showing the navigation is lifted just
above the bar; with `?chrome=0` it sits where the product puts it.

**One column.** Every screen is the same centred column, at most 470 px wide, at every viewport.
The mocks are responsive in the way the app is: nothing rearranges at tablet or desktop width.

### The state matrix, for an encouragement-only, offline-first product

The skill asks every page for `default`, `loading`, `empty` and `error`, every dialog for
`default`, `busy` and `invalid`, and every notification for `info`, `success`, `warning` and
`danger`. TwinkleTune is offline-first and renders most screens straight from on-device state, so
many of those cannot occur. Each one that cannot is recorded in `manifest.json` under
`not_applicable` with its reason, and shows as ➖ in the matrix below. Typical reasons:

- **No loading:** the screen renders synchronously from `localStorage` or bundled data.
- **No error:** a failed server call falls back to cached or bundled data. The child never sees an error.
- **No busy:** the dialog's buttons act at once.

Toasts have three looks, not four. They map onto the skill's states like this:

| State | Toast | Used for |
|---|---|---|
| `info` | white | quiet confirmations: "Removed 💙" |
| `success` | gold | good news: sparkles, a captured note, a new family record |
| `warning` | pink | a gentle nudge that says what to try next |
| `danger` | pink | something did not work. Deliberately the same soft pink: no red, no "error" |

## Open questions

These are places where the app and the skill's conventions disagree. The mocks record the app as
it is; none of these was changed by the rewrite.

**Where the mocks are a step ahead of the app** (small accessibility plumbing the mock skeleton
requires; the app could adopt each one without any visual change):

1. A "Skip to content" link and `id="main"` on `<main>`.
2. A visually hidden `<h1>` on the Sing screen, which has no heading in the app.
3. The page behind an open dialog is `inert`.
4. Labels are tied to their fields in the song editor, the avatar editor and the duet song picker
   (`for`/`id`), and the mic-timing slider and the photo input have accessible names.
5. The current bottom-navigation item carries `aria-current="page"`.
6. `[hidden]` always hides. In the app the solo Sing screen's opponent chip has `hidden` but
   `.opponent-chip { display: flex }` wins, so an empty white pill shows in the top-left of the stage.

**Where the app falls short of the skill's conventions** (shown faithfully, not fixed):

1. **Dialogs** are centred cards at every width, not bottom sheets under 640 px. They have
   `role="dialog"` and an `aria-label`, but no `aria-modal`, no focus trap, no Escape to close and
   no close button.
2. **Toasts** are not in a live region, cannot be dismissed, and failures auto-dismiss after 2.2 s
   like everything else.
3. **No busy state** on the dialogs that call the family server (singer, song and avatar editors,
   and the three confirmations).
4. **Validation** is a toast in the singer and avatar editors and one list in the song editor.
   Fields are not marked `aria-invalid` and errors are not tied to them.
5. **Raw messages:** when the family server is unreachable mid-save, the editors show the browser's
   own text ("Failed to fetch").
6. **Missing messages:** a difficulty filter with no songs, and an emptied family songbook, show
   only the gift note (`pages/songs/no-results`, `pages/songs/empty`). The Duet screen draws
   nothing while it waits for the server (`pages/duet/loading`).
7. **Contrast:** white text on the blue toy button is 2.6:1 and soft ink on white is 3.8:1, both
   under WCAG AA for body-size text. The palette is the brand; changing it is a design decision.
8. **Layout quirks kept as they are:** on Me, the song emoji and title share the row equally
   (`.mastered span { flex: 1 }` matches both); before the first tap on Sing, the avatar sits at the
   top of the stage because nothing has positioned it yet.

**A design the app does not have yet:**

1. **Dark theme.** The night palette in `tokens.css` exists only in the mocks. Light text on the
   blue button is replaced by dark ink there, which also fixes that button's contrast. Whether the
   app should ship a dark theme, and whether it should follow the device setting, is undecided.

## Coverage

<!-- coverage:start -->

Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing

### Pages

| Screen | default | loading | empty | error | returning | listening-low | holding | listening-high | goal-complete | offline | no-range | filtered | no-results | ready | countdown | no-mic | standard-key | practice | duet | duet-waiting | three-stars | one-star | no-profile | join | lobby-waiting | lobby-ready | listening | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Welcome (`welcome`) | [✅](pages/welcome/default.html) | ➖ | ➖ | ➖ | [✅](pages/welcome/returning.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `PP-L2-5`, `PP-L2-6`, `CE-L2-1`, `GC-L2-2` |
| Find My Voice (`voice-setup`) | [✅](pages/voice-setup/default.html) | ➖ | ➖ | ➖ |  | [✅](pages/voice-setup/listening-low.html) | [✅](pages/voice-setup/holding.html) | [✅](pages/voice-setup/listening-high.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `VP-L2-1`, `VP-L2-2`, `VP-L2-3`, `VP-L2-5`, `VP-L2-6`, `VP-L2-7`, `VP-L2-15` |
| Home (`home`) | [✅](pages/home/default.html) | ➖ | [✅](pages/home/empty.html) | ➖ |  |  |  |  | [✅](pages/home/goal-complete.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `RP-L2-2`, `RP-L2-3`, `RP-L2-4`, `RP-L2-10`, `CE-L2-2`, `CE-L2-6`, `AS-L2-5`, `VP-L2-13` |
| Pick a Song (`songs`) | [✅](pages/songs/default.html) | ➖ | [✅](pages/songs/empty.html) | ➖ |  |  |  |  |  | [✅](pages/songs/offline.html) | [✅](pages/songs/no-range.html) | [✅](pages/songs/filtered.html) | [✅](pages/songs/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `SL-L2-4`, `SL-L2-5`, `SL-L2-14`, `VP-L2-12`, `HS-L2-13`, `DM-L2-13` |
| Sing! (`sing`) | [✅](pages/sing/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  | [✅](pages/sing/ready.html) | [✅](pages/sing/countdown.html) | [✅](pages/sing/no-mic.html) | [✅](pages/sing/standard-key.html) | [✅](pages/sing/practice.html) | [✅](pages/sing/duet.html) | [✅](pages/sing/duet-waiting.html) |  |  |  |  |  |  |  | `SG-L2-2`, `SG-L2-3`, `SG-L2-4`, `SG-L2-5`, `SG-L2-6`, `SG-L2-7`, `SG-L2-8`, `SG-L2-11`, `SG-L2-12`, `SG-L2-14`, `SG-L2-17`, `SG-L2-28`, `DM-L2-14`, `DM-L2-20`, `CE-L2-3` |
| Results (`results`) | [✅](pages/results/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  | [✅](pages/results/no-range.html) |  |  |  |  | [✅](pages/results/no-mic.html) |  |  | [✅](pages/results/duet.html) | [✅](pages/results/duet-waiting.html) | [✅](pages/results/three-stars.html) | [✅](pages/results/one-star.html) |  |  |  |  |  | `SR-L2-9`, `SR-L2-10`, `SR-L2-11`, `SR-L2-12`, `SR-L2-13`, `SR-L2-14`, `SR-L2-16`, `SR-L2-17`, `DM-L2-15`, `CE-L2-8`, `CE-L2-9` |
| Twinkle's Tips (`tips`) | [✅](pages/tips/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  | [✅](pages/tips/filtered.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `CE-L2-4`, `CE-L2-5`, `CE-L2-7`, `AS-L2-5` |
| My Star Journey (`me`) | [✅](pages/me/default.html) | ➖ | [✅](pages/me/empty.html) | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `RP-L2-1`, `RP-L2-2`, `RP-L2-4`, `RP-L2-5`, `RP-L2-6`, `RP-L2-9`, `VP-L2-14`, `GC-L2-2` |
| Who's singing? (`profiles`) | [✅](pages/profiles/default.html) | [✅](pages/profiles/loading.html) | [✅](pages/profiles/empty.html) | [✅](pages/profiles/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `PP-L2-3`, `PP-L2-14`, `PP-L2-16`, `FS-L2-15` |
| Duet Time (`duet`) | [✅](pages/duet/default.html) | [✅](pages/duet/loading.html) | ➖ | [✅](pages/duet/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/duet/no-profile.html) | [✅](pages/duet/join.html) | [✅](pages/duet/lobby-waiting.html) | [✅](pages/duet/lobby-ready.html) |  | `DM-L2-1`, `DM-L2-2`, `DM-L2-4`, `DM-L2-12`, `DM-L2-13`, `DM-L2-16` |
| Tuner (dev) (`tuner`) | [✅](pages/tuner/default.html) | ➖ | ➖ | [✅](pages/tuner/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/tuner/listening.html) | `AE-L2-17` |

### Dialogs

| Screen | default | busy | invalid | practice | duet | names-hidden | declined | not-plugged-in | unsupported | loading | empty | failed | edit | family | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Microphone needed (Sing) (`mic-ask`) | [✅](dialogs/mic-ask/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `SG-L2-20`, `SG-L2-14`, `AE-L2-14` |
| Microphone needed (Find My Voice) (`mic-denied`) | [✅](dialogs/mic-denied/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `VP-L2-15`, `AE-L2-14` |
| Voice found (`voice-found`) | [✅](dialogs/voice-found/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `VP-L2-10`, `VP-L2-11`, `VP-L2-12` |
| Song tuned for you (`tuned-for-you`) | [✅](dialogs/tuned-for-you/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `SG-L2-13`, `VP-L2-12` |
| Paused (`pause`) | [✅](dialogs/pause/default.html) | ➖ | ➖ | [✅](dialogs/pause/practice.html) | [✅](dialogs/pause/duet.html) |  |  |  |  |  |  |  |  |  | `SG-L2-18`, `SG-L2-17` |
| Tip walk-through (`tip`) | [✅](dialogs/tip/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `CE-L2-5` |
| Parent gate (`parent-gate`) | [✅](dialogs/parent-gate/default.html) | ➖ | [✅](dialogs/parent-gate/invalid.html) |  |  |  |  |  |  |  |  |  |  |  | `GC-L2-1`, `GC-L2-2` |
| Grown-Ups Corner (`grown-ups-corner`) | [✅](dialogs/grown-ups-corner/default.html) | ➖ | ➖ |  |  | [✅](dialogs/grown-ups-corner/names-hidden.html) | [✅](dialogs/grown-ups-corner/declined.html) | [✅](dialogs/grown-ups-corner/not-plugged-in.html) | [✅](dialogs/grown-ups-corner/unsupported.html) |  |  |  |  |  | `GC-L2-3`, `GC-L2-4`, `GC-L2-5`, `GC-L2-10`, `GC-L2-11`, `GC-L2-12`, `AE-L2-22` |
| Confirm reset (`confirm-reset`) | [✅](dialogs/confirm-reset/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | `GC-L2-9` |
| Family high scores (`song-board`) | [✅](dialogs/song-board/default.html) | ➖ | ➖ |  |  |  |  |  |  | [✅](dialogs/song-board/loading.html) | [✅](dialogs/song-board/empty.html) | [✅](dialogs/song-board/failed.html) |  |  | `HS-L2-7`, `HS-L2-12`, `HS-L2-13`, `HS-L2-15` |
| New or edit singer (`singer-editor`) | [✅](dialogs/singer-editor/default.html) | ➖ | [✅](dialogs/singer-editor/invalid.html) |  |  |  |  |  |  |  |  | [✅](dialogs/singer-editor/failed.html) | [✅](dialogs/singer-editor/edit.html) |  | `PP-L2-8`, `PP-L2-9`, `PP-L2-13`, `PP-L2-15` |
| Confirm remove singer (`confirm-remove-singer`) | [✅](dialogs/confirm-remove-singer/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  | [✅](dialogs/confirm-remove-singer/failed.html) |  |  | `PP-L2-15` |
| Songbook manager (`song-manager`) | [✅](dialogs/song-manager/default.html) | ➖ | ➖ |  |  |  |  |  |  | [✅](dialogs/song-manager/loading.html) |  | [✅](dialogs/song-manager/failed.html) |  |  | `GC-L2-6`, `SL-L2-11` |
| Song editor (`song-editor`) | [✅](dialogs/song-editor/default.html) | ➖ | [✅](dialogs/song-editor/invalid.html) |  |  |  |  |  |  |  |  | [✅](dialogs/song-editor/failed.html) | [✅](dialogs/song-editor/edit.html) |  | `GC-L2-6`, `SL-L2-7`, `SL-L2-10` |
| Confirm delete song (`confirm-delete-song`) | [✅](dialogs/confirm-delete-song/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  | [✅](dialogs/confirm-delete-song/failed.html) |  | [✅](dialogs/confirm-delete-song/family.html) | `GC-L2-7` |
| Avatar manager (`avatar-manager`) | [✅](dialogs/avatar-manager/default.html) | ➖ | ➖ |  |  |  |  |  |  | [✅](dialogs/avatar-manager/loading.html) |  | [✅](dialogs/avatar-manager/failed.html) |  |  | `GC-L2-8`, `PP-L2-11`, `PP-L2-12` |
| Avatar editor (`avatar-editor`) | [✅](dialogs/avatar-editor/default.html) | ➖ | [✅](dialogs/avatar-editor/invalid.html) |  |  |  |  |  |  |  |  | [✅](dialogs/avatar-editor/failed.html) | [✅](dialogs/avatar-editor/edit.html) |  | `GC-L2-8`, `PP-L2-11` |

### Notifications

| Screen | info | success | warning | danger | stacked | family-record | Requirements |
|---|---|---|---|---|---|---|---|
| Toast (`toast`) | [✅](notifications/toast/info.html) | [✅](notifications/toast/success.html) | [✅](notifications/toast/warning.html) | [✅](notifications/toast/danger.html) | [✅](notifications/toast/stacked.html) | [✅](notifications/toast/family-record.html) | `AS-L2-7`, `CE-L2-3`, `CE-L2-8`, `HS-L2-14`, `DM-L2-16` |

<!-- coverage:end -->

## Re-checking and re-screenshotting

Run from the repository root.

```sh
# coverage, HTML hygiene, labels, links; --write regenerates index.html and the matrix above
python3 .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write

# PNGs of every mock at 360, 768 and 1280 px in both themes, plus a contact sheet (never commit .cache/)
python3 .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/mocks
```

When you add a state: copy the sibling `default.html`, change the content, update the three
`mock:*` metas, the title and the mock bar in every sibling, add the state to `manifest.json`, then
run the checker.

The next step after a change to these mocks is the `extracting-design-systems` skill, which turns
them into `docs/design-system/`.
