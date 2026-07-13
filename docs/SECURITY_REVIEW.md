# Security, Stability, Performance & Standardization Review

**Date:** 2026-07-13  
**Scope:** Full application as currently implemented (backend, frontend, Docker Compose)  
**Audience:** Pre–beta readiness for a **single-production pilot** (one org, trusted cast/crew, not public internet multi-tenant SaaS)  
**Bar for this pilot:** Not “bank-grade.” Must not have glaring, obvious issues that would leak scripts, confuse roles, crash under normal use, or make a shared deploy trivially compromised.

---

## Executive summary

The app is a coherent MVP: FastAPI + Postgres + React/Vite, JWT auth with Admin / Director / Actor roles, Dockerized local stack, and solid foundations (bcrypt passwords, ORM-bound queries, mutation RBAC on most write paths, no XSS sinks found).

For a **single-production beta**, the work that matters most is:

1. **Stop treating “list filtering” as authorization** — any logged-in user who knows a production ID can currently read that production’s data.
2. **Refuse weak secrets and default admin passwords** when running as prod.
3. **Cap script uploads and fix the production nginx `/api` proxy** before anyone relies on a non-dev frontend image.
4. **Reduce copy-paste surfaces** (catalog pages, shared `_get_production_or_404`, moment attachment UI) so beta bugfixes land once, not twelve times.

Everything else in this document is real and worth doing, but can be sequenced around that bar.

---

## Review assumptions

| Assumption | Implication |
| --- | --- |
| One organization, one (or few) productions | Full multi-tenant org isolation is not required for beta day one, but schema already has `organization_id` — do not pretend isolation exists if it does not. |
| Users are cast/crew with accounts you create | Brute-force and XSS still matter if the host is reachable beyond a trusted LAN. |
| Script content is sensitive IP | Unauthorized read of timeline/reports is a real business risk, not just a privacy nicety. |
| Compose currently runs frontend `dev` target | Prod nginx bugs are latent until you switch targets; still fix before any “real” deploy path. |

---

## What is already in good shape

| Area | Status |
| --- | --- |
| Password storage | bcrypt via passlib |
| Write RBAC | Admin / Director gates generally consistent on mutations |
| Note privacy | Public vs private + ownership on edit/delete |
| SQL injection | SQLAlchemy ORM; no string-built SQL found |
| XSS sinks | No `dangerouslySetInnerHTML` / `innerHTML` usage found |
| Re-import guard | Blocked when acts already exist |
| Actor author notes | Hidden in list; detail returns 404 |
| `.env` | Gitignored; Docker builds exclude `.env` |
| API client | Centralized in `frontend/src/lib/api.ts` |
| DB port | Postgres not published in Compose (internal only) |

---

## Part 1 — Security findings

Severity: **Critical** / **High** / **Medium** / **Low**

### S1 — Critical: Production access is list-only for actors (IDOR)

**Where:** `backend/app/api/productions.py` filters the production **list** for Actor-only users, but `GET /productions/{id}`, overview, timeline, catalogs, notes, bookmarks, and reports only check “authenticated + production exists.”

**Impact:** An actor (or any authenticated user) who can guess or learn another production’s numeric ID can read the full script, cast, notes, and reports. For a multi-show org—or even a leaked ID—this defeats the casting filter.

**Fix (basic):** Introduce one shared dependency, e.g. `require_production_access(production_id)`, used by every production-scoped route:

- Admin / Director: any production in their organization (or all, while single-tenant).
- Actor: only productions where they have a `UserCharacterAssignment`.

Add API tests that attempt direct ID access as an uncast actor and expect 404/403.

---

### S2 — Critical: Default secrets usable in “prod-ish” deploys

**Where:** `backend/app/config.py`, `docker-compose.yml`, `.env.example`, seed defaults.

- `SECRET_KEY` defaults to a known string; prod validation only requires `ADMIN_PASSWORD`, not a strong unique `SECRET_KEY`.
- Compose defaults: `ADMIN_PASSWORD=admin`, same known `SECRET_KEY`, DB password = username.
- Dev seed users `director`/`director`, `actor`/`actor` when `ENVIRONMENT=dev`.

**Impact:** Forged JWTs and trivial admin login if env is mis-set or left on defaults.

**Fix (basic):** When `ENVIRONMENT=prod`, refuse known default `SECRET_KEY`, require strong `ADMIN_PASSWORD`, and do not seed director/actor demo accounts. Document a one-time secret generation step in deploy docs.

---

### S3 — High: Unbounded script upload (DoS / memory)

**Where:** `POST /api/productions/{id}/import` — `await file.read()` with only a `.md` extension check.

**Impact:** A large upload can exhaust backend memory and take down the process.

**Fix (basic):** Cap size (e.g. 2–5 MB via Starlette/nginx/`Content-Length` check), reject non-text after decode, optionally stream to a temp limit. Extension spoofing is secondary if size and UTF-8 decode are enforced.

---

### S4 — High: No login rate limiting

**Where:** `POST /api/auth/login`

**Impact:** Credential stuffing / brute force against weak or reused passwords if the API is network-reachable.

**Fix (basic):** Per-IP (and optionally per-username) throttle—e.g. slowapi, nginx `limit_req`, or a small in-memory/redis counter. Pair with a stronger password minimum (see S6).

---

### S5 — High: JWT in `localStorage`, 24h lifetime, no revocation

**Where:** `frontend/src/lib/api.ts`, `backend/app/auth/jwt.py`, logout no-op in `backend/app/api/auth.py`.

**Impact:** Any future XSS steals a long-lived token; logout does not invalidate stolen tokens; deactivated users are blocked on next request (good) but stolen tokens of active users work until expiry.

**Fix for beta (pragmatic):** Keep Bearer tokens if needed, but: shorten access token TTL (e.g. 1–4h), ensure React continues to escape user content (no markdown HTML without sanitization), and treat XSS as a hard ban. **After beta:** httpOnly Secure cookies + CSRF strategy, or refresh tokens with rotation/denylist.

---

### S6 — High: Password policy allows length 1

**Where:** `backend/app/schemas/auth.py` (`CreateUserRequest`, `ResetPasswordRequest`)

**Fix (basic):** `min_length=8` (or similar) for create/reset. Login can stay flexible for existing short passwords until force-reset.

---

### S7 — High: Reports API is not Director-gated

**Where:** `backend/app/api/reports.py` uses `require_authenticated` only; UI hides Reports behind `directorOnly`.

**Impact:** UI ≠ API. Any authenticated user who can hit the endpoint gets prop/cue/costume/entrance sheets for that production (compounded by S1).

**Fix (basic):** Use `require_director_or_admin` on report routes (and still apply production access from S1).

---

### S8 — High: Prod nginx strips `/api` incorrectly

**Where:** `frontend/nginx.conf`

```nginx
location /api/ {
    proxy_pass http://backend:8000/;  # strips /api → backend sees /auth/login
}
```

App mounts routers under `/api`. Vite dev proxy preserves `/api`; the **prod** image target does not.

**Impact:** Production frontend stage would break API calls (or hit wrong paths). Stability/security both—failed auth vs accidental exposure of wrong handlers.

**Fix (basic):** `proxy_pass http://backend:8000;` (no trailing slash) or `proxy_pass http://backend:8000/api/;` with a matching location design. Smoke-test the `prod` image before beta if that path will be used.

---

### S9 — Medium: Organization IDs exist but are not enforced

**Where:** Users/productions have `organization_id`; list users / castable users / group membership are not org-scoped.

**Impact today:** Low if truly single-tenant. **Risk:** false confidence that multi-org is safe.

**Fix for beta:** Document “single org per deployment.” Optionally filter by `current_user.organization_id` on user lists as a cheap hardening step. Full multi-tenant isolation is post-beta.

---

### S10 — Medium: OpenAPI docs exposed; CORS hardcoded to localhost

**Where:** FastAPI `/docs`, `/redoc`, `/openapi.json`; `backend/app/main.py` CORS origins.

**Fix for beta:** Disable docs when `ENVIRONMENT=prod`. Make CORS origins env-driven for the deploy host you actually use (do **not** use `*` with credentials).

---

### S11 — Medium: Bookmark / note path consistency gaps

**Where:** Bookmarks accept any `moment_id` without production membership; note update/delete paths include `production_id` but query mainly by `note_id` + ownership.

**Impact:** Cross-production peek via bookmark create; URL/production mismatch on notes.

**Fix:** Tie bookmark/note operations to production access (S1) and verify `note.production_id == path production_id`.

---

### S12 — Medium: Unrestricted cue `payload` JSON

**Where:** Cue schemas allow arbitrary `dict` with no size bound.

**Fix:** Cap serialized size (e.g. reject if JSON > N KB) or constrain known keys.

---

### S13 — Low: CSRF, SQL injection, path traversal

Bearer tokens in `Authorization` (not cookies) → classic CSRF risk is low. ORM usage is sound. Uploads are not written to disk → path traversal risk is low. Keep these properties when changing auth storage.

---

## Part 2 — Stability findings

### St1 — High: Concurrent moment reorder can corrupt sequence

**Where:** `backend/app/services/moment_sequence.py`; no unique constraint on `(scene_id, sequence_number)`.

**Impact:** Two directors editing the same scene can produce duplicate/gap sequence numbers and break ordering.

**Fix:** Unique constraint + transactional update with row locks (`SELECT … FOR UPDATE`) or a single ordered rewrite under a scene lock. Add a regression test for concurrent moves if practical.

---

### St2 — High: Bad timeline filter params → 500

**Where:** `parse_character_ids` in `backend/app/services/timeline_filters.py` calls `int()` without catching `ValueError`.

**Fix:** Validate query params in the route (Pydantic) or catch and return 422.

---

### St3 — Medium: Username uniqueness race; multi-step mutations

**Where:** `create_user` check-then-insert; many endpoints commit without catching `IntegrityError`.

**Fix:** Catch integrity errors → 409; keep related writes in one commit.

---

### St4 — Medium: Containers run as root; API port published

**Where:** Dockerfiles; Compose publishes `8000` and `5173`.

**Fix for beta (LAN pilot):** Bind to localhost or put behind a reverse proxy with TLS; firewall the host. After beta: non-root users in images, optional prod Compose override that does not expose backend directly.

---

### St5 — Medium: Seed on every container start

**Where:** `backend/scripts/start.sh` always migrates + seeds.

**Impact:** Mostly idempotent, but expands boot failure surface and can recreate demo users if env is wrong.

**Fix:** Seed only when `ENVIRONMENT=dev` or via an explicit `SEED_ON_START=true` flag.

---

### St6 — Latent: Prod frontend target unused / untested

Compose uses `target: dev`. The nginx path (S8) is unproven in CI.

**Fix:** Add a CI or smoke job that builds frontend `prod` and curls `/api/health` or login through nginx.

---

## Part 3 — Performance findings

### P1 — High: Unpaginated scene moment loads with heavy joins

**Where:** `list_scene_moments` loads all moments for a scene with many `joinedload`s, filters in Python, computes on-stage across the scene.

**Impact:** Large musical scenes → large JSON, slow first paint, memory pressure.

**Fix for beta:** Acceptable if scripts stay modest; smoke-test with the largest real script you will import. **During/after:** pagination or “summary vs detail” payloads; keep list payloads slim.

---

### P2 — High: Reports load entire production timelines

**Where:** `backend/app/api/reports.py`

**Fix:** Same as P1—OK for one show if measured; add streaming/CSV later if sheets get huge.

---

### P3 — Medium: On-stage recomputed per moment detail

**Where:** `on_stage_character_ids_for_moment` reloads all scene moments on each detail open; list path already batch-computes.

**Fix:** Reuse batch helper or cache per-request for the scene.

---

### P4 — Medium: Bookmark list filters in Python; chatty overview counts

**Fix:** Filter bookmarks in SQL; overview counts are fine for MVP.

---

### P5 — Low: Missing composite index `(scene_id, sequence_number)`

Add when reorder locking (St1) lands—same migration can add the unique index.

---

## Part 4 — Standardization opportunities

These are not “security bugs,” but they **raise beta maintenance risk**: the same fix must be applied in many places, and drift causes authz/UX inconsistencies.

### Priority A — High value before or early in beta

| Opportunity | Evidence | Proposed direction |
| --- | --- | --- |
| **Shared production access helper** | `_get_production_or_404` duplicated in ~12 API modules | Extract `app/api/deps.py`: `get_production_or_404`, `get_moment_in_production_or_404`, `require_production_access`, `validate_character_in_production` — **same change that fixes S1** |
| **Shared moment response builders** | `_moment_prop_response` (etc.) duplicated in resource routers and `timeline.py` | One serializer module so timeline and catalog attach/detach cannot drift |
| **Catalog CRUD pages** | Near-identical Props / Set Pieces / Microphones / Cue Categories / Costumes / Songs pages | Shared page shell: header, loading, error banner, table, create/edit dialog; or `useCatalogCrud` + column config |
| **`formatApiError`** | Most pages use `String(err.detail)`; validation arrays become `"[object Object]"`; `ApiError.message` already exists | One helper used by toasts and page error banners |
| **Slice `MomentDetailPanel`** | ~1.4k lines; repeated attach/detach blocks for props, mics, set pieces, entrances, exits, blocking, cues | `MomentAttachmentSection` (select + optional character + notes + list + detach) |

### Priority B — Nice during beta if time allows

| Opportunity | Notes |
| --- | --- |
| Consistent loading UX | Skeleton on Timeline/Rehearse/Reports/Overview vs plain “Loading…” on catalogs |
| shadcn Input / Select / Label / Table | Same class string repeated everywhere; focus rings inconsistent |
| Unify `Button` vs raw `<button>` | Characters, Groups, CreateProduction, Import, EmptyState, parts of Timeline/MomentDetail |
| Auth dependency naming | `require_director` alias in `characters.py` / `groups.py` vs `require_director_or_admin` elsewhere |
| Route gating consistency | Groups/Reports are `directorOnly` routes; catalogs rely on in-page `canManagePreparation` |

### Priority C — After beta

| Opportunity | Notes |
| --- | --- |
| Move songs out of `characters` API/schemas | Routes are `/songs` but live under characters modules |
| Split notes vs bookmarks routers | Optional clarity only |
| Split `api.ts` by domain | Optional readability; single client is fine |
| Schema style (`ConfigDict` vs dict `model_config`) | Cosmetic consistency |

---

## Prioritized action plan

### Before beta (must-fix / must-harden)

Do these before inviting cast/crew onto a shared instance with real script content.

| # | Item | Refs | Effort (rough) |
| --- | --- | --- | --- |
| 1 | Enforce production access on **every** production-scoped route; centralize helpers | S1, Std A | M |
| 2 | Prod config: reject default `SECRET_KEY`; require strong admin password; no demo seed users in prod | S2, St5 | S |
| 3 | Cap script import size; basic content checks | S3 | S |
| 4 | Director-gate reports API | S7 | S |
| 5 | Fix nginx `/api` proxy; smoke-test frontend `prod` if that path will be used | S8, St6 | S |
| 6 | Disable `/docs` in prod; set CORS origins for the real host | S10 | S |
| 7 | Password min length on create/reset | S6 | S |
| 8 | Login rate limiting (app or reverse proxy) | S4 | S–M |
| 9 | `formatApiError` + use it on high-traffic pages | Std A | S |
| 10 | Validate timeline filter query params (no 500s) | St2 | S |
| 11 | Deploy checklist: unique secrets, `ENVIRONMENT=prod`, TLS or trusted LAN only, change all seed passwords | Ops | S |

**Explicitly acceptable to defer for a closed LAN pilot:** httpOnly cookies, refresh tokens, non-root containers, full org multi-tenancy, Dependabot.

---

### During beta (watch, measure, patch quickly)

| # | Item | Refs | Why during |
| --- | --- | --- | --- |
| 1 | Unique `(scene_id, sequence_number)` + locked reorder | St1, P5 | Real concurrent director edits will surface this |
| 2 | Extract catalog page shell / shared CRUD patterns as you touch those pages | Std A | Reduces patch churn mid-beta |
| 3 | Slice moment attachment sections when fixing moment-detail bugs | Std A | Same |
| 4 | Measure timeline/report payload sizes on the real script | P1, P2 | Only optimize if the pilot script is slow |
| 5 | Shorten JWT TTL if sessions feel “too sticky” or someone leaves the company | S5 | Low effort knob |
| 6 | Bookmark/note production consistency | S11 | If actors share links oddly |
| 7 | Catch `IntegrityError` on user create / unique names | St3 | If admins create users in parallel |

**Ops during beta:** Keep a simple incident list (auth failures, import failures, timeline reorder glitches). Prefer fixing shared helpers over one-off page patches.

---

### After beta (harden toward broader use)

| # | Item | Refs |
| --- | --- | --- |
| 1 | httpOnly Secure cookies or short-lived access + refresh with revocation | S5 |
| 2 | Org-scoped queries everywhere if multi-org is on the roadmap | S9 |
| 3 | Paginate / slim timeline and report APIs; fix on-stage detail recompute | P1–P3 |
| 4 | Cap cue `payload` size; dependency update automation | S12 |
| 5 | Non-root Docker users; TLS-terminated reverse proxy; prod Compose override | St4 |
| 6 | shadcn form/table primitives; Button consistency; songs module cleanup | Std B/C |
| 7 | Shared catalog API helper on the backend (props/mics/set pieces clones) | Std A |
| 8 | Security headers, backup/restore runbook, monitoring/alerting | Ops |

---

## Suggested beta deploy checklist (ops)

Copy into a runbook when standing up the pilot host:

- [ ] `ENVIRONMENT=prod`
- [ ] Fresh random `SECRET_KEY` (≥32 bytes, not the documented default)
- [ ] Strong unique `ADMIN_PASSWORD`; change immediately after first login if seeded
- [ ] Strong `POSTGRES_PASSWORD`; DB not exposed publicly
- [ ] CORS origins match the real frontend origin
- [ ] `/docs` and `/redoc` disabled or blocked
- [ ] Login rate limit enabled (app or proxy)
- [ ] Import size limit confirmed
- [ ] If using frontend `prod` image: `/api` proxy verified with a login smoke test
- [ ] TLS (or VPN / LAN-only) documented for participants
- [ ] No demo `director`/`actor` passwords left from `ENVIRONMENT=dev`
- [ ] Backup of Postgres volume before script import and after major edits
- [ ] At least one Admin and one Director account created for the pilot company

---

## Testing gaps to close with the above

| Gap | Related |
| --- | --- |
| Actor can `GET /productions/{other_id}` | S1 |
| Actor can `GET .../reports/*` | S7 |
| Import of oversized file returns 413 | S3 |
| Prod settings reject default `SECRET_KEY` | S2 |
| Invalid `character_ids` query → 422 | St2 |
| Concurrent reorder preserves uniqueness | St1 |
| Frontend `prod` image login through nginx | S8 |

---

## Out of scope / not found

- No third-party OAuth, email, object storage, Redis, or payment integrations to audit.
- No classic SQL injection or DOM XSS sinks identified in current code.
- No requirement in this review for formal penetration testing before a closed single-production pilot; revisit if the host becomes internet-facing to a wider audience.

---

## Bottom line

**Ship a single-production beta after:** production-scoped authorization (not just list filtering), non-default secrets, upload caps, report RBAC, login throttling, safer password rules, docs/CORS locked down, and a working (or unused) prod proxy path.

**Standardize early** around shared backend access helpers and frontend error/catalog/moment-attachment patterns so mid-beta fixes do not fork twelve ways.

**Defer** cookie auth, full multi-tenancy, deep performance work, and UI kit perfection until the pilot proves the product is useful—unless measurement during beta forces an earlier move.
