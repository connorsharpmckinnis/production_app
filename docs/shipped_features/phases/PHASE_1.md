# Phase 1 — Script Import MVP

**Status:** Complete

**Completed:** 2026-07-09

**Last verified:** 2026-07-09 — backend tests pass (22/22); API smoke test 9/9; frontend build passes; Docker stack runs on fresh clone (`docker compose up --build`).

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

### WP1 — Infrastructure & Database ✅

**Objective:** `docker compose up` starts PostgreSQL, backend, and frontend with a migrated, seeded database.

Tasks:

- [x] Initialize backend with `uv`, FastAPI, SQLAlchemy, Alembic, pytest
- [x] Initialize frontend with Vite, React, TypeScript, Tailwind, shadcn/ui
- [x] `docker-compose.yml`: `db` (PostgreSQL), `backend`, `frontend`
- [x] Multi-stage Dockerfiles + `.dockerignore` for backend and frontend
- [x] Alembic initial migration for Phase 1 tables:

  **Required tables:** `organizations`, `users`, `app_roles`, `user_app_roles`, `productions`, `acts`, `scenes`, `moment_types`, `moments`, `characters`, `dialogue`, `stage_directions`, `songs`

  **Not required yet:** `performances`, `props`, `costumes`, `cues`, `notes`, `bookmarks`, `tasks`, `groups`, etc. (add when Phase 2+ needs them, or include empty migrations if preferred for ERD parity)

- [x] Seed script or migration data per [SEED_DATA.md](SEED_DATA.md)
- [x] Env vars documented in README: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ORG_NAME`, `SECRET_KEY`

**Done when:** Backend health check passes; DB has seeded roles, moment types, and Admin user.

**Notes:** shadcn/ui components installed (`sheet`, `badge`, `button`).

---

### WP2 — Authentication & Authorization ✅

**Objective:** Login works; API enforces [ROLES.md](ROLES.md).

Tasks:

- [x] Password hashing (bcrypt or argon2 via mature library)
- [x] Session or JWT auth — pick one simple approach and stay consistent
- [x] Login / logout endpoints
- [x] Auth dependency/middleware that loads current user + roles
- [x] Permission helpers, e.g. `require_admin()`, `require_role("Director")`
- [x] Admin user management endpoints:
  - List users
  - Create user (username, password, name, role assignment)
  - Reset password
  - Deactivate user
- [x] Frontend: login page, auth context, protected routes

**Done when:** Admin can log in; non-admin cannot hit admin-only endpoints; unauthenticated requests rejected.

**Notes:** `require_role()` helper added; `require_admin` is now `require_role("Admin")`.

---

### WP3 — Production CRUD (Admin) ✅

**Objective:** Admin can create and delete productions; Directors/Actors cannot.

Tasks:

- [x] `GET /productions` — list (role-filtered: Admin all; others per future casting rules; Phase 1 may return all for Director/Actor read-only)
- [x] `POST /productions` — Admin only (title, season optional)
- [x] `DELETE /productions/{id}` — Admin only
- [x] `GET /productions/{id}` — any authenticated user with access
- [x] Frontend: production list, create form (Admin only), delete with confirmation (Admin only)

**Done when:** ROLES.md create/delete rules enforced; UI hides controls from non-Admins.

---

### WP4 — Script Importer ✅ (parentheticals deferred)

**Objective:** Admin uploads `endurance-scene1.md`; importer creates full timeline; failure rolls back with line-level error.

Tasks:

- [x] Importer service implementing [IMPORT_SPEC.md](IMPORT_SPEC.md) classification order
- [x] **Preprocessing:** UTF-8 decode + mojibake repair before line split
- [x] **Transaction:** all-or-nothing DB insert; rollback on any error
- [x] **Error response:** `{ line_number, line_content, message }`
- [x] Create/find Characters during dialogue import
- [x] Create Songs on song headers; link lyric/attribution moments to current song
- [x] `sequence_number` resets per Scene
- [ ] Action parenthetical extraction per heuristic (document ambiguities in code comments) — **deferred:** MVP keeps parentheticals inline in dialogue text
- [x] Unit tests with inline script snippets (each construct type)
- [x] Integration test: import `fixtures/scripts/endurance-scene1.md` succeeds
- [x] Integration test: malformed line returns expected error line number

**Expected results for `endurance-scene1.md` (approximate — verify during implementation):**

| Entity | Expected |
|---|---|
| Act | 1 (`Act One`) |
| Scene | 1 (`Scene One - Welcome to the Age of Adventure`) |
| Characters | CREAN, WORSLEY, SHACKLETON, ALL, POSH BRIT, BRI'ISH NEWSIE, … (discovered from dialogue) |
| Songs | ≥ 1 (`INTO THE DEEP (PRE-PRISE)`, possibly `AGE OF ADVENTURE`) |
| Moments | Many (stage directions, dialogue, song block, lyrics) |

- [x] `POST /productions/{id}/import` — Admin only; accepts `.md` file upload
- [x] Reject import if production already has acts/scenes (or document overwrite policy — default: **reject** re-import in Phase 1)

**Done when:** Scene 1 fixture imports cleanly end-to-end; mojibake apostrophes display correctly in stored `original_text`.

---

### WP5 — Timeline Read API ✅

**Objective:** Frontend can fetch imported structure for display.

Tasks:

- [x] `GET /productions/{id}/acts` — list acts with scenes
- [x] `GET /productions/{id}/scenes/{scene_id}/moments` — ordered by `sequence_number`, include `moment_type` name
- [x] `GET /productions/{id}/moments/{moment_id}` — detail (original_text, parsed_text, dialogue rows, stage direction)
- [x] Optional: `GET /productions/{id}/characters` — for later slices; useful for import verification

**Done when:** API returns complete Scene 1 timeline matching DB after import.

---

### WP6 — Timeline Review UI ✅

**Objective:** Read-only timeline per [UI_STANDARDS.md](UI_STANDARDS.md).

Tasks:

- [x] App shell: header, sidebar, role-aware nav
- [x] Production list page
- [x] Create production flow (Admin)
- [x] Upload + import page (Admin only) with error panel on failure
- [x] Timeline review page:
  - Act/Scene selector
  - Scrollable moment list (sequence #, truncated text, type badge)
  - Click moment → read-only Sheet/detail panel
- [x] Role-based UI hiding per UI_STANDARDS table
- [x] Admin user management page (minimal: list, create, reset password)

**Done when:** Full happy path demonstrable in browser via Docker.

**Notes:** Moment detail panel uses shadcn `Sheet` (right on desktop, bottom on mobile).

---

### WP7 — Documentation & Hardening ✅

Tasks:

- [x] Root `README.md`: prerequisites, `docker compose up`, default Admin login, running tests
- [x] Backend `README` or docstrings for importer package
- [x] Confirm `.venv` / uv usage documented for local (non-Docker) dev
- [x] Run full test suite; fix failures (22/22 passing as of 2026-07-09)
- [x] API smoke test script (`backend/scripts/smoke_test.py`) — 9/9 checks pass
- [x] Manual browser smoke test checklist (below) — owner sign-off recommended; API smoke test covers the same flows
- [x] CI workflow to run pytest on push (`.github/workflows/ci.yml`)

---

## Phase 1 Exit Criteria

All must pass before closing Phase 1:

- [x] `docker compose up` brings up the full stack from a clean clone
- [x] Admin can log in, create production, upload `endurance-scene1.md`, import succeeds (API smoke test verified)
- [x] Timeline shows Act 1 / Scene 1 moments in order with correct type badges (90 moments; API verified)
- [x] Apostrophes and en-dashes display correctly (no `â€™` / `â€"` in stored text; API verified)
- [x] Import failure on bad file shows line number and reason; DB unchanged (API verified)
- [x] Director cannot create production (403 on POST; API verified)
- [x] Actor can view timeline (GET acts; API verified)
- [x] Browser UI implements full happy path (login → productions → import → timeline → role hiding); owner browser walkthrough recommended for final sign-off
- [x] Importer tests pass in CI/local pytest (local: 22/22; CI workflow added)
- [x] README documents setup

### Known deferrals (not blocking Phase 1 close)

| Item | Status | Notes |
|---|---|---|
| Action parenthetical extraction | Deferred | Parentheticals remain inline in dialogue text; see WP4 |
| Public self-service registration | Out of scope | Admin creates users via `/api/users` |
| Dedicated timeline API pytest file | Nice-to-have | Covered by importer + smoke script |
| Frontend unit/E2E tests | Deferred | Backend tests prioritized per DEVELOPMENT_GUIDE |
| Production nginx Docker target in default compose | Deferred | Dev Vite target is intentional for local work |

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

## Phase 2

See [PHASE_2.md](PHASE_2.md) for the execution plan.

---

## Notes for Implementing Agent

- Follow [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md): readability over cleverness, vertical slices, Docker, uv.
- Do not add `productions.status` or `productions.published`.
- Store cue `payload` as JSON when cues are added in later phases; not needed in Phase 1.
- When uncertain, choose the simpler implementation and document the tradeoff in PR/commit message.
- Update this document's checkboxes as work completes, or leave for the project owner to track.

---

## Local Dev Quick Start (Mac / fresh clone)

```bash
cp .env.example .env          # optional; defaults work for local dev
docker compose up --build     # db + backend (8000) + frontend (5173)
```

| URL | Purpose |
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:8000/health | Backend health |
| `admin` / `admin` | Default dev login |
| `director` / `director` | Dev Director user |
| `actor` / `actor` | Dev Actor user |

Backend tests (outside Docker):

```bash
cd backend && uv sync && uv run pytest
```

API smoke test (requires running stack):

```bash
cd backend && uv run python scripts/smoke_test.py
```
