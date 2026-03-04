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
npm run build:css:mandarin   # PurgeCSS - strips unused CSS for Mandarin card templates
                              # Output: ./card-templates/mandarin/dist
```

## Repository Structure

```
Card Templates/
  Basic - Mandarin/               # Core Mandarin flashcard templates
  Basic - Mandarin From Subtitles/
  Basic - Mandarin Grammar/
  Basic - Mandarin Sentences/
scripts/
  normalise-mp3-files.sh         # Audio normalisation script
  aacgain/                       # AAC audio gain utility
```

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
