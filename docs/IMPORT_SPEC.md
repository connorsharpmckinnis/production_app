# Import Specification

**Version:** 0.2

Defines how the importer reads a script file (Markdown or DOCX) and creates database records.

Companion documents:

* [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) — authoring rules and ideal plain-text format
* [DATABASE.md](DATABASE.md) — target schema
* [ROLES.md](ROLES.md) — import is Admin-only
* [PHASE_7.md](PHASE_7.md) — format adapters and title ownership

Test fixtures: [fixtures/scripts/](../fixtures/scripts/)

---

## Input Format

**Primary inputs:**

1. Google Docs **Markdown** export (`File → Download → Markdown`) — `.md`
2. Google Docs / Word **DOCX** export (`File → Download → Microsoft Word (.docx)`) — `.docx`

Architecture: **format adapter → shared preprocess → shared classifier**. Adapters emit newline-oriented lines that look like the Markdown dialect (or plain SCRIPT_FORMAT aliases). Classification stays in one place.

The Endurance scene-1 fixtures (`endurance-scene1.md` and `Endurance Scene 1.docx`) are the regression references.

| Construct | Ideal format (SCRIPT_FORMAT) | Markdown export | DOCX adapter emits |
|---|---|---|---|
| Title | `Title: Endurance` | `# Title: Endurance` | `# Title: …` from Title style |
| Author | `Author: Name` | `## Author: Name` | `Author: …` from Body (plain alias) |
| Act | `Act 1` | `# Act One` | `# Act One` from Heading / Heading 1 |
| Scene | `Scene 1 - Title` | `## Scene One \- Title` | `## Scene One - Title` from Heading 2 |
| Song title | `SONG TITLE (REPRISE)` | `### [SONG TITLE](url)` or `### SONG TITLE` | `### SONG TITLE` from Heading 3 (link optional) |
| Performer / lyrics | Plain ALL CAPS | Often `#### …` or plain ALL CAPS | Plain ALL CAPS (Body centered or Heading 4) |
| Song description | Sentence-case line | `#### …` | `#### …` from non-CAPS Heading 4 |
| End markers | `End of Scene 6` (ignored) | `## End of Scene One` | Same from Heading 2 |

### Recommended DOCX / Google Docs styles

| Style | Use for |
|---|---|
| Title | Show title (parsed; does **not** rename the production — admin create title wins) |
| Heading / Heading 1 | Act headings |
| Heading 2 | Scene headings and End of Scene markers |
| Heading 3 | Song titles (ALL CAPS; hyperlink optional) |
| Heading 4 | Song description (sentence case) or singer/lyrics (ALL CAPS) |
| Body + italic | Stage directions |
| Body + ALL CAPS (centered in gold-standard scripts) | Singer labels and lyrics |
| Body `NAME:` | Dialogue |

If Heading styles are missing (bold-only formatting), import may fail with a clear line error rather than guessing.

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

Before classification, normalize each line (after format extraction):

1. Split on `\n` (accept `\r\n`; normalize to `\n`). Adapters may already return lines.
2. Decode Markdown bytes as UTF-8. Non-UTF-8 uploads return a friendly import error (not a 500). UTF-8 BOM is stripped.
3. Repair common mojibake from Google Docs mis-encoded exports:

   | Mojibake sequence | Replace with | Character |
   |---|---|---|
   | `â€™` | `'` | Apostrophe / right single quote |
   | `â€˜` / modifier-tilde variant | `'` | Left single quote |
   | `â€"` | `–` | En dash |
   | `â€"` | `—` | Em dash |
   | `â€¦` | `…` | Ellipsis |
   | `â€œ` / `â€` | `"` / `"` | Smart double quotes |

4. Unescape common Markdown artifacts from Google Docs export: `\!`, `\-`, and similar backslash-escapes of Markdown punctuation (conservative list).
5. Normalize curly apostrophes/quotes to ASCII so character names match consistently.
6. Strip trailing whitespace from each line.
7. Do **not** strip leading whitespace (tabs after dialogue colons are preserved in content).
8. Leave inline markdown footnote markers (`[^1]`) in `original_text`; do not expand footnote definitions during import.

---

## Importer State

The importer maintains:

| State | Description |
|---|---|
| `production_title` | From title page — **parsed only**; reported as `ImportResult.script_title`; never overwrites `productions.title` |
| `production_author` | From title page (stored as metadata; not a User) |
| `current_act` | Innermost open Act |
| `current_scene` | Innermost open Scene |
| `current_song` | Most recent Song record (for linking lyric/attribution moments) |
| `sequence_number` | Counter within `current_scene`; resets on new Scene |
| `characters` | Set of Character names discovered during import |
| `title_page_complete` | False until first Act heading ends title-page parsing |

**Invariant:** A Moment is never created without an open Scene. If a classifiable moment line appears before the first Scene heading → error.

**Title ownership:** The production name is set when an Admin creates the production. Script `# Title:` / `Title:` lines are consumed so they are not “unrecognized,” but they do not rename the production.

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
^Title:\s*(.+)$
^##\s+Author:\s*(.+)$
^Author:\s*(.+)$
```

* `Title` → `script_title` only (admin create title wins for `productions.title`)
* `Author` → `productions.author` when present
* Do not create Moments

### 4. Act heading

```text
^#\s+Act\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*$
^Act\s+(\d+)\s*$
```

* Convert word-form numbers to digits (see Word Numbers below).
* Create **Act** record: `number`, `sort_order`.
* Set `current_act`; clear `current_scene`, reset `sequence_number`.
* Mark `title_page_complete`.

### 5. Scene heading

```text
^##\s+Scene\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s+\\?[-–—]\s+(.+)$
^Scene\s+(\d+)\s*[-–—]\s*(.+)$
```

* Requires open Act → else error: `"Scene heading before any Act"`.
* Create **Scene** record: `number`, `title`, `sort_order`.
* Reset `sequence_number` to 0.

### 6. Song header

```text
^###\s+\[(.+?)\]\([^)]+\)\s*$
^###\s+(.+)$
```

* Create **Song** record with title = captured group (trimmed). Hyperlink is optional; URL is ignored when present.
* Create **Moment** (`song_header`); increment `sequence_number`.
* Set `current_song`.

Song titles in DOCX should use **Heading 3** (ALL CAPS). Hyperlinks are a convenience only — not required for import.

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

**Singer recognition:**

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

(Google Docs sometimes exports performers and lyrics without `####` prefixes — see `endurance-scene1.md`. DOCX gold-standard scripts use centered ALL CAPS Body text for the same content.)

### 9. Stage direction

```text
^\*(.+)\*\s*$
```

* Create **Moment** (`stage_direction`) + **StageDirection** row.
* Store full line (including asterisks) in `original_text`.
* Increment `sequence_number`.

Stage directions may span multiple sentences in one paragraph = one Moment.

### 10. Dialogue

```text
^([A-Z][A-Z0-9' ,&-]+):\s*(.*)$
```

* Parse character name(s) from before colon. Split on `,` and ` and ` for group lines.
* MVP: keep all parentheticals inline (vocal cues and stage action alike).
* Create/find **Character** records for each speaker.
* Create **Moment** (`dialogue`) + **Dialogue** row(s).
* Increment `sequence_number`.

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

## Records Created Per Construct

| Script construct | Database records |
|---|---|
| Title | Parsed only (`script_title`); does **not** set `productions.title` |
| Author | `productions.author` |
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

Fixture: Act One, Scene One through `## End of Scene One`.

Expected top-level structure:

| Lines | Construct | Result |
|---|---|---|
| 1 | `# Title: Endurance` | Parsed / ignored for `production.title`; admin create title wins |
| 5 | `## Author: Connor McKinnis` | Author metadata |
| 8 | `# Act One` | Act 1 |
| 10 | `## Scene One \- Welcome...` | Scene 1 |
| 12–14 | Stage directions | 2 × `stage_direction` moments |
| 16–34 | Dialogue | Multiple `dialogue` moments; Characters: CREAN, WORSLEY, SHACKLETON |
| 36 | `### [INTO THE DEEP (PRE-PRISE)](...)` | Song + `song_header` moment |
| 38–42 | ALL + lyric lines (plain) | `song_attribution` + 4 × `lyric` |
| 44+ | Continue scene… | More moments |
| last | `## End of Scene One` | Ignored |

DOCX twin: `Endurance Scene 1.docx` — same structure via Heading styles; song titles without hyperlinks.

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

**Recommendation:** Use `endurance-scene1.md` / `Endurance Scene 1.docx` for import tests. Track full-script cleanup as a separate task before full-show import.

---

## Implementation Notes

* Admin-only endpoint (see [ROLES.md](ROLES.md)).
* Run import inside a DB transaction.
* Return structured error `{ line_number, line_content, message }` on failure.
* Accept `.md` and `.docx` only.
* Re-import remains blocked once acts exist.

---

## Remaining Import Questions

1. **Script cleanup vs tolerance** — **Decided:** focus on scene-1 fixtures; full-script cleanup deferred by author.
2. **Google Drive URLs on songs** — **Decided:** optional convenience; title comes from bracket text or plain `### TITLE`.
3. **Director delete production** — **Decided:** Admin only ([ROLES.md](ROLES.md)).
4. **Production title** — **Decided (Phase 7):** admin create-time title is authoritative.
