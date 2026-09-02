# Phase 9 — Dual-Format Script Import Hardening

**Status:** Complete (WP1–WP8 core shipped 2026-07-18; optional Admin preview UI deferred). Singer Character persistence and footnote stripping moved to [PHASE_11.md](PHASE_11.md).

**Goal:** Make Markdown and DOCX imports produce the same production structure from the same script, including modern Google Docs hyperlinks, punctuated multi-word character names such as `MS. ELEPHANT`, and normal lyric punctuation.

Phase 7 introduced format adapters for Markdown and DOCX. Phase 9 keeps that architecture and hardens it against a complete production script. It does **not** introduce separate parsers or an admin-configurable grammar.

---

## Owner Decisions (confirmed 2026-07-17)

| Topic | Decision |
| --- | --- |
| Supported formats | Keep and fix both `.md` and `.docx` |
| Architecture | Format-specific extraction adapters feeding one shared classifier |
| Character casing | Speaker labels remain ALL CAPS; the owner will change `McNISH` to `MCNISH` |
| Character punctuation | Support punctuated, multi-word names such as `MS. ELEPHANT`, `BRI'ISH NEWSIE`, and `ORDE-LEES` |
| Parser configuration | Out of scope for MVP; use one documented grammar |
| Import failures | Collect all issues in one pass, then roll back the transaction |
| Source mistakes | Report malformed styles and markers clearly instead of silently guessing |
| Database changes | None expected |

---

## Read First

| Document | Why |
| --- | --- |
| [PROJECT.md](PROJECT.md) | Script fidelity, progressive enrichment, and human review |
| [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) | Author-facing script rules |
| [IMPORT_SPEC.md](IMPORT_SPEC.md) | Authoritative importer classification and error policy |
| [PHASE_7.md](PHASE_7.md) | Existing Markdown/DOCX adapter design |
| [DATABASE.md](DATABASE.md) | Character, Song, Moment, and Dialogue storage |

---

## Confirmed Problems

### 1. Modern DOCX hyperlinks lose song titles

The fresh full-script export stores most linked song titles in modern `w:hyperlink` elements. `python-docx` exposes their visible text through `paragraph.text`, but not through `paragraph.runs`.

The current adapter prefers `paragraph.runs` whenever any direct run exists:

```python
def _paragraph_text(paragraph: Paragraph) -> str:
    return "".join(run.text for run in paragraph.runs) if paragraph.runs else paragraph.text
```

An empty trailing run therefore causes a linked Heading 3 title to become an empty extracted line. The following `ALL` attribution is then processed without an active song and fails.

Observed in `App-Formatted Copy of Script 2026 Draft 2-4.docx`:

- 25 paragraphs use modern hyperlink elements.
- 24 of 26 Heading 3 song titles currently extract as blank.
- The first missing title is `INTO THE DEEP (PRE-PRISE)`.
- The next extracted line is `ALL`, which fails because no Song was opened.

The older `Endurance Scene 1.docx` fixture uses legacy field-code hyperlinks whose display text remains in direct runs, so it does not expose this bug.

### 2. Markdown and DOCX are tested independently

Both scene-one fixtures currently import successfully, but their tests use loose minimum counts. Nothing verifies that both formats produce the same:

- Acts and Scenes
- ordered Moment types
- Characters and dialogue speakers
- Songs and descriptions
- singer attributions and lyrics
- Moment-to-Song associations

### 3. Dialogue labels do not allow periods

The shared dialogue regex supports spaces, commas, ampersands, apostrophes, and hyphens, but not periods. `MS. ELEPHANT:` therefore fails even though it is an unambiguous ALL-CAPS speaker label.

### 4. Normal lyric punctuation is too restrictive

The ALL-CAPS song-line grammar rejects valid lyrics containing punctuation such as:

- `!` and `?`
- parentheses
- en and em dashes
- some quote variants

After correcting DOCX hyperlink extraction, these lines become the next avoidable failures.

### 5. Some source lines are genuinely malformed or unsupported

The complete script also contains constructs that should not be silently reinterpreted:

- `### ALL` and a DOCX Heading 3 `ALL`, which currently create a Song named `ALL`
- `#### rCHORUS`, whose mixed casing is ambiguous
- Bible references and prose paragraphs outside a recognized Moment format
- `SAD CHRISTMAS SONG` without a Heading 3 song-title style

Phase 9 should distinguish parser defects from source-format errors and provide actionable messages for both.

---

## Target Architecture

```text
Markdown bytes ──→ Markdown adapter ─┐
                                    ├─→ shared preprocessing
DOCX bytes ──────→ DOCX adapter ────┘
                                         ↓
                              shared grammar helpers
                                         ↓
                                shared classifier
                                         ↓
                             transactional persistence
```

The adapters translate source structure only:

- Markdown is decoded into lines.
- DOCX paragraph styles become the equivalent Markdown-shaped lines.
- Both formats then use the same character, song, lyric, and Moment rules.

There must not be a Markdown dialogue parser and a separate DOCX dialogue parser.

---

## Shared Grammar Decisions

### Speaker labels

A dialogue line remains:

```text
{SPEAKER_LIST}: {dialogue}
```

Each speaker name:

- must contain at least one letter;
- must use ALL CAPS;
- may contain multiple words;
- may contain digits;
- may use internal apostrophes, periods, and hyphens;
- may not begin or end with whitespace or a group separator.

Examples that must be accepted:

```text
MS. ELEPHANT: Good morning.
BRI'ISH NEWSIE: Extry! Extry!
ORDE-LEES: What now?
POSH BRIT: Quite right.
CREW 2: Ready.
MS. ELEPHANT, ORDE-LEES: Together.
VERA & MOM: Together.
SHACKLETON, WORSLEY, and CREAN: Together.
```

Examples that must remain invalid:

```text
McNISH: Mixed-case speaker label.
.ELEPHANT: Leading punctuation.
NAME!: Unsupported speaker punctuation.
NAME,, OTHER: Empty group member.
```

Implementation should use small validation and splitting helpers rather than one large permissive regex. The same helper must be used for:

1. dialogue classification;
2. the pre-scan that discovers Character names;
3. song performer attribution.

Do not maintain a fixed list of titles such as `MR.` or `MS.`. Periods are valid within an otherwise valid ALL-CAPS name so abbreviations can evolve without parser changes.

### Speaker lists

Supported separators remain:

- comma;
- ` & `;
- ` and `.

Validation must happen before splitting so dangling separators and empty names fail clearly.

### Song performer attribution

Within an active song, a line is a performer attribution when every parsed name is:

- an existing Character discovered from dialogue; or
- a built-in singer such as `ALL` or `ENSEMBLE`.

`ALL` and `ENSEMBLE` remain valid without first appearing in dialogue.

This phase does not add a new Character Group model or change attribution persistence.

### Lyric lines

Lyrics remain ALL CAPS and are only recognized while a Song is active. In addition to letters, numbers, and spaces, lyrics may contain:

- apostrophes and quotation marks;
- periods, commas, ellipses, exclamation points, and question marks;
- hyphens, en dashes, and em dashes;
- ampersands;
- balanced parentheses.

Lowercase prose must not become a lyric merely because it appears after a Song header. Dialogue matching must run before lyric matching so a colon-bearing speaker line is not consumed as a lyric.

### Song headers

Markdown `###` and DOCX Heading 3 remain the explicit song-title signal.

Before creating a Song:

1. require non-empty visible text;
2. require a plausible ALL-CAPS title;
3. reject a title that is only a recognized performer list;
4. return a targeted error for `### ALL`, Heading 3 `ALL`, and similar attribution-shaped titles.

Example:

```text
Song header looks like a performer attribution — use Heading 3 for the song
title and Body/Heading 4 ALL CAPS for "ALL".
```

The importer must not guess that arbitrary ALL-CAPS Body text is a Song title. That would make titles, attributions, and lyrics indistinguishable.

### Prose and Bible references

Free-standing prose remains outside the standard grammar. Do not silently convert it into stage direction or author notes.

Errors should suggest an explicit supported form:

- `Note: ...` for retained author/context notes;
- `*...*` or italic Body text for performance stage direction;
- removal from the import copy when the text is front matter only.

---

## Work Packages

### WP1 — Lock the shared grammar

**Objective:** Replace overlapping regular-expression behavior with documented shared helpers.

Tasks:

- Add a speaker-name validator.
- Add a speaker-list parser used by dialogue and song attribution.
- Add an ALL-CAPS lyric validator with the approved punctuation.
- Add a plausible-song-title validator.
- Preserve original imported wording; validators classify but do not rewrite.
- Update `IMPORT_SPEC.md` and `SCRIPT_FORMAT.md` with the exact rules.

**Done when:** Markdown and DOCX lines use the same helpers after extraction, and focused unit tests cover accepted and rejected examples.

### WP2 — Fix DOCX visible-text extraction

**Objective:** Preserve text inside both modern and legacy hyperlinks.

Tasks:

- Use `paragraph.text` or an equivalent ordered visible-content iterator.
- Keep run-level inspection only where formatting information is required.
- Add a minimal DOCX regression fixture containing a modern hyperlinked Heading 3.
- Keep the existing legacy-hyperlink scene-one fixture test.
- Verify Heading 3 titles, Body lyrics, Heading 4 lyrics, dialogue, and fully italic stage directions.

**Done when:** `INTO THE DEEP (PRE-PRISE)` opens a Song in the fresh full DOCX and the following `ALL` becomes `song_attribution`.

### WP3 — Support punctuated multi-word speakers

**Objective:** Import names such as `MS. ELEPHANT` consistently.

Tasks:

- Replace direct `RE_DIALOGUE` name capture with the shared speaker parser.
- Use the same parser during Character pre-scan.
- Use the same parser for performer attribution.
- Add Character creation and deduplication tests.
- Confirm existing names such as `BRI'ISH NEWSIE` and `ORDE-LEES` remain stable.
- Reject mixed-case labels such as `McNISH` with an actionable casing error.

**Done when:** punctuated multi-word speakers work in ordinary and grouped dialogue and can later be recognized as song performers.

### WP4 — Expand lyric punctuation safely

**Objective:** Accept real lyrics without admitting arbitrary prose.

Tasks:

- Expand the shared lyric grammar to the approved punctuation set.
- Keep the active-Song and ALL-CAPS requirements.
- Test straight and curly quotes, punctuation, parentheses, ellipses, and dashes.
- Add negative tests for lowercase prose and dialogue-shaped lines.

**Done when:** the full DOCX proceeds past the currently failing punctuated lyrics without changing their original text.

### WP5 — Harden malformed song markers and errors

**Objective:** Fail clearly rather than create structurally incorrect Songs.

Tasks:

- Reject performer-shaped Heading 3 / `###` content.
- Give a specific fix for `### ALL`.
- Reject or clearly explain mixed-case H4 markers such as `#### rCHORUS`.
- Improve unsupported prose/reference errors with `Note:` and italics guidance.
- Preserve full-rollback on any issues; collect every issue in one pass (song blocks collapse to one issue).

**Done when:** malformed styling cannot silently create a Song named `ALL`, and each known source issue provides an actionable correction.

### WP6 — Add semantic format-parity tests

**Objective:** Make equivalent source documents produce equivalent production data.

Create a normalized import fingerprint containing:

- Act number and title;
- Scene number, title, and order;
- ordered Moment type;
- parsed dialogue text and ordered speaker names;
- Song title and description;
- ordered song attribution and lyric text;
- each Moment's Song association;
- normalized Character set.

Compare the scene-one Markdown and DOCX fixtures using exact fingerprints. Normalize source-only syntax such as Markdown links and heading markers; do not require byte-identical `original_text`.

Replace loose assertions such as `songs_created >= 2` and `moments_created >= 30` with explicit expected results.

**Done when:** changing either adapter in a way that alters semantic output causes a parity test failure.

### WP7 — Full-script validation

**Objective:** Exercise both formats against the complete show instead of declaring success from one scene.

Fixtures:

- `endurance-full.md`
- `App-Formatted Copy of Script 2026 Draft 2-4.docx`
- existing scene-one gold fixtures
- small generated or hand-built files for isolated edge cases

Tasks:

- Apply owner source cleanup, including `McNISH` → `MCNISH`.
- Correct known performer lines styled as Heading 3.
- Correct missing song-title Heading 3 styles.
- Decide whether `rCHORUS` should be `CHORUS`, `ALL`, or another explicit Character.
- Mark Bible/prose blocks explicitly as notes, stage directions, or excluded text.
- Run both complete formats and compare normalized semantic fingerprints.
- Document any intentional export differences.

**Done when:** both cleaned full-script formats import successfully and produce equivalent production structure.

### WP8 — Lightweight import diagnostics

**Objective:** Make future format drift diagnosable without building a configurable parser.

Minimum scope:

- Include source format and extracted line number in failures.
- For DOCX, include paragraph number and paragraph style when available.
- Add a developer diagnostic command that emits normalized lines and classifications without committing data.

Optional follow-up:

- Add an Admin-only preview endpoint and “Check script” UI that returns counts and all issues without creating records.

Do not add parser profiles, editable regexes, partial commits, or warn-and-continue behavior in this phase.

---

## Test Matrix

| Case | Markdown | DOCX | Expected |
| --- | --- | --- | --- |
| Modern hyperlinked song title | N/A | Required | Visible Heading 3 opens Song |
| Legacy hyperlinked song title | N/A | Required | Existing behavior preserved |
| `MS. ELEPHANT:` | Required | Required | Dialogue + Character |
| Multi-speaker punctuated names | Required | Required | One Moment, correct speakers |
| `McNISH:` | Required | Required | Clear ALL-CAPS error |
| `ALL` after song title | Required | Required | `song_attribution` |
| `### ALL` / Heading 3 `ALL` | Required | Required | Targeted source-style error |
| Lyrics with `! ? () – — …` | Required | Required | `lyric`, original text preserved |
| Lowercase prose inside song | Required | Required | Description only where explicitly marked; otherwise error |
| Bible citation/prose | Required | Required | Actionable unsupported-line error |
| Scene-one twin fixtures | Required | Required | Exact semantic parity |
| Cleaned full-script twins | Required | Required | Successful import and semantic parity |

---

## Error Policy

Phase 9 collects issues across the whole script, then fails closed:

1. Continue scanning after each recoverable line error.
2. Collapse song-block failures to one issue and skip until the next Act, Scene, or song header.
3. Return source line or DOCX paragraph location for each issue.
4. Explain what was recognized and how to correct the source.
5. Roll back the entire import when any issues exist.

Examples of improved reasons:

```text
Invalid speaker label "McNISH" — speaker names must be ALL CAPS.
```

```text
Song header "ALL" looks like a performer attribution. Use Heading 3 for the
song title and Body/Heading 4 ALL CAPS for performers.
```

```text
Unrecognized prose outside a Moment. Use "Note:" for an author note or italics
for a stage direction.
```

---

## Migration and Compatibility

- No Alembic migration is expected.
- Existing imported Productions are unchanged.
- Re-import remains prohibited.
- Existing valid Markdown and DOCX scripts must continue to import.
- Original script text remains sacred and is not case-corrected or punctuation-normalized by these changes.

---

## Out of Scope

- User-configurable regexes or parser profiles
- Automatic format inference for arbitrary scripts
- Mixed-case speaker normalization
- Character Group storage for `ALL` or `ENSEMBLE`
- New file formats such as PDF, ODT, or RTF
- Partial import or warn-and-continue
- Script replacement/re-import
- Automatic conversion of free prose into Moments
- A grammar configuration UI

Configuration should be reconsidered only after multiple real scripts reveal repeated, legitimate grammars that cannot be represented by the shared standard.

---

## Rollout Order

```text
WP1 shared grammar
  ├─→ WP2 DOCX hyperlink extraction
  ├─→ WP3 punctuated speaker names
  └─→ WP4 lyric punctuation
          ↓
WP5 malformed markers and errors
          ↓
WP6 scene-one semantic parity
          ↓
WP7 complete-script parity
          ↓
WP8 diagnostics / optional preview
```

WP2, WP3, and WP4 can be implemented independently once the shared helper interfaces are agreed.

---

## Definition of Done

Phase 9 is complete when:

1. Modern Google Docs hyperlink text is preserved in DOCX extraction.
2. `MS. ELEPHANT` and other valid punctuated multi-word ALL-CAPS names import in dialogue and performer attribution.
3. Normal lyric punctuation imports without weakening the ALL-CAPS and active-Song safeguards.
4. `ALL` works as dialogue when followed by a colon and as performer attribution inside a Song.
5. Attribution-shaped Heading 3 lines cannot silently create bogus Songs.
6. Equivalent scene-one Markdown and DOCX fixtures pass exact semantic parity tests.
7. Cleaned full-script Markdown and DOCX fixtures import successfully and produce equivalent semantic fingerprints.
8. Remaining source-format failures provide actionable errors with source locations.
9. `IMPORT_SPEC.md`, `SCRIPT_FORMAT.md`, and fixture documentation match implemented behavior.
10. No parser configuration system or database migration is introduced.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Broader lyric punctuation consumes prose | Require active Song context and ALL-CAPS letters |
| Punctuated speaker grammar becomes too permissive | Validate names and group separators explicitly; keep focused positive/negative tests |
| DOCX and Markdown parity tests compare presentation syntax | Compare normalized semantic fingerprints, not raw heading markup |
| Full-script cleanup hides parser bugs | Keep dirty originals or documented regression cases for each confirmed failure |
| Heading 3 guard rejects a legitimate title matching a Character | Fail clearly and require an explicit authoring decision rather than silently choosing |
| Diagnostics expand into configurable parsing | Limit Phase 9 to visibility, classification reporting, and actionable errors |

---

## Decision Log

| Date | Decision |
| --- | --- |
| 2026-07-17 | Keep both Markdown and DOCX support |
| 2026-07-17 | Preserve one shared classifier behind format adapters |
| 2026-07-17 | Support ALL-CAPS multi-word names with apostrophes, periods, and hyphens |
| 2026-07-17 | Keep mixed-case speaker labels invalid; owner will normalize `McNISH` |
| 2026-07-17 | Harden and test the shared grammar before considering parser configuration |
| 2026-07-17 | Use exact semantic parity tests for equivalent fixtures |
| 2026-07-18 | Full-script cleanup uses cleaned canonical copies; dirty originals stay for regression |
| 2026-07-18 | `rCHORUS` is a typo for `CHORUS`; spaced dialogue colons such as `APPLICANT :` are source errors |
