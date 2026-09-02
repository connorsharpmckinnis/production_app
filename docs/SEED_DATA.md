# Seed Data Specification (MVP)

**Version:** 0.2 (updated 2026-09-02 for production membership)

Initial database seed data required before the application can run. Schema: [DATABASE.md](DATABASE.md).
Permissions model: [ROLES.md](ROLES.md).

Seeds run via the dedicated `backend/app/db/seed.py` path (and related Alembic setup).

---

## 1. Organization

Single default organization for MVP (one org per deployment).

| Field | Value |
|---|---|
| name | `"Default Organization"` (configurable via env var `ORG_NAME`) |

---

## 2. App Roles (organization-wide)

| name | description |
|---|---|
| Admin | Full system access; import scripts; manage users; bypasses production membership checks |

Permissions detail: [ROLES.md](ROLES.md).

Legacy global `Director` and `Actor` app roles are **not** seeded. Fresh seeds create
only `Admin`. Existing legacy Director/Actor `app_roles` rows are purged on seed so
they cannot authorize production access.

Future organization-wide staff roles (do **not** seed for MVP): Production Manager,
Marketing Manager, etc.

---

## 3. Production roles and permission matrix

Seeded via `production_roles` + `production_role_permissions` (see
`backend/app/db/production_role_defaults.py`):

| code | name | Seeded capability summary |
|---|---|---|
| `member` | Member | `read` on every production resource |
| `actor` | Actor | Member reads plus CRUD for notes and bookmarks |
| `director` | Director | Broad preparation / rehearsal / people / casting management; `production.update` |

Every role/resource pair receives rows for `read`, `create`, `update`, and `delete`.
Admins may edit the matrix in App Settings; changes apply on the next authorization
check. No production memberships are auto-created by seed.

---

## 4. Moment Types

| name | description |
|---|---|
| `stage_direction` | Prose stage direction (`*...*`) |
| `dialogue` | Character spoken line |
| `song_header` | Song title line |
| `song_attribution` | Performer attribution (ALL, SHACKLETON, etc.) |
| `lyric` | Single lyric line |
| `author_note` | Non-performance note (`Note:` prefix) |

Import mapping: [IMPORT_SPEC.md](IMPORT_SPEC.md).

---

## 5. Bootstrap Admin User

Created on first run if no users exist.

| Field | Source |
|---|---|
| username | env `ADMIN_USERNAME` (default: `admin`) |
| password | env `ADMIN_PASSWORD` (required in production; default for dev only) |
| first_name | `"Admin"` |
| last_name | `"User"` |
| organization_id | default organization |
| roles | Admin |

**Security:** Refuse to start in production without `ADMIN_PASSWORD` set. Document in README at Phase 1.

Seed does **not** create sample `director` / `actor` accounts. Create those under
**Users**, then assign them to a production under **People**.

---

## 6. Optional Dev Seeds

For local development only (not production):

* Default locations (Main Stage, Dance Room, etc.)
* Overview encouragement message defaults
* App display settings row
* Pre-created production / script import remains a manual or smoke-test step, not automatic seed

---

## Seed Order (FK dependencies)

1. `organizations`
2. `app_roles` (Admin only; purge legacy Director/Actor)
3. `moment_types`
4. `app_settings` / overview message defaults / locations
5. `production_roles` + `production_role_permissions`
6. Bootstrap `users` + `user_app_roles` (Admin)
7. Application data (productions, memberships, casts) created via UI / import — **not** seeded

---

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ORG_NAME` | No | `Default Organization` | Single org display name |
| `ADMIN_USERNAME` | No | `admin` | Bootstrap admin login |
| `ADMIN_PASSWORD` | Prod: Yes | (none) | Bootstrap admin password |
