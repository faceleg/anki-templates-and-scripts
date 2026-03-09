# ADR-002: Repo File Structure Conventions

## Status

Proposed

## Context

The four note type directories in `Card Templates/` have inconsistent structure:

1. **Subdirectories vs flat**:
   - `Basic - Mandarin/` uses numbered subdirectories (`1. Reading, Listening
     and Speaking With Audio/`, `2. Reading Without Audio/`, `Writing/`)
   - The other three note types are flat (all HTML files at root level)

2. **CSS filename**:
   - `Basic - Mandarin/` and `Basic - Mandarin Sentences/` use `style.css`
   - `Basic - Mandarin Grammar/` and `Basic - Mandarin From Subtitles/` use
     `styles.css`

3. **HTML filename pattern**:
   The card template name is encoded as `{Card Template Name} - Front.html` and
   `{Card Template Name} - Back.html`. This pattern is consistent across all
   four note types, but the card template names themselves vary in style:
   - Most use `{Skill} {With|Without} Audio - {Direction}` format
   - Sentences uses `Mandarin - {Skill}` format
   - Grammar Quiz has no direction component

These inconsistencies make it harder to write tooling that walks the tree
reliably.

## Decision

### CSS filename: standardise on `style.css` (singular)

Rename `styles.css` to `style.css` in Grammar and From Subtitles directories.
Singular matches the Anki UI label ("Styling") and is already used by two of four
note types.

### Directory structure: flatten all note types

Remove the numbered subdirectories in `Basic - Mandarin/`. All HTML files live
directly under their note type directory, matching the other three.

Rationale: the subdirectories add no information that isn't already in the
filename. They complicate glob patterns and the deploy script's directory walker.
The numbered prefixes (`1.`, `2.`) encoded a display order that Anki itself
controls via template ordering, not filesystem position.

### HTML filenames: do not rename

Card template names in Anki are user-visible (shown in the card browser and
template editor). Renaming them would require `modelTemplateRename` API calls
and would change how cards appear in Anki's UI. The current names are descriptive
and functional — the inconsistency between note types reflects genuine
differences in card behaviour (Sentences cards don't have a direction because
they're always Mandarin -> English).

The deploy script will derive the card template name by stripping ` - Front.html`
or ` - Back.html` from the filename. This works for all existing files.

## Consequences

### Positive

- Deploy script can use a simple, uniform directory walker:
  `Card Templates/{note-type}/style.css` + `Card Templates/{note-type}/*-Front.html`
- No special-casing for subdirectories
- CSS filename is predictable

### Negative

- Moving files in `Basic - Mandarin/` will show as delete+add in git history
  (mitigated by `git mv` and a dedicated commit)
- Anyone with muscle memory for the old paths will need to adjust (low impact —
  only automated tooling and Claude reference these paths)

## File structure after this ADR is applied

```
Card Templates/
  shared/
    base.css                      # Shared CSS tokens (Story 6)
    utils.js                      # Shared JS utilities (Story 7)
  Basic - Mandarin/
    style.css
    Reading With Audio - Mandarin -> English - Front.html
    Reading With Audio - Mandarin -> English - Back.html
    Listening With Audio - Mandarin -> English - Front.html
    Listening With Audio - Mandarin -> English - Back.html
    Recall With Audio - English -> Mandarin - Front.html
    Recall With Audio - English -> Mandarin - Back.html
    Reading Without Audio - Mandarin -> English - Front.html
    Reading Without Audio - Mandarin -> English - Back.html
    Writing - English -> Mandarin - Front.html
    Writing - English -> Mandarin - Back.html
  Basic - Mandarin Grammar/
    style.css
    Grammar Quiz - Front.html
    Grammar Quiz - Back.html
    Listening With Audio - English -> Mandarin - Front.html
    Listening With Audio - English -> Mandarin - Back.html
    Reading With Audio - Mandarin -> English - Front.html
    Reading With Audio - Mandarin -> English - Back.html
    Recall Without Audio - English -> Mandarin - Front.html
    Recall Without Audio - English -> Mandarin - Back.html
  Basic - Mandarin Sentences/
    style.css
    Mandarin - Reading - Front.html
    Mandarin - Reading - Back.html
    Mandarin - Recall from definition - Front.html
    Mandarin - Recall from definition - Back.html
  Basic - Mandarin From Subtitles/
    style.css
    Listening With Audio - English -> Mandarin - Front.html
    Listening With Audio - English -> Mandarin - Back.html
    Reading With Audio - Mandarin -> English - Front.html
    Reading With Audio - Mandarin -> English - Back.html
    Recall Without Audio - English -> Mandarin - Front.html
    Recall Without Audio - English -> Mandarin - Back.html
```
