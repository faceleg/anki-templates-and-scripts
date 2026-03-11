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

### Build
```bash
npm run build                # Inject shared modules + run PurgeCSS → dist/
npm run build:css:mandarin   # PurgeCSS only (strips unused CSS in dist/)
```

### AnkiConnect Workflow (requires Anki open with AnkiConnect add-on)
```bash
npm run anki:discover    # Compare Anki note types vs repo
npm run anki:backup      # Snapshot all templates to backups/<timestamp>/
npm run anki:pull        # Pull templates from Anki into Card Templates/
npm run anki:deploy      # Deploy dist/ to Anki (shows diff + asks confirmation)
npm run anki:deploy:dry  # Preview what would be deployed
npm run anki:rollback    # Restore from backup (usage: node scripts/anki-rollback.js backups/<timestamp>)
```

**Developer workflow:** Edit source → `npm run build` → `npm run anki:deploy`

## Repository Structure

```
shared/
  css/
    base.css          — :root vars, .card light/dark modes
    fonts.css         — @font-face (KaiTi, Material Icons, handwriting fonts)
    layout.css        — main, header, fieldset, select, input, responsive
    components.css    — .icon, .sidebar, .more-info-sidebar, buttons
    tone-colors.css   — .tone1-.tone5, .t1-.t5, .char-tone1-.char-tone4
    character.css     — .char-card, HanziWriter divs, #character-target-div
    typography.css    — .pinyin, .zhuyin, .meaning, hr, img
    pinyin-ruby.css   — ruby/rt rules (Grammar + Sentences only)
  js/
    persistence.js    — anki-persistence library (SimonLammer)
    preferences.js    — sidebar, setPrefs, initSwitchPrefs (reads window.keyPrefix + window.preferenceDefaults)
    audio.js          — AudioManager, playAudio()
    pinyin.js         — decodePinyin(), TONE_COLORS, recolorCharacters()
    debug.js          — DEBUG=false, window.onerror, debugLog()
    font-rotation.js  — assignClassBasedOnTime() for font variety

Card Templates/           — source templates (edit these)
  Basic - Mandarin/
  Basic - Mandarin From Subtitles/
  Basic - Mandarin Grammar/
  Basic - Mandarin Sentences/
  CGW-InvalidExample/
  CGW-ValidExample/

dist/                 — built output (committed to git; do not edit directly)
backups/              — committed to git; timestamped backup directories
scripts/
  lib/ankiconnect.js  — AnkiConnect HTTP client
  anki-backup.js      — backup Anki state + repo snapshot
  anki-discover.js    — compare Anki vs repo
  anki-pull.js        — pull templates from Anki
  anki-deploy.js      — deploy dist/ to Anki
  anki-rollback.js    — restore from backup
  build.js            — inject shared modules → dist/
  normalise-mp3-files.sh
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
<script>
window.keyPrefix = "reading";
window.preferenceDefaults = { ... };
</script>
<!-- @inject: shared/js/persistence.js -->
<!-- @inject: shared/js/preferences.js -->
```

The per-template `window.keyPrefix` and `window.preferenceDefaults` config **must appear before** the inject comments — `preferences.js` reads these at runtime.

## Pinyin Display Approach

Two approaches coexist (intentionally not unified):
- **Grammar + Sentences**: HTML `<ruby>`/`<rt>` tags styled via `shared/css/pinyin-ruby.css`
- **Basic - Mandarin + From Subtitles**: div+JS colorization via `shared/js/pinyin.js`

Unifying these would require changing note field storage format — out of scope.

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
node scripts/anki-rollback.js backups/<timestamp>
# Verify in Anki, fix and redeploy
npm run build && npm run anki:deploy
```

### Source files corrupted
```bash
node scripts/anki-rollback.js backups/<timestamp> --restore-source
git diff
npm run build && npm run anki:deploy
```
