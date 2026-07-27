# Phase 11 — Singer Attribution, Footnotes & Import Leftovers

**Status:** Complete (2026-07-25) — owner decisions confirmed; implementation shipped

**Goal:** Make song blocks behave like dialogue for *who is performing*: every lyric Moment has identifiable singer Character(s), footnotes and other import leftovers stop polluting Timeline text, and remaining Phase 9 / issue #16 import gaps are audited and closed or explicitly deferred.

This phase is the import/data foundation for later **lav charts** and **character packets**. Those features are **out of Phase 11** (next targets after this phase ships).

Tracks GitHub Issues: [#15](https://github.com/connorsharpmckinnis/production_app/issues/15) (singer attribution), [#14](https://github.com/connorsharpmckinnis/production_app/issues/14) (footnotes / leftovers), [#16](https://github.com/connorsharpmckinnis/production_app/issues/16) (other import leftovers).

---

## Owner Decisions (confirmed 2026-07-25)

Confirm or edit before implementation. Recommendations are the defaults if you accept the package as-is.


| Topic | Proposed decision | Rationale |
| ----- | ----------------- | --------- |
| **Distinguish singer vs lyric** | **No new punctuation glyph required.** Keep ALL-CAPS performer lines vs lyric lines. Harden the rule: a line that is *only* a known speaker list (`ALL`, `ENSEMBLE`, dialogue Characters, `&` / `,` groups) is **always** `song_attribution`, never a lyric. | Matches existing SCRIPT_FORMAT examples; avoids rewriting the full Endurance script. Escape hatch below if real songs still collide. |
| **Escape hatch (only if needed)** | If a real lyric is indistinguishable from a speaker list, add an optional trailing colon on performer lines (`SHACKLETON:`) and treat colon-terminated known lists as attribution. Prefer not to require it for existing fixtures. | Guarantees distinction without forcing a full re-author if we hit a collision mid-phase. |
| **Performer context duration** | After a `song_attribution`, those singers own following `lyric` Moments until the next attribution, a new song header, or song context ends (Act / Scene / leave song). **Blank lines do not clear singers.** | Matches SCRIPT_FORMAT examples (blank lines between lyrics under the same `VERA & MOM`). Clarifies scratch wording that sounded like blank lines ended ownership. |
| **Persistence model** | New table **`lyric_lines`** mirroring `dialogue`: `moment_id`, `character_id`, `lyric_text`. Import also links Characters on `song_attribution` Moments via **`song_attribution_characters`** (`moment_id`, `character_id`). Do **not** overload the `dialogue` table. | Same query patterns as dialogue; honest naming; Timeline / Rehearse / filters can treat singers like speakers. |
| **Parenthetical splits** (`SHACKLETON (WILD)`) | Parse primary list + parenthetical alternate. **MVP:** attach **all** resolved Characters (primary + parenthetical) to each following lyric Moment for filtering / “my lyrics.” Do **not** split ownership of parenthetical segments inside a single lyric line yet. | Unlocks actor filters and packets; segment-accurate scoring can wait. |
| **`ALL` / `ENSEMBLE`** | Keep as builtins that create/find Characters named `ALL` / `ENSEMBLE` (same as today’s dialogue pre-scan behavior). No Character Groups expansion in this phase. | Already how import resolves them; Groups remain post-MVP. |
| **Footnotes (authoring)** | **Ban** Markdown footnote markers and definition blocks in [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md). Prefer `Note:` Moments or external annotations. | Sacred Timeline text should not carry export artifacts. |
| **Footnotes (import)** | **Strip** inline `[^n]` from stored `original_text` / lyric text. Continue **skipping** `[^n]:` definition lines. **Do not** invent Notes from footnote bodies in Phase 11 (stretch only if cheap after strip works). | Fixes #14 pollution without a notes-product redesign. |
| **Other import artifacts** | Strip or reject other known MD/DOCX leftovers discovered while fixing footnotes (orphan footnote prose, obvious export debris). Fail loudly for unrecognized prose (Phase 9 policy), do not silently invent Moments. | Keeps “humans decide” / fail-clearly. |
| **Issue #16 leftovers** | **Audit against Phase 9.** Close what Phase 9 already fixed (DOCX hyperlinks, punctuated names, MD↔DOCX parity). Keep **mixed-case** speakers (`McNISH`) **invalid** (normalize in source to `MCNISH`). File any true residuals as new focused issues. | Avoids redoing Phase 9; avoids reopening mixed-case grammar. |
| **Re-import** | Still **prohibited**. Singer linking applies to **new** imports only. Existing productions keep old Moments without `lyric_lines` until manually rebuilt. | Matches project policy; document for pilot. |
| **Database** | Alembic migration **expected** (`lyric_lines`, `song_attribution_characters`; document `moments.song_id` in DATABASE.md if still missing). | Persistence is the point of this phase. |
| **Lav chart / character packets** | **Out of Phase 11.** Next phase after this. Lav chart may start from rough booth needs; character packets follow. | Agreed sequencing. |

---

## Where We Are


### Shipped and reliable (relevant)


| Area | Status |
| ---- | ------ |
| Phase 9 shared grammar (punctuated speakers, lyric punctuation, DOCX hyperlinks, reject `### ALL`) | Core done |
| Song Moments: `song_header` / `song_attribution` / `lyric` + `moments.song_id` | Done |
| Performer *classification* via `parse_performer_line` + known Characters | Done |
| Dialogue → Character via `dialogue` rows | Done |
| Footnote *definitions* skipped; inline `[^n]` left in text | Done (and wrong for display) |


### Gaps this phase addresses


| Item | Notes |
| ---- | ----- |
| Attribution Moments have no Character FKs | Type is set; singers are not queryable |
| Lyric Moments have no singers | Cannot filter “my lyrics” like “my lines” |
| `SHACKLETON (WILD)`-style splits | Not modeled |
| Inline footnotes pollute dialogue/lyrics | #14 |
| #16 mixes fixed Phase 9 items + real residuals | Needs audit + close/split |
| DATABASE / ERD claim Character↔Song via attribution | Aspirational until this phase |


### Explicitly not Phase 11


| Item | Target |
| ---- | ------ |
| Lav / mic change chart (auto-generate or suggest) | **Next phase** (booth requirements still TBD) |
| Per-character “what do I need tonight?” packets | After lav chart |
| Event-driven costumes / props / set pieces | Parked ([#51](https://github.com/connorsharpmckinnis/production_app/issues/51), [#70](https://github.com/connorsharpmckinnis/production_app/issues/70)) |
| User-configurable import grammar UI | [#17](https://github.com/connorsharpmckinnis/production_app/issues/17) |
| Mixed-case speaker normalization (`McNISH`) | Source must be ALL CAPS |
| Character Groups for `ALL` / `ENSEMBLE` | Post-MVP |
| Segment-accurate parenthetical lyric ownership | After MVP singer links |
| Import footnote bodies as Timeline Notes | Stretch / later |
| Script re-import / replace timeline | Post-MVP |
| Admin “Check script” preview UI (Phase 9 optional) | Still deferred |

---

## Read First


| Document | Why |
| -------- | --- |
| [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) — Songs and Lyrics | Authoring rules to update |
| [IMPORT_SPEC.md](IMPORT_SPEC.md) — song block + footnote policy | Classifier behavior to update |
| [DATABASE.md](DATABASE.md) — Dialogue, Songs, Moments | Schema mirror for `lyric_lines` |
| [PHASE_9.md](PHASE_9.md) | What import hardening already shipped |
| [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) | Singer attribution as P1 musical gap |
| GitHub [#14](https://github.com/connorsharpmckinnis/production_app/issues/14), [#15](https://github.com/connorsharpmckinnis/production_app/issues/15), [#16](https://github.com/connorsharpmckinnis/production_app/issues/16) | Issue statements |

**Code anchors:** `backend/app/services/importer/{importer,grammar,patterns}.py`, `backend/app/models/{dialogue,moment,song}.py`, `backend/tests/test_importer_phase9.py`.

**Fixtures:** `fixtures/scripts/endurance-scene1.md` (+ DOCX twin), cleaned full-script fixtures from Phase 9.

---

## Problem Statement

### 1. Singers are classified but not owned (#15)

Today a performer line becomes a `song_attribution` Moment with `original_text` only. Lyrics become `lyric` Moments linked to the Song, not to Characters. Timeline character filters, Rehearse “my lines,” and future character packets therefore **miss sung material**.

Desired behavior (same mental model as dialogue):

```text
### INTO THE DEEP (PRE-PRISE)

ALL                    ← attribution: singers = {ALL}
INTO THE DEEEEEEEEEP   ← lyric owned by ALL
…

### US WHO TRAVEL (2)

VERA & MOM             ← attribution: {VERA, MOM}
O GOD WHOSE …          ← lyric owned by VERA + MOM
…
SHACKLETON (WILD)      ← attribution: {SHACKLETON, WILD} (MVP: both)
LINE WITH (ASIDE) …    ← still both; segment split later
```

### 2. Footnotes and export debris (#14)

IMPORT_SPEC currently **preserves** inline `[^n]` in `original_text`. Definition lines are skipped, so markers remain as visual garbage on the Timeline. SCRIPT_FORMAT even documents footnote markers as allowed lyric punctuation — that should change.

### 3. Leftover import issues (#16)

Much of #16 overlaps Phase 9 (hyperlinks, punctuated names, MD↔DOCX equality). Phase 11 should **verify**, document, and close or split — not rebuild Phase 9. Mixed-case names stay out of scope.

---

## Target Design

### Import state machine (song block)

```text
song_header → set current_song; clear current_performers
song_attribution → parse performers; set current_performers;
                   persist song_attribution_characters
lyric → require current_performers non-empty (else error);
        create lyric Moment + lyric_lines for each performer
```

**Errors (collect-all, then rollback — Phase 9 policy):**

- Lyric while no active song → existing song-context error path
- Lyric while song active but **no** current performers → new clear error: attribution required before lyrics
- Attribution with unknown name → existing unknown-speaker style error

### Distinguishing attribution from lyric (no new glyph)

1. Line matches `parse_performer_line` against known singers → **attribution**
2. Else line matches `is_all_caps_lyric` → **lyric**
3. Document: do not write a lyric that is *only* a comma/`&`-separated list of character names; that will be read as attribution

If fixtures or the full script prove a true collision, enable the **colon escape hatch** in SCRIPT_FORMAT / grammar and update fixtures.

### Schema

```text
lyric_lines
  id
  moment_id      → moments (type lyric)
  character_id   → characters
  lyric_text     # typically same as moment.original_text (post-footnote-strip)

song_attribution_characters
  id
  moment_id      → moments (type song_attribution)
  character_id   → characters
```

**Derived (no new tables):** Character → Songs / Scenes via lyric and attribution links (update DATABASE.md / ERD to match reality).

**Timeline / API:** Extend “speaking character” helpers used by filters so lyric Moments count their `lyric_lines` characters the same way dialogue Moments count `dialogue` rows. Attribution Moments should be included when filtering by those Characters (or documented if excluded — default: **include**).

### Footnotes

| Source | Behavior |
| ------ | -------- |
| Inline `[^digits]` in any Moment text | Strip before persistence |
| `[^digits]: …` definition lines | Skip (unchanged) |
| SCRIPT_FORMAT | Ban footnotes; remove “allowed in lyrics” language |
| Optional stretch | If definition text is available and cheap to map, create a public Note — only after strip is solid |

---

## Work Packages

### WP0 — Confirm decisions & close open questions

- Owner confirms the [proposed decisions](#owner-decisions-proposed-2026-07-25) table (or edits it).
- Agree on blank-line behavior and parenthetical MVP.
- Decide whether colon escape hatch starts **off** (recommended) or **on**.

**Done when:** Decision log below is marked confirmed; implementation may start.

---

### WP1 — Docs: SCRIPT_FORMAT + IMPORT_SPEC + DATABASE

- Update Songs / Lyrics: performer context rules; ban footnotes; clarify attribution vs lyric; document `SHACKLETON (WILD)` MVP meaning.
- Update IMPORT_SPEC: strip footnotes; persist `lyric_lines` / attribution characters; lyric-without-performers error; remove “leave `[^1]` in original_text”.
- Update DATABASE.md (+ ERD touch): new tables; fix `moments.song_id` documentation drift; Character↔Song derived via new links.
- Note Phase 11 in [PROJECT.md](PROJECT.md) (companion list + phase summary).

**Done when:** Docs describe the target behavior; no code required yet for this WP to be reviewable.

---

### WP2 — Schema + models + migration

- Alembic migration for `lyric_lines` and `song_attribution_characters`.
- SQLAlchemy models and relationships from Moment / Character.
- Cascade / delete behavior consistent with `dialogue`.

**Done when:** Migration applies cleanly on empty and existing DBs; models importable.

---

### WP3 — Importer: performer context + persistence

- Maintain `current_performers` through the song block.
- Persist attribution character links.
- Persist `lyric_lines` for each lyric Moment.
- Parse `NAME (OTHER)` / multi-primary + parenthetical into the MVP character set.
- Error when lyrics appear before any attribution in a song.
- Unit tests: scene-one songs; multi-attribution song; split form; lyric-before-attribution fails.

**Done when:** New imports create Character-linked lyric/attribution rows; Phase 9 parity tests still pass (extend fingerprints to include singer ids where appropriate).

---

### WP4 — Timeline / Rehearse / API consumers

- Character filter includes lyric (and attribution) Moments for linked Characters.
- Any “speakers on moment” API used by UI includes lyric singers.
- Smoke: cast actor filter / Rehearse “my lines” shows sung lines for that Character after re-import of a fixture production.
- Minimal UI copy only if something currently claims songs have no speakers — no large UX redesign.

**Done when:** Filtering by Character returns that Character’s lyrics on a freshly imported fixture.

---

### WP5 — Footnotes & import leftover cleanup (#14)

- Preprocess or persist-time strip of `\[\^\d+\]`.
- Tests: dialogue and lyrics with `[^2]` store clean text; definitions still skipped.
- Scan full-script / scene fixtures for other recurring debris; strip or error with guidance.
- Update SCRIPT_FORMAT / IMPORT_SPEC if any extra artifact rules are added.

**Done when:** Imported fixtures contain no inline footnote markers in Moment text; #14 can be closed or reduced to “Notes import” stretch.

---

### WP6 — Issue #16 audit & residual close-out

- Checklist against Phase 9 Definition of Done (hyperlinks, punctuated names, lyric punctuation, MD↔DOCX parity, `### ALL` rejection).
- Confirm mixed-case remains rejected with a clear error.
- Close #16 if nothing material remains; otherwise open focused follow-up issues (one concern each).
- Mark [PHASE_9.md](PHASE_9.md) status accurately if still “In Progress” only for deferred Admin preview.

**Done when:** #16 is closed or cleanly split; written audit note in this phase’s Decision Log.

---

### WP7 — Regression fixtures & Definition of Done pass

- Extend `test_importer_phase9` / new `test_importer_phase11` for singer links + footnote strip.
- Re-import cleaned full-script fixtures; spot-check Songs with changing attributions.
- Update smoke test if it asserts dialogue-only character presence.
- Feature closeout: scratch / PRE_AUGUST checkboxes for singer + footnotes; GitHub issue state.

**Done when:** [Definition of Done](#definition-of-done) items 1–10 are true.

---

## Rollout Order

```text
WP0 owner confirms decisions
  ↓
WP1 docs
  ↓
WP2 schema
  ↓
WP3 importer persistence  ←── WP5 footnotes can parallel after WP1
  ↓
WP4 timeline / filter consumers
  ↓
WP6 #16 audit (can start anytime after WP0)
  ↓
WP7 regression + closeout
```

---

## Definition of Done

Phase 11 is complete when:

1. New imports attach Character(s) to every `lyric` Moment via `lyric_lines`, using the active performer set.
2. `song_attribution` Moments persist their Character set.
3. Performer context survives blank lines and resets on new attribution / new song / end of song context.
4. `SHACKLETON (WILD)`-style lines resolve to both Characters for MVP linking.
5. Lyric before any attribution in a song fails with an actionable import error (collect-all + rollback).
6. Timeline/Rehearse character filtering includes that Character’s lyrics on a fresh import.
7. Inline footnote markers are stripped from stored Moment text; definitions remain skipped; SCRIPT_FORMAT bans footnotes.
8. Phase 9 parity / full-script cleaned fixtures still import; singer identity is covered by tests.
9. #14 and #15 are closable; #16 is closed or split into focused residuals.
10. DATABASE.md, SCRIPT_FORMAT.md, IMPORT_SPEC.md, and this phase doc match shipped behavior.

---

## Risks


| Risk | Mitigation |
| ---- | ---------- |
| A lyric line is only character names and is misclassified as attribution | Document the rule; add colon escape hatch if a real collision appears |
| Requiring attribution before lyrics breaks songs that omit `ALL` | Error clearly; fixtures/scripts must include a performer line (already SCRIPT_FORMAT) |
| Fingerprint / parity tests ignore singers and hide regressions | Extend semantic fingerprint to include sorted character ids on lyric/attribution Moments |
| Over-stripping text that looks like footnotes | Limit to `\[\^\d+\]` pattern |
| Scope creep into lav chart or packets | Keep those as Phase 12+; only ensure data shape does not block them |
| Existing productions lack lyric_lines | Document “re-create production / re-import not available — new import only”; acceptable for pre-pilot |

---

## Follow-on (not this phase)

Agreed next targets after Phase 11:

1. ~~**Lav chart**~~ — Phase 12 matrix MVP shipped 2026-07-26 (wires/packs, propose, edit, print). Still later: change-list sheet; Timeline “get pack on” from approved chart.
2. **Character packets** — “what do I need tonight?” including lines **and** lyrics once singers exist.

Event-driven assets remain parked.

---

## Decision Log


| Date | Decision |
| ---- | -------- |
| 2026-07-25 | Phase 11 scoped to singer attribution + footnotes + #16 leftovers; lav chart and character packets explicitly next, not now |
| 2026-07-25 | Confirmed: no mandatory new attribution glyph; blank lines do not clear singers; `lyric_lines` + `song_attribution_characters`; footnote ban + strip; McNISH stays ALL-CAPS-only |
| 2026-07-25 | Colon escape hatch starts **off** |
| 2026-07-25 | Parenthetical MVP links both Characters to whole lyric lines |
| 2026-07-25 | Footnote definition → Notes stretch deferred |
| 2026-07-25 | Existing imports keep old Moments until recreated (no re-import) |
| 2026-07-25 | Optional `VERSE` / `CHORUS` / similar section markers are ignored (not Moments) |
| 2026-07-25 | #16 audit: Phase 9 hyperlink/punctuation/parity remain green; mixed-case still rejected; residual is singer persistence (this phase) + footnotes (this phase) |

---

## Open Questions for Owner

None — decisions confirmed 2026-07-25.
