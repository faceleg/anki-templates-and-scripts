# ADR-005: Visual Design Principles for Learning Optimisation

## Status

Proposed

## Context

The four note types have evolved independently. They share ~80% of their CSS via
copy-paste but have drifted in specifics: font sizes, spacing, colour usage, and
visual hierarchy vary between them. The templates work, but they haven't been
systematically audited against what research says about effective flashcard
design.

Flashcard visual design directly impacts learning outcomes:

- **Cognitive load**: Cluttered cards slow processing and reduce retention
  ([Mayer's Coherence Principle](https://www.learningscientists.org/blog/2017/7/28-1))
- **Visual hierarchy**: The tested element must be the first thing the eye lands
  on — if it isn't, the brain processes distractors first and primes the wrong
  retrieval pathways
- **Typography**: CJK characters need enough size for stroke detail (critical for
  Writing cards); pinyin needs to be legible but must not dominate
- **Colour coding**: Tone colours are a learning aid, not decoration — they need
  to be perceptually distinct under all viewing conditions
- **Review speed**: Animations and transitions that add even 200ms per card
  compound across thousands of reviews

## Decision

### Guiding principles (in priority order)

1. **Test stimulus dominance** — The element being tested (character, sentence,
   meaning, audio cue) must have overwhelming visual priority. Everything else is
   secondary.

2. **Minimal viable chrome** — UI elements (buttons, sidebars, metadata) should
   be present but visually quiet. If removing an element doesn't hurt the review
   task, remove it. If it's needed sometimes but not always, hide it behind
   interaction (tap to reveal).

3. **Consistent rhythm** — Same spacing scale, same font sizes for the same
   semantic roles, across all note types. A "character" looks the same size
   whether it's on a Reading card or a Writing card.

4. **Perceptual distinctness** — Tone colours must be distinguishable from each
   other and from the background in day mode, night mode, and with common colour
   vision deficiencies (protanopia, deuteranopia). This may mean adjusting hue,
   not just lightness.

5. **Speed** — No animation that delays content visibility. Transitions are for
   user-initiated actions (e.g. sidebar open), not for card rendering.

6. **Night mode as first-class** — Not an afterthought. Night mode must be tested
   with the same rigour as day mode, meeting WCAG AA contrast ratios.

### What this does NOT cover

- Card *content* (which fields to show, what data to populate) — that's a note
  type design question, not a visual design question
- HanziWriter configuration (stroke order animation speed, hint behaviour) —
  that's functional behaviour, covered separately
- Anki's own UI (reviewer buttons, menu bar) — we can't control that

### Implementation approach

Changes are made as small, independently deployable increments (Story 8a-8g in
the epic). Each increment:

1. Is deployed via the deploy script (Story 3)
2. Is verified via before/after diff (Story 4)
3. Is tested during at least one real study session
4. Can be rolled back independently via the restore script (Story 2)

No "big bang" visual redesign. Each change earns its place by surviving real
usage.

## Consequences

### Positive

- Cards become more effective learning tools, not just functional ones
- Consistent visual language across note types reduces cognitive switching cost
  when reviewing mixed decks
- Night mode becomes properly usable (important for evening study sessions)
- Tone colours become a reliable learning signal rather than approximate
  decoration

### Negative

- Visual changes are subjective — what feels "cleaner" to one person may feel
  "too sparse" to another. Mitigated by incremental deployment and rollback
  capability.
- Some visual changes may temporarily disrupt muscle memory (e.g. "the hint
  button used to be here"). Mitigated by making changes small and giving time to
  adapt between increments.
- Contrast ratio compliance may force tone colour changes that look different
  from what the user is accustomed to. Mitigated by testing with real cards
  before committing.

## Current state (for reference)

### Shared across all four note types
- 5 tone colours: Red #f44336, Orange #ff9800, Green #4caf50, Blue #2196f3,
  Gray #607d8b
- Night mode: #1f1f1f background, rgb(240,240,240) text
- Base font: 20px Arial
- Material Icons for action buttons
- Spacing tokens: xxs (0.25rem) through xxl (6rem)
- Platform-specific CJK fonts: KaiTi (macOS/iOS), AR PL KaitiM GB (Linux)

### Per-note-type differences that need reconciling
| Aspect | Basic - Mandarin | Grammar | Sentences | From Subtitles |
|--------|-----------------|---------|-----------|----------------|
| Complexity | Highest (sidebar, forms, fieldsets) | Medium (quiz buttons) | Low (textarea, buttons) | Low (simplified Mandarin) |
| Character size | 3em / 30-40px | 40px | 2.2rem | 3em |
| Button style | Material icon buttons | 3D raised buttons + quiz buttons | 3D raised buttons | Material icon buttons |
| Layout | Grid + sidebar | Grid + flexbox | Grid + flexbox | Grid + flexbox |
| Unique elements | Sidebar nav, custom checkboxes, fieldsets | btn-q/btn-a quiz pattern | Textarea input | Lesson info |
