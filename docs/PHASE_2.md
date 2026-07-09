# Phase 2 — Character Workflow & Actor Experience

**Status:** Complete (P0 + P2 shipped; owner sign-off 2026-07-09)

**Goal:** After import, Directors and Admins can cast actors to characters and give every role a useful timeline experience — actor-filtered views, search, notes, bookmarks, and cue-only rehearsal mode. Groups are an optional P2 add-on.

Phase 1 is complete. This document is the execution plan for the implementing agent.

---

## Current Status (2026-07-09)

### Shipped (P0)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Schema (003) | Done | `user_character_assignments`, `notes`, `bookmarks` |
| Casting API + UI | Done | Characters page; one actor per character |
| Actor production list filter | Done | Actors see only cast productions |
| Timeline filters | Done | Character filter, search, cue-only; stage directions referencing filtered characters included |
| Line highlighting | Done | Dialogue + character-referenced stage directions |
| Notes + bookmarks API/UI | Done | Moment sheet; bookmark icon button |
| Backend tests | Done | `backend/tests/test_phase2.py` |
| Smoke test | Done | Extended in `backend/scripts/smoke_test.py` |

### Shipped (P2)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Groups schema (005) | Done | `groups`, `character_groups`, `user_groups` |
| Groups API | Done | CRUD + member assignment (characters + users) |
| Groups UI | Done | Character and actor membership |
| Timeline filter by group | Done | Director/Admin group dropdown on timeline |

### Removed / deferred (owner decision)

| Area | Decision |
| ---- | -------- |
| Character/song verification | **Removed** — import review happens by reading/editing the timeline directly; not an MVP checklist feature |
| Song management UI | Deferred — backend song endpoints exist; no frontend page |

### Recent UX tweaks (2026-07-09)

- Timeline character filter defaults to **All characters** for every role (including Actors)
- Production list action renamed **Open** (was "Timeline")
- Bookmark toggle uses a **Bookmark icon** (lucide-react) instead of text
- Character filter includes **stage directions** that mention the selected character name(s)
- Import preprocessing repairs an additional mojibake quote variant (`â€˜` → `'`)
- `fixtures/scripts/endurance-scene1.md` mojibake cleaned

- Act/scene selector label fix (no duplicate "Act 1: Act 1")

### Phase 2 closed

- [x] Owner manual smoke test sign-off (2026-07-09)
- [x] CI workflow present (`.github/workflows/ci.yml`)
- [x] Groups UI: user assignment + timeline group filter

See [Wish List](#wish-list-deferred) for post-MVP ideas captured from owner notes.

---

## Read First (authoritative)


| Document                                                          | Use for                                         |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| [PROJECT.md](PROJECT.md)                                          | Vision, domain model, phase scope               |
| [DATABASE.md](DATABASE.md)                                        | Schema for new tables and fields                |
| [ROLES.md](ROLES.md)                                              | Permission matrix — enforce on API and UI       |
| [UI_STANDARDS.md](UI_STANDARDS.md)                                | Slice 1 baseline; extend for Slice 2 screens    |
| [PHASE_1.md](PHASE_1.md)                                          | What already ships (import, read-only timeline) |
| [ERD.md](ERD.md)                                                  | Entity relationships for casting and groups     |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, Docker, uv, patterns                |


**Test fixture:** Continue using [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md) for regression; add Phase 2 scenarios as needed.

---



## In Scope



### P0 (must-ship) — **complete in codebase**

- [x] Alembic migration: `user_character_assignments`, `notes`, `bookmarks` (see WP1)
- [x] Casting: assign one Actor user per character (`user_character_assignments`)
- [x] Production list filtering: **Actors** see only productions where they are cast; **Directors and Admins** see all productions (unchanged from Phase 1)
- [x] Actor-filtered timeline view (filter moments by selected character(s); includes stage directions referencing those characters)
- [x] Line highlighting for the actor's character(s) on the timeline
- [x] Timeline text search (within a production; scene-scoped)
- [x] Cue-only rehearsal mode toggle on the timeline
- [x] Notes API + UI on moments (public and private visibility per [ROLES.md](ROLES.md))
- [x] Bookmarks API + UI (private per user; icon toggle in moment sheet)
- [x] Preparation sidebar nav: Characters (casting-focused)
- [x] Backend tests for new APIs and permission rules
- [x] Update smoke test script for Phase 2 happy paths



### P1 (removed from MVP)

~~Character and song verification workflow~~ — **removed per owner decision (2026-07-09).** Import accuracy is validated by directors reviewing the timeline directly after import; a separate verify/unverify checklist is deferred indefinitely.

- [x] Manual add character missed by importer (shipped on Characters page)



### P2 (can slip to late Phase 2)

- [x] Groups: create groups; assign characters (API + partial UI)
- [x] Groups: assign users in UI
- [x] Groups UI and timeline filter-by-group



## Out of Scope (defer to Phase 3+)

- Technical cues (`cues`, `cue_categories`) — cue-only mode uses moment-type filtering until cues exist
- Blocking, entrances, exits, props, costumes, microphones
- Timeline structure editing (split/merge/reorder moments; edit imported `original_text`)
- Director production-list filtering by assignment (Phase 5+)
- Understudy / multi-actor-per-character casting (exception may come via Groups later)
- Full-show import (`endurance-full.md`)
- Preparation progress dashboard (future)
- Production `status` / `published` fields
- Action parenthetical extraction (carried forward from Phase 1 deferral)

---



## Prerequisites (from Phase 1)

Confirm before starting Phase 2 work:

- [x] `docker compose up` works from a clean clone
- [x] Admin can import `endurance-scene1.md` and view 90 moments in Scene 1
- [x] `GET /api/productions/{id}/characters` returns importer-discovered characters
- [x] JWT auth and role enforcement are in place
- [x] Owner browser walkthrough of Phase 1 manual smoke test (recommended sign-off)

---



## Suggested Repository Layout (additions)

```
backend/app/
├── models/
│   ├── group.py
│   ├── user_character_assignment.py
│   ├── note.py
│   └── bookmark.py
├── api/
│   ├── characters.py      # casting endpoints
│   ├── groups.py
│   ├── notes.py
│   └── bookmarks.py
└── services/
    └── timeline_filters.py   # actor filter, cue-only, search helpers

frontend/src/
├── pages/
│   ├── CharactersPage.tsx
│   ├── GroupsPage.tsx
│   └── (extend TimelinePage.tsx)
└── components/
    ├── CharacterCastingPanel.tsx
    ├── TimelineSearchBar.tsx
    └── NoteEditor.tsx
```

Adjust as needed; keep business logic in the backend.

---



## Domain Clarifications (for implementers)



### Users vs characters vs casting


| Entity                       | Scope                      | Notes                                                |
| ---------------------------- | -------------------------- | ---------------------------------------------------- |
| `users`                      | Organization               | One login per deployment org; **not** per-production |
| `characters`                 | Production                 | Importer creates these per production                |
| `user_character_assignments` | Production (via character) | Links org user → production character                |


An Actor user may be cast to multiple characters in one production and to characters in different productions. Each assignment is a separate row. Do not introduce per-production user records.

### ~~What verification means~~ (removed)

Character/song verification was planned as a P1 soft checklist but **removed from MVP** (2026-07-09). Directors validate import results by reading the timeline and (in Phase 3+) editing moments directly. Do not reintroduce `is_verified` fields without an explicit owner decision.

### Casting rules (MVP)


| Rule                 | Decision                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Characters per actor | **Many** — one actor may play multiple characters in a production                            |
| Actors per character | **One** — no understudies in MVP                                                             |
| Understudy exception | Deferred — may later cast via **Groups** (e.g. ensemble), not multiple rows on one character |
| Castable users       | Users with the **Actor** app role only                                                       |
| Un-cast character    | Allowed — character exists with no assignment                                                |
| Re-cast              | Replacing assignment clears previous actor on that character                                 |


Enforce one actor per character with `UNIQUE(character_id)` on `user_character_assignments`.

### Groups (late Phase 2 — design now, build later)

Groups organize characters and optionally users (Ensemble, Crew, etc.). **Do not block Groups when building P0:**

- Casting API operates on individual characters only
- Timeline actor filter accepts `character_ids` — group expansion can be added later as `group_id` → resolve to member character IDs
- WP1 P0 migration omits group tables; add in a separate migration when WP4 starts
- Sidebar nav can reserve a "Groups" slot hidden until P2

---



## Work Package Priority


| Tier                 | Packages                                                                    | Rationale                                                          |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **P0 (must-ship)**   | WP1 (schema subset), WP3, WP5 (notes/bookmarks), WP6, WP7 (casting UI), WP9 | First rehearsal value: cast actors, find lines, cue-only, annotate |
| **P2 (can slip)**    | WP4, WP8 (groups)                                                           | Organizational; not on owner's P0 list                             |


WP1 still needs `user_character_assignments`, `notes`, and `bookmarks` tables for P0. Groups tables land in migration 005.

### WP1 — Schema: Casting, Notes, Bookmarks

**Objective:** Database supports P0 entities; group tables in separate migration 005.

**P0 migration (003 — shipped):**

- [x] `user_character_assignments`
  - `id`, `user_id` (FK → users), `character_id` (FK → characters)
  - `UNIQUE(character_id)` — one actor per character
  - Index on `user_id` (for actor production-list query)
  - `created_at` optional
- [x] `notes`
  - Per [DATABASE.md](DATABASE.md): `id`, `user_id`, `visibility` (`public` | `private`), `content`, `created_at`
  - **Phase 2 MVP attach targets:** `moment_id`, `character_id` (both nullable; exactly one reference required on create — validate in service layer)
  - Other nullable FKs (`production_id`, `scene_id`, etc.) may be omitted from migration until needed
- [x] `bookmarks`
  - `id`, `user_id`, `moment_id`, `label` (nullable), `created_at`
  - `UNIQUE(user_id, moment_id)` recommended

**Not in WP1 P0 (WP4 / late Phase 2):**

- `groups`, `character_groups`, `user_groups` — migration 005

**Tasks:**

- [x] Alembic revision(s) as above
- [x] SQLAlchemy models + relationships on `Character`, `User`, `Moment`
- [x] Update [ERD.md](ERD.md) when group migration lands

**Done when:** P0 migration applies cleanly; models import; Phase 1 seed unchanged; pytest still passes.

---



### ~~WP2 — Character & Song Verification API~~ (removed)

Verification was removed from MVP. Skip this work package.

---



### WP3 — Casting API (P0) — **done**

**Objective:** Directors/Admins assign exactly one Actor user per character.

Tasks:

- [x] `GET /productions/{id}/casting` — all assignments: `{ character_id, character_name, user_id, user_display_name }`
- [x] `PUT /productions/{id}/characters/{character_id}/cast` — body: `{ "user_id": number | null }` — assign or clear; reject if user lacks Actor role
- [x] Reject second assignment to same character (DB unique + 409 from API)
- [x] `GET /users` — add optional `?role=Actor` filter for cast picker (or dedicated castable-users endpoint)
- [x] Update `GET /productions`:
  - **Admin / Director:** all productions (unchanged)
  - **Actor:** productions where user has ≥1 `user_character_assignments` row via any character in that production
- [x] Tests: Actor sees filtered list; uncast Actor sees empty list; one actor per character enforced

**Done when:** Casting CREAN to `actor` user restricts Actor production list and enables actor timeline filter.

---



### WP4 — Groups API (P2) — **done**

**Objective:** Directors/Admins create groups and assign members. Migration 005.

Tasks:

- [x] Migration: `groups`, `character_groups`, `user_groups` per [DATABASE.md](DATABASE.md)
- [x] `GET/POST /productions/{id}/groups`
- [x] `PATCH/DELETE /productions/{id}/groups/{group_id}`
- [x] `PUT /productions/{id}/groups/{group_id}/characters` — set character membership
- [x] `PUT /productions/{id}/groups/{group_id}/users` — set user membership
- [ ] Optional: `GET .../moments?group_id=` — expand group to character_ids for timeline filter
- [x] Permission tests per [ROLES.md](ROLES.md)

**Done when:** "Ensemble" group created and populated via API without changes to casting schema.

---



### WP5 — Notes & Bookmarks API (P0) — **done**

**Objective:** All roles can add notes (per visibility rules) and private bookmarks.

Tasks:

- [x] Notes CRUD with visibility (`public` | `private`)
- [x] Bookmarks CRUD — scoped to current user; moment reference
- [x] `GET /productions/{id}/moments/{moment_id}` — include `notes` array (public + caller's private) and `is_bookmarked` for caller
- [x] `GET /users/me/bookmarks?production_id=` — list bookmarks for production (optional convenience)
- [x] Tests: visibility enforcement; user cannot read another user's private note

**Done when:** Actor can bookmark a moment; Director can add public note on a moment; Actor cannot see another user's private note.

---



### WP6 — Timeline Filters (P0) — **done**

**Objective:** Timeline becomes rehearsal-useful for actors and directors.

```
GET /productions/{id}/scenes/{scene_id}/moments
  ?character_ids=1,2,3   # filter: dialogue for character(s) + stage directions mentioning those names
  ?search=shackleton     # case-insensitive substring on original_text (scene-scoped)
  ?cue_only=true         # stage_direction | song_header | song_attribution only
```

Tasks:

- [x] **Actor filter:** filter by `character_ids`; default UI filter is "all" for every role
- [x] **Stage directions:** include `stage_direction` moments whose text references a filtered character name (ALL-CAPS word match)
- [x] **Highlighting:** frontend — highlight dialogue rows and character-referenced stage directions
- [x] **Search:** scene-scoped `ILIKE` on `moments.original_text`; return matching moments still in sequence order
- [x] **Cue-only mode:** include only moment types `stage_direction`, `song_header`, `song_attribution`
- [x] Hide `author_note` moments from Actor role always (even without cue_only)
- [x] Centralize filter logic in `services/timeline_filters.py`
- [x] Tests for filter modes and Actor author_note hiding

**Done when:** Logged-in Actor sees highlighted lines for their character; cue-only hides dialogue; search finds "Shackleton".

---



### WP7 — Preparation UI: Characters & Casting (P0) — **done**

**Objective:** Directors manage casting from the production context.

Tasks:

- [x] Characters page: table (name, assigned actor, scene count)
- [x] Casting UI: **single-select** Actor per character (dropdown of castable users); clear assignment button
- [x] Manual add character (Director+)
- [x] Sidebar nav: Preparation → Characters, Groups
- [x] Role-based hiding per [ROLES.md](ROLES.md)

**Done when:** Director can cast `actor` user to CREAN from the browser.

---



### WP8 — Groups UI (P2) — **done**

**Objective:** Directors manage groups visually.

Tasks:

- [x] Groups list page
- [x] Create/edit group (name, description)
- [x] Assign characters to group (checkbox multi-select)
- [x] Assign users to group in UI (API ready)
- [x] Filter timeline by group (Director/Admin)

**Done when:** "Ensemble" group created with multiple characters in UI.

---



### WP9 — Timeline UX (P0) — **done**

**Objective:** Extend Timeline page per Slice 2 in [UI_STANDARDS.md](UI_STANDARDS.md).

Tasks:

- [x] Search bar above moment list (scene-scoped first; submit on Enter)
- [x] Character filter dropdown (all characters; "My characters" shortcut when cast)
- [x] Cue-only mode toggle
- [x] Bookmark icon button on moment detail Sheet; bookmarks list in user menu
- [x] Notes section in moment detail Sheet (list + add); visibility selector for Director/Admin
- [x] Display production title in header (not only "Production #X")
- [x] Sheet padding fix for moment detail text on small screens
- [x] Production list **Open** button (was "Timeline")

**Done when:** Full actor rehearsal flow works in browser: login → production → filter to my character → highlight → bookmark → cue-only.

---



### WP10 — Documentation, Tests & Hardening — **done**

Tasks:

- [x] Extend `backend/scripts/smoke_test.py` for casting + actor filter
- [x] Update README with Phase 2 features and dev users
- [x] Update [UI_STANDARDS.md](UI_STANDARDS.md) with Slice 2 screens
- [x] Commit `.github/workflows/ci.yml` if not yet on main
- [x] Run full pytest + frontend build; fix failures

**Done when:** CI green; smoke test covers Phase 2 paths; docs updated.

---



## Phase 2 Exit Criteria



### P0 (required to close Phase 2)

- [x] Director can cast the dev `actor` user to at least one character (and multiple characters if desired)
- [x] Actor production list shows only cast productions; Director/Admin still see all
- [x] Actor timeline highlights their character's dialogue lines
- [x] Search finds a known line in Scene 1
- [x] Cue-only mode hides dialogue/lyrics; shows stage directions and song headers
- [x] Actor can add a private bookmark; Director can add a public note on a moment
- [x] Permission tests pass (Actor cannot cast or manage other users' notes)
- [x] Smoke test and pytest pass
- [x] Owner manual browser sign-off (2026-07-09)



### P2 (optional — late Phase 2)

- [x] Groups can be created with character members (API + UI)
- [x] Groups UI can assign users
- [x] Permission tests: Actor cannot manage groups
- [x] Timeline filter by group (Director/Admin)

---



## Manual Smoke Test Script



### P0 path

1. Log in as Admin or Director; open Endurance production (imported in Phase 1).
2. Go to Characters → cast dev `actor` user to CREAN (and optionally WORSLEY).
3. Log in as `actor` → production list shows only Endurance.
4. Open production (**Open** button) → Timeline loads; default filter is **All characters** → filter to CREAN / "My characters" → dialogue rows highlighted; stage directions mentioning CREAN appear when filtered.
5. Search for "Shackleton" → matching moments shown.
6. Enable cue-only mode → dialogue/lyrics hidden; stage directions remain.
7. Bookmark a moment (icon in moment sheet); confirm it appears in bookmarks list.
8. Log in as Director → add public note on a moment; log in as Actor → note visible.
9. Log in as Director → confirm still sees all productions in list.



### P2 path

1. Create group "Trio" with CREAN, WORSLEY, SHACKLETON; confirm saved.
2. Add dev `actor` user to an Ensemble group (even if uncast to a character).
3. On Timeline, select the group filter → moments for group characters appear.

---



## Technical Decisions (pre-made — do not re-litigate)


| Topic                          | Decision                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Casting table                  | `user_character_assignments` per DATABASE.md                                             |
| One actor per character        | `UNIQUE(character_id)`; no understudies in MVP                                           |
| Many characters per actor      | Allowed — multiple assignment rows per `user_id`                                         |
| Castable users                 | Actor app role only                                                                      |
| User scope                     | Org-scoped users; casting is per-production via characters                               |
| Actor production list          | Filtered by casting assignments                                                          |
| Director/Admin production list | All productions (Phase 5+ may add assignment filtering)                                  |
| Notes visibility               | `public` / `private` enum on notes row                                                   |
| Notes attach (Phase 2)         | Moments primary; characters secondary                                                    |
| Bookmarks                      | Private per user; moment reference; unique per user+moment                               |
| Character filter stage dirs    | Include `stage_direction` moments whose text mentions filtered character name(s)         |
| Timeline filter default        | **All characters** for every role (no implicit actor filter)                             |
| Cue-only mode (Phase 2)        | `stage_direction` + `song_header` + `song_attribution` only                              |
| Timeline structure editing     | Phase 3+ — Phase 2 adds notes on moments only                                            |
| Groups                         | P2; migration 005; timeline filter via `group_id` on moments endpoint                    |
| Phase 2 priority (P0)          | Casting, actor filter/highlight, search, cue-only, notes & bookmarks                     |
| Technical cues                 | Phase 3 — cue-only uses moment-type filter in Phase 2                                    |
| Import / re-import             | Unchanged from Phase 1 (Admin only; no re-import)                                        |
| Dependency management          | uv (Python), npm (frontend)                                                              |
| Deployment                     | Docker required                                                                          |


---



## Decisions Log


| Date       | Decision                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 2026-07-09 | Cue-only: stage directions + song headers/attribution only                                                 |
| 2026-07-09 | Phase 2 moment manipulation = notes only; structural editing Phase 3+                                      |
| 2026-07-09 | P0: casting, search, cue-only, notes & bookmarks                                                           |
| 2026-07-09 | One actor per character; many characters per actor; no understudies                                        |
| 2026-07-09 | Users org-scoped; casting per production via characters                                                    |
| 2026-07-09 | Director/Admin production list unchanged (all productions)                                                 |
| 2026-07-09 | Verification removed from MVP — timeline review replaces checklist                                         |
| 2026-07-09 | Character filter includes stage directions referencing filtered character names                            |
| 2026-07-09 | Default timeline filter = all characters for all roles                                                     |
| 2026-07-09 | Production list action label = Open                                                                        |
| 2026-07-09 | Groups user assignment UI + timeline group filter shipped                                                  |
| 2026-07-09 | Groups slip to late Phase 2; P0 schema must not require groups                                             |


---



## Known Risks & Watch Items

1. **Production list UX for uncast actors** — Empty list until casting; show helpful empty-state ("No productions yet — ask your director to cast you").
2. **Character** `ALL` **and chorus names** — Importer creates `ALL`; casting UI should not require every character be cast. Directors review these while reading the timeline.
3. **Search performance** — Scene-scoped search first; add index on `moments.original_text` if production-wide search added later.
4. **Notes reference validation** — Require exactly one of `moment_id` / `character_id` on create until more attach types ship.
5. **Groups without breaking casting** — When Groups land, do not move casting to group-only; individual character assignments remain source of truth for actor filter.
6. **Scratch UX items** — Bookmarks dedicated view, live search, multi-select filter, production home page — see [Wish List](#wish-list-deferred).

---



## Wish List (deferred)

Captured from [SCRATCH_NOTES.md](SCRATCH_NOTES.md) and [PROJECT.md](PROJECT.md). Not Phase 2 scope:

- Live search (filter as you type)
- Multi-select character filter
- Cue-only / rehearsal as dedicated modes (not just a checkbox filter)
- Bookmarks dedicated timeline-like view
- Production home page (vs opening timeline hub)
- Saved views (named filter combos)

---

**P0 path — complete:**

```
WP1 P0 schema → WP3 Casting API → WP5 Notes & Bookmarks API
  → WP6 Timeline filters → WP7 Characters / casting UI
    → WP9 Timeline UX → WP10 Docs & tests
```

**P2 remaining (optional):**

```
WP8 Groups UI (user assignment) → optional group timeline filter
```

WP5 and WP6 can parallel after WP3.

---



## Phase 3 Preview (context only — do not implement)

Blocking, entrances, exits, props, costumes, microphones, cue categories, structured cue management. See [PROJECT.md](PROJECT.md).

---

---



## API Contract Sketches (P0)

Implementations may adjust field names to match existing schema conventions; behavior must match.

### Casting

```http
PUT /api/productions/{production_id}/characters/{character_id}/cast
Authorization: Bearer …
Content-Type: application/json

{ "user_id": 42 }        # assign
{ "user_id": null }      # clear assignment
```

Response `200`: `{ "character_id": 1, "user_id": 42, "user_display_name": "Jane Actor" }`

Errors: `403` non-Director; `404` character not in production; `409` character already cast (should not happen with upsert); `422` user is not an Actor.

### Productions list (Actor filtering)

`GET /api/productions` — existing endpoint; filter response server-side:

- Admin, Director → all org productions
- Actor → productions where `EXISTS (assignment JOIN characters WHERE characters.production_id = productions.id AND assignment.user_id = current_user.id)`



### Moments (extended)

```http
GET /api/productions/{id}/scenes/{scene_id}/moments?character_ids=3&search=deep&cue_only=true
```

Response: existing moment summary array, filtered and still ordered by `sequence_number`.

### Notes

```http
POST /api/productions/{id}/notes
{ "moment_id": 10, "visibility": "public", "content": "Hold for laugh" }

GET /api/productions/{id}/moments/{moment_id}  # includes notes[] + is_bookmarked
```



### Bookmarks

```http
POST /api/bookmarks
{ "moment_id": 10, "label": "Act 1 top" }

DELETE /api/bookmarks/{id}
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

Phase 2 builds on Phase 1 — same stack:

```bash
docker compose up --build
```


| URL                                                          | Purpose                             |
| ------------------------------------------------------------ | ----------------------------------- |
| [http://localhost:5173](http://localhost:5173)               | Frontend                            |
| [http://localhost:8000/health](http://localhost:8000/health) | Backend health                      |
| `admin` / `admin`                                            | Admin                               |
| `director` / `director`                                      | Director                            |
| `actor` / `actor`                                            | Actor (cast during Phase 2 testing) |


```bash
cd backend && uv sync && uv run pytest
cd backend && uv run python scripts/smoke_test.py   # extend for Phase 2
```

