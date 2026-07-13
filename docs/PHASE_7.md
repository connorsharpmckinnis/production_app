# Phase 7 — Import Hardening & Multi-Format Foundation

**Status:** Implemented (2026-07-13)

**Goal:** Move the script importer from a Markdown-only, Google-Docs-export-fragile path toward a cleaner middle ground: more reliable preprocessing, production metadata that respects admin choices, and a format-adapter architecture that supports **at least one additional Google Docs export format** (`.docx`) while keeping the existing line classifier as the single source of truth.

Phase 6 shipped rehearsal UX and deliberately left the importer alone. Phase 7 returns to import quality — **without** jumping all the way to the ideal end state (admin-configured field maps, fully format-agnostic parsing, re-import, warn-and-continue).

---



## Owner Decisions (confirmed)


| Topic                      | Decision                                                                            | Rationale                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Additional format**      | **DOCX** (Google Docs → *Download → Microsoft Word (.docx)*)                        | See [Format recommendation](#format-recommendation)                                                |
| **Keep Markdown**          | Yes — `.md` remains fully supported                                                 | Existing fixtures, docs, and workflows must not break                                              |
| **Production title**       | **Never overwritten by the script**                                                 | Admin sets the name at create time; script `# Title:` / `Title:` is ignored for `production.title` |
| **Production author**      | Still applied from script when present                                              | Author is not collected at create today; title-page Author remains the natural source              |
| **Architecture**           | Extract → preprocess → classify                                                     | Format adapters emit normalized text lines; classifier stays shared                                |
| **Admin import config UI** | **Out of scope** for Phase 7                                                        | Document the seam; do not build field-mapping settings yet                                         |
| **Re-import**              | **Out of scope**                                                                    | Still blocked once acts exist                                                                      |
| **Error policy**           | Keep **full-fail on first bad line**                                                | Soften only via better preprocessing / format tolerance, not warn-and-continue                     |
| **Full Endurance fixture** | Owner script cleanup remains primary; importer gains limited, deliberate tolerances | Do not turn the importer into a free-form prose parser                                             |
| **Plain SCRIPT_FORMAT**    | Accept a **small** set of non-markdown heading aliases where cheap                  | Bridge toward format-agnostic classification without a second parser                               |
| **Song titles (DOCX)**     | **Heading 3**; hyperlink **optional**                                               | Gold-standard uses Heading 3 ALL CAPS; links are convenience only                                  |
| **Song lyrics / singers**  | ALL CAPS Body (or Heading 4); center is typical but not required                    | Matches gold-standard normal-text lyrics; classifier already handles plain ALL CAPS                |


---



## Format Recommendation



### Candidates (Google Docs export)


| Format  | Pros                                                                                                                                                        | Cons                                                                                                                  | Verdict                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `.docx` | First-class Google Docs export; preserves headings + italics; avoids Markdown escape quirks (`\!`, `\-`); mature `python-docx`; familiar to theatre writers | New dependency; must map Word styles → line conventions carefully                                                     | **Choose this**                                                         |
| `.txt`  | Zero deps; closest to [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) ideal                                                                                            | Google Docs plain-text export **strips** italics and heading styles — stage directions and structure become ambiguous | Strong Phase 8+ candidate once classifier already accepts plain aliases |
| `.odt`  | Structured like DOCX                                                                                                                                        | Rare export path for Google Docs users; weaker Python ecosystem (`odfpy`)                                             | Skip                                                                    |
| `.rtf`  | Available from Google Docs                                                                                                                                  | Notoriously messy; inconsistent exports; painful to parse reliably                                                    | Skip                                                                    |




### Why DOCX for Phase 7

1. **Fixes real Markdown pain.** Google Docs Markdown export introduces escaped punctuation, heading prefixes, and link-wrapped song titles that the classifier must special-case. DOCX keeps structure in styles (Heading 1/2/3, italic runs) instead of characters that collide with Markdown.
2. **Still structured.** Unlike `.txt`, DOCX retains the signals we need: act/scene headings, italic stage directions, hyperlinked song titles.
3. **Boring dependency.** `python-docx` is widely used and readable — matches the project preference for mature, well-understood libraries.
4. **Sets up the end state.** Once extraction is behind an adapter interface, adding `.txt` (or a cleaned plain export) later is mostly “emit lines differently,” not “rewrite the importer.”



### Explicit non-goals for format work

- Google Docs / Drive API sync
- Live collaborative editing
- PDF or Fountain import
- Round-trip export back to DOCX/MD

---



## Where We Are (post–Phase 6)



### Shipped and reliable


| Area                                                 | Status                              |
| ---------------------------------------------------- | ----------------------------------- |
| Admin create production → import `.md` → Timeline    | Done                                |
| Line classifier per [IMPORT_SPEC.md](IMPORT_SPEC.md) | Done (Google Docs Markdown dialect) |
| Mojibake repair (partial)                            | Done                                |
| Builtin characters `ALL` / `ENSEMBLE`                | Done                                |
| Full-fail errors with line number + content          | Done                                |
| Rehearsal UX (Phase 6)                               | Done — no importer changes          |




### Gaps this phase addresses


| Item                                             | Notes                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Create-time title overwritten by `# Title:`      | `importer.py` applies `state.production_title` → `production.title` after success |
| Markdown-only upload                             | UI + API reject non-`.md`                                                         |
| Escaped Markdown punctuation left in sacred text | e.g. `everybody\!` in fixtures                                                    |
| Incomplete mojibake / decode UX                  | Double-quote mojibake incomplete; non-UTF-8 → ugly failure                        |
| Overview “needs import” heuristic                | `act_count === 0 || !author` — missing Author line looks like “no script”         |
| No format-adapter seam                           | Classifier tightly coupled to Markdown-shaped lines                               |
| Spec’d but unimplemented                         | Action parentheticals; stage-direction CAPS linking — **still deferred**          |




### Explicitly not Phase 7


| Item                                                           | Target                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Admin-configurable import field maps / regex profiles          | Ideal end state (post–Phase 7)                         |
| Re-import / replace timeline                                   | Post-MVP (PROJECT.md)                                  |
| Warn-and-continue / partial import                             | Post-MVP                                               |
| Event engine                                                   | Post-MVP                                               |
| Parenthetical extraction into adjacent stage-direction moments | Deferred since Phase 1 — keep deferred unless blocking |
| Stage-direction ALL-CAPS character auto-linking                | Deferred                                               |
| ODT / RTF / PDF / Drive API                                    | Out of scope                                           |
| Deployment / nginx / secrets hardening                         | Separate phase                                         |
| Full `endurance-full.md` auto-tolerance for prose blocks       | Owner cleanup + limited tolerances only                |


---



## Read First (authoritative)


| Document                                                          | Use for                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [PROJECT.md](PROJECT.md)                                          | Import philosophy (“script is sacred”, humans decide)                        |
| [IMPORT_SPEC.md](IMPORT_SPEC.md)                                  | Classification order, error policy, preprocessing — **update in this phase** |
| [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)                              | Ideal authoring rules; plain aliases                                         |
| [DATABASE.md](DATABASE.md)                                        | Production / Moment / Character fields                                       |
| [ROLES.md](ROLES.md)                                              | Import remains Admin-only                                                    |
| [PHASE_1.md](PHASE_1.md)                                          | Original importer slice                                                      |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Prefer stdlib; justify new deps; vertical slices                             |


**Regression fixture:** [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md)

**New fixture (to add):** a small DOCX twin of scene 1 (or a hand-built minimal DOCX) under `fixtures/scripts/` — see WP3.

---



## Phase 7 Theme

Three outcomes, in priority order:

1. **Admin owns the production name** — create-time title sticks after import.
2. **Importer becomes format-aware at the edges** — adapters convert DOCX (and MD) into the same line stream the classifier already understands.
3. **Imported text is cleaner** — unescape Markdown artifacts, harden encoding repair, fix UX that lies about import state.

This is the intentional **middle state**: more robust and slightly multi-format, still convention-based, not yet admin-configured.

---



## Target Architecture

Keep business logic in the existing classifier. Add a thin extraction layer in front.

```
Upload (.md | .docx)
        │
        ▼
┌───────────────────────┐
│  detect_format(name,  │
│    content_type)      │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│  format adapters      │
│  md_adapter           │  bytes → text (as today)
│  docx_adapter         │  paragraphs/runs → text lines
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│  preprocess_script    │  encoding, mojibake, unescape,
│                       │  line normalize
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│  import_script        │  EXISTING state machine +
│  (classify / DB)      │  patterns — mostly unchanged
└───────────────────────┘
```



### Adapter contract (proposed)

```python
# Conceptual — keep it simple, not a plugin framework
def extract_script_lines(filename: str, content: bytes) -> list[str]:
    """Return newline-oriented script lines ready for preprocess + classify."""
```

Adapters should:

- Emit **one logical script line per list entry** (blank lines preserved as `""`).
- Prefer emitting lines that already look like the Markdown dialect the classifier knows (`# Act One`, `*stage direction*`, `NAME: line`, `### [SONG](url)`), **or** plain SCRIPT_FORMAT aliases that WP4 teaches the classifier to accept.
- Never write to the database.
- Fail with a clear `ValueError` / import error if the file is corrupt or empty.



### DOCX → line mapping (proposed defaults)


| DOCX signal                                                                       | Emit as (classifier input)                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Paragraph style Heading 1 matching Act / Title patterns                           | `# Act …` / `# Title: …` (or plain alias)                                                |
| Heading 2 matching Scene / Author / End of Scene                                  | `## …`                                                                                   |
| Heading 3 (ALL CAPS; hyperlink optional)                                          | `### TITLE` or `### [TITLE](url)` if link present                                    |
| Heading 4 sentence case / mixed                                                   | `#### …` (song description)                                                          |
| Heading 4 ALL CAPS **or** Body ALL CAPS (centered in gold-standard)               | Plain ALL CAPS (singer / lyric — same as Markdown path)                              |
| Entirely italic paragraph (or italic-majority)                                    | `*{text}*` stage direction                                                               |
| `NAME:` / `NAME & NAME:` style runs                                               | Plain dialogue line (no markdown)                                                        |
| Normal paragraphs                                                                 | As-is text                                                                               |


**Important:** The adapter may normalize *structure* for the classifier. It must not rewrite dialogue/lyric wording beyond what preprocessing already does (encoding repair, unescape). Sacred text stays sacred.

If Heading styles are missing (writer used bold manual formatting only), Phase 7 may fail with a clear message rather than guessing — document that DOCX scripts should use Heading 1–4 consistently (mirrors “internally consistent script” goal).

---



## Work Packages



### WP0 — Production title is admin-owned (do first)

**Objective:** Creating a production with title `X` and importing a script whose title page says `Y` leaves `production.title == X`.

**Backend**

- [ ] In `backend/app/services/importer/importer.py`, **stop assigning** `production.title` from `state.production_title`.
- [ ] Continue assigning `production.author` from `state.production_author` when present.
- [ ] Keep parsing `# Title:` / `Title:` lines so they do not fall through as “unrecognized” (still consume on title page; simply do not persist to `production.title`).
- [ ] Optional (nice): retain `state.production_title` on `ImportResult` for logging / future “script title differed” toast — **do not** overwrite DB title.

**Tests**

- [ ] Update `TestStructure.test_act_and_scene` in `backend/tests/test_importer.py`: production created as `"Test Production"` (or fixture name) must **remain** that title after import; author still becomes `"Writer"`.
- [ ] Add an explicit regression test: create with title `Admin Chosen Name`, import `# Title: Script Name`, assert title unchanged and author set.

**Docs**

- [ ] Update [IMPORT_SPEC.md](IMPORT_SPEC.md) walkthrough row for `# Title:` — “parsed / ignored for production.title; admin create title wins”.
- [ ] Update [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) title-page note if it implies import sets production name.

**UI (light)**

- [ ] On `ImportPage`, show the current production title (fetch overview or list detail) and a short note: “Production name stays as set when you created it; the script title page does not rename it.”
- [ ] Reuse existing production fetch patterns from Overview / AppShell — do not invent a new API.

**Done when:** Backend tests pass; create → import leaves admin title intact; Import page copy matches behavior.

---



### WP1 — Preprocessing hardening (Markdown + shared)

**Objective:** Reduce character bugs before any DOCX work, and share the same preprocessor for all adapters.

**Tasks**

- [ ] Expand mojibake table to cover smart double quotes (`â€œ` / `â€` and documented IMPORT_SPEC sequences).
- [ ] Add Markdown unescape for common Google Docs export escapes that should not appear in sacred Timeline text: at minimum `\!`, `\-`, and other backslash-escapes that are purely Markdown artifacts (be conservative — do not strip intentional backslashes in dialogue if tests show real use).
- [ ] Decode bytes with a clear failure path: try UTF-8; on failure return a friendly import error (not a 500). Optional: UTF-8-SIG already handled via BOM strip.
- [ ] Keep CRLF normalization and trailing-whitespace strip as today.
- [ ] Unit tests for unescape + quote mojibake in `test_importer.py` (or `test_preprocessing.py` if splitting).

**Done when:** Known fixture escapes like `everybody\!` store as `everybody!` in `original_text`; bad encoding yields a structured error.

---



### WP2 — Format detection + adapter seam

**Objective:** Introduce extraction without changing classification behavior for `.md`.

**Tasks**

- [ ] Add `backend/app/services/importer/extract.py` (or `formats/` package with `md.py` + `docx.py`) — small modules, one responsibility each.
- [ ] `import_script` (or API layer) calls extract → preprocess → classify.
- [ ] API `POST /productions/{id}/import` accepts `.md` and `.docx` (case-insensitive extension check).
- [ ] Reject unsupported types with the same style of 400 used today.
- [ ] Frontend `ImportPage`: accept `.md` and `.docx` in file picker, drag/drop validation, and help copy.
- [ ] Reuse existing drop-zone / error / line-error UI — only widen `accept` and messages.

**Done when:** `.md` import golden path unchanged; unsupported extension still rejected cleanly.

---



### WP3 — DOCX adapter + fixture

**Objective:** Import a DOCX exported (or built) to match scene-1 structure.

**Dependency:** Add `python-docx` via uv in `backend/pyproject.toml` — justify in PR/docs as the DOCX reader. Prefer pinning a stable minor.

**Mapping implementation**

- [ ] Read paragraphs in document order.
- [ ] Map paragraph styles → heading prefixes / italics as in [DOCX → line mapping](#docx--line-mapping-proposed-defaults).
- [ ] Hyperlinks on song headings → `### [TITLE](url)` so existing song regex keeps working.
- [ ] Empty paragraphs → blank lines.
- [ ] Ignore headers/footers/footnotes definitions if present (inline footnote markers in body text: follow existing IMPORT_SPEC policy).

**Fixtures & tests**

- [ ] Add `fixtures/scripts/endurance-scene1.docx` (or `minimal-scene1.docx`) checked into the repo.
- [ ] Test: DOCX import creates comparable act/scene/moment/character/song counts to the MD fixture (exact moment counts may differ slightly if blank-line handling differs — document expected deltas).
- [ ] Test: corrupt/non-docx bytes → clear error.

**Docs**

- [ ] Update IMPORT_SPEC “Input Format” section: primary inputs are Google Docs **Markdown** and **DOCX** exports.
- [ ] Update ImportPage help list and README if it mentions Markdown-only.
- [ ] Document recommended Google Docs styles (Heading 1 = Act / Title, Heading 2 = Scene, Heading 3 = Song, italic = stage direction).

**Done when:** Admin can upload DOCX; tests cover MD + DOCX; docs match.

---



### WP4 — Classifier tolerance toward SCRIPT_FORMAT (small, shared)

**Objective:** Make classification slightly less Markdown-tied so DOCX adapters and future TXT have an easier target — without building a second parser.

**Accept (in addition to existing Google Docs Markdown forms)**


| Construct       | Also accept                                                            |
| --------------- | ---------------------------------------------------------------------- |
| Title page      | `^Title:\s*(.+)$` (no `#`) — still **does not** set `production.title` |
| Author          | `^Author:\s*(.+)$` (no `##`)                                           |
| Act             | `^Act\s+(\d+)\s*$` and existing word-number `# Act One` forms          |
| Scene           | `^Scene\s+(\d+)\s*[-–—]\s*(.+)$` alongside `## Scene One \- …`         |
| Stage direction | Existing `*...*` — DOCX adapter should emit this form                  |


**Do not** in Phase 7:

- Free-form prose as stage direction
- Infer acts from page breaks
- Multiple conflicting dialect modes selectable in UI

**Done when:** A minimal plain-text (or adapter-emitted) snippet using SCRIPT_FORMAT title/act/scene lines imports; MD fixtures still pass.

---



### WP5 — Overview / import UX consistency

**Objective:** UI tells the truth about import state and production naming.

**Tasks**

- [ ] Fix `needsImport` on `ProductionOverviewPage` to `act_count === 0` **only** (author absence must not imply “no script”).
- [ ] Align overview empty-state copy with multi-format import (“markdown or Word (.docx) script”).
- [ ] Import success toast can remain simple; optional: if script title ≠ production title, no action required (title already preserved).
- [ ] Confirm sidebar “Import script” still Admin-only.

**Done when:** Imported production without Author line does not show “needs a script”; title messaging is consistent.

---



### WP6 — Documentation & regression

**Tasks**

- [ ] Update IMPORT_SPEC version notes / preprocessing / title behavior / input formats.
- [ ] Update SCRIPT_FORMAT “MVP import source” blurb to mention DOCX.
- [ ] Add a short “Importing a script” section to README (Google Docs → MD or DOCX; create title wins).
- [ ] Note Phase 7 decisions in PROJECT.md phase tracker if one exists.
- [ ] Run full backend pytest + frontend build.
- [ ] Manual smoke: create production with custom name → import MD → title unchanged → Timeline; repeat with DOCX.

**Done when:** Docs and automated tests agree with behavior; manual smoke checklist below passes.

---



## Suggested Agent Execution Order

```
WP0  Title never overwritten + tests + ImportPage note
  → WP1 Preprocessing (mojibake, unescape, decode errors)
  → WP2 Adapter seam + API/UI accept list (.md + .docx)
  → WP3 DOCX adapter + fixture + python-docx
  → WP4 Plain SCRIPT_FORMAT aliases in classifier
  → WP5 Overview needsImport + copy
  → WP6 Docs & full regression
```

WP0 is intentionally first and shippable alone if the rest slips.

---



## Exit Criteria

Phase 7 is complete when:

1. Admin-chosen production title survives import (MD and DOCX).
2. `.md` regression fixture still imports.
3. A DOCX fixture imports into a coherent Timeline (acts/scenes/moments).
4. Preprocessing no longer leaves common `\!` / quote mojibake artifacts in `original_text`.
5. Overview “needs script” reflects acts, not author.
6. IMPORT_SPEC + SCRIPT_FORMAT + README describe the dual-format path and title rule.
7. No re-import, no admin field-mapping UI, no ODT/RTF.

---



## Manual Validation Script



### P0 — Title ownership

1. Admin creates production titled `My Custom Show Name`.
2. Import `endurance-scene1.md` (script title page says Endurance).
3. Overview / sidebar / Timeline header still show `My Custom Show Name`.
4. Author still populated from script when present.



### P0 — Markdown regression

1. Import `endurance-scene1.md` on a fresh production.
2. Act 1 / Scene 1 present; dialogue and song header appear.
3. Spot-check a line that previously had `\!` — Timeline shows `!` without backslash.



### P0 — DOCX path

1. Export (or use fixture) DOCX with Heading styles for Act/Scene and italic stage directions.
2. Import via Import page.
3. Timeline structure matches expectations; line errors (if any) are actionable.



### P1 — Overview heuristic

1. Import a script **without** an Author line (or clear author in DB only if testing carefully on a throwaway).
2. With acts present, Overview must **not** show “needs a script.”

---



## Technical Decisions (do not re-litigate during implementation)

1. **DOCX over TXT/ODT/RTF** for the additional format.
2. **Adapters emit lines; one classifier** — do not fork import logic per format.
3. `python-docx` **is allowed** for Phase 7; no other format libraries.
4. **Production title is admin-owned**; script title page is not authoritative for `productions.title`.
5. **Author still comes from the script** in Phase 7 (no create-form Author field required).
6. **Full-fail policy stays**; improve inputs instead of partial commits.
7. **Sacred text:** only encoding repair + Markdown-artifact unescape — no creative rewriting.
8. **Reuse** ImportPage, EmptyState, toast, and production fetch patterns — no parallel import UI.

---



## Path to the Ideal End State (out of scope, but design toward it)

Phase 7 should leave obvious seams for later work — **do not implement these now**:


| Future capability                     | Seam to leave                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Admin-configured field / pattern maps | Keep regexes centralized in `patterns.py`; avoid scattering magic strings in adapters |
| Additional formats (`.txt`, others)   | `extract_script_lines` dispatch table                                                 |
| Optional “use script title” toggle    | `ImportResult.script_title` already available if WP0 stores it; UI checkbox later     |
| Re-import                             | Still a hard guard in `import_script`; replace strategy is a separate phase           |
| Per-production import settings        | Do not invent `app_settings` keys for import yet                                      |


---



## Known Risks & Watch Items


| Risk                                             | Mitigation                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| DOCX without Heading styles fails                | Clear error + docs for required styles; do not silently guess                |
| `python-docx` version drift                      | Pin dependency; test in Docker image                                         |
| Unescape too aggressive                          | Conservative list + fixture tests                                            |
| Moment count MD vs DOCX mismatch                 | Compare structure, not byte-identical line counts; document deltas           |
| Song headings without hyperlinks in DOCX         | Prefer requiring link or ALL CAPS song rules already in classifier; document |
| Title still overwritten via some other code path | Grep for `production.title =` in importer and API before shipping            |


---



## Decisions Log


| Date       | Decision                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-07-13 | Song titles: Heading 3 without required hyperlink; lyrics/singers via ALL CAPS (center optional) |
| 2026-07-13 | Phase 7 scoped as import hardening + DOCX foundation — not full admin-configurable importer |
| 2026-07-13 | Recommended additional format: **DOCX** (not TXT/ODT/RTF)                                   |
| 2026-07-13 | Production title set at create time must **not** be overridden by script title page         |
| 2026-07-13 | Author continues to come from script title page when present                                |
| 2026-07-13 | Architecture: format adapters → shared preprocess → existing classifier                     |
| 2026-07-13 | Re-import, warn-and-continue, ODT/RTF, Drive API: out of scope                              |


---



## Notes for Implementing Agent

- Read IMPORT_SPEC and this document before coding; update IMPORT_SPEC when behavior changes.
- **WP0 first** — small, user-visible, unblocks correct mental model for everything else.
- Prefer extending `backend/app/services/importer/` over a new top-level package.
- Do not clone ImportPage; widen acceptance and copy only.
- Do not implement unused `RE_CAPS_NAME` / parenthetical extraction “while you’re there.”
- When adding `python-docx`, update Docker build so `uv sync` picks it up; verify in container.
- Keep functions boring and readable for an intermediate Python developer.
- If DOCX mapping gets ambiguous, fail clearly and document the expected Google Docs style usage rather than adding heuristics.
- Ask the owner before expanding Phase 7 into re-import or settings UI.

