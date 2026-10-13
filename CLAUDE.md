# CLAUDE.md

## Project Overview

This repository contains Anki card templates and scripts for Mandarin Chinese language learning. It includes:

- **Card Templates**: HTML/CSS/JS templates for Anki note types (Reading, Writing, Sentences, Grammar)
- **Scripts**: Shell scripts and utilities for audio processing

## Commands

### Linting & Formatting
```bash
npm run lint        # ESLint (HTML files via @html-eslint)
npm run format      # Prettier (auto-format all files)
```

### Build & check
```bash
npm run build   # Inject shared modules + per-model PurgeCSS → dist/
npm run check   # Rebuild; fail if committed dist/ is stale or tone classes were purged
npm test        # Deploy/pull/rollback tests against a stub AnkiConnect (no live Anki)
```

PurgeCSS only sees template HTML. Classes that live in **note field HTML** (tone
colours `t0-5`/`tone*`/`char-tone*`, `char_example*`, `pinyin`, `zhuyin`, …) must be
in the safelist in `scripts/build.js`, or they are silently stripped.

### AnkiConnect Workflow (requires Anki open with AnkiConnect add-on)
```bash
npm run anki:discover    # Compare Anki note types vs repo
npm run anki:backup      # Snapshot all note types to backups/<YYYYMMDD-HHMMSS>/ (gitignored)
npm run anki:pull        # Pull Anki's templates into pulled/<ts>/ for comparison (never touches source)
npm run anki:deploy      # Deploy dist/ to Anki (flags: --model=NAME --dry-run --no-confirm --force)
npm run anki:deploy:dry  # Preview what would be deployed
npm run anki:ship        # build + deploy
npm run anki:rollback -- backups/<ts> [--model=NAME] [--restore-source]
```

**Developer workflow:** Edit source → `npm run check` → `npm run anki:ship` → sync AnkiMobile.

Deploy refuses (before writing anything) on missing/empty CSS, template names unknown to
Anki, empty Front/Back, or templates edited inside Anki since the last deploy (tracked in
gitignored `.deploy-state.json`; override with `--force`). It snapshots current Anki state
to `backups/` first, verifies after writing, and prints the rollback command on failure.

## Repository Structure

```
shared/
  css/
    base.css          — :root vars, .card light/dark modes
    fonts.css         — @font-face (KaiTi, LXGW WenKai, Jason/Muyao handwriting, Material Icons)
    components.css    — .icon, dictionary-links panel, buttons
    tone-colors.css   — .tone1-.tone5, .t1-.t5, .char-tone1-.char-tone4
    character.css     — .char-card, font-rotation classes, HanziWriter divs
    typography.css    — .pinyin, .zhuyin, .meaning, hr, img
  js/
    persistence.js    — anki-persistence (Writing quiz passes its rating front → back)
    audio.js          — AudioManager, playAudio()
    pinyin.js         — decodePinyin(), TONE_COLORS (night-mode aware) — the only copy
    strip-lrm.js      — removes U+200E from rendered text nodes (keeps tone spans)
    debug.js          — DEBUG=false, window.onerror, debugLog()
    font-rotation.js  — 3-minute font rotation + #font-name label on backs

Card Templates/           — source templates (edit these)
  Basic - Mandarin/
  Basic - Mandarin From Subtitles/
  Basic - Mandarin Grammar/
  Basic - Mandarin Sentences/
  CGW-InvalidExample/
  CGW-ValidExample/

dist/                 — built output (committed to git; do not edit directly)
backups/              — gitignored, local only; Anki snapshots + git commit id
pulled/               — gitignored; output of anki:pull
scripts/
  lib/ankiconnect.js  — AnkiConnect HTTP client (ANKICONNECT_URL override)
  lib/snapshot.js     — shared backup/snapshot logic
  lib/util.js         — arg parsing (util.parseArgs strict), prompts, paths
  check.js            — npm run check
  test/deploy.test.js — npm test
  anki-backup.js      — backup Anki state
  anki-discover.js    — compare Anki vs repo
  anki-pull.js        — pull templates from Anki
  anki-deploy.js      — deploy dist/ to Anki
  anki-rollback.js    — restore from backup
  build.js            — inject shared modules → dist/
  normalise-mp3-files.sh — needs `brew install aacgain`
```

## Shared Module @inject Syntax

Templates use inject comments to reference shared files. The build script resolves these.

**In CSS (style.css):**
```css
/* @inject: shared/css/base.css */
/* @inject: shared/css/fonts.css */
```

**In HTML templates:**
```html
<!-- @inject: shared/js/pinyin.js -->
<!-- @inject: shared/js/font-rotation.js -->
```

## Template Script Rules

The user reviews only on **AnkiMobile (iOS)**, which may reuse one page across cards, so
template scripts re-run in the same global scope:
- Wrap every inline script in an IIFE; no top-level `const`/`let`/`var`. Export only what
  `onclick` handlers need, explicitly on `window`.
- Timers must check a session counter kept on `window` (see Writing quiz), not one inside
  a per-card closure.
- Hide answers with CSS from first paint; JS only reveals. Never rely on `DOMContentLoaded`
  or `load` (they don't fire again on a reused page).
- Pinyin is deliberately hidden on Basic backs (user choice); Simplified only.

## Pinyin Display

Tone colouring goes through `shared/js/pinyin.js` everywhere. Subtitles backs also render
`<ruby>` pinyin from the note field (styled inline in that model's CSS).

## Commit Style

Use Conventional Commits with optional scope:

```
type(optional-scope): short description (imperative, max 72 chars)
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`

Examples:
- `feat: speak character before drawing begins`
- `fix(writing): correct stroke indicator color after bad start`
- `chore: update dependencies`

## Card Template Notes

- Templates are plain HTML files used directly inside Anki
- CSS is purged via PurgeCSS before distribution to reduce file size
- JavaScript in templates is vanilla JS (no build step, runs inside Anki's WebView)
- The Writing card type uses [HanziWriter](https://hanziwriter.org/) for stroke order animation

## Adding New Words Workflow

1. Get words into a CSV (Chinese only)
2. Use [Anki-xiehanzi](https://krmanik.github.io/Anki-xiehanzi/) to generate initial deck
3. Download TSV and import into Anki using the **Basic - Mandarin** note type
4. Apply images with the Google Image plugin
5. Add audio with Hyper TTS
6. Generate example sentences with [ankiai](https://github.com/faceleg/ankiai)
7. Populate blanks field with [anki-field-transformer](https://github.com/faceleg/anki-field-transformer/tree/process-examples-blank)

## Rollback Procedure

### Bad deploy — Anki cards look wrong
```bash
ls backups/
npm run anki:rollback -- backups/<YYYYMMDD-HHMMSS>   # only this repo's note types
# Verify in Anki, fix and redeploy
npm run anki:ship
```

### Source files corrupted
```bash
npm run anki:rollback -- backups/<ts> --restore-source   # git checkout of the backed-up commit; refuses if dirty
npm run anki:ship
```
