# Phase 4 — Timeline Polish, Structural Editing & Prep Objects

**Status:** Complete (2026-07-10)

**Goal:** Finish the director import-review experience, add structural timeline editing, ship the remaining preparation objects (costumes, microphones, set pieces), and deliver the first minimal reports — producing a stable, complete timeline that downstream views can trust.

Phase 3 shipped import-review editing, songs, props, and cues. This document is the execution plan for the implementing agent.

---

## Owner Decisions (2026-07-10)

| Topic | Decision |
| ----- | -------- |
| **Priority** | Structural editing before costumes/mics/set pieces. No rigid global sequence beyond hard dependencies (API before UI, stable timeline before reports). |
| **Structural depth** | MVP = add, delete, reorder only. Split/merge → post-MVP wish list. |
| **Settings scope** | Primary: global **App Settings** page (Admin). Optional production-level settings page only if a concrete per-production flag emerges during implementation. |
| **Costume model** | Scene-level assignment (`character_id` + `scene_id`) per [DATABASE.md](DATABASE.md). Future: event-driven add/remove model (like props) to derive current costume state — out of scope for Phase 4. |
| **Reports** | Prep objects are higher priority than reports, but Phase 4 should still ship **minimal report views** by exit — functional, not polished or deeply analytical. |

---

## Phase 3 Close-Out Review

### Shipped and verified

| Area | Status |
| ---- | ------ |
| Timeline editing API (PATCH moment, dialogue, stage direction) | Done |
| Songs page + timeline filter | Done |
| Props catalog + moment attachments | Done |
| Cue categories + moment cues | Done |
| Extended filters (song, prop, cue category; upgraded cue-only) | Done |
| Backend tests + smoke test | Done |
| UI_STANDARDS Slice 3 | Done |

### Gaps / follow-ups entering Phase 4

| Item | Notes |
| ---- | ----- |
| Timeline list did not reflect edits | **Fixed 2026-07-10** — `display_text` on list rows; sheet no longer closes on save |
| Detail panel closed on prop/cue attach | **Fixed 2026-07-10** — decoupled list refresh from selection reset |
| Type-change warning when structured data exists | Phase 4 P0 — WP2 |
| `moment_props` in [DATABASE.md](DATABASE.md) | Document in WP6 docs pass |
| Costumes, microphones, set pieces | Phase 4 P1 — after structural editing |
| Prop/cue filter UX polish | Phase 4 P2 |
| Live search / multi-select character filter | Wish list — Phase 4 P2 or later |

---

## Read First (authoritative)

| Document | Use for |
| -------- | ------- |
| [PROJECT.md](PROJECT.md) | Vision, domain model, phase scope |
| [DATABASE.md](DATABASE.md) | Schema for costumes (scene-level), microphones, set pieces |
| [ROLES.md](ROLES.md) | Permission matrix |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Timeline + panel patterns |
| [PHASE_3.md](PHASE_3.md) | What already ships |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, Docker, uv |

**Test fixture:** Continue using [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md) for regression.

---

## Phase 4 Theme

Phase 3 made the timeline *editable*. Phase 4 makes it *trustworthy and complete*:

1. Directors see their corrections everywhere (timeline, detail, filters).
2. Directors can fix structure (add/delete/reorder moments) when import got it wrong.
3. Remaining prep objects fill out the production model on a stable timeline.
4. Minimal reports prove the data model is complete enough to generate useful views.

---

## In Scope

### P0 (must-ship) — Timeline editing UX completion

- [x] `display_text` on timeline list rows; sheet stays open on save (shipped 2026-07-10)
- [x] Session-persisted resizable detail panel (shipped 2026-07-10)
- [x] Auto-save on field blur / panel close (remove explicit Save buttons where practical)
- [x] Unified moment detail panel for Director/Admin (single coherent layout; less section sprawl)
- [x] Collapse "edit parsed data" behind a pencil affordance (only expand when correcting parse errors)
- [x] Global App Settings page (Admin) — first flags:
  - [x] Show/hide `original_text` in moment detail (all productions)
  - [x] Show/hide `parsed_text` in moment detail (all productions)
- [x] Natural timeline row layout — prose-like rows with text wrap; optional character column for dialogue
- [x] Moment type change warning when dialogue/stage-direction data would be orphaned

### P1 (should-ship) — Structural editing, prep objects, minimal reports

**Structural editing (before prep objects):**

- [x] Structural timeline editing API — add, delete, reorder moments within a scene
- [x] Structural editing UI in timeline (Director/Admin; confirm destructive actions)

**Prep objects (after structural editing):**

- [x] Costumes — catalog CRUD + scene/character assignment (scene-level; not moment-attached)
- [x] Microphones — catalog CRUD + moment assignments (mirror props pattern)
- [x] Set pieces — catalog CRUD + moment attachments (mirror props pattern)
- [x] Timeline filters for microphone / set piece (Director/Admin); costume filter (`costume_only` — moments where a speaking character has a scene costume)
- [x] Update [DATABASE.md](DATABASE.md) for `moment_props`, microphone/set-piece junction tables

**Reports (minimal — end of phase):**

- [x] Prop sheet — props with moment references and carrier characters, timeline-ordered
- [x] Cue sheet — cues grouped by category, timeline-ordered
- [x] One additional simple report (costume-by-scene) — functional, not polished

### P2 (can slip)

- [x] Admin navigation section — User Management + App Settings visually separated from production prep
- [ ] Prop/cue filter UX polish (multi-select, badges on list rows)
- [x] Live search / multi-select character filter (wish list carryover) — **shipped 2026-08-13**
- [ ] Production-level settings page (only if a concrete per-production flag emerges)

## Out of Scope (defer)

| Item | Target |
| ---- | ------ |
| Split / merge moments | Post-MVP wish list |
| Costume event-driven model (add/remove pieces → derived state) | Phase 5+ event engine |
| Blocking, entrances, exits | Phase 5+ |
| Re-import, full-show import, preparation progress dashboard | Phase 5+ |
| Production `status` / `published` fields | Phase 5+ |
| Rehearsal scheduling, attendance | Phase 5+ |
| Saved views / production home page | Wish list |
| Bookmarks dedicated timeline view | Wish list (owner undecided) |
| Rich / analytical reports, PDF export, print CSS polish | Phase 5+ |

---

## Work Package Priority

| Tier | Packages | Rationale |
| ---- | -------- | --------- |
| **P0** | WP1, WP2, WP3 | Editing UX + settings must feel reliable |
| **P1** | WP4, WP5 → WP6, WP7 → WP9 | Structural fixes first; prep objects on stable timeline; then minimal reports |
| **P2** | WP8, WP10 | Nav polish, filter UX |

**Hard dependencies only:**

- WP4 before WP5 (structural API before UI)
- WP6 before WP7 (prep objects API before UI)
- WP4/WP5 before WP6/WP7 (owner: structural editing before prep objects)
- WP6/WP7 before WP9 (reports need complete prep data)

Everything else can be parallelized or reordered by the implementing agent.

---

## Work Packages

### WP1 — Timeline Display & Save Reliability (P0)

**Objective:** Timeline list and detail always agree after director edits.

**Tasks:**

- [x] `display_text` on `MomentSummary` — derived from dialogue lines, stage direction, or director `parsed_text` override (shipped 2026-07-10)
- [x] Keep moment sheet open after save / prop / cue attach (shipped 2026-07-10)
- [x] Session-persisted resizable detail panel (shipped 2026-07-10)
- [ ] Auto-save: debounced PATCH on blur; save on sheet close if dirty
- [ ] Use PATCH response to update detail state without full refetch where possible
- [ ] Prose-like timeline rows (variable height, wrap; dialogue character column optional)
- [ ] Tests for `display_text` derivation edge cases

**Done when:** Director edits speaker, closes panel, sees updated text in list without refresh confusion.

---

### WP2 — Unified Moment Detail + App Settings (P0)

**Objective:** One coherent director editing surface; global display toggles for import-review workflow.

**Tasks:**

- [ ] Refactor `MomentDetailPanel` into focused subcomponents (read view vs edit view)
- [ ] Pencil toggle for parsed-data correction block
- [ ] `app_settings` table (singleton row or key-value) with `show_original_text`, `show_parsed_text` booleans
- [ ] App Settings page at `/settings` (Admin only) — separate from production prep nav
- [ ] Moment detail respects global settings for all roles
- [ ] Warn on moment type change when dialogue or stage-direction rows exist
- [ ] *(Stretch)* Production-level settings page only if a concrete per-production flag is needed during implementation

**Done when:** Admin hides original text globally after import review; panel feels like one form, not stacked sections.

---

### WP3 — Admin Navigation Restructure (P0/P2)

**Objective:** Separate production prep from app administration.

**Tasks:**

- [ ] Sidebar sections: **Production** (timeline + prep), **Administration** (users, app settings)
- [ ] User Management link does not feel like a production tab
- [ ] Optional: remember last-opened production so admin pages can link back
- [ ] App Settings lives under Administration, not under a production

**Done when:** Clicking User Management or App Settings is clearly "leaving prep mode."

---

### WP4 — Structural Timeline Editing API (P1)

**Objective:** Director can fix importer structure without re-importing.

**Tasks:**

- [ ] `POST /productions/{id}/scenes/{scene_id}/moments` — insert moment at sequence position
- [ ] `DELETE /productions/{id}/moments/{moment_id}` — remove moment and cascade children
- [ ] `PATCH /productions/{id}/moments/{moment_id}/sequence` — reorder within scene (or bulk renumber endpoint)
- [ ] New moments: director supplies `original_text` (or empty); existing `original_text` rows remain immutable
- [ ] Renumber `sequence_number` transactionally within scene
- [ ] Reject Actor mutations (403)
- [ ] Tests: insert, delete, reorder; `original_text` immutability on imported rows

**Out of scope:** split, merge — see wish list.

**Done when:** Director inserts a missing stage-direction moment between two dialogue lines.

---

### WP5 — Structural Timeline Editing UI (P1)

**Tasks:**

- [ ] Insert moment control (between rows or at end of scene)
- [ ] Delete moment with confirmation
- [ ] Reorder via move-up/move-down or drag-and-drop
- [ ] List refreshes without closing detail panel (reuse WP1 pattern)
- [ ] Empty-state guidance when structural edit is needed

**Done when:** Structural fix completed entirely from browser without SQL or re-import.

---

### WP6 — Costumes, Microphones, Set Pieces API (P1)

**Objective:** Complete remaining preparation entities per domain model.

**Costumes (scene-level — not moment-attached):**

Per [DATABASE.md](DATABASE.md), costumes belong to production + character and are assigned to a single scene:

- [ ] Alembic migration 008: `costumes` table (`production_id`, `character_id`, `scene_id`, `name`, `description`)
- [ ] `GET/POST/PATCH/DELETE /productions/{id}/costumes`
- [ ] Validate character and scene belong to same production
- [ ] No moment junction in Phase 4 — scene/character assignment only

**Microphones (moment-attached — mirror props):**

- [ ] Alembic migration 009: `microphones`, `moment_microphones` junction
- [ ] CRUD + moment attach/detach routes
- [ ] Optional `character_id` on junction (who wears the mic)

**Set pieces (moment-attached — mirror props):**

- [ ] Alembic migration 010: `set_pieces`, `moment_set_pieces` junction
- [ ] CRUD + moment attach/detach routes

**Shared:**

- [ ] Extend `MomentSummary` with `has_microphone`, `has_set_piece` flags; filters as appropriate
- [ ] Document `moment_props`, `moment_microphones`, `moment_set_pieces` in [DATABASE.md](DATABASE.md)
- [ ] Permission tests (Director/Admin write; Actor read)

**Done when:** Director assigns a costume to a character for Scene 2; attaches a lav mic and set piece to a moment via API.

---

### WP7 — Costumes, Microphones, Set Pieces UI (P1)

**Tasks:**

- [ ] `CostumesPage.tsx` — catalog CRUD; assign character + scene per row
- [ ] `MicrophonesPage.tsx` — catalog CRUD
- [ ] `SetPiecesPage.tsx` — catalog CRUD
- [ ] Moment sheet sections for microphones and set pieces (progressive disclosure, mirror props/cues)
- [ ] Costumes visible on Characters page or dedicated page — not in moment sheet (scene-level model)
- [ ] Sidebar nav: Costumes, Microphones, Set Pieces under Preparation
- [ ] Timeline filters for microphone / set piece (Director/Admin)

**Done when:** All remaining DATABASE.md preparation entities have usable catalog + assignment UI.

---

### WP8 — Filter & Search Polish (P2)

**Tasks:**

- [ ] Multi-select prop/cue category filters with badge chips
- [x] Live search (debounced; Enter still commits immediately) — **shipped 2026-08-13**
- [x] Multi-select character filter (OR semantics) — **shipped 2026-08-13**
- [ ] Document filter composition in UI helper text

---

### WP9 — Minimal Reports (P1)

**Objective:** Prove timeline data is complete enough for derived views. Functional, not polished.

**Tasks:**

- [ ] Reports section in sidebar (Director/Admin) under production context
- [ ] Prop sheet — all props, moment references, carrier characters, timeline order
- [ ] Cue sheet — grouped by cue category, timeline order
- [ ] One simple third report — costume-by-scene or character scene list (pick simplest to implement)
- [ ] Read-only views; no PDF/print polish required
- [ ] Backend aggregation endpoints or server-rendered JSON consumed by simple table views

**Done when:** Director opens prop sheet and cue sheet from live production data without manual assembly.

**Not required:** deep analytics, export formats, print CSS, cross-production reports.

---

### WP10 — Documentation, Tests & Hardening (runs throughout)

**Tasks:**

- [x] `backend/tests/test_phase4.py` — structural editing, prep objects, settings, reports
- [x] Extend `backend/scripts/smoke_test.py`
- [x] Update [UI_STANDARDS.md](UI_STANDARDS.md) Slice 4
- [x] Update [DATABASE.md](DATABASE.md) for all Phase 4 tables
- [x] Update this document's checkboxes
- [x] Run pytest + frontend build

---

## Phase 4 Exit Criteria

### P0 (required)

- [x] Director edits visible in timeline list and detail without sheet closing (2026-07-10)
- [x] Auto-save works for parsed text, stage direction, dialogue speaker
- [x] Global App Settings can hide original and/or parsed text in moment detail
- [x] Timeline rows read like script text, not uniform table cells
- [x] Admin nav separates production prep from administration

### P1 (should-ship)

- [x] Director adds, deletes, and reorders moments in a scene (no split/merge)
- [x] Costumes assignable at scene + character level
- [x] Microphones and set pieces attachable to moments
- [x] Prop sheet and cue sheet reports render from live data
- [x] DATABASE.md documents all junction tables

### P2 (nice-to-have)

- [ ] Filter/search polish (live search, multi-select)
- [x] Third minimal report beyond prop/cue sheets (costumes-by-scene)

---

## Technical Decisions (pre-made — do not re-litigate)

| Topic | Decision |
| ----- | -------- |
| `original_text` | Immutable on imported rows; newly inserted moments get director-supplied text |
| Edit permissions | Admin + Director for structural edits and prep objects |
| Display text | Backend derives `display_text` for list rows |
| Settings scope | Global App Settings (Admin); production-level only if concrete need arises |
| Costume assignment | Scene + character in Phase 4; event-driven model deferred |
| Costume timeline filter | `costume_only` boolean — moments where a speaking character has a costume for the scene |
| Microphones / set pieces | Catalog + moment junction (mirror props) |
| Structural edits | Add, delete, reorder only; scene-scoped `sequence_number` renumber in one transaction |
| Split / merge | Post-MVP wish list |
| Reports | Minimal read-only views; prep objects must ship first |
| UI pattern | Timeline stays visible; edit through side panel |

---

## Decisions Log

| Date | Decision |
| ---- | -------- |
| 2026-07-10 | Phase 4 draft created from scratch notes + Phase 3 deferred items |
| 2026-07-10 | Hotfixes: `display_text`, sheet persistence, panel resize, props/cues UX |
| 2026-07-10 | Owner: structural editing before prep objects; flexible order otherwise |
| 2026-07-10 | Owner: structural MVP = add/delete/reorder; split/merge → wish list |
| 2026-07-10 | Owner: global App Settings primary; production settings only if needed |
| 2026-07-10 | Owner: costumes scene-level now; event-driven costume changes later |
| 2026-07-10 | Owner: prep objects > reports, but minimal reports required by phase exit |
| 2026-07-10 | Owner: costume timeline filter = `costume_only` (speaking character has scene costume); not per-character/scene pickers |

---

## Suggested Agent Execution Order

Hard dependencies shown with `→`. Other packages can run in parallel where convenient.

```
WP1 (remaining auto-save + layout)
WP2 Unified detail + App Settings    WP3 Admin nav
  → WP4 Structural API → WP5 Structural UI
    → WP6 Prep objects API → WP7 Prep objects UI
      → WP9 Minimal reports
WP8 Filter polish (anytime; can slip)
WP10 Docs & tests (throughout)
```

WP2 and WP3 can start alongside WP1 completion. WP8 is independent and lowest priority.

---

## API Contract Sketches

### App settings

```http
GET /api/settings
→ { "show_original_text": true, "show_parsed_text": true }

PATCH /api/settings
{ "show_original_text": false, "show_parsed_text": false }
```

Admin only.

### Structural editing

```http
POST /api/productions/{id}/scenes/{scene_id}/moments
{ "sequence_number": 42, "moment_type_id": 2, "original_text": "CREAN crosses downstage." }

DELETE /api/productions/{id}/moments/{moment_id}

PATCH /api/productions/{id}/moments/{moment_id}/sequence
{ "sequence_number": 43 }
```

### Costumes (scene-level)

```http
POST /api/productions/{id}/costumes
{ "character_id": 3, "scene_id": 12, "name": "Expedition parka", "description": "…" }
```

### Microphones / set pieces (moment-attached)

Mirror props pattern:

```http
POST /api/productions/{id}/moments/{moment_id}/microphones
{ "microphone_id": 1, "character_id": 3, "notes": "…" }

POST /api/productions/{id}/moments/{moment_id}/set-pieces
{ "set_piece_id": 2, "notes": "…" }
```

---

## Manual Smoke Test Script

### P0 path

1. Log in as Admin → App Settings → hide original text → open moment → confirm hidden.
2. Log in as Director → edit stage direction → blur field → confirm auto-save; list updates.
3. Confirm detail panel stays open through edit cycle.

### P1 structural path

1. Director → insert stage-direction moment between two dialogue lines → reorder → delete test moment.
2. Confirm `original_text` on imported rows unchanged.

### P1 prep objects path

1. Costumes → assign parka to CREAN in Scene 1.
2. Microphones → create Lav 1 → attach to a moment with carrier character.
3. Set Pieces → create "Table" → attach to a moment.

### P1 reports path

1. Open Prop sheet → confirm Sextant (or test prop) with moment references.
2. Open Cue sheet → confirm cues grouped by category in timeline order.

---

## Local Dev Quick Start

Unchanged from Phase 3:

```bash
docker compose up --build
```

| URL | Purpose |
| --- | ------- |
| http://localhost:5173 | Frontend |
| http://localhost:8000/health | Backend health |
| `admin` / `admin` | Admin |
| `director` / `director` | Director |
| `actor` / `actor` | Actor |

```bash
cd backend && uv sync && uv run pytest
cd backend && uv run python scripts/smoke_test.py
```

---

## Notes for Implementing Agent

- WP1 is partially complete from 2026-07-10 hotfixes — verify checkboxes before re-implementing.
- Do not add `productions.status` or `productions.published`.
- Keep filter logic in the backend; frontend sends query params.
- Costumes use scene-level assignment — do not invent `moment_costumes` unless owner changes the model.
- Reports are proof-of-concept views, not a reporting subsystem.
- When uncertain, choose the simpler implementation and document the tradeoff in this file.
- Update this document's checkboxes as work completes.
