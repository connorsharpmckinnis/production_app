# Phase 2 — Character Workflow & Actor Experience

**Status:** Not started

**Goal:** After import, Directors and Admins can cast actors to characters and give every role a useful timeline experience — actor-filtered views, search, notes, bookmarks, and cue-only rehearsal mode. Character/song verification and groups are optional P1/P2 add-ons.

Phase 1 is complete. This document is the execution plan for the implementing agent.

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

### P0 (must-ship)

- Alembic migration: `user_character_assignments`, `notes`, `bookmarks` (see WP1)
- Casting: assign one Actor user per character (`user_character_assignments`)
- Production list filtering: **Actors** see only productions where they are cast; **Directors and Admins** see all productions (unchanged from Phase 1)
- Actor-filtered timeline view (filter moments by selected character(s))
- Line highlighting for the actor's character(s) on the timeline
- Timeline text search (within a production; start scene-scoped)
- Cue-only rehearsal mode toggle on the timeline
- Notes API + UI on moments (public and private visibility per [ROLES.md](ROLES.md))
- Bookmarks API + UI (private per user)
- Preparation sidebar nav: Characters (casting-focused)
- Backend tests for new APIs and permission rules
- Update smoke test script for Phase 2 happy paths

### P1 (should-ship)

- Character and song verification workflow (soft checklist — see [What verification means](#what-verification-means))
- Manual add/edit character or song missed by importer

### P2 (can slip to late Phase 2)

- Groups: create groups; assign characters and/or users
- Groups UI and timeline filter-by-group
- Song verification UI (if not bundled with P1 character verification)

## Out of Scope (defer to Phase 3+)

- Technical cues (`cues`, `cue_categories`) — cue-only mode uses moment-type filtering until cues exist
- Blocking, entrances, exits, props, costumes, microphones
- Timeline structure editing (split/merge/reorder moments; edit imported `original_text`)
- Director production-list filtering by assignment (Phase 5+)
- Understudy / multi-actor-per-character casting (exception may come via Groups later)
- Full-show import (`endurance-full.md`)
- Preparation progress dashboard (future; verification flags may feed it later)
- Production `status` / `published` fields
- Action parenthetical extraction (carried forward from Phase 1 deferral)

---



## Prerequisites (from Phase 1)

Confirm before starting Phase 2 work:

- [x] `docker compose up` works from a clean clone
- [x] Admin can import `endurance-scene1.md` and view 90 moments in Scene 1
- [x] `GET /api/productions/{id}/characters` returns importer-discovered characters
- [x] JWT auth and role enforcement are in place
- [ ] Owner browser walkthrough of Phase 1 manual smoke test (recommended sign-off)

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
│   ├── characters.py      # verification, casting endpoints
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

| Entity | Scope | Notes |
|---|---|---|
| `users` | Organization | One login per deployment org; **not** per-production |
| `characters` | Production | Importer creates these per production |
| `user_character_assignments` | Production (via character) | Links org user → production character |

An Actor user may be cast to multiple characters in one production and to characters in different productions. Each assignment is a separate row. Do not introduce per-production user records.

### What verification means

Verification applies to **Characters and Songs** — not individual Timeline moments.

After import, the script parser auto-discovers character names (from dialogue cues like `CREAN:`) and songs (from song headers). Verification is a **soft preparation checklist** step:

> A Director or Admin reviewed this auto-detected character (or song) and confirmed it belongs in the production — correct name, not a parser false positive, ready to cast or use.

Examples of what verification catches:

- Importer created `ALL` or `POSH BRIT` — director confirms these are ensemble/non-cast vs real roles
- Misspelled or duplicate character names that need merging (manual fix + verify)
- Song title matches expectations before rehearsal prep

**What verification is not:**

- It is **not** "this moment line is correct" — moment review is separate (timeline reading, notes)
- It does **not** gate casting, timeline access, or any mission-critical workflow in Phase 2
- It may later feed a preparation progress dashboard ([PROJECT.md](PROJECT.md)) — not built in Phase 2

**Phase 2 policy:** Verification is **P1 optional**. If implemented, un-verifying is always allowed. Casting can proceed whether or not a character is verified.

### Casting rules (MVP)

| Rule | Decision |
|---|---|
| Characters per actor | **Many** — one actor may play multiple characters in a production |
| Actors per character | **One** — no understudies in MVP |
| Understudy exception | Deferred — may later cast via **Groups** (e.g. ensemble), not multiple rows on one character |
| Castable users | Users with the **Actor** app role only |
| Un-cast character | Allowed — character exists with no assignment |
| Re-cast | Replacing assignment clears previous actor on that character |

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
| **P1 (should-ship)** | WP2 (verification), WP10                                                    | Structure review before rehearsal; hardening                       |
| **P2 (can slip)**    | WP4, WP8 (groups)                                                           | Organizational; not on owner's P0 list                             |


WP1 still needs `user_character_assignments`, `notes`, and `bookmarks` tables for P0. Groups tables can land in P1/P2.

### WP1 — Schema: Casting, Notes, Bookmarks (+ optional verification)

**Objective:** Database supports P0 entities; optional verification columns for P1; group tables deferred to WP4 migration.

**P0 migration (ship first):**

- [ ] `user_character_assignments`
  - `id`, `user_id` (FK → users), `character_id` (FK → characters)
  - `UNIQUE(character_id)` — one actor per character
  - Index on `user_id` (for actor production-list query)
  - `created_at` optional
- [ ] `notes`
  - Per [DATABASE.md](DATABASE.md): `id`, `user_id`, `visibility` (`public` | `private`), `content`, `created_at`
  - **Phase 2 MVP attach targets:** `moment_id`, `character_id` (both nullable; exactly one reference required on create — validate in service layer)
  - Other nullable FKs (`production_id`, `scene_id`, etc.) may be omitted from migration until needed
- [ ] `bookmarks`
  - `id`, `user_id`, `moment_id`, `label` (nullable), `created_at`
  - `UNIQUE(user_id, moment_id)` recommended

**P1 migration (same or follow-up revision):**

- [ ] Add to `characters`:
  - `is_verified` BOOLEAN NOT NULL DEFAULT false
  - `verified_at` TIMESTAMPTZ NULL
  - `verified_by_user_id` INTEGER NULL FK → users (optional audit)
- [ ] Add to `songs`: same three fields

**Not in WP1 P0 (WP4 / late Phase 2):**

- `groups`, `character_groups`, `user_groups` — separate migration when Groups work starts

**Tasks:**

- [ ] Alembic revision(s) as above
- [ ] SQLAlchemy models + relationships on `Character`, `User`, `Moment`
- [ ] Update [ERD.md](ERD.md) when group migration lands

**Done when:** P0 migration applies cleanly; models import; Phase 1 seed unchanged; pytest still passes.

---



### WP2 — Character & Song Verification API (P1)

**Objective:** Directors/Admins can optionally mark characters and songs as reviewed. Never blocks casting.

Tasks:

- [ ] `GET /productions/{id}/characters` — extend existing endpoint: `is_verified`, `verified_at`, scene appearance count (derived), assigned actor (0 or 1 user)
- [ ] `PATCH /productions/{id}/characters/{character_id}` — update `description`; set `is_verified` true/false (sets/clears `verified_at` and `verified_by_user_id`)
- [ ] `POST /productions/{id}/characters` — manually add character missed by importer (Director+)
- [ ] `DELETE /productions/{id}/characters/{character_id}` — only if no dialogue references (or document reject policy)
- [ ] Parallel song endpoints: list (if not exists), PATCH verify, manual add
- [ ] Permission tests: Actor cannot verify; Director can; un-verify after cast allowed

**Done when:** Admin can mark CREAN verified, un-verify, and cast regardless of verification state.

---



### WP3 — Casting API (P0)

**Objective:** Directors/Admins assign exactly one Actor user per character.

Tasks:

- [ ] `GET /productions/{id}/casting` — all assignments: `{ character_id, character_name, user_id, user_display_name }`
- [ ] `PUT /productions/{id}/characters/{character_id}/cast` — body: `{ "user_id": number | null }` — assign or clear; reject if user lacks Actor role
- [ ] Reject second assignment to same character (DB unique + 409 from API)
- [ ] `GET /users` — add optional `?role=Actor` filter for cast picker (or dedicated castable-users endpoint)
- [ ] Update `GET /productions`:
  - **Admin / Director:** all productions (unchanged)
  - **Actor:** productions where user has ≥1 `user_character_assignments` row via any character in that production
- [ ] Tests: Actor sees filtered list; uncast Actor sees empty list; one actor per character enforced

**Done when:** Casting CREAN to `actor` user restricts Actor production list and enables actor timeline filter.

---



### WP4 — Groups API (P2 — late Phase 2)

**Objective:** Directors/Admins create groups and assign members. Requires separate Alembic migration from WP1.

Tasks:

- [ ] Migration: `groups`, `character_groups`, `user_groups` per [DATABASE.md](DATABASE.md)
- [ ] `GET/POST /productions/{id}/groups`
- [ ] `PATCH/DELETE /productions/{id}/groups/{group_id}`
- [ ] `PUT /productions/{id}/groups/{group_id}/characters` — set character membership
- [ ] `PUT /productions/{id}/groups/{group_id}/users` — set user membership
- [ ] Optional: `GET .../moments?group_id=` — expand group to character_ids for timeline filter
- [ ] Permission tests per [ROLES.md](ROLES.md)

**Done when:** "Ensemble" group created and populated via API without changes to casting schema.

---



### WP5 — Notes & Bookmarks API (P0)

**Objective:** All roles can add notes (per visibility rules) and private bookmarks.

Tasks:

- [ ] Notes CRUD with visibility (`public` | `private`)
  - **Phase 2 attach targets:** moment (primary), character (secondary)
  - Private notes: visible only to author
  - Public notes: visible to all roles with timeline access
- [ ] Bookmarks CRUD — scoped to current user; moment reference
- [ ] `GET /productions/{id}/moments/{moment_id}` — include `notes` array (public + caller's private) and `is_bookmarked` for caller
- [ ] `GET /users/me/bookmarks?production_id=` — list bookmarks for production (optional convenience)
- [ ] Tests: visibility enforcement; user cannot read another user's private note

**Done when:** Actor can bookmark a moment; Director can add public note on a moment; Actor cannot see another user's private note.

---



### WP6 — Timeline Filters: Actor View, Highlighting, Search, Cue-Only (P0)

**Objective:** Timeline becomes rehearsal-useful for actors and directors.

Extend existing moments endpoint with query params (prefer one endpoint over many):

```
GET /productions/{id}/scenes/{scene_id}/moments
  ?character_ids=1,2,3   # filter: moments where character speaks (dialogue) or optional lyric attribution
  ?search=shackleton     # case-insensitive substring on original_text (scene-scoped)
  ?cue_only=true         # stage_direction | song_header | song_attribution only
  ?include_non_dialogue=true  # when character_ids set, also include stage directions between filtered dialogue (default false — decide during impl)
```

Tasks:

- [ ] **Actor filter:** filter dialogue moments by `character_ids`; Directors/Admins may pass any IDs; Actors default to their cast characters
- [ ] **Highlighting:** frontend-only — highlight rows where dialogue `character_id` matches selected/filter character(s)
- [ ] **Search:** scene-scoped `ILIKE` on `moments.original_text`; return matching moments still in sequence order
- [ ] **Cue-only mode:** include only moment types `stage_direction`, `song_header`, `song_attribution`
- [ ] Hide `author_note` moments from Actor role always (even without cue_only)
- [ ] Centralize filter logic in `services/timeline_filters.py`
- [ ] Tests for each filter mode and Actor author_note hiding

**Done when:** Logged-in Actor sees highlighted lines for their character; cue-only hides dialogue; search finds "Shackleton".

---



### WP7 — Preparation UI: Characters & Casting (P0)

**Objective:** Directors manage casting from the production context.

Tasks:

- [ ] Characters page: table (name, assigned actor, scene count, optional verified badge if P1 shipped)
- [ ] Casting UI: **single-select** Actor per character (dropdown of castable users); clear assignment button
- [ ] P1: verify/unverify toggle; edit description; manual add character
- [ ] Sidebar nav: Preparation → Characters (Groups nav hidden until P2)
- [ ] Role-based hiding per [ROLES.md](ROLES.md)
- [ ] Empty-state copy when no characters (should not happen post-import)

**Done when:** Director can cast `actor` user to CREAN from the browser.

---



### WP8 — Groups UI (P2 — late Phase 2)

**Objective:** Directors manage groups visually.

Tasks:

- [ ] Groups list page
- [ ] Create/edit group (name, description)
- [ ] Assign characters and users to group (checkbox or multi-select)
- [ ] Optional: filter timeline by group (if in scope)

**Done when:** "Ensemble" group created with multiple characters in UI.

---



### WP9 — Timeline UX: Search, Filters, Notes, Bookmarks

**Objective:** Extend Timeline page per Slice 2 in [UI_STANDARDS.md](UI_STANDARDS.md).

Tasks:

- [ ] Search bar above moment list (scene-scoped first)
- [ ] Character filter dropdown (all characters for Director; own characters for Actor)
- [ ] Cue-only mode toggle
- [ ] Bookmark button on moment detail Sheet; bookmarks list in sidebar or user menu
- [ ] Notes section in moment detail Sheet (list + add); visibility selector for Director/Admin
- [ ] Display production title in header (not only "Production #X") — see [SCRATCH_NOTES.md](SCRATCH_NOTES.md)
- [ ] Sheet padding fix for moment detail text on small screens

**Done when:** Full actor rehearsal flow works in browser: login → production → filter to my character → highlight → bookmark → cue-only.

---



### WP10 — Documentation, Tests & Hardening

Tasks:

- [ ] Extend `backend/scripts/smoke_test.py` for casting + actor filter
- [ ] Update README with Phase 2 features and dev users
- [ ] Update [UI_STANDARDS.md](UI_STANDARDS.md) with Slice 2 screens (or add `UI_STANDARDS_SLICE_2.md`)
- [ ] Commit `.github/workflows/ci.yml` if not yet on main
- [ ] Run full pytest + frontend build; fix failures

**Done when:** CI green; smoke test covers Phase 2 paths; docs updated.

---



## Phase 2 Exit Criteria

### P0 (required to close Phase 2)

- [ ] Director can cast the dev `actor` user to at least one character (and multiple characters if desired)
- [ ] Actor production list shows only cast productions; Director/Admin still see all
- [ ] Actor timeline highlights their character's dialogue lines
- [ ] Search finds a known line in Scene 1
- [ ] Cue-only mode hides dialogue/lyrics; shows stage directions and song headers
- [ ] Actor can add a private bookmark; Director can add a public note on a moment
- [ ] Permission tests pass (Actor cannot cast or manage other users' notes)
- [ ] Smoke test and CI pass

### P1 (optional — ship if time allows)

- [ ] Director can verify/un-verify characters without affecting casting
- [ ] Manual add character works for importer misses

### P2 (optional — late Phase 2)

- [ ] Groups can be created with character members
- [ ] Permission tests: Actor cannot manage groups

---



## Manual Smoke Test Script

### P0 path

1. Log in as Admin or Director; open Endurance production (imported in Phase 1).
2. Go to Characters → cast dev `actor` user to CREAN (and optionally WORSLEY).
3. Log in as `actor` → production list shows only Endurance.
4. Open Timeline → filter to CREAN / "My characters" → dialogue rows highlighted.
5. Search for "Shackleton" → matching moments shown.
6. Enable cue-only mode → dialogue/lyrics hidden; stage directions remain.
7. Bookmark a moment; confirm it appears in bookmarks list.
8. Log in as Director → add public note on a moment; log in as Actor → note visible.
9. Log in as Director → confirm still sees all productions in list.

### P1 path (if verification shipped)

10. Mark CREAN verified → badge shown → un-verify → badge cleared → casting unchanged.

### P2 path (if groups shipped)

11. Create group "Trio" with CREAN, WORSLEY, SHACKLETON; confirm saved.

---



## Technical Decisions (pre-made — do not re-litigate)

| Topic | Decision |
|---|---|
| Casting table | `user_character_assignments` per DATABASE.md |
| One actor per character | `UNIQUE(character_id)`; no understudies in MVP |
| Many characters per actor | Allowed — multiple assignment rows per `user_id` |
| Castable users | Actor app role only |
| User scope | Org-scoped users; casting is per-production via characters |
| Actor production list | Filtered by casting assignments |
| Director/Admin production list | All productions (Phase 5+ may add assignment filtering) |
| Notes visibility | `public` / `private` enum on notes row |
| Notes attach (Phase 2) | Moments primary; characters secondary |
| Bookmarks | Private per user; moment reference; unique per user+moment |
| Verification fields | `is_verified` + `verified_at` (+ optional `verified_by_user_id`) on characters and songs |
| Verification policy | Soft checklist; un-verify anytime; never blocks casting |
| Cue-only mode (Phase 2) | `stage_direction` + `song_header` + `song_attribution` only |
| Timeline structure editing | Phase 3+ — Phase 2 adds notes on moments only |
| Groups | P2; separate migration; timeline filter via `group_id` later |
| Phase 2 priority (P0) | Casting, actor filter/highlight, search, cue-only, notes & bookmarks |
| Technical cues | Phase 3 — cue-only uses moment-type filter in Phase 2 |
| Import / re-import | Unchanged from Phase 1 (Admin only; no re-import) |
| Dependency management | uv (Python), npm (frontend) |
| Deployment | Docker required |

---

## Decisions Log

| Date | Decision |
|---|---|
| 2026-07-09 | Cue-only: stage directions + song headers/attribution only |
| 2026-07-09 | Phase 2 moment manipulation = notes only; structural editing Phase 3+ |
| 2026-07-09 | P0: casting, search, cue-only, notes & bookmarks |
| 2026-07-09 | One actor per character; many characters per actor; no understudies |
| 2026-07-09 | Users org-scoped; casting per production via characters |
| 2026-07-09 | Director/Admin production list unchanged (all productions) |
| 2026-07-09 | Verification = soft character/song checklist (P1); both `is_verified` and `verified_at`; un-verify allowed |
| 2026-07-09 | Groups slip to late Phase 2; P0 schema must not require groups |

---



## Known Risks & Watch Items

1. **Production list UX for uncast actors** — Empty list until casting; show helpful empty-state ("No productions yet — ask your director to cast you").

2. **Character `ALL` and chorus names** — Importer creates `ALL`; casting UI should not require every character be cast. P1 verification helps mark these as reviewed ensemble names.

3. **Search performance** — Scene-scoped search first; add index on `moments.original_text` if production-wide search added later.

4. **Notes reference validation** — Require exactly one of `moment_id` / `character_id` on create until more attach types ship.

5. **Groups without breaking casting** — When Groups land, do not move casting to group-only; individual character assignments remain source of truth for actor filter.

6. **Scratch UX items** — Sheet padding, animation speed, production title in header ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)).

---



## Suggested Agent Execution Order

**P0 path (ship first):**

```
WP1 P0 schema (casting, notes, bookmarks)
  → WP3 Casting API
    → WP5 Notes & Bookmarks API
      → WP6 Timeline filters
        → WP7 Characters / casting UI
          → WP9 Timeline UX
            → WP10 Docs & tests
```

**P1 when ready:**

```
WP1 P1 verification columns → WP2 Verification API → extend WP7 UI
```

**P2 when ready:**

```
WP4 Groups migration + API → WP8 Groups UI → optional group timeline filter
```

WP5 and WP6 can parallel after WP3. WP2 does not block P0.

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

