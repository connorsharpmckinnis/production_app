# Phase 10 — Deployment Security, Container Standardization & Private Multi-Device Access

**Status:** Complete (2026-07-22) — hardening + Dev/Tailscale day-to-day path; optional nginx preview retained
**Goal:** Make the laptop-hosted Docker stack secure enough for real script content, reachable from the owner’s phone/tablet via Tailscale, and ready for a future VPS — without opening the app to the public internet.

Phases 6–8 deferred deployment hardening. [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) and [SECURITY_REVIEW.md](SECURITY_REVIEW.md) already list the P0 “don’t leak a script / don’t ship a soft pilot on hope” items. Phase 10 turns that into an executable plan and adds the **access path** for multi-device testing.

This phase is **not** production SaaS hosting, STP IT onboarding, or a Cloudflare-first public demo. It is the boring foundation so feature work and an eventual VPS pilot sit on something trustworthy.

---



## Owner Decisions (confirmed 2026-07-21)


| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| **Access model (near term)** | **Tier A:** laptop is the host; **Tailscale** private mesh for owner devices only | Stable bookmarkable access; not public internet; owner already has Tailscale on laptop + phone |
| **Who gets access (next few months)** | Owner only — laptop, phone, tablet on the same tailnet | Keeps ACLs/invites out of scope; soft-pilot invites are later |
| **Laptop must be awake** | Acceptable for Tier A | Matches prototype reality; always-on is Tier B |
| **Access tech detail** | Prefer **localhost-bound Compose ports + Tailscale Serve** (HTTPS on MagicDNS hostname). MagicDNS-only to published ports is acceptable fallback if Serve is awkward | Serve = stable `https://…ts.net` URL, no raw IP:port, not exposed on café Wi‑Fi; MagicDNS alone is simpler but ports may still be LAN-reachable |
| **Cloudflare Tunnel** | Avoid for Phase 10; tolerate only as an emergency demo fallback | Free tunnels rotate URLs; no owned Cloudflare domain today |
| **Day-to-day Compose** | **Vite `dev` only** (`docker compose up -d --build`). Tailscale Serve → **5173**. Optional nginx `docker-compose.preview.yml` kept for future VPS smoke-tests, not daily use | Owner preference (2026-07-21): one stack for maintainability |
| **App security in this phase** | Absorb Pre-August / SECURITY_REVIEW **before-beta** items that are reasonable: IDOR, secrets hygiene, upload caps, report RBAC, login rate limit, password min length, prod docs/CORS, nginx `/api` fix | Shared Tailscale link without these is false confidence |
| **Tier B (later)** | Cheap **hands-off VPS** (or similar web host); Connor deploys; cost + low maintenance win. Self-host Pi is secondary. Decide specifics with STP after pilot signal | STP is non-technical; uptime/maintenance argue against home self-host as the end state |
| **Cloudflare domain / STP spend** | Future pilot decision — not Phase 10 | May buy domain + VPS when piloting for real |
| **Out of Phase 10** | Multi-tenant SaaS, httpOnly cookie auth migration, non-root images as hard requirement, Funnel/public URLs as default, full CI deploy pipelines to cloud | Explicit deferrals from SECURITY_REVIEW “after beta” |


---



## Where We Are (pre–Phase 10)



### Shipped and reliable


| Area | Status |
| ---- | ------ |
| Docker Compose: `db` + `backend` + frontend `dev` (Vite :5173) | Done — primary workflow |
| Frontend multi-stage Dockerfile with unused `prod` (nginx :80) target | Exists; **unproven** in daily use |
| JWT auth, Admin / Director / Actor roles, bcrypt passwords | Done |
| Postgres not published to the host | Done (good) |
| Tailscale on owner laptop + phone | Owner-ready (outside repo) |



### Gaps this phase addresses


| Item | Notes |
| ---- | ----- |
| No documented private multi-device path | Phone testing = LAN IP:port folklore, or nothing |
| Frontend `prod` nginx strips `/api` incorrectly | [SECURITY_REVIEW.md](SECURITY_REVIEW.md) S8 — preview/VPS would break |
| Production access is list-only for actors (IDOR) | S1 — Critical before any shared host with real scripts |
| Default secrets usable if `ENVIRONMENT` is wrong | S2 |
| Unbounded script upload; weak password min length; reports API not director-gated | S3, S6, S7 |
| No login rate limiting; `/docs` + CORS hardcoded for localhost | S4, S10 |
| Seed always runs; Compose always publishes API/UI on all interfaces | St5, St4 |
| No one-page deploy / Tailscale runbook | Pre-August P0 “one-page deploy notes” |
| Deployment hardening deferred since Phases 6–8 | Explicit park → this phase |



### Explicitly not Phase 10


| Item | Target |
| ---- | ------ |
| Public internet exposure as the default access path | Never for Tier A; Tier B uses TLS on a real host |
| Cloudflare Tunnel / Funnel as primary | Emergency demo only; document as “avoid” |
| Inviting STP / cast onto the tailnet | After Tier A is solid; likely move to Tier B for pilot |
| VPS provisioning, DNS purchase, STP billing | Post–August / post–pilot-signal |
| httpOnly Secure cookies + CSRF redesign | After beta (S5) |
| Full org multi-tenancy enforcement | Post-beta (S9); document single-org-per-deploy |
| Non-root container users as a gate | After beta (St4); optional if cheap |
| Concurrent moment-reorder locking / deep performance work | During/after beta (St1, P1–P2) — not this phase unless blocking |
| Feature work (import polish, sheets, UX) | [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) P1+ / other phases |
| Replacing Vite-dev as the coding default | Keep; preview is additive |


---



## Read First


| Document | Why |
| -------- | --- |
| [SECURITY_REVIEW.md](SECURITY_REVIEW.md) | Authoritative findings + before-beta checklist |
| [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) | P0 security/deploy items tied to August credibility |
| [PROJECT.md](PROJECT.md) | One-org-per-deploy, auth model, phase roadmap |
| [ROLES.md](ROLES.md) / [SEED_DATA.md](SEED_DATA.md) | Who may access what; bootstrap admin rules |
| [README.md](../README.md) | Current Compose / env / ports |
| [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Docker required; keep Compose simple; document ports/env |


---



## Phase Theme

**“Can I run this on my laptop, open the same private link on my phone, and trust that a real script won’t leak or melt the box — without pretending we’re already on a VPS?”**

Four vertical slices:

1. **Private access (Tier A)** — Tailscale Serve → Vite **5173**; owner devices only.
2. **Compose standardization** — one day-to-day **dev** stack; nginx `/api` fix + optional preview overlay retained for Tier B.
3. **Application hardening** — production access (IDOR), secrets, uploads, rate limits, report RBAC, password floor, prod docs/CORS.
4. **Ops docs** — one-page deploy + Tailscale runbook; explicit Tier B sketch so we don’t paint into a corner.

---



## Access Architecture



### Tier A — Laptop + Tailscale (Phase 10)

```text
[Phone / tablet / laptop]
        │  Tailscale mesh (private)
        ▼
[Laptop MagicsDNS / Serve HTTPS]
        │  loopback only (preferred)
        ▼
[Docker Compose]
   frontend (dev :5173  or  preview nginx :80)
   backend  (:8000)
   db       (internal only)
```

**Rules**

- App is **not** intentionally reachable from the public internet.
- Prefer **not** relying on café/LAN `192.168.x.x:port` as the “shareable” story.
- Owner installs Tailscale on each personal device and uses one bookmarkable URL.
- Laptop must be awake and online for remote devices to work — accepted.

**MagicDNS vs Serve (plain English)**

| Option | What you get | Tradeoff |
| ------ | ------------ | -------- |
| **MagicDNS only** | Stable name for the laptop (e.g. `your-mac.tail….ts.net`); you still type a port (`:5173` or `:80`) | Simplest mental model; if Compose binds `0.0.0.0`, the same ports may also be reachable on local Wi‑Fi |
| **Tailscale Serve** (preferred) | HTTPS on the MagicDNS name, proxying to a **localhost** port — bookmark `https://your-mac…` with no port | One extra Tailscale command/config; best match for “not IP:port” and not LAN-open |

Phase 10 documents **Serve as the happy path** and MagicDNS-only as fallback. Neither requires a Cloudflare domain.

**Cloudflare Tunnel:** do not make it the documented default. If used once for an off-tailnet emergency demo, treat the URL as ephemeral and tear it down after.



### Tier B — Hands-off host (future; document only)

```text
[Browsers anywhere, invited users]
        │  HTTPS (real DNS name)
        ▼
[Small VPS or managed host]
   reverse proxy (Caddy/nginx) + TLS
   same Docker images / Compose-shaped stack
   ENVIRONMENT=prod, strong secrets
```

**Intent (not implement in Phase 10)**

- Cost and low maintenance beat home self-hosting for STP.
- Connor keeps deploy credentials and ships builds; STP is not the sysadmin.
- Exact vendor (DigitalOcean, Hetzner, Railway-style, etc.) and whether Cloudflare sits in front is a **post-meeting** decision.
- Raspberry Pi / home always-on remains a possible interim, not the preferred end state.



### CORS and “the real origin”

Today CORS is hardcoded to `http://localhost:5173`. Phase 10 makes origins **env-driven**.

For Tier A preview via Serve, the browser origin will be the Tailscale HTTPS hostname (and/or `http://100.x` / MagicDNS http). Document the exact `CORS_ORIGINS` value(s) in the runbook once Serve is chosen — do **not** use `*`.


---



## Container & Compose Standardization



### Profiles


| Profile | Command (illustrative) | Frontend | Backend env | Ports (preferred) | Use when |
| ------- | ---------------------- | -------- | ----------- | ----------------- | -------- |
| **dev** (default) | `docker compose up -d --build` | Vite `target: dev` | `ENVIRONMENT=dev` OK | Current habit OK for local coding; optional localhost bind | Daily feature work |
| **preview** | `docker compose --profile preview up -d --build` (exact flag TBD) | nginx `target: prod` | Prefer `ENVIRONMENT=prod` + strong secrets from `.env` | Host bind `127.0.0.1` + Tailscale Serve → `:80` (or mapped host port) | Phone test, “does prod image work?”, pre-pilot smoke |

Implementation may use Compose `profiles`, a `docker-compose.preview.yml` override, or documented `target:` / port edits — pick the **simplest** pattern that stays one-command for the owner. Prefer override file or profile over asking humans to edit YAML each time.



### Must-fix before trusting preview

1. **nginx `/api` proxy** — trailing slash currently strips `/api` so the backend never sees `/api/...`. Fix and smoke-test login through the preview frontend.
2. **Health path** — confirm `/api/health` (or equivalent) through nginx.
3. **No demo director/actor seeds** when `ENVIRONMENT=prod`.
4. **DB remains unpublished.**



### Env / secrets

- `.env.example` documents required prod vars and a one-liner for generating `SECRET_KEY`.
- When `ENVIRONMENT=prod`, refuse known default `SECRET_KEY` and weak/default `ADMIN_PASSWORD`.
- Seed on start: only when `ENVIRONMENT=dev` (demo director/actor seeds; no separate `SEED_ON_START` flag was added).


---



## Application Hardening (from SECURITY_REVIEW / Pre-August P0)



### In scope (do in Phase 10)


| Ref | Work |
| --- | ---- |
| **S1** | Shared `require_production_access` (and helpers) on every production-scoped route; Actor only if cast; tests for IDOR |
| **S2 / St5** | Prod refuses default secrets; no demo users in prod; seed gating |
| **S3** | Cap script upload size + basic content/UTF-8 checks |
| **S4** | Login rate limiting (app-level preferred so preview and future VPS both get it; nginx `limit_req` optional extra) |
| **S6** | Password `min_length` on create/reset |
| **S7** | Reports API: `require_director_or_admin` + production access |
| **S8 / St6** | Fix nginx `/api`; smoke preview image |
| **S10** | Disable `/docs` `/redoc` `/openapi.json` in prod; env-driven CORS |
| **S11** | Bookmark/note paths respect production access (ties to S1) |
| **St2** | Invalid timeline filter params → 422, not 500 |
| **Ops** | One-page deploy + Tailscale runbook; beta checklist folded in |

Also cheap if it falls out of S1: centralize `_get_production_or_404` into shared deps (SECURITY_REVIEW Std A).



### Explicitly deferred (not Phase 10 gates)


| Ref | Why defer |
| --- | --------- |
| **S5** httpOnly cookies / refresh revocation | Larger auth redesign; Bearer + XSS discipline OK for Tier A |
| **S9** full org isolation | Single org per deploy — document, don’t build multi-tenant |
| **S12** cue payload size cap | Medium; do if trivial while touching schemas |
| **St1** reorder locking | During-beta; real concurrent directors |
| **St4** non-root images | After beta unless easy |
| **P1–P2** pagination | Measure on real script later |


---



## Work Packages



### WP0 — Tailscale access runbook (Tier A)

**Objective:** Owner can bookmark one private HTTPS URL on phone/tablet and reach the laptop stack without public exposure.

**Tasks**

- [ ] Confirm MagicDNS is enabled on the tailnet (Tailscale admin / client settings) — owner confirms on Mac
- [x] Document **Serve** happy path: Tailscale Serve → Vite **5173** (day-to-day); optional preview on `:80` documented in DEPLOY.md
- [x] Document MagicDNS-only fallback (`http://<magicdns>:<port>`) and its LAN caveat
- [x] Document CORS origin(s) to set for the Serve hostname
- [x] Explicit “do not use Cloudflare Tunnel as default”; optional one-paragraph emergency demo note
- [x] Write [DEPLOY.md](DEPLOY.md): start Compose → Serve → open on phone → tear-down / sleep laptop expectations

**Done when:** From a cold start, the owner can follow the runbook and load the app on phone over Tailscale without using a LAN IP or public tunnel.



### WP1 — Compose `preview` profile + nginx `/api` fix

**Objective:** One documented command builds the production frontend image and it successfully talks to the API.

**Tasks**

- [x] Fix `frontend/nginx.conf` `proxy_pass` so `/api/...` reaches the backend with the `/api` prefix intact
- [x] Add Compose profile or override for frontend `target: prod`, port mapping suitable for Serve (`127.0.0.1:…:80`)
- [x] Keep default `docker compose up -d --build` as Vite **dev** (no behavior surprise)
- [x] Smoke script or documented curl: preview UI → `/api/health` and login
- [ ] Optional: CI job that builds frontend `prod` and fails if nginx config is wrong (lightweight) — deferred

**Done when:** Preview stack login works through nginx; README / DEPLOY.md show both commands. Day-to-day remains Dev + Serve on **5173**; preview is optional.



### WP2 — Prod secrets, seed gating, docs/CORS

**Objective:** Misconfigured “prod” cannot boot with toy secrets; OpenAPI is not public on prod; CORS matches the real origin.

**Tasks**

- [x] Config validation: `ENVIRONMENT=prod` rejects default/known `SECRET_KEY` and weak/default `ADMIN_PASSWORD`
- [x] Seed demo director/actor only when `ENVIRONMENT=dev` (no separate `SEED_ON_START` env; seed gated by environment); admin bootstrap rules remain documented
- [x] Disable `/docs`, `/redoc`, `/openapi.json` when prod
- [x] `CORS_ORIGINS` (or similar) from env; update `.env.example`
- [x] Tests for config refusal; docs/`redoc`/`openapi` disabled in code when `ENVIRONMENT=prod`

**Done when:** Compose with `ENVIRONMENT=prod` + default secrets fails loudly; with strong secrets, app serves without OpenAPI UI.



### WP3 — Production access (IDOR) + report RBAC + note/bookmark consistency

**Objective:** Authenticated ≠ authorized for every production’s script data.

**Tasks**

- [x] Introduce shared deps: `get_production_or_404`, `require_production_access`, `get_accessible_production`, and related helpers
- [x] Apply to all production-scoped routes (timeline, catalogs, overview, notes, bookmarks, import, reports, etc.); moment satellite lists fixed
- [x] Actor: only productions with a `UserCharacterAssignment`; Admin/Director: org productions (single-tenant OK)
- [x] Reports: director/admin + production access (S7)
- [x] Bookmark/note operations cannot cross productions (S11)
- [x] API tests: uncast actor `GET /productions/{other}` → 403/404; reports denied for actors

**Done when:** IDOR tests pass; reports are not actor-readable via API.



### WP4 — Upload caps, password floor, login rate limit, filter 422

**Objective:** Shared host cannot be trivially DoS’d or brute-forced; bad query params don’t 500.

**Tasks**

- [x] Script import max size (e.g. 2–5 MB) + clear 413; basic decode/content checks
- [x] Password `min_length=8` (or project-agreed floor) on create/reset
- [x] Login rate limit (per-IP and optionally per-username) — prefer in-app so preview and future VPS share behavior
- [x] Timeline filter query validation → 422 (St2)
- [x] Tests for oversized import, rate limit behavior (within reason), password validation, bad filters

**Done when:** SECURITY_REVIEW before-beta items S3, S4, S6, St2 are closed with tests.



### WP5 — Deploy docs + PROJECT / Pre-August linkage

**Objective:** Future-you (and an implementing agent) can run Tier A and understand Tier B without tribal knowledge.

**Tasks**

- [x] Add [DEPLOY.md](DEPLOY.md): Tier A Tailscale + Compose Dev (Serve on 5173); optional preview; secrets generation; checklist from SECURITY_REVIEW “Suggested beta deploy checklist”
- [x] Short Tier B sketch: VPS + TLS + same images; what changes (DNS, CORS, always-on); what stays (Docker, prod env rules)
- [x] Update [README.md](../README.md) with pointers to DEPLOY.md and preview command
- [x] Update [PROJECT.md](PROJECT.md) Phase 10 tracker when shipping
- [x] Tick / reference Pre-August P0 security & deploy bullets once done
- [x] Update [SECURITY_REVIEW.md](SECURITY_REVIEW.md) status notes or “addressed in Phase 10” pointers (light touch)

**Done when:** A cold reader can start Dev + Tailscale Serve (or localhost without Tailscale) and know what “real hosting later” means.



## Exit Criteria

1. Owner can reach the app from phone/tablet over Tailscale Serve on **5173**; laptop-awake requirement documented.
2. Default Compose remains Vite **dev**; optional nginx preview overlay still builds and proxies `/api` correctly for future VPS.
3. `ENVIRONMENT=prod` refuses default secrets; no demo cast seeds; OpenAPI disabled; CORS env-driven.
4. Production-scoped routes enforce access (IDOR fixed) with tests; reports are director/admin-only.
5. Script upload capped; password floor on create/reset; login rate limited; bad timeline filters return 422.
6. [DEPLOY.md](DEPLOY.md) (or equivalent) covers Tier A runbook + Tier B sketch + secrets checklist.
7. Cloudflare Tunnel is not the documented default path.
8. No requirement to provision a VPS or buy a domain to complete this phase.



## Manual Validation


| Step | Expected |
| ---- | -------- |
| `docker compose up -d --build` (dev) | Local Vite workflow |
| Start Dev + `tailscale serve --bg 5173` | Phone loads HTTPS MagicDNS URL; login works |
| Disconnect Tailscale on phone | App unreachable (confirms not relying on public/LAN alone) |
| Preview with default `SECRET_KEY` / `ENVIRONMENT=prod` | Backend refuses to start |
| Login as Actor; request another production by ID | 403/404 |
| Actor hits reports API | Denied |
| Upload oversized script | 413 |
| Burst login failures | Rate limited |
| `ENVIRONMENT=prod` | `/docs` not available |
| Laptop sleep | Phone loses access (documented; not a bug) |


---



## Rollout Order

```text
WP0 Tailscale runbook (can start anytime; refine after WP1 ports)
WP1 preview Compose + nginx fix
        ↓
WP2 secrets / seed / docs / CORS
        ↓
WP3 IDOR + reports + note/bookmark access
        ↓
WP4 upload / password / rate limit / filter 422
        ↓
WP5 DEPLOY.md + cross-doc updates
```

WP0 and WP1 can overlap. Do **not** advertise phone access as “safe for real scripts” until WP2–WP4 land.



## Risks


| Risk | Mitigation |
| ---- | ---------- |
| Serve config forgotten after reboot | Document `tailscale serve` persistence / login-item; checklist in DEPLOY.md |
| CORS mismatch with Serve hostname | Set `CORS_ORIGINS` from the exact bookmark URL; test from phone |
| Owner uses preview with `ENVIRONMENT=dev` by habit | Preview docs insist on prod env + strong `.env`; config refusal when prod |
| False sense of security (“it’s on Tailscale”) without IDOR fix | Exit criteria require WP3; Pre-August P0 tied to this phase |
| Rate limit locks out owner during testing | Generous limits; document how to restart / clear; whitelist not required for single user |
| Future VPS differs enough to rewrite everything | Same images + prod env rules + nginx fix are the portable core; Tier B sketch keeps DNS/TLS outside the app |
| Temptation to Funnel/Tunnel for “just this demo” | DEPLOY.md marks public tunnels as emergency-only and ephemeral |


---



## Decision Log


| Date | Decision |
| ---- | -------- |
| 2026-07-21 | Two tiers: Tailscale laptop host now; VPS-style hands-off host later |
| 2026-07-21 | Near-term access: owner devices only on existing tailnet |
| 2026-07-21 | Laptop-awake requirement accepted for Tier A |
| 2026-07-21 | Prefer Tailscale Serve + localhost binds; MagicDNS-only is fallback |
| 2026-07-21 | Avoid Cloudflare Tunnel as default; no owned CF domain required for Phase 10 |
| 2026-07-21 | Keep Vite-dev default Compose; add preview (frontend `prod`) path |
| 2026-07-21 | Consolidate day-to-day to Dev + Tailscale Serve on **5173**; preview optional appendix only |
| 2026-07-21 | Phase 10 absorbs Pre-August / SECURITY_REVIEW before-beta app hardening |
| 2026-07-21 | Tier B optimized for cost + hands-off; Connor deploys; self-host not preferred end state |
| 2026-07-21 | Defer cookie auth, multi-tenant isolation, non-root images, public hosting provisioning |
| 2026-07-22 | Localhost-only testing OK without Tailscale on secondary machines; Tailscale runbook remains for the primary Mac |
| 2026-07-22 | Phase 10 complete — single day-to-day path is Dev + Serve on **5173**; optional nginx preview retained for Tier B smoke |


---



## Implementing-Agent Notes

Follow [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md).

- Prefer boring, documented Docker Compose over clever orchestrators.
- Do not invent multi-tenant SaaS networking for this phase.
- Every production-scoped route should go through shared access helpers — fix once, not twelve copy-pastes.
- When changing authz or nginx, add or update the tests / smoke steps listed under Exit Criteria and [SECURITY_REVIEW.md](SECURITY_REVIEW.md) “Testing gaps.”
- Update DEPLOY.md and README in the same change set as the Compose/nginx behavior they describe.
- Do not provision remote cloud resources or change Tailscale admin ACL policy without explicit owner confirmation (remote-system rule).
