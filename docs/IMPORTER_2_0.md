Script Importer 2.0 — Sprint Requirements
For: Cursor / coding agents implementing Theater Thing (production_app)
Product: The Theater Thing
Primary driver: STP Scrooge pilot (Emmy directing; script is a selectable-text PDF)
Related issues: #158 (PDF path), #17 (configurable import), #59 (parentheticals), #130 (ALL/ENSEMBLE → Groups), Milestone Script Importer 2.0
Related docs: docs/IMPORT_SPEC.md, docs/SCRIPT_FORMAT.md, docs/feature_plans/script-rights-and-reference-mode.md
Status: Scrooge-pilot v1 polish in progress on `importer-2-0` (PDF adapter, profile
engine, live-draft preview/commit, persistence, visual editor, layout peek,
automated tests, and readiness UX: preview window ≠ commit end page, profile-
derived column band, import success summary). Engine comfort package (2026-09-10,
extended same day): short left-column parentheticals attach to the owning
lyric/dialogue (including multi-line wraps that share a row with right-column
body); stage directions carry no speaker; ensemble marks like `(B)` continue
`Carolers (A)` → `Carolers (B)` even when LifeHouse line-level open-paren rules
are present; multi-speaker `&` / `and` labels split into distinct Characters
(including wrapped `Undertaker and` / `Gravediggers`); consecutive same-speaker
dialogue coalesces into one multiline Moment (lyrics still one-per-line).
Column comforts now **derive** speaker/body `x0` bounds from profile rules
(LifeHouse uses 130/130, matching the former engine hardcodes).
**Owner ruleset tuning** continues on throwaway productions. Deferred: Simple
mode, manual song-end, full “turn block” classifier, lyric coalesce,
**example-driven / click-to-build rules** (see §17), post-import profile
management UI (#162), in-dialogue parentheticals (#59), Groups for ALL/ENSEMBLE
(#130).

1. Goal
Extend the importer so staff can bring more script shapes into Theater Thing — especially PDF scripts with real selectable text — without forcing authors into the Theater App Standard Markdown/DOCX format first.

Success for this sprint is not “every PDF on earth.” Success is:

PDF extraction works (no OCR required for text PDFs).
Extracted content feeds the same shared classifier / moment builder path as .md / .docx (adapter pattern already in backend/app/services/importer/).
A configurable mapping / formula builder lets an admin define how layout + text patterns map to Acts, Scenes, Moments (dialogue, stage direction, song, etc.).
A preview shows what the current mapping would produce before committing to the DB — ideally on a portion of the script so iteration is fast.
At least one saved mapping profile that successfully imports the Scrooge / LifeHouse-style PDF layout (or a fixture cut from it).
2. Context & constraints
Why now
STP wants to lightly run Scrooge out of Theater Thing. Emmy delivered a PDF (selectable/highlightable text). Today SUPPORTED_EXTENSIONS = {".md", ".docx"} in extract.py. Forcing Google Docs → DOCX restyle is explicitly out for this pilot path — import the PDF as-is.

Licensing (important, light touch)
Scrooge is licensed third-party material (LifeHouse / W.R. Scott copyright on the sample). Do not add a full rights UI this sprint (script-rights-and-reference-mode.md is far-future). Do:

Assume org confirms they may digitize for this pilot.
Don’t check copyrighted full scripts into public fixtures; use synthetic / redacted fixtures that preserve layout patterns, or keep private fixtures out of public history as the team prefers.
Preserve author wording; never “improve” dialogue/lyrics during extract.
Non-goals (this sprint)
OCR / scanned image PDFs (defer; architecture should not forbid adding later).
Full Fountain / Final Draft / ProductionPro integrations.
Script revision re-import / diff merge (script-revision-reimport.md).
Reference-only / rights-gated productions.
Replacing Planning Center or building Stage Manager role (#156) — separate track.
Perfect mobile import UX (desktop admin flow is enough).
3. Current architecture (do not rip out)
Existing pipeline:

upload bytes
  → detect_format(filename)          # md | docx
  → format adapter → ExtractedLine[] # text + optional paragraph_number/style
  → preprocess_script / preprocess_lines
  → shared classifier (patterns + grammar + importer.py state machine)
  → DB records (Act / Scene / Moment / Character / Song / …)
Key modules:

backend/app/services/importer/extract.py — ExtractedLine, ScriptExtraction, extract_script
formats/md.py, formats/docx.py — adapters
importer.py — classification + persistence
frontend/src/pages/ImportPage.tsx — upload UI (accepts .md, .docx only today)
Design rule: PDF is a new adapter, not a second importer. Prefer extending ExtractedLine with optional layout metadata rather than forking the classifier.

4. What the Scrooge PDF looks like (corpus facts)
Sample analyzed 2026-09-09 (snippet PDF; full show ~34 pages; script body starts ~page 5 after front matter).

Fact	Detail
Producer	macOS Pages → Quartz PDF
Text	Real selectable text — OCR not required
Page size	Letter
Layout	Rough two-column script: character / attribution on the left, dialogue / lyrics indented/right
Acts	ACT I (roman / word forms may appear)
Scenes	SCENE 1: LONDON TOWN SQUARE
Stage directions	Parenthetical blocks, often multi-line: (As overture leads…)
Dialogue	Scrooge (left) then lines; sometimes Name: inline
Ensemble splits	Carolers (A) / (B) / … then All
Songs	SONG: “A MERRY CHRISTMAS!” then lyric lines under attributions
Music notes	Mixed into parentheticals: (Music pauses then turns ominous…)
Noise	Running page numbers, copyright headers, title repeats
pdftotext -layout already recovers usable structure. Prefer pymupdf (fitz) (or equivalent) in-app for x/y/font-size/font-name per span so mapping rules can use geometry, not only regex.

5. Sprint workstreams
Workstream A — PDF → structured lines
Deliverable: .pdf accepted by extract + Import UI; adapter emits enriched ExtractedLines (or a thin subclass / parallel DTO that adapters normalize into).

Workstream B — Mapping profiles + formula builder
Deliverable: Persistable Import Profile (JSON) describing how to classify lines/spans into Theater Thing constructs; UI to edit rules; default profile(s).

Workstream C — Preview (partial)
Deliverable: API + UI to run extract + map on a byte range / page range / first N pages and return a preview tree without writing Moments (or writing only to a discardable preview session).

Workstream D — Scrooge path / fixtures / docs
Deliverable: Profile that imports Scrooge-like layout; regression fixtures; IMPORT_SPEC.md + SCRIPT_FORMAT.md updates for PDF; ImportPage accepts .pdf.

Suggested implementation order: A spike → A solid → C minimal → B knobs → D polish. Getting one LifeHouse profile working beats boiling the ocean on a universal formula language.

6. Requirements — PDF extraction (Workstream A)
A1. Accept .pdf uploads
Update SUPPORTED_EXTENSIONS, detect_format, ImportPage ACCEPTED_EXTENSIONS, API validation messages.
Reject empty PDFs; clear error if PDF has no extractable text (likely scan) with message suggesting OCR-not-supported-yet / convert path.
A2. Skip front matter (configurable)
Default: optional start_page (1-based) — Scrooge script starts ~page 5.
Profile field: pdf.start_page, pdf.end_page optional.
A3. Emit reading-order lines/spans with layout metadata
Minimum metadata per span/line (nullable when unknown):

{
  "text": "Scrooge",
  "page": 5,
  "paragraph_number": 12,
  "x0": 72.0,
  "x1": 120.0,
  "y0": 640.0,
  "y1": 652.0,
  "font_size": 11.0,
  "font_name": "Helvetica",
  "flags": {"bold": false, "italic": false}
}
Merge spans into logical lines using y-tolerance; keep raw spans available for rules that need column detection.

A4. Preserve sacred text
No rewriting of dialogue/lyrics.
Normalize only whitespace/newlines as existing preprocess does for md/docx.
Strip or ignore pure page-number lines via profile rules (see knobs).
A5. Library choice
Prefer pymupdf for coordinates + fonts.
Pin dependency in backend/pyproject.toml / uv.lock.
Unit-test extraction against a synthetic multi-column PDF fixture checked into fixtures/scripts/ (not the licensed Scrooge file).
A6. Compatibility shim
Existing md/docx paths keep working unchanged.
Classifier may ignore layout fields when absent (md/docx).
7. Requirements — classification targets
Mapper output must still land in existing domain objects:

Target	Notes
Act	number (+ optional title later; today number-centric)
Scene	number + title
Moment / stage_direction	parenthetical or italic-style directions
Moment / dialogue	speakers + text (Character creation as today)
Moment / song_header, song_attribution, lyric	song blocks
Ignore	page numbers, copyright banners, blank
Group-attribution (All, ENSEMBLE) may still create builtin Characters for now; align with #130 when ready — don’t block Scrooge on Groups rewrite unless cheap.

8. Requirements — formula builder / mapping knobs (Workstream B)
B1. Mental model
An Import Profile is an ordered list of rules. Each rule:

Matches a line or span using predicates (AND within rule; first matching rule wins, or explicit priority — pick one and document it; recommend first match wins after sorting by priority desc).
Emits a classification action (act / scene / dialogue / direction / song_header / lyric / ignore / “continue previous moment”, etc.).
Admins should think in plain language examples the UI can show:

“Bold-ish left column short token → Character / speaker”
“Text in parentheses → Stage direction”
“Line matching ^SCENE\\s+(\\d+):\\s*(.*)$ → Scene”
“Line starting with SONG: → Song header”
“Indented body under current speaker → Dialogue/lyric continuation”
B2. Predicates (knobs) — v1 set
Implement a small, explicit predicate vocabulary (JSON), not a free Python eval sandbox.

Text predicates

text_equals / text_starts_with / text_contains (case options)
regex_match (named capture groups for numbers/titles/speakers)
is_all_caps
is_wrapped_in_parens (whole line or span)
word_count_lte / char_count_lte (speaker labels are short)
Layout predicates (PDF; no-op / skip if metadata missing)

x0_lte / x0_gte / x0_between — column detection (e.g. speaker column x0 < 150)
indent_gte — dialogue column
font_size_gte / font_size_lte
is_bold / is_italic (from font flags/name heuristics)
Context predicates

previous_was classification in {speaker, dialogue, direction, song_header, …}
inside_song_block true/false
page_gte / page_lte
B3. Actions (outputs)
ignore
set_act — from capture group or literal
set_scene — number + title captures
stage_direction — use line text (strip outer parens option)
speaker — sets current speaker(s); may not create a Moment alone
dialogue — create dialogue Moment for current speaker(s); text from line or capture
song_header — title capture
song_attribution / lyric
inline_dialogue — for NAME: text lines (reuse parse_dialogue_line grammar where possible)
B4. Built-in starter profiles
theater-app-standard — current md/docx behavior (regexes already in patterns.py) expressed as profile or keep code path as “legacy default” and only use profiles for PDF.
lifehouse-twocolumn-pdf — tuned to Scrooge sample:
Skip pages before pdf.start_page (default 5 for that show; profile-settable)
ACT … → act
SCENE N: title → scene
SONG: → song header
Full-line (...) → stage direction
Short left-column token → speaker (handle Carolers (A), Bob (with Tiny Tim), Liddy & Rouge, All)
Indented / right-column text → dialogue or lyric depending on song state
Ignore standalone page numbers
B5. Persistence
Store profiles in DB (recommended) or JSON files under backend/.../import_profiles/ for v1 if faster — DB preferred so Cloud Run instances share config.
Fields: id, name, description, source_formats[], version, rules (JSON), pdf options, created_at, updated_at.
Ability to duplicate a profile (“clone LifeHouse → tweak”).
B6. Safety
No user-supplied code execution.
Regex timeouts / size limits.
Validate profile JSON against a schema (pydantic model).
9. Requirements — preview (Workstream C)
C1. Why partial preview
Re-parsing a 100+ page musical on every knob tweak is slow and hostile. Preview must support:

page_from / page_to or
max_pages from start_page or
max_lines after extract
Default preview window: ~3–5 script pages or ~200 logical lines, configurable in UI.

C2. Preview API (shape)
Something like:

POST /api/productions/{id}/import/preview

Body: multipart file or previously uploaded temp id + profile_id / inline profile JSON + preview window.

Response (illustrative):

{
  "source_format": "pdf",
  "preview_window": {"page_from": 5, "page_to": 8, "line_count": 180},
  "acts": [
    {
      "number": 1,
      "scenes": [
        {
          "number": 1,
          "title": "LONDON TOWN SQUARE",
          "moments": [
            {"type": "stage_direction", "text": "As overture leads…", "page": 5},
            {"type": "dialogue", "speakers": ["Storyteller"], "text": "The London fog…", "page": 5},
            {"type": "song_header", "title": "A MERRY CHRISTMAS!", "page": 5}
          ]
        }
      ]
    }
  ],
  "warnings": [{"line": 42, "message": "Speaker-like token with no following dialogue"}],
  "unclassified_sample": [{"page": 6, "text": "..."}]
}
Must not persist Moments on preview.

C3. Preview UI
On Import page (or a new Import Wizard step):
Upload PDF
Pick profile + start page
Preview pane: nested Act → Scene → Moment list (virtualized if long)
Side panel: rule editor / knobs (can be basic JSON form in v1 if needed, nicer builder if time)
“Refresh preview” (only window) vs “Commit import” (full script with same profile)
Show counts: moments by type, characters detected, unclassified %.
Highlight unclassified lines loudly.
C4. Commit import
Full-file run with same profile.
Keep existing collect-all-errors then rollback policy from IMPORT_SPEC.
Return same style of line issues ImportPage already renders.
10. API / product surface checklist
 Accept .pdf on import endpoints + frontend
 List / get / create / update / duplicate import profiles (Admin-only; match ROLES — import is Admin today)
 Preview endpoint (Admin)
 Commit import with profile_id (default profile for md/docx may be implicit legacy)
 Docs updated: IMPORT_SPEC PDF section; SCRIPT_FORMAT note that PDF profiles are layout-based, not the authoring standard
11. Testing requirements
Unit: PDF adapter on synthetic fixture (two-column + ACT/SCENE/SONG/parens).
Unit: rule engine predicates + first-match behavior.
Unit: preview window slicing doesn’t leak pages outside range.
Integration: preview does not write DB rows.
Regression: existing md/docx endurance fixtures still pass (test_importer*.py).
Manual: Scrooge PDF pages 5–8 preview looks right before full commit (local/private).
12. Acceptance criteria (sprint done when)
Admin can upload a text PDF to a production import flow.
Extraction yields layout-aware lines without OCR for Pages/Quartz-style PDFs like Scrooge.
Admin can select (and edit at least basically) a mapping profile with knobs from §8.
Preview shows Act/Scene/Moment interpretation for a page/line window in under a few seconds for typical scripts.
Commit creates Timeline data consistent with preview (same rules).
A LifeHouse/Scrooge-like profile imports Scene 1 dialogue + stage directions + at least one song header/lyrics block correctly enough to rehearse against.
md/docx import still works.
Docs mention PDF + profiles; licensed full scripts not published as public fixtures.
13. Implementation notes for Cursor
Follow existing importer package style; use uv / project deps.
Prefer small PRs: (1) pdf extract + tests, (2) preview API dry-run with hardcoded LifeHouse heuristics, (3) profile JSON + UI, (4) wire commit.
Reuse grammar.py helpers (parse_dialogue_line, speaker validation) when actions produce speakers — don’t fork speaker grammar.
Soften ALL-CAPS speaker requirement for PDF profiles if LifeHouse uses title case (Scrooge, Storyteller) — today validate_speaker_name requires ALL CAPS for standard format. PDF profiles must allow title-case speakers without breaking md/docx ALL CAPS rules (profile flag speakers.require_all_caps: false).
Page headers/footers: provide ignore regex list in profile.
Performance: don’t load entire PDF into the classifier twice; cache extract result per upload temp id for preview iteration.
Cloud Run: ensure pymupdf wheels install cleanly in backend image.
14. Open decisions (resolve during sprint if blocked)
Profiles in DB vs files for v1?
First-match vs score-based rule arbitration?
Are Carolers (A) separate Characters or one Character with note? (Recommend separate labels or a single Carolers + parenthetical preserved on Moment — pick one and test Rehearse.)
Full Scrooge commit in shared Cloud env vs local-only until licensing comfort?
15. Reference — example LifeHouse rule sketch (illustrative)
{
  "name": "lifehouse-twocolumn-pdf",
  "pdf": {"start_page": 5},
  "speakers": {"require_all_caps": false},
  "rules": [
    {"priority": 100, "match": {"regex_match": "^\\d+$"}, "action": "ignore"},
    {"priority": 90, "match": {"regex_match": "^ACT\\s+([IVXLC]+|\\d+)$"}, "action": "set_act"},
    {"priority": 90, "match": {"regex_match": "^SCENE\\s+(\\d+)\\s*:\\s*(.*)$"}, "action": "set_scene"},
    {"priority": 85, "match": {"regex_match": "^SONG:\\s*[\"“](.+?)[\"”]\\s*$"}, "action": "song_header"},
    {"priority": 80, "match": {"is_wrapped_in_parens": true}, "action": "stage_direction"},
    {"priority": 70, "match": {"x0_lte": 130, "word_count_lte": 6, "char_count_lte": 40}, "action": "speaker"},
    {"priority": 60, "match": {"x0_gte": 130}, "action": "dialogue"}
  ]
}
(Tune thresholds empirically against extract metadata; do not hardcode magic numbers without measuring the Scrooge PDF.)

16. Owner validation checklist (manual)
Prerequisite: on branch `importer-2-0`, run `./scripts/dev` (or migrate + seed) so migration `028_import_profiles` and the LifeHouse builtin are present. Login `admin` / `admin`. Use a throwaway production (e.g. "Scrooge test 1").

PDF file: local `fixtures/scripts/Scrooge script snippet.pdf` (licensed; gitignored). Confirm Finder/Preview shows **34 pages**. Always use the real file picker — automation previously produced a fake 1-page blob.

| Step | Action | Pass if |
|------|--------|---------|
| 1 | Import Script → Choose file → Scrooge PDF | Filename shown; profile draft area appears |
| 2 | Profile dropdown → **LifeHouse two-column PDF** | Name/description load; ~16 rule cards; Start page defaults to **5** |
| 3 | Preview uses Start page … Start+3 automatically (independent of End page) → **Refresh preview** | No “1 page” / out-of-range errors; counts + Act/Scene/Moment tree; wait a few seconds OK |
| 4 | Spot-check tree | Act I, Scene 1 (London…), dialogue speakers (title case OK), parenthetical stage directions, at least one SONG block if present in window |
| 5 | Unclassified / warnings | Low enough to iterate; note high-volume miss patterns; warnings are labeled as blocking commit |
| 6 | Edit one rule (e.g. speaker `x0_lte`) without refreshing | Prior preview clears / Import stays disabled until refresh |
| 7 | **Save as new profile** | Editable org copy appears in dropdown (builtin stays read-only) |
| 8 | Optional: **Import Script** on throwaway prod only (End page empty = full file) | Success summary shows counts; Timeline matches preview enough to rehearse Scene 1 |

Regression smoke: upload `fixtures/scripts/endurance-scene1.md` (no PDF profile required) → import still succeeds.

Do **not** commit the licensed Scrooge PDF. Defer #59 / #130. After this checklist passes, mark this doc Status complete and sync scratch/phase closeout.

17. Future wish — example-driven rule building (not this sprint)
Owner vision (recorded 2026-09-10): invert today’s “write predicates → see matches”
loop. Admin clicks or highlights text on a PDF/layout peek (or later a page image),
labels the selection (e.g. Character name), and the system:

1. Reads layout + style of the examples (x0/x1, bold/italic, parentheses, neighbors).
2. Proposes a rule that covers all selected positives (“bold words near x≈72”).
3. Auto-highlights other lines the candidate rule would match so the admin can
   accept/reject and refine (active-learning / inverted regex builder).

Prerequisites that move us closer without building the whole product: layout peek
(shipped), reliable extract metadata, and the small engine comforts above. Full
click-to-build stays post-Scrooge-pilot; do not start it until LifeHouse import is
“good enough to rehearse” with hand-edited profiles.

**Column bounds as a stepping stone:** For unfamiliar scripts, a useful mid-step
before full example-driven rules is letting the admin paint vertical bands on a
sample page (“speaker names live roughly here”, “dialogue/lyrics here”, optional
“stage directions / music cues here”). Those bands compile into the existing
predicate vocabulary (`x0_lte` / `x0_gte` / `x0_between` on speaker vs body rules)
plus defaults for start page — covering the highest-leverage part of a two-column
profile without asking staff to invent priorities. Wrap handling, ensemble
letters, and multi-speaker `&` / `and` stay as shared engine comforts on top of
those bounds. Worth planning once LifeHouse hand-tuning proves the predicate set
is stable.
