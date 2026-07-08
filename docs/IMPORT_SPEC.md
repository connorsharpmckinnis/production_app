# Import Specification

**Version:** 0.1

Defines how the MVP importer reads a Markdown (`.md`) script file and creates database records.

Companion documents:

* [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) — authoring rules and ideal plain-text format
* [DATABASE.md](DATABASE.md) — target schema
* [ROLES.md](ROLES.md) — import is Admin-only

Test fixtures: [fixtures/scripts/](../fixtures/scripts/)

---

## Input Format

**MVP primary input:** Google Docs Markdown export (`File → Download → Markdown`).

The Endurance script (`fixtures/scripts/endurance-full.md`) is the reference file. Google Docs export differs from the ideal plain-text format in [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md):

| Construct | Ideal format (SCRIPT_FORMAT) | Google Docs export (MVP) |
|---|---|---|
| Title | `Title: Endurance` | `# Title: Endurance` |
| Author | `Author: Name` | `## Author: Name` |
| Act | `Act 1` | `# Act One` |
| Scene | `Scene 1 - Title` | `## Scene One \- Title` |
| Song title | `SONG TITLE (REPRISE)` | `### [SONG TITLE (REPRISE)](https://...)` |
| Performer / lyrics | Plain ALL CAPS lines | Often `#### ALL` / `#### LYRIC LINE`; sometimes plain lines |
| End markers | `End of Scene 6` (ignored) | `## End of Scene One`, `# End of Act One` (ignored) |

The importer targets **Google Docs export** for MVP. Plain-text SCRIPT_FORMAT support may be added later using the same classification rules without markdown prefixes.

---

## Error Policy

**Full fail on first unrecognized line.**

When the importer cannot classify a non-blank, non-ignored line:

1. Stop processing immediately.
2. Return an error containing:
   * **Line number** (1-based)
   * **Line content** (truncated if very long)
   * **Reason** (e.g., "No Act defined yet", "Unrecognized line format", "Dialogue character not parseable")
3. Do not persist partial imports (use a transaction; rollback on error).

Warnings (non-fatal) may be added post-MVP. MVP has no warn-and-continue mode.

---

## Preprocessing

Before classification, normalize each line:

1. Split file on `\n` (accept `\r\n`; normalize to `\n`).
2. Decode as UTF-8. If the file lacks a UTF-8 BOM, also repair common mojibake from Google Docs mis-encoded exports:

   | Mojibake sequence | Replace with | Character |
   |---|---|---|
   | `â€™` | `'` | Apostrophe / right single quote |
   | `â€"` | `–` | En dash |
   | `â€"` | `—` | Em dash (if encountered) |
   | `â€œ` / `â€` | `"` / `"` | Smart quotes (if encountered) |

   Apply repair to the full file content **before** line splitting. Store repaired text in `original_text` so the Timeline displays correctly.

3. Strip trailing whitespace from each line.
4. Do **not** strip leading whitespace (tabs after dialogue colons are preserved in content).
5. Leave inline markdown footnote markers (`[^1]`) in `original_text`; do not expand footnote definitions during import.

---

## Importer State

The importer maintains:

| State | Description |
|---|---|
| `production_title` | From title page |
| `production_author` | From title page (stored as metadata; not a User) |
| `current_act` | Innermost open Act |
| `current_scene` | Innermost open Scene |
| `current_song` | Most recent Song record (for linking lyric/attribution moments) |
| `sequence_number` | Counter within `current_scene`; resets on new Scene |
| `characters` | Set of Character names discovered during import |
| `title_page_complete` | False until first Act heading ends title-page parsing |

**Invariant:** A Moment is never created without an open Scene. If a classifiable moment line appears before the first Scene heading → error.

---

## Classification Order

Evaluate each line top-to-bottom. **First matching rule wins.**

### 1. Blank line

Skip. Does not end song context.

### 2. Ignored lines

Skip. Do not create records.

```text
^##\s+End of Scene\s+\w+\s*$
^#\s+End of Act\s+\w+\s*$
^\[\^\d+\]:\s+          # footnote definition lines at file bottom
```

### 3. Title page (only before first Act)

```text
^#\s+Title:\s*(.+)$
^##\s+Author:\s*(.+)$
```

Store in production metadata. Do not create Moments.

### 4. Act heading

```text
^#\s+Act\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*$
```

* Convert word-form numbers to digits (see Word Numbers below).
* Create **Act** record: `number`, `sort_order`.
* Set `current_act`; clear `current_scene`, reset `sequence_number`.
* Mark `title_page_complete`.

Plain-text tolerance (future): `^Act\s+(One|Two|...|\d+)\s*$`

### 5. Scene heading

```text
^##\s+Scene\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s+\\-\s+(.+)$
^##\s+Scene\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s+-\s+(.+)$
```

* Requires open Act → else error: `"Scene heading before any Act"`.
* Create **Scene** record: `number`, `title`, `sort_order`.
* Reset `sequence_number` to 0.

Plain-text tolerance (future): `^Scene\s+(\d+)\s+-\s+(.+)$`

### 6. Song header

```text
^###\s+\[(.+?)\]\([^)]+\)\s*$
```

* Create **Song** record with title = captured group (trimmed).
* Create **Moment** (`song_header`); increment `sequence_number`.
* Set `current_song`.
* Optional: store Google Drive URL from markdown link in `Song` metadata field (future) or ignore for MVP.

Plain-text tolerance (future): line is ALL CAPS with optional `(REPRISE)` / `(N)` parenthetical, not matching dialogue.

### 7. Markdown H4 line (song block context)

```text
^####\s+(.+)$
```

When `current_song` is set, classify the captured content:

| Content pattern | Action |
|---|---|
| Empty / whitespace only | Skip |
| `^\*(.+)\*$` or contains lowercase letters (sentence case) | Append to `current_song.description`; no Moment |
| ALL CAPS line matching known singers (see below) | **Moment** `song_attribution`; increment sequence |
| All caps, substantial lyric text | **Moment** `lyric`; increment sequence |
| Otherwise | **Error**: `"Cannot classify H4 line in song block"` |

**Singer recognition (Phase 1):**

1. Pre-scan the script for character names from dialogue speaker labels.
2. Always include built-in names **`ALL`** and **`ENSEMBLE`** (created as Character records on import; `ENSEMBLE` is reserved for a future Character Group).
3. An ALL CAPS line is `song_attribution` when every comma/`and`-separated segment matches a name from that set.

Examples: `ALL`, `SHACKLETON`, `SHACKLETON, WORSLEY`, `ENSEMBLE`

### 8. Plain ALL CAPS line (song context)

When `current_song` is set and line does not match dialogue or stage direction:

```text
^[A-Z0-9' &,…\.]+(?:\s+[A-Z0-9' &,…\.]+)*\s*$
```

* If line matches known singers (dialogue characters + `ALL` + `ENSEMBLE`) → **Moment** `song_attribution`
* Else if length ≥ 4 characters → **Moment** `lyric`
* Else → **Error**

(Google Docs sometimes exports performers and lyrics without `####` prefixes — see `endurance-scene1.md` lines 38–42.)

### 9. Stage direction

```text
^\*(.+)\*\s*$
```

* Create **Moment** (`stage_direction`) + **StageDirection** row.
* Store full line (including asterisks) in `original_text`.
* Scan text for ALL CAPS character names; link Characters where matched.
* Increment `sequence_number`.

Stage directions may span multiple sentences in one paragraph = one Moment.

### 10. Dialogue

```text
^([A-Z][A-Z0-9' ,&-]+):\s*(.*)$
```

* Parse character name(s) from before colon. Split on `,` and ` and ` for group lines.
* Extract **action parentheticals** from text: `(as they leave)`, `(Worsley looks up to heaven)` when they describe stage action → separate `stage_direction` Moments adjacent to dialogue. Keep **delivery** parentheticals inline: `(Getting suspicious)`, `(With a gleam in his eye)`.
* Create/find **Character** records for each speaker.
* Create **Moment** (`dialogue`) + **Dialogue** row(s).
* Increment `sequence_number`.

**Action vs delivery heuristic (MVP):**

* If parenthetical contains a character name or action verb (looks, walks, leaves, enters, exits, as they) → action → extract.
* Otherwise → delivery → keep inline.

Document ambiguous cases in import review UI (Phase 1).

### 11. Author note

```text
^Note:\s*(.+)$
^####\s+Note:\s*(.+)$   # Google Docs variant
```

* Create **Moment** (`author_note`); increment sequence.

### 12. Unrecognized line → Error

```text
ImportError: Line {n}: Unrecognized format — "{content}"
```

Common causes in the Endurance full script:

* Unformatted prose (Bible verses between scenes)
* Stage directions missing `*...*` wrappers (e.g., `LIGHTS UP on SHACKLETON`)
* Non-script content pasted into the document

---

## Word Numbers

Map word-form act/scene numbers to digits:

| Word | Digit |
|---|---|
| One | 1 |
| Two | 2 |
| Three | 3 |
| Four | 4 |
| Five | 5 |
| Six | 6 |
| Seven | 7 |
| Eight | 8 |
| Nine | 9 |
| Ten | 10 |

---

## Parenthetical Extraction (Dialogue)

For dialogue text containing `(…) ` segments:

1. Split on parenthetical groups.
2. Classify each parenthetical using action vs delivery heuristic.
3. Action parentheticals → insert `stage_direction` Moment immediately before or after the dialogue Moment (preserve script order).
4. Remaining text becomes `dialogue_text` on the Dialogue record.

Store the **original unsplit line** in `moments.original_text` for the dialogue Moment.

---

## Records Created Per Construct

| Script construct | Database records |
|---|---|
| Title / Author | Production metadata fields |
| Act heading | `acts` |
| Scene heading | `scenes` |
| Stage direction | `moments` + `stage_directions` |
| Dialogue | `moments` + `dialogue` + `characters` (find or create) |
| Song header | `songs` + `moments` |
| Song attribution | `moments` (links to `current_song`) |
| Lyric line | `moments` (links to `current_song`) |
| Author note | `moments` |

---

## Walkthrough: `endurance-scene1.md`

Fixture: first 196 lines of Endurance (Act One, Scene One through `## End of Scene One`).

Expected top-level structure:

| Lines | Construct | Result |
|---|---|---|
| 1 | `# Title: Endurance` | Production title |
| 5 | `## Author: Connor McKinnis` | Author metadata |
| 8 | `# Act One` | Act 1 |
| 10 | `## Scene One \- Welcome...` | Scene 1 |
| 12–14 | Stage directions | 2 × `stage_direction` moments |
| 16–34 | Dialogue | Multiple `dialogue` moments; Characters: CREAN, WORSLEY, SHACKLETON |
| 36 | `### [INTO THE DEEP (PRE-PRISE)](...)` | Song + `song_header` moment |
| 38–42 | ALL + lyric lines (plain) | `song_attribution` + 4 × `lyric` |
| 44+ | Continue scene… | More moments through line 195 |
| 196 | `## End of Scene One` | Ignored |

Manual trace checklist for Phase 0 exit:

- [ ] Act 1, Scene 1 created
- [ ] ≥ 2 Characters discovered before first song
- [ ] Song `INTO THE DEEP (PRE-PRISE)` created
- [ ] Sequence numbers restart at Scene 2 when tested against full Act One

---

## Full Script Known Issues

`fixtures/scripts/endurance-full.md` will **not** import cleanly without script cleanup or additional tolerance rules. Known failure points:

| Line (approx) | Issue | Suggested fix |
|---|---|---|
| 200–202 | Bible verse prose (Scene 2) | Wrap in `Note:` or remove from script file |
| 1560 | `LIGHTS UP on SHACKLETON` without `*...*` | Wrap in asterisks |
| Various | Inline footnotes `[^N]` | Preserved in text; no action needed |
| 78, 94 | Dialogue embedded in song sections | Supported — dialogue breaks song lyric run but `current_song` remains for subsequent lyrics |
| 234 | `###   [GIVING UP IS NEAT]` extra spaces | Regex allows optional whitespace |

**Recommendation:** Use `endurance-scene1.md` for first import implementation and tests. Track full-script cleanup as a separate task before full-show import.

---

## Phase 1 Implementation Notes

* Admin-only endpoint (see [ROLES.md](ROLES.md)).
* Run import inside a DB transaction.
* Return structured error `{ line_number, line_content, message }` on failure.
* After successful import, redirect to Timeline review UI ([UI_STANDARDS.md](UI_STANDARDS.md)).

---

## Remaining Import Questions

1. **Script cleanup vs tolerance** — **Decided:** focus on `endurance-scene1.md` for Phase 1; full-script cleanup deferred by author.
2. **Google Drive URLs on songs** — **Decided:** ignore for MVP (strip link URL; use bracket title only).
3. **Director delete production** — **Decided:** Admin only ([ROLES.md](ROLES.md)).
