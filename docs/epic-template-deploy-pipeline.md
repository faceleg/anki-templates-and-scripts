# Epic: Automated Template Deploy Pipeline

## Motivation

Card templates are maintained as HTML/CSS files in this repo but must be manually
copy-pasted into Anki's template editor. This is error-prone and has led to
drift between the repo and what Anki actually runs. A deploy script would let us
push changes from the repo into Anki with a single command, and — critically —
would make the design-language normalisation work (Phase 2) safe to iterate on.

The stakes are high: a bad template push could corrupt card rendering across
thousands of review cards, directly impacting Chinese study. This epic therefore
treats **safety and reversibility** as first-class concerns.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Note type** (Anki calls this "model") | A schema — defines fields and card templates. e.g. "Basic - Mandarin" |
| **Card template** | A front/back HTML pair within a note type. e.g. "Writing - English -> Mandarin" |
| **Styling** | The single CSS block shared by all card templates in a note type |

A note type has **one CSS** and **one or more card templates** (each with a front
and back).

---

## Current Repo-to-Anki Mapping

```
Card Templates/
  {Note Type}/
    style.css (or styles.css)   -->  Note type CSS ("Styling")
    {optional subdirectory}/
      {Card Template Name} - Front.html  -->  Card template qfmt
      {Card Template Name} - Back.html   -->  Card template afmt
```

### Concrete mapping

| Repo directory | Anki note type | Card templates |
|---|---|---|
| `Basic - Mandarin/` | Basic - Mandarin | Reading With Audio - Mandarin -> English, Listening With Audio - Mandarin -> English, Recall With Audio - English -> Mandarin, Reading Without Audio - Mandarin -> English, Writing - English -> Mandarin |
| `Basic - Mandarin Grammar/` | Basic - Mandarin Grammar | Grammar Quiz, Listening With Audio - English -> Mandarin, Reading With Audio - Mandarin -> English, Recall Without Audio - English -> Mandarin |
| `Basic - Mandarin Sentences/` | Basic - Mandarin Sentences | Mandarin - Reading, Mandarin - Recall from definition |
| `Basic - Mandarin From Subtitles/` | Basic - Mandarin From Subtitles | Listening With Audio - English -> Mandarin, Reading With Audio - Mandarin -> English, Recall Without Audio - English -> Mandarin |

**Important**: The card template name in Anki must match the filename prefix
exactly (everything before ` - Front.html` / ` - Back.html`). The deploy script
must verify this before pushing, not assume it.

---

## Stories

### Story 0: Verify repo-to-Anki name mapping

**Before any automated pushing**, we need to confirm that the filenames in this
repo exactly match the card template names in Anki. A mismatch could create
duplicate templates or silently fail to update the right one.

**Acceptance criteria:**
- [ ] Script connects to AnkiConnect and calls `modelNames` to list all note types
- [ ] For each note type, calls `modelTemplates` to get actual card template names
- [ ] Compares against the repo file tree and reports:
  - Exact matches
  - Templates in Anki but missing from repo (warning — may be intentional)
  - Templates in repo but missing from Anki (error — filename probably wrong)
- [ ] Any mismatches are corrected (rename files in repo to match Anki, or vice
  versa if the Anki name is wrong)
- [ ] Output is saved as a mapping file (`scripts/template-mapping.json`) that
  the deploy script will consume

### Story 1: Backup before deploy

**Every deploy must create a full backup of the current Anki state first.**

**Acceptance criteria:**
- [ ] Script calls `exportPackage` via AnkiConnect to create a timestamped
  `.apkg` file in a `backups/` directory (gitignored)
- [ ] Alternatively, if `exportPackage` is unavailable, script reads all
  templates and CSS via `modelTemplates` + `modelStyling` and writes them to
  a timestamped directory under `backups/` as plain files
- [ ] Backup includes every note type that will be modified
- [ ] Script verifies backup is non-empty and readable before proceeding
- [ ] `backups/` is added to `.gitignore`

### Story 2: Backup restore and verification

**We must be able to restore from backup before we trust the deploy.**

**Acceptance criteria:**
- [ ] `npm run restore` (or `node scripts/restore.js <backup-dir>`) reads a
  backup directory and pushes all templates/CSS back via AnkiConnect
- [ ] Restore script has a `--dry-run` flag that shows what it would do
- [ ] Integration test: backup -> make a trivial change -> deploy -> restore ->
  verify templates match the backup exactly
- [ ] Documented in README

### Story 3: Deploy script

**Acceptance criteria:**
- [ ] `npm run deploy` (or `node scripts/deploy.js`) pushes all templates and
  CSS from the repo into Anki via AnkiConnect
- [ ] Reads `scripts/template-mapping.json` to know which repo files map to
  which Anki note types and card templates
- [ ] Calls `updateModelStyling` for each note type's CSS
- [ ] Calls `updateModelTemplates` for each card template's front/back HTML
- [ ] Has a `--dry-run` flag that shows what would be pushed without pushing
- [ ] Has a `--note-type <name>` flag to deploy only one note type
- [ ] Automatically runs Story 1 backup before any writes (can be skipped with
  `--no-backup` for speed during iteration)
- [ ] Reports success/failure per template
- [ ] On any failure, stops immediately (does not continue pushing remaining
  templates) and prints restore instructions

### Story 4: Diff / preview command

**Acceptance criteria:**
- [ ] `npm run diff` (or `node scripts/diff.js`) compares repo templates against
  what's currently in Anki
- [ ] Shows a unified diff for each template and CSS
- [ ] Useful for verifying state before and after deploy
- [ ] Can be used as a pre-deploy check: "nothing unexpected will change"

### Story 5: Normalise repo file naming conventions

**Acceptance criteria:**
- [ ] CSS files consistently named `style.css` (singular) across all note types
- [ ] Subdirectory structure decision made (see ADR-002) and applied
- [ ] All filenames validated against Anki's actual template names (Story 0)

### Story 6: Normalise shared CSS

**Acceptance criteria:**
- [ ] Shared CSS tokens, night mode, Material Icons, base typography extracted to
  `Card Templates/shared/base.css`
- [ ] Deploy script concatenates `base.css` + note-type-specific `style.css`
  before pushing to Anki
- [ ] Each note type's `style.css` contains only overrides
- [ ] Visual rendering in Anki is identical before and after (verified via Story 4
  diff showing only whitespace/ordering changes in final output)

### Story 7: Normalise shared JavaScript

**Acceptance criteria:**
- [ ] Shared JS utilities (`decodePinyin`, `recolorCharacters`,
  `assignClassBasedOnTime`, `isChineseCharacter`, LTR cleanup) extracted to
  `Card Templates/shared/utils.js`
- [ ] Deploy script (or build step) injects shared JS into each template's
  `<script>` block before pushing
- [ ] Card behaviour is identical before and after

---

## Story dependency graph

```
Story 0 (verify mapping)
  |
  v
Story 1 (backup) ---> Story 2 (restore + verify)
  |
  v
Story 3 (deploy) ---> Story 4 (diff)
  |
  v
Story 5 (normalise filenames)
  |
  v
Story 6 (normalise CSS) + Story 7 (normalise JS)   [parallel]
```

---

## Safety guardrails

1. **Pre-deploy backup** — automatic, cannot be skipped without explicit flag
2. **Tested restore** — restore script is written and tested before deploy script
   is considered complete
3. **Dry-run everything** — every write operation has a dry-run mode
4. **Diff before and after** — `npm run diff` to inspect exactly what changed
5. **Name verification** — deploy refuses to run if repo filenames don't match
   Anki's actual template names (prevents creating phantom templates)
6. **Atomic-ish deploys** — fail fast on first error, print restore instructions
7. **No destructive Anki operations** — script only updates existing templates
   and CSS, never deletes note types, card templates, or notes
8. **Manual Anki sync** — script does NOT trigger AnkiWeb sync; user syncs
   manually after verifying cards look correct

---

## Prerequisites

- Anki desktop running with [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
  add-on installed (localhost:8765)
- Node.js (already present for existing lint/format/purgecss tooling)
