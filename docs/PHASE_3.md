# Phase 3 — Import Review & Production Preparation

**Status:** Complete (P0 + P1 shipped; 2026-07-10)

**Post-close hotfixes (2026-07-10):** Timeline list `display_text`, sheet persistence on edit, props/cues UX polish, resizable detail panel — see [PHASE_4.md](PHASE_4.md) WP1 (partial).

**Goal:** Directors and Admins can review and correct imported timeline data (without changing sacred `original_text`), manage songs, and attach props and technical cues to moments — completing the production-preparation workflow on top of the Phase 2 rehearsal experience.

Phase 2 is complete. This document is the execution plan for the implementing agent.

---

## Current Status (2026-07-10)

### Shipped (P0)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Timeline editing API | Done | PATCH moment, dialogue, stage-direction; `GET /moment-types` |
| Timeline editing UI | Done | Moment sheet edit controls (Director/Admin) |
| Songs page + filter | Done | `SongsPage.tsx`; timeline `song_id` filter |
| Backend tests | Done | `backend/tests/test_phase3.py` (6 tests) |
| Smoke test | Done | Checks 16–20 in `backend/scripts/smoke_test.py` |

### Shipped (P1)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Props schema (006) | Done | `props`, `moment_props` |
| Cues schema (007) | Done | `cue_categories`, `cues` |
| Props API + UI | Done | Catalog page; moment sheet attachments |
| Cues API + UI | Done | Cue categories page; moment sheet cues |
| Extended timeline filters | Done | `prop_id`, `cue_category_id`; cue-only upgrade |
| UI standards Slice 3 | Done | [UI_STANDARDS.md](UI_STANDARDS.md) v0.3 |

### Deferred (P2 / Phase 4)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Timeline list reflects edits | Done | `display_text` on `MomentSummary` (2026-07-10 hotfix) |
| Detail panel persistence | Done | Sheet stays open on save/attach (2026-07-10 hotfix) |
| Costumes, microphones, set pieces | Phase 4 | See [PHASE_4.md](PHASE_4.md) |
| Structural timeline editing | Phase 4 | See [PHASE_4.md](PHASE_4.md) |
| Prop/cue filter UX polish | Phase 4 P2 | Multi-select, list badges |

---

## Read First (authoritative)

| Document | Use for |
| -------- | ------- |
| [PROJECT.md](PROJECT.md) | Vision, domain model, phase scope |
| [DATABASE.md](DATABASE.md) | Schema for props, cues, moment attachments |
| [ROLES.md](ROLES.md) | Permission matrix — enforce on API and UI |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Slice 1–2 baseline; extend for Slice 3 |
| [PHASE_2.md](PHASE_2.md) | What already ships (casting, filters, notes) |
| [ERD.md](ERD.md) | Entity relationships |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, Docker, uv, patterns |

**Test fixture:** Continue using [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md) for regression.

---

## In Scope

### P0 (must-ship) — **complete in codebase**

- [x] Timeline import-review editing API (PATCH moment, dialogue, stage direction)
- [x] Timeline editing UI in moment Sheet (Director/Admin only; Actors read-only)
- [x] `GET /api/moment-types` for type selector
- [x] Songs page (list/create/edit) — backend already exists
- [x] Moment sheet song link/unlink via moment PATCH
- [x] Timeline filter by song (`song_id` query param)
- [x] Backend tests for editing permissions and `original_text` immutability
- [x] Extend smoke test for Phase 3 P0 paths

### P1 (should-ship) — **complete in codebase**

- [x] Alembic migration 006: `props`, `moment_props`
- [x] Alembic migration 007: `cue_categories`, `cues`
- [x] Props catalog CRUD + moment attach/detach API
- [x] Props page + moment sheet props section
- [x] Optional timeline filter by `prop_id`
- [x] Cue categories CRUD + cues CRUD on moments
- [x] Cue categories page + moment sheet cues section
- [x] Upgrade cue-only mode to include moments with attached cues
- [x] Optional timeline filter by `cue_category_id`
- [x] Backend tests for props and cues

### P2 (can slip)

- [ ] Costumes, microphones, set pieces
- [ ] Prop/cue filter UX polish (multi-select, list badges)
- [x] Live search / multi-select character filter (Phase 2 wish list) — **shipped 2026-08-13**

## Out of Scope (defer to Phase 4+)

- Structural timeline editing (add/delete/reorder/split/merge moments)
- Blocking, entrances, exits (future event model)
- Re-import, full-show import, preparation progress dashboard
- Phase 4 reports (prop sheets, cue sheets)
- Production `status` / `published` fields
- Action parenthetical extraction (carried from Phase 1)

---

## Prerequisites (from Phase 2)

Confirm before starting Phase 3 work:

- [x] `docker compose up` works from a clean clone
- [x] Admin can import `endurance-scene1.md` and view 90 moments in Scene 1
- [x] Casting, timeline filters, notes, and bookmarks work
- [x] JWT auth and role enforcement are in place
- [x] `backend/tests/test_phase2.py` passes

---

## Suggested Repository Layout (additions)

```
backend/app/
├── models/
│   ├── prop.py
│   ├── moment_prop.py
│   ├── cue_category.py
│   └── cue.py
├── api/
│   ├── props.py
│   └── cues.py
├── schemas/
│   ├── timeline_editing.py
│   ├── props.py
│   └── cues.py
└── services/
    └── timeline_filters.py   # extend: song, prop, cue filters; cue-only upgrade

frontend/src/
├── pages/
│   ├── SongsPage.tsx
│   ├── PropsPage.tsx
│   └── CueCategoriesPage.tsx
└── (extend TimelinePage.tsx moment Sheet)
```

---

## Domain Clarifications (for implementers)

### Sacred original text

Imported `moments.original_text` is **never modified** after import. All director corrections update structured/parsed fields only:

| Field | Editable in Phase 3 |
| ----- | ------------------- |
| `original_text` | **No** — display only |
| `parsed_text` | Yes |
| `moment_type_id` | Yes |
| `song_id` | Yes |
| `dialogue.character_id` | Yes |
| `dialogue.dialogue_text` | Yes |
| `stage_directions.direction_text` | Yes |

This replaces the removed Phase 2 verification checklist — directors validate imports by reading and correcting the timeline.

### Props attachment model

`props` is a production-level catalog. `moment_props` is a junction table (Phase 3 addition — not yet in DATABASE.md):

| Column | Notes |
| ------ | ----- |
| `moment_id` | FK → moments |
| `prop_id` | FK → props |
| `character_id` | Nullable — who carries/uses the prop |
| `notes` | Nullable — e.g. "enters with sextant" |

### Technical cues

Per [DATABASE.md](DATABASE.md): `cues` attach to `moments` via `moment_id`; categorized by `cue_categories`. `payload` is JSON for structured data; MVP UI uses title + category + notes.

### Cue-only mode (Phase 3 upgrade)

Phase 2: `stage_direction`, `song_header`, `song_attribution` only.

Phase 3: **also include** any moment that has ≥1 row in `cues` (even if moment type is dialogue).

---

## Work Package Priority

| Tier | Packages | Rationale |
| ---- | -------- | --------- |
| **P0** | WP1, WP2, WP3 | Import review + songs — unblocks director workflow |
| **P1** | WP4, WP5, WP6, WP7 | Production prep objects on moments |
| **P2** | WP8 docs/tests (runs throughout) | Hardening |

---

## Work Packages

### WP1 — Timeline Editing API (P0)

**Objective:** Director/Admin can correct parsed timeline data after import.

**Tasks:**

- [x] `GET /api/moment-types` — list lookup table for UI type selector
- [x] `PATCH /productions/{id}/moments/{moment_id}` — `moment_type_id`, `parsed_text`, `song_id` (nullable to unlink)
- [x] `PATCH /productions/{id}/moments/{moment_id}/dialogue/{line_id}` — `character_id`, optional `dialogue_text`
- [x] `PATCH /productions/{id}/moments/{moment_id}/stage-direction` — `direction_text`
- [x] Extend `DialogueLineResponse` with `id` field
- [x] Reject PATCH attempts that include `original_text`
- [x] Validate character/song belong to same production
- [x] Actor → 403 on all PATCH routes
- [x] Tests in `backend/tests/test_phase3.py`

**Done when:** Director can reassign dialogue speaker; Actor cannot.

---

### WP2 — Timeline Editing UI (P0)

**Objective:** Edit controls in moment Sheet; timeline stays visible.

**Tasks:**

- [x] Moment type dropdown (Director/Admin)
- [x] Song link dropdown (Director/Admin)
- [x] Parsed text textarea (Director/Admin)
- [x] Dialogue speaker dropdown per line (Director/Admin)
- [x] Stage direction editable textarea (Director/Admin)
- [x] Save triggers PATCH + refresh detail
- [x] Actors see read-only fields (unchanged from Phase 2)

**Done when:** Director fixes a mis-assigned speaker from the browser.

---

### WP3 — Songs Frontend + Filter (P0)

**Objective:** Complete PROJECT.md Slice 3.

**Tasks:**

- [x] `SongsPage.tsx` — table with title, composer, lyricist; create/edit forms
- [x] Sidebar nav: Songs (all roles view; Director/Admin edit)
- [x] `api.ts` song methods
- [x] Timeline song filter dropdown
- [x] Backend: `song_id` query param on moments list

**Done when:** Director creates a song and filters timeline to its moments.

---

### WP4 — Props Schema + API (P1)

**Objective:** Production prop catalog and moment attachments.

**Migration 006:**

- [x] `props` — per DATABASE.md
- [x] `moment_props` — junction (see Domain Clarifications)

**Tasks:**

- [x] `GET/POST/PATCH/DELETE /productions/{id}/props`
- [x] `GET/POST/DELETE /productions/{id}/moments/{moment_id}/props`
- [x] Extend moment detail with `props[]`
- [x] Extend moment summary with `has_props` flag
- [x] `prop_id` filter on moments list
- [x] Permission tests

**Done when:** API can attach "Sextant" prop to a moment with optional carrier character.

---

### WP5 — Props UI (P1)

**Tasks:**

- [x] `PropsPage.tsx` — catalog CRUD
- [x] Moment sheet props section — attach/detach, carrier character
- [x] Optional prop filter on timeline (Director/Admin)
- [x] Sidebar nav: Props

**Done when:** Director attaches a prop from moment sheet in browser.

---

### WP6 — Cues Schema + API (P1)

**Objective:** Technical cue categories and moment-attached cues.

**Migration 007:**

- [x] `cue_categories` — per DATABASE.md
- [x] `cues` — per DATABASE.md (`payload` JSON)

**Tasks:**

- [x] `GET/POST/PATCH/DELETE /productions/{id}/cue-categories`
- [x] `GET/POST/PATCH/DELETE /productions/{id}/moments/{moment_id}/cues`
- [x] Extend moment detail with `cues[]`
- [x] Extend moment summary with `has_cues` flag
- [x] Update `timeline_filters.py` cue-only logic
- [x] `cue_category_id` filter on moments list
- [x] Permission tests

**Done when:** Director adds a Lighting cue to a moment via API.

---

### WP7 — Cues UI + Cue-Only Upgrade (P1)

**Tasks:**

- [x] `CueCategoriesPage.tsx` — category CRUD
- [x] Moment sheet cues section — add/edit/delete
- [x] Cue-only checkbox uses upgraded backend filter
- [x] Optional cue category filter on timeline
- [x] Sidebar nav: Cue Categories

**Done when:** Cue-only mode shows moments with attached technical cues.

---

### WP8 — Documentation, Tests & Hardening

**Tasks:**

- [x] `backend/tests/test_phase3.py` — full Phase 3 coverage
- [x] Extend `backend/scripts/smoke_test.py`
- [x] Update [UI_STANDARDS.md](UI_STANDARDS.md) Slice 3
- [x] Update this document's checkboxes
- [x] Run pytest + frontend build

**Done when:** CI green; smoke test covers Phase 3 paths.

---

## Phase 3 Exit Criteria

### P0 (required)

- [x] Director fixes mis-assigned dialogue speaker on a moment
- [x] Director changes moment type or links a song
- [x] Songs page works; timeline filters by song
- [x] Actor cannot edit timeline content (403)
- [x] `original_text` unchanged after edits
- [x] pytest + smoke test pass for P0 paths

### P1 (should-ship)

- [x] Director creates props and attaches to moments
- [x] Director creates cue categories and cues on moments
- [x] Cue-only mode includes moments with cues
- [x] Prop/cue data visible in moment sheet (Actors read-only)
- [x] pytest covers props and cues permissions

---

## Manual Smoke Test Script

### P0 path

1. Log in as Director; open Endurance production.
2. Open a dialogue moment → change speaker to another character → save → confirm update persists.
3. Open a stage direction moment → edit direction text → save.
4. Go to Songs → create or edit a song → return to Timeline.
5. Open a moment → link to song → filter timeline by that song.
6. Log in as Actor → open same moment → confirm no edit controls.

### P1 path

1. Log in as Director → Props → create "Sextant".
2. Open a moment → attach Sextant with carrier character → save.
3. Filter timeline by Sextant (if filter shipped).
4. Cue Categories → create "Lighting".
5. Open a moment → add cue "Fade to blue" in Lighting category.
6. Enable cue-only mode → moment with cue appears even if type is dialogue.

---

## Technical Decisions (pre-made — do not re-litigate)

| Topic | Decision |
| ----- | -------- |
| `original_text` | Immutable after import |
| Edit permissions | Admin + Director only |
| Structural editing | Deferred to Phase 4 (owner decision) |
| Props attachment | `moment_props` junction table |
| Cue payload | JSON column; MVP UI optional textarea |
| Cue-only mode (Phase 3) | Phase 2 types OR moments with `cues` rows |
| Filter logic | Backend query params on moments endpoint |
| UI pattern | Edit through moment Sheet; timeline stays visible |
| Migrations | 006 props, 007 cues (separate revisions) |
| Moment types | Global lookup; `GET /api/moment-types` |

---

## Decisions Log

| Date | Decision |
| ---- | -------- |
| 2026-07-10 | Phase 3 P0 = import-review editing + songs; structural editing → Phase 4 |
| 2026-07-10 | `moment_props` junction for prop-to-moment attachments |
| 2026-07-10 | Cue-only upgraded to include moments with attached cues |

---

## Known Risks & Watch Items

1. **Type changes on moments with dialogue/stage data** — Allow type change but warn in UI if structured data exists for old type.
2. **Song filter vs character filter** — Filters compose; document interaction in UI.
3. **Cue-only + dialogue moments with cues** — Intentional Phase 3 behavior for tech rehearsal.
4. **Prop duplicate attach** — Prevent duplicate `(moment_id, prop_id)` pairs.

---

## Suggested Agent Execution Order

```
WP1 Timeline editing API → WP2 Timeline editing UI
  → WP3 Songs frontend + filter
    → WP4 Props API → WP5 Props UI
      → WP6 Cues API → WP7 Cues UI
        → WP8 Docs & tests
```

WP3 can parallel WP2 after WP1.

---

## API Contract Sketches

### Moment types

```http
GET /api/moment-types
→ [{ "id": 1, "name": "dialogue" }, …]
```

### Timeline editing

```http
PATCH /api/productions/{id}/moments/{moment_id}
{ "moment_type_id": 2, "song_id": 5, "parsed_text": "…" }

PATCH /api/productions/{id}/moments/{moment_id}/dialogue/{line_id}
{ "character_id": 3, "dialogue_text": "…" }

PATCH /api/productions/{id}/moments/{moment_id}/stage-direction
{ "direction_text": "CREAN crosses downstage." }
```

### Props

```http
POST /api/productions/{id}/props
{ "name": "Sextant", "description": "…", "notes": "…" }

POST /api/productions/{id}/moments/{moment_id}/props
{ "prop_id": 1, "character_id": 3, "notes": "enters with sextant" }

DELETE /api/productions/{id}/moments/{moment_id}/props/{moment_prop_id}
```

### Cues

```http
POST /api/productions/{id}/cue-categories
{ "name": "Lighting", "description": "…" }

POST /api/productions/{id}/moments/{moment_id}/cues
{ "cue_category_id": 2, "title": "Fade to blue", "notes": "…", "payload": {} }
```

### Moments list (extended filters)

```http
GET /api/productions/{id}/scenes/{scene_id}/moments?song_id=5&prop_id=1&cue_category_id=2&cue_only=true
```

---

## Notes for Implementing Agent

- Follow [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md): readability over cleverness, vertical slices, Docker, uv.
- Do not add `productions.status` or `productions.published`.
- Keep filter/search logic in the backend; frontend sends query params.
- When uncertain, choose the simpler implementation and document the tradeoff.
- Update this document's checkboxes as work completes.

---

## Local Dev Quick Start

Phase 3 builds on Phase 1–2 — same stack:

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

## Phase 4 Preview (context only — do not implement)

See [PHASE_4.md](PHASE_4.md). Structural editing, prep objects, App Settings, minimal reports.
