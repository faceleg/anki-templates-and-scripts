# ADR-004: Shared CSS and JS Assembly Strategy

## Status

Proposed

## Context

Anki note types each have their own CSS ("Styling") and each card template has
its own front/back HTML. There is no `@import` or `<script src="">` mechanism
that works reliably across Anki desktop, AnkiDroid, and AnkiMobile. Each
template must be fully self-contained.

Currently the four note types duplicate ~80% of their CSS (variables, night mode,
Material Icons, base typography, spacing, sidebar styles) and ~60% of their JS
(pinyin decoding, tone coloring, font rotation, character detection). These
duplicates have drifted apart.

We need a way to maintain shared code in one place while producing self-contained
output for each Anki template.

## Decision

### Build-time assembly (not copy-paste)

Shared code lives in `Card Templates/shared/`:

```
Card Templates/shared/
  base.css       # CSS variables, night mode, Material Icons, base typography
  utils.js       # decodePinyin, recolorCharacters, assignClassBasedOnTime, etc.
```

The **deploy script** handles assembly at push time:

- **CSS**: Reads `shared/base.css`, appends the note type's `style.css`, and
  pushes the concatenated result via `updateModelStyling`.
- **JS**: Reads `shared/utils.js` and injects it into each template's HTML at a
  marked insertion point (`<!-- SHARED_JS -->`) before pushing via
  `updateModelTemplates`.

No intermediate files are written to disk. Assembly happens in memory during
deploy. The repo files remain clean and un-duplicated.

### Why not `@import` or external CSS?

Anki's `@import url("_file.css")` feature (referencing files in the media folder)
works for CSS but:
- Anki doesn't detect edits to existing media files for sync
- Doesn't work for JS at all
- Requires manual media file management outside the repo
- Different behaviour across Anki desktop, AnkiDroid, and AnkiMobile

### Why not a pre-commit build step that writes assembled files?

- Would duplicate every file (source + assembled), causing confusion about which
  to edit
- PurgeCSS already exists as a build step for CSS; adding another layer of
  assembly increases complexity
- The deploy script is the single place where repo -> Anki translation happens;
  assembly belongs there

## Consequences

### Positive

- Single source of truth for shared CSS and JS
- No drift between note types for common code
- Template-specific files contain only template-specific code
- No build artifacts in the repo
- Easy to diff: changes to `shared/base.css` are clearly about shared
  styling; changes to `Basic - Mandarin/style.css` are clearly about that
  note type

### Negative

- What you see in the repo is not exactly what Anki receives (shared code is
  injected at deploy time). Mitigated by the `diff` command which shows the
  assembled output vs what's in Anki.
- Editing shared code requires a deploy to test in Anki (no live preview).
  Same as the current workflow, just more explicit.
- Template HTML files need a `<!-- SHARED_JS -->` marker, which is slightly
  unusual. But it's self-documenting and grep-able.
