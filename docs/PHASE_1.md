# Phase 1 — Script Import MVP

**Status:** Not started

**Goal:** Deliver a working vertical slice — Admin creates a production, uploads a Markdown script, imports it into the database, and all roles can view the resulting Timeline. Directors and Actors cannot create productions or import scripts.

Phase 0 is complete. This document is the execution plan for the implementing agent.

---

## Read First (authoritative)

| Document | Use for |
|---|---|
| [PROJECT.md](PROJECT.md) | Vision, domain model, phase scope |
| [DATABASE.md](DATABASE.md) | Schema, naming conventions, table fields |
| [IMPORT_SPEC.md](IMPORT_SPEC.md) | Importer rules, regex, error policy, mojibake repair |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Slice 1 screens and components |
| [ROLES.md](ROLES.md) | Permission matrix — enforce on API and UI |
| [SEED_DATA.md](SEED_DATA.md) | Bootstrap seeds and env vars |
| [ERD.md](ERD.md) | Entity relationships |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, Docker, uv, patterns |

**Test fixture:** [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md) — sole import target for Phase 1.

---

## In Scope

- Monorepo / project scaffolding with Docker
- PostgreSQL schema via Alembic (MVP tables needed for import + auth)
- Seed data: organization, roles, moment types, bootstrap Admin
- Local username/password authentication
- Role-based authorization (Admin, Director, Actor)
- Admin: create/delete production, import script, user CRUD, password reset
- Director: view production list, view timeline (read-only in Phase 1 UI)
- Actor: view production list, view timeline (read-only)
- Script importer per IMPORT_SPEC (Google Docs Markdown export)
- UTF-8 mojibake repair (`â€™` → `'`, `â€"` → `–`) during import preprocessing
- Timeline review UI (read-only moment list with act/scene navigation)
- Backend tests for importer and auth
- README with local setup instructions

## Out of Scope (defer to Phase 2+)

- Timeline editing (inline or side-panel)
- Character verification workflow, casting UI, groups
- Notes, bookmarks (API stubs OK; UI not required)
- Search, actor highlighting, cue-only mode
- Full-show import (`endurance-full.md`) — author will clean source script later
- Google Drive URLs on songs (ignore link; use bracket title only)
- Preparation progress tracking
- Production `status` / `published` fields

---

## Suggested Repository Layout

```
production_app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   │   └── importer/
│   │   ├── auth/
│   │   └── db/
│   ├── alembic/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml          # uv-managed
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── fixtures/scripts/             # already exists
├── docs/                         # already exists
└── README.md
```

Adjust as needed, but keep backend business logic (especially importer) out of the frontend.

---

## Work Packages

Complete in roughly this order. Each package should be shippable before moving on.

### WP1 — Infrastructure & Database

**Objective:** `docker compose up` starts PostgreSQL, backend, and frontend with a migrated, seeded database.

Tasks:

- [ ] Initialize backend with `uv`, FastAPI, SQLAlchemy, Alembic, pytest
- [ ] Initialize frontend with Vite, React, TypeScript, Tailwind, shadcn/ui
- [ ] `docker-compose.yml`: `db` (PostgreSQL), `backend`, `frontend`
- [ ] Multi-stage Dockerfiles + `.dockerignore` for backend and frontend
- [ ] Alembic initial migration for Phase 1 tables:

  **Required tables:** `organizations`, `users`, `app_roles`, `user_app_roles`, `productions`, `acts`, `scenes`, `moment_types`, `moments`, `characters`, `dialogue`, `stage_directions`, `songs`

  **Not required yet:** `performances`, `props`, `costumes`, `cues`, `notes`, `bookmarks`, `tasks`, `groups`, etc. (add when Phase 2+ needs them, or include empty migrations if preferred for ERD parity)

- [ ] Seed script or migration data per [SEED_DATA.md](SEED_DATA.md)
- [ ] Env vars documented in README: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ORG_NAME`, `SECRET_KEY`

**Done when:** Backend health check passes; DB has seeded roles, moment types, and Admin user.

---

### WP2 — Authentication & Authorization

**Objective:** Login works; API enforces [ROLES.md](ROLES.md).

Tasks:

- [ ] Password hashing (bcrypt or argon2 via mature library)
- [ ] Session or JWT auth — pick one simple approach and stay consistent
- [ ] Login / logout endpoints
- [ ] Auth dependency/middleware that loads current user + roles
- [ ] Permission helpers, e.g. `require_admin()`, `require_role("Director")`
- [ ] Admin user management endpoints:
  - List users
  - Create user (username, password, name, role assignment)
  - Reset password
  - Deactivate user
- [ ] Frontend: login page, auth context, protected routes

**Done when:** Admin can log in; non-admin cannot hit admin-only endpoints; unauthenticated requests rejected.

---

### WP3 — Production CRUD (Admin)

**Objective:** Admin can create and delete productions; Directors/Actors cannot.

Tasks:

- [ ] `GET /productions` — list (role-filtered: Admin all; others per future casting rules; Phase 1 may return all for Director/Actor read-only)
- [ ] `POST /productions` — Admin only (title, season optional)
- [ ] `DELETE /productions/{id}` — Admin only
- [ ] `GET /productions/{id}` — any authenticated user with access
- [ ] Frontend: production list, create form (Admin only), delete with confirmation (Admin only)

**Done when:** ROLES.md create/delete rules enforced; UI hides controls from non-Admins.

---

### WP4 — Script Importer

**Objective:** Admin uploads `endurance-scene1.md`; importer creates full timeline; failure rolls back with line-level error.

Tasks:

- [ ] Importer service implementing [IMPORT_SPEC.md](IMPORT_SPEC.md) classification order
- [ ] **Preprocessing:** UTF-8 decode + mojibake repair before line split
- [ ] **Transaction:** all-or-nothing DB insert; rollback on any error
- [ ] **Error response:** `{ line_number, line_content, message }`
- [ ] Create/find Characters during dialogue import
- [ ] Create Songs on song headers; link lyric/attribution moments to current song
- [ ] `sequence_number` resets per Scene
- [ ] Action parenthetical extraction per heuristic (document ambiguities in code comments)
- [ ] Unit tests with inline script snippets (each construct type)
- [ ] Integration test: import `fixtures/scripts/endurance-scene1.md` succeeds
- [ ] Integration test: malformed line returns expected error line number

**Expected results for `endurance-scene1.md` (approximate — verify during implementation):**

| Entity | Expected |
|---|---|
| Act | 1 (`Act One`) |
| Scene | 1 (`Scene One - Welcome to the Age of Adventure`) |
| Characters | CREAN, WORSLEY, SHACKLETON, ALL, POSH BRIT, BRI'ISH NEWSIE, … (discovered from dialogue) |
| Songs | ≥ 1 (`INTO THE DEEP (PRE-PRISE)`, possibly `AGE OF ADVENTURE`) |
| Moments | Many (stage directions, dialogue, song block, lyrics) |

- [ ] `POST /productions/{id}/import` — Admin only; accepts `.md` file upload
- [ ] Reject import if production already has acts/scenes (or document overwrite policy — default: **reject** re-import in Phase 1)

**Done when:** Scene 1 fixture imports cleanly end-to-end; mojibake apostrophes display correctly in stored `original_text`.

---

### WP5 — Timeline Read API

**Objective:** Frontend can fetch imported structure for display.

Tasks:

- [ ] `GET /productions/{id}/acts` — list acts with scenes
- [ ] `GET /productions/{id}/scenes/{scene_id}/moments` — ordered by `sequence_number`, include `moment_type` name
- [ ] `GET /productions/{id}/moments/{moment_id}` — detail (original_text, parsed_text, dialogue rows, stage direction)
- [ ] Optional: `GET /productions/{id}/characters` — for later slices; useful for import verification

**Done when:** API returns complete Scene 1 timeline matching DB after import.

---

### WP6 — Timeline Review UI

**Objective:** Read-only timeline per [UI_STANDARDS.md](UI_STANDARDS.md).

Tasks:

- [ ] App shell: header, sidebar, role-aware nav
- [ ] Production list page
- [ ] Create production flow (Admin)
- [ ] Upload + import page (Admin only) with error panel on failure
- [ ] Timeline review page:
  - Act/Scene selector
  - Scrollable moment list (sequence #, truncated text, type badge)
  - Click moment → read-only Sheet/detail panel
- [ ] Role-based UI hiding per UI_STANDARDS table
- [ ] Admin user management page (minimal: list, create, reset password)

**Done when:** Full happy path demonstrable in browser via Docker.

---

### WP7 — Documentation & Hardening

Tasks:

- [ ] Root `README.md`: prerequisites, `docker compose up`, default Admin login, running tests
- [ ] Backend `README` or docstrings for importer package
- [ ] Confirm `.venv` / uv usage documented for local (non-Docker) dev
- [ ] Run full test suite; fix failures
- [ ] Manual smoke test checklist (below)

---

## Phase 1 Exit Criteria

All must pass before closing Phase 1:

- [ ] `docker compose up` brings up the full stack from a clean clone
- [ ] Admin can log in, create production, upload `endurance-scene1.md`, import succeeds
- [ ] Timeline shows Act 1 / Scene 1 moments in order with correct type badges
- [ ] Apostrophes and en-dashes display correctly (no `â€™` / `â€"` in UI)
- [ ] Import failure on bad file shows line number and reason; DB unchanged
- [ ] Director can log in and view timeline but cannot create production, import, or manage users
- [ ] Actor can log in and view timeline (read-only)
- [ ] Importer tests pass in CI/local pytest
- [ ] README documents setup

---

## Manual Smoke Test Script

1. Start stack; log in as Admin (`admin` / configured password).
2. Create production "Endurance" / season "2026".
3. Upload `fixtures/scripts/endurance-scene1.md`; confirm import success.
4. Open Timeline → Act 1 → Scene 1; verify first moment is stage direction, dialogue follows.
5. Find a dialogue line with apostrophe (e.g. "That'll"); confirm display is correct.
6. Upload a one-line invalid file; confirm error shows line 1 and no partial data.
7. Log in as Director (seed dev user); confirm no "New Production" or Import UI.
8. Log in as Actor; confirm read-only timeline access.

---

## Technical Decisions (pre-made — do not re-litigate)

| Topic | Decision |
|---|---|
| Import format | Google Docs Markdown export |
| Import strategy | Line-by-line regex; see IMPORT_SPEC |
| Error policy | Full fail; transactional rollback |
| Test fixture | `endurance-scene1.md` only |
| Song URLs | Ignore Google Drive href |
| Encoding | Repair mojibake in preprocessing |
| Create/delete production | Admin only |
| Import | Admin only |
| User management | Admin only |
| Timeline UI Phase 1 | Read-only |
| Dependency management | uv (Python), npm/pnpm (frontend) |
| Deployment | Docker required |

---

## Known Risks & Watch Items

1. **Messy dialogue line 34** — Shackleton line mixes inline stage direction and footnotes; parenthetical heuristic may need tuning. Prefer passing tests on fixture over perfect heuristic.

2. **Song blocks with embedded dialogue** — `AGE OF ADVENTURE` section has dialogue interrupting lyrics; `current_song` must persist across dialogue moments.

3. **Plain vs `####` lyric lines** — `INTO THE DEEP` block uses plain ALL CAPS lines without markdown H4; both forms must import.

4. **Action parentheticals in dialogue** — e.g. `(as they leave)` on line 46; extraction rules may need iteration.

5. **Character name edge cases** — `BRI'ISH NEWSIE`, `POSH BRIT`, names with apostrophes after mojibake repair.

6. **Re-import policy** — default to blocking re-import on non-empty production; document in API.

7. **Director production list** — until casting exists (Phase 2), Directors may see all productions or none; simplest: show all productions read-only except timeline prep access.

---

## Suggested Agent Execution Order

```
WP1 Infrastructure & Database
  → WP2 Auth
    → WP3 Production CRUD
      → WP4 Importer (tests first, then endpoint)
        → WP5 Timeline API
          → WP6 Frontend
            → WP7 Docs & smoke test
```

Importer (WP4) can start unit tests in parallel with WP2/WP3 once models exist.

---

## Phase 2 Preview (context only — do not implement)

Character verification, casting, groups, actor view, notes, bookmarks, search, cue-only mode. See [PROJECT.md](PROJECT.md).

---

## Notes for Implementing Agent

- Follow [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md): readability over cleverness, vertical slices, Docker, uv.
- Do not add `productions.status` or `productions.published`.
- Store cue `payload` as JSON when cues are added in later phases; not needed in Phase 1.
- When uncertain, choose the simpler implementation and document the tradeoff in PR/commit message.
- Update this document's checkboxes as work completes, or leave for the project owner to track.
