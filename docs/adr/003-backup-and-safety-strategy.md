# ADR-003: Backup and Safety Strategy

## Status

Proposed

## Context

Pushing templates into Anki via AnkiConnect is a write operation against a live
database containing years of spaced-repetition scheduling data, review history,
and card content. A bad push could:

- Break card rendering (blank cards, JavaScript errors during review)
- Corrupt scheduling if a template change somehow triggers re-creation of cards
- Be difficult to notice immediately (some card types are reviewed infrequently)

AnkiConnect's `updateModelTemplates` and `updateModelStyling` only modify
template HTML and CSS — they do not touch note fields, scheduling data, or review
history. But a broken template can still make cards unusable until fixed.

We need a safety strategy that makes every deploy **reversible** and every change
**inspectable**.

## Decision

### Three layers of protection

#### Layer 1: Pre-deploy template snapshot

Before any write, the deploy script reads the current state of every template and
CSS it's about to modify via `modelTemplates` and `modelStyling`, and writes them
to disk:

```
backups/
  2026-03-09T14-30-00/
    Basic - Mandarin/
      style.css
      Reading With Audio - Mandarin -> English - Front.html
      Reading With Audio - Mandarin -> English - Back.html
      ...
    Basic - Mandarin Grammar/
      ...
```

This is fast (pure API reads), lightweight (just text files), granular (per-
template), and easy to diff against.

#### Layer 2: Full collection backup via Anki export

Before the **first ever deploy** and periodically thereafter, the user should
create a full Anki backup via `File > Export > Anki Collection Package (.colpkg)`.
The deploy script will remind the user to do this if no `.colpkg` backup is
detected in the `backups/` directory within the last 7 days.

We do not automate `.colpkg` export because:
- AnkiConnect's `exportPackage` creates `.apkg` per-deck exports, not full
  collection backups
- A full collection backup includes scheduling, media, and all note types — the
  nuclear recovery option
- Anki also maintains its own automatic backups (configurable in preferences)

#### Layer 3: Restore script

A dedicated restore script reads a backup directory (Layer 1) and pushes the
saved templates/CSS back into Anki. This provides fast, targeted rollback
without needing to restore an entire collection.

### Verification protocol

The deploy script will implement a **verify-after-write** step:

1. Push template/CSS via `updateModelTemplates` / `updateModelStyling`
2. Read it back via `modelTemplates` / `modelStyling`
3. Compare the read-back content against what was pushed
4. If mismatch, abort and report

This catches silent failures (e.g. AnkiConnect returning success but not
actually persisting the change).

### Diff command

A standalone `diff` command compares repo state against live Anki state. This
serves two purposes:

- **Pre-deploy**: "Here's exactly what will change" — review before committing
- **Post-deploy**: "Anki now matches the repo" — confidence check

### Fail-fast behaviour

If any API call fails during deploy, the script stops immediately. It does not
attempt to roll back automatically (partial rollback could make things worse).
Instead it:

1. Prints which templates were successfully updated
2. Prints which template failed and the error
3. Prints the command to restore from the just-created backup

### What the deploy script will NOT do

- **Delete** note types, card templates, or notes — only update existing ones
- **Trigger AnkiWeb sync** — user syncs manually after visual verification
- **Modify scheduling data** — templates don't affect scheduling
- **Run without Anki open** — fails fast with a clear error

## Consequences

### Positive

- Every deploy is reversible within seconds (restore from template snapshot)
- Full collection backup exists as a nuclear option
- Changes are inspectable before and after via diff
- Verify-after-write catches silent failures
- Fail-fast prevents cascading damage

### Negative

- Backup directory will accumulate over time (mitigated: add a cleanup command
  or age-based pruning, and `.gitignore` the directory)
- Pre-deploy backup adds a few seconds to each deploy (acceptable for safety)
- Restore is not automatic on failure — requires manual intervention. This is
  intentional: automatic rollback in a partially-applied state could cause more
  harm than stopping and letting the user decide.

## Appendix: Recovery scenarios

| Scenario | Recovery |
|----------|----------|
| Template renders incorrectly after deploy | Run `npm run restore <backup-dir>`, verify in Anki |
| Deploy failed mid-way (3 of 5 templates updated) | Run `npm run restore <backup-dir>` to restore all to pre-deploy state |
| Catastrophic issue (scheduling/notes affected) | Restore from `.colpkg` full collection backup via Anki's File > Import |
| Repo has wrong template names (phantom templates created) | Story 0 name verification prevents this; if it somehow happens, manually delete the phantom template in Anki's Manage Note Types dialog |
| AnkiConnect not responding | Deploy refuses to start; no changes made |
