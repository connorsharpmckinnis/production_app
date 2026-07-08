# Seed Data Specification (MVP)

**Version:** 0.1

Initial database seed data required before the application can run. Schema: [DATABASE.md](DATABASE.md).

Seeds run via Alembic migration or a dedicated `seed.py` script at Phase 1 startup.

---

## 1. Organization

Single default organization for MVP (one org per deployment).

| Field | Value |
|---|---|
| name | `"Default Organization"` (configurable via env var `ORG_NAME`) |

---

## 2. App Roles

| name | description |
|---|---|
| Admin | Full system access; import scripts; manage users |
| Director | Edit timeline; cast actors; no create/delete production, import, or user management |
| Actor | View timeline; add notes and bookmarks |

Permissions detail: [ROLES.md](ROLES.md).

Future roles (do **not** seed for MVP): Production Manager, Stage Manager, Lighting, Sound.

---

## 3. Moment Types

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

## 4. Bootstrap Admin User

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

---

## 5. Optional Dev Seeds

For local development only (not production):

* Sample Director and Actor test users
* Pre-created production linked to `fixtures/scripts/endurance-scene1.md` after import smoke test

---

## Seed Order (FK dependencies)

1. `organizations`
2. `app_roles`
3. `moment_types`
4. `users` + `user_app_roles`
5. (Application data created via import, not seed)

---

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ORG_NAME` | No | `Default Organization` | Single org display name |
| `ADMIN_USERNAME` | No | `admin` | Bootstrap admin login |
| `ADMIN_PASSWORD` | Prod: Yes | (none) | Bootstrap admin password |
