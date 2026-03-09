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

### Story 0: Discover and verify all Anki templates

**Before any automated pushing**, we need a complete picture of what exists in
Anki and how it maps (or doesn't map) to the repo. This is the foundation for
everything else.

**Acceptance criteria:**
- [ ] Script connects to AnkiConnect and calls `modelNames` to list **all** note
  types in the collection — not just the four we expect
- [ ] For each note type, calls `modelTemplates` to get actual card template names
  and `modelFieldNames` to get fields
- [ ] Produces a full inventory report with three sections:
  1. **Matched**: Note types/templates that exist in both Anki and the repo, with
     exact filename-to-template-name correspondence
  2. **In Anki, not in repo**: Note types or individual card templates that exist
     in Anki but have no corresponding files in the repo. For each, report:
     - Note type name
     - Card template names
     - Number of notes using this note type (via `findNotes`)
     - Whether it appears to be a built-in/default type or a custom type
  3. **In repo, not in Anki**: Files in the repo that don't match any Anki
     template (error — filename probably wrong, or note type was deleted)
- [ ] "In Anki, not in repo" items get triaged:
  - **Adopt**: Pull the template from Anki into the repo (bring under version
    control)
  - **Ignore**: Known third-party note type, add to an ignore list
    (`scripts/ignored-note-types.json`)
  - **Orphan**: Note type with zero notes — candidate for deletion (manual, not
    automated)
- [ ] Any name mismatches in matched types are corrected (rename files in repo to
  match Anki, or vice versa if the Anki name is wrong)
- [ ] Output is saved as a mapping file (`scripts/template-mapping.json`) that
  the deploy script will consume
- [ ] Inventory report is saved to `docs/anki-template-inventory.md` for
  reference

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

### Story 8: Visual design audit and optimisation for learning

**Improve card visual design based on SRS and language-learning research.** See
ADR-005 for rationale and principles.

**This story is intentionally broken into small, independently deployable
increments** — each sub-task can be deployed, reviewed during real study sessions,
and rolled back if it hurts rather than helps.

**Acceptance criteria:**
- [ ] **8a: Typography audit** — Review and optimise font sizing, line height,
  and character spacing for readability. CJK characters should be large enough for
  stroke detail; pinyin should be legible but secondary. Verify on both desktop
  and AnkiDroid. Document chosen sizes and rationale.
- [ ] **8b: Visual hierarchy** — Ensure the most important element on each card
  (the thing being tested) has clear visual dominance. Secondary information
  (pinyin, meaning, example sentences) should be visually subordinate. The user's
  eye should land on the test stimulus immediately.
- [ ] **8c: Night mode parity** — Verify night mode provides equivalent
  readability to day mode. Current night mode overrides all exist but haven't
  been audited for contrast ratios. All text must meet WCAG AA contrast (4.5:1
  for body text, 3:1 for large text).
- [ ] **8d: Reduce visual clutter** — Identify and remove or de-emphasise UI
  elements that distract from the core study loop. Sidebars, buttons, and
  metadata should not compete with the test stimulus. Less is more during review.
- [ ] **8e: Tone colour refinement** — Audit the five tone colours for
  distinctness under both day and night mode. Current colours are Material Design
  defaults; they may not be optimal for distinguishing tones at a glance,
  especially red (tone 1) vs orange (tone 2) for colour-deficient users.
- [ ] **8f: Consistent spacing and rhythm** — Apply a consistent spacing scale
  across all four note types. Current spacing tokens (xxs through xxl) are defined
  but applied inconsistently between templates.
- [ ] **8g: Animation and transition review** — Remove or simplify animations
  that add latency to the review loop. Card transitions should feel instant. Any
  animation that delays seeing content hurts review speed.

**Verification for each sub-task:**
- Before/after screenshots (desktop + mobile)
- Side-by-side comparison reviewed during at least one real study session
- Can be rolled back independently via restore script

---

## Story dependency graph

```
Story 0 (discover + verify ALL templates)
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
  |
  v
Story 8a-8g (visual optimisation)  [sequential sub-tasks, each independently deployable]
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
