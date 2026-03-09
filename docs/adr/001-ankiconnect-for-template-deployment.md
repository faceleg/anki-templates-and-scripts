# ADR-001: Use AnkiConnect for Template Deployment

## Status

Proposed

## Context

We need a way to push card templates (front HTML, back HTML, CSS) from this repo
into Anki programmatically. Currently this is done by hand: open Anki's template
editor, select the card type, paste the HTML, repeat for every card and note type.

Three approaches were considered:

1. **AnkiConnect API** — An Anki add-on that exposes a local HTTP API on port
   8765. Provides `updateModelTemplates`, `updateModelStyling`, `modelTemplates`,
   `modelStyling`, and `exportPackage` endpoints.

2. **Direct SQLite modification** — Anki stores note types in a SQLite database
   (`collection.anki21`). We could modify the `notetypes` and `templates` tables
   directly.

3. **`.apkg` export/import** — Build a `.apkg` package with the updated templates
   and import it into Anki.

## Decision

Use **AnkiConnect** (option 1).

## Consequences

### Positive

- **Safe**: AnkiConnect goes through Anki's internal APIs, respecting undo
  history, sync state, and schema migrations. Direct SQLite writes bypass all of
  this.
- **Read and write**: We can read current state (for backup and diff) and write
  updates through the same API.
- **Backup via API**: `exportPackage` can create `.apkg` backups before we push,
  or we can snapshot all templates/CSS via the read endpoints.
- **No file-locking issues**: Anki locks its SQLite database while running.
  AnkiConnect works *because* Anki is running, not despite it.
- **Well-established**: AnkiConnect has been maintained since 2016, is widely
  used by automation tools, and is the de facto standard for programmatic Anki
  interaction.
- **Simple HTTP**: Plain JSON-over-HTTP on localhost. No special client library
  required (though `yanki-connect` exists for typed usage).

### Negative

- **Requires Anki desktop running**: Cannot deploy from CI or headless
  environments. This is acceptable — we only deploy from a development machine
  where Anki is open.
- **Add-on dependency**: If AnkiConnect stops being maintained, we'd need to find
  an alternative. Risk is low given its long track record.
- **No transactional deploy**: AnkiConnect processes one API call at a time. If
  the script fails mid-deploy (e.g. after updating 3 of 5 templates), Anki will
  be in a partially-updated state. Mitigated by: pre-deploy backup, fail-fast
  behaviour, and restore script.

### Why not direct SQLite?

- Anki locks the DB while running — we'd need to close Anki first, defeating the
  purpose of quick iteration.
- Schema has changed across Anki versions (legacy JSON-in-column vs normalised
  tables). We'd need to handle both.
- Bypasses Anki's undo/sync infrastructure, risking data corruption.
- No advantage over AnkiConnect for our use case.

### Why not `.apkg` import?

- `.apkg` import is designed for adding new notes, not updating templates on
  existing notes. Importing a package with template changes can create duplicate
  note types or fail to update existing ones.
- Doesn't provide a read/diff capability.
- More complex to construct than a simple HTTP call.
