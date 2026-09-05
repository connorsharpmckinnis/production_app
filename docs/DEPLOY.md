# Deploy & Private Access

How to run The Theater Thing on your laptop day to day, reach it from your phone over Tailscale, and host the API (and soon the UI) on Google Cloud Run.

Companion to [PHASE_10.md](shipped_features/phases/PHASE_10.md). Latency / Neon query-cost ideas: [PERFORMANCE.md](PERFORMANCE.md).

**Current hosting (2026-09-05):**
- **Database:** Neon
- **API:** Cloud Run (free tier), continuous deploy from GitHub `main` — see [Cloud Run backend](#cloud-run-backend-shipped-2026-09-05)
- **Frontend:** local Vite day-to-day; **prod image ready** for Cloud Run (`theater-thing-frontend`) — see [Cloud Run frontend](#cloud-run-frontend--owner-console-steps)
- **Day-to-day coding:** Postgres local Docker *or* Neon via `DATABASE_URL`; API + Vite on the host via `./scripts/dev`. Tailscale Serve on **5173** when you want private multi-device access
---

## Day-to-day (Dev)

```bash
cp .env.example .env   # once; then edit DATABASE_URL / secrets as needed
./scripts/dev
```

| What | URL |
| ---- | --- |
| App | http://localhost:5173 |
| API health | http://localhost:8000/health |

**`DATABASE_URL` in the repo-root `.env` is the source of truth** for which Postgres the app uses. `./scripts/dev` loads it, runs migrations + seed, then API (`uvicorn --reload`) and Vite together.

- If `DATABASE_URL` points at `127.0.0.1` / `localhost` / `db`, the script starts local Docker Postgres.
- If it points at a remote host (e.g. Neon), local Docker Postgres is **not** started.

| Change | Action |
| ------ | ------ |
| Frontend / backend code | Save + browser refresh (HMR / reload). No rebuild. |
| New DB migration | Ctrl+C → `./scripts/dev` again |
| Switch local Docker ↔ Neon | Edit `DATABASE_URL` in `.env`, then `./scripts/dev` |
| Stop API + Vite | Ctrl+C |
| Stop local Postgres | `docker compose stop db` (only when using local DB) |

Quick DB connectivity check (uses `.env`):

```bash
./scripts/check-db
```

Dev logins (when `ENVIRONMENT=dev`): `admin` / `admin` (and any users already in the database).

On a machine **without Tailscale** (for example a secondary Windows laptop), browser testing at `http://localhost:5173` is enough — leave the Tailscale steps for the machine that has Tailscale installed.

### Optional: full Docker (baked-in code)

```bash
docker compose up -d --build
```

Compose passes through `DATABASE_URL` from `.env` when set; otherwise the backend uses the internal `db` hostname. Prefer `./scripts/dev` for daily coding (and for Neon) so images do not accumulate.

---

## Neon (hosted Postgres)

Migrate vs seed vs copy data:

| Term | What it does |
| ---- | ------------ |
| **Migrate** (`alembic upgrade head`) | Creates/updates **tables and columns** (schema). Needed on an empty Neon database unless you restore a dump that already includes schema. |
| **Seed** (`python -m app.seed`) | Inserts **default** admin/org/roles/moment types if missing. Does **not** copy your production script data. |
| **Dump / restore** | Copies **your real data** (and usually schema) from local Docker Postgres → Neon. |

### One-time: copy local Docker data → Neon

1. Keep local Postgres running and dump it (schema + data):

   ```bash
   docker compose up -d db
   docker compose exec -T db pg_dump -U production_app -d production_app --no-owner --no-acl \
     > /tmp/production_app_dump.sql
   ```

2. In `.env`, set `DATABASE_URL` to your Neon **direct** connection string (include `sslmode=require`). Comment out the local `127.0.0.1` URL.

3. Restore into Neon (requires `psql` on your Mac — from Postgres.app, Homebrew `libpq`, or Neon’s SQL editor upload):

   ```bash
   # Load DATABASE_URL from .env into this shell, then:
   set -a && source .env && set +a
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/production_app_dump.sql
   ```

4. Verify, then run the app against Neon:

   ```bash
   ./scripts/check-db
   ./scripts/dev
   ```

After a full dump/restore you usually **do not** need a separate migrate for that first load (schema came with the dump). `./scripts/dev` still runs migrate + seed; migrate should be a no-op if `alembic_version` matched, and seed is mostly idempotent.

### Later: refresh Neon from local again

Repeat dump → restore (or dump → drop Neon DB / create fresh → restore). For schema-only changes on an already-populated Neon DB, run `cd backend && uv run alembic upgrade head` with Neon `DATABASE_URL` set.

### Fresh Neon with no local data to copy

```bash
# DATABASE_URL=Neon in .env
./scripts/check-db
./scripts/dev   # migrate + seed + app
```

---

## Phone / tablet via Tailscale Serve

Goal: one bookmarkable private HTTPS URL. The laptop must be awake and online. Skip this section until Tailscale is installed on the host machine.

1. Install/sign in to Tailscale on the laptop and phone (same account/tailnet).
2. Start the app: `./scripts/dev`.
3. On the laptop, serve Vite:

   ```bash
   tailscale serve --bg 5173
   ```

4. Check the URL:

   ```bash
   tailscale serve status
   ```

   You should see something like `https://your-machine.tailXXXX.ts.net`.

5. Open that URL on your phone and bookmark it.
   If Vite says the host is not allowed, the frontend config must include
   `server.allowedHosts: [".ts.net"]` (already set in this repo). Restart
   `./scripts/dev` if you still see the error after pulling that change.
6. Add the exact `https://…` origin to `CORS_ORIGINS` in `.env` (keep the localhost entries), then restart `./scripts/dev` so the API picks up the env.

   Example `.env` line:

   ```bash
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-machine.tailXXXX.ts.net
   ```

Tear down Serve when you want it off:

```bash
tailscale serve reset
```

Exact `tailscale serve` flags can vary by Tailscale version (`tailscale serve --help`). The idea is always: HTTPS on your MagicDNS name → localhost:5173.

### Fallback: MagicDNS + port

If Serve is awkward, enable MagicDNS and open `http://your-machine:5173` from the phone while Tailscale is connected. Prefer Serve so you are not typing ports and are less exposed on local Wi‑Fi.

### What we are not doing by default

- **Cloudflare Tunnel** — emergency demo only; poor daily default.
- **Public port-forwarding** — do not expose the app to the open internet on this laptop host.

---

## Real script content on the laptop

Defaults keep `ENVIRONMENT=dev` so boot is easy. Before putting a real script on a Tailscale-reachable host:

1. Put strong values in `.env` (checklist below).
2. Set `ENVIRONMENT=prod`.
3. Set `CORS_ORIGINS` to include your Tailscale Serve `https://…` origin.
4. Restart `./scripts/dev` (or `docker compose up -d --force-recreate backend` if using the full Docker stack).

With `ENVIRONMENT=prod`, the backend **refuses** the documented default `SECRET_KEY` and weak admin passwords, disables `/docs`, and does not seed demo director/actor users.

---

## Secrets checklist (prod / real scripts)

- [ ] `ENVIRONMENT=prod`
- [ ] Fresh `SECRET_KEY` (≥32 random characters, not the value in `.env.example`)
- [ ] Strong unique `ADMIN_PASSWORD` (≥8 characters, not `admin` / `password` / etc.)
- [ ] Strong `POSTGRES_PASSWORD` if the host is shared
- [ ] `CORS_ORIGINS` matches laptop localhost **and** the Tailscale Serve origin
- [ ] Confirm `/docs` is unavailable
- [ ] No reliance on demo `director` / `actor` passwords
- [ ] Postgres is not exposed beyond this machine (Compose publishes `127.0.0.1:5432` only)

Generate a secret key (example):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Cloud Run backend (shipped 2026-09-05)

**Status:** Backend API is live on **Google Cloud Run** (free tier; example service name `theater-thing-backend`), talking to **Neon**. Frontend stays on the laptop for now (Vite), optionally proxied at the Cloud Run URL.

### What was decided / learned

| Topic | Outcome |
| ----- | ------- |
| Scope | Backend-first; frontend Cloud Run is next |
| DB | Neon direct URL with `sslmode=require` (`DATABASE_URL`) |
| CD | Cloud Run continuous deploy from GitHub `main` via Developer Connect; build context **`backend/`**, Dockerfile **`backend/Dockerfile`** |
| Port | Cloud Run sets `PORT` (usually `8080`); `backend/scripts/start.sh` must honor `$PORT` (not hardcode 8000) |
| Env style | Plain Cloud Run **environment variables** for now (not Secret Manager) |
| Boot | `start.sh` still runs migrate + seed on every container start — OK for solo / free tier |
| Auth | Allow **unauthenticated** Cloud Run invocations; the API does its own JWT auth |
| Scale | Min instances **0**; set a low **max** (e.g. 2–3) to avoid surprise scale |
| Latency | Owner smoke-tested: feels no slower than localhost API + Neon |

### Cloud Run env vars (API service)

Set on the service (Console → Edit → Variables). Do **not** commit real values.

| Variable | Notes |
| -------- | ----- |
| `DATABASE_URL` | Neon **direct** URL + `sslmode=require` — not `127.0.0.1` |
| `SECRET_KEY` | ≥32 chars, not the `.env.example` default |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrap only: seed **creates** this user if missing; does **not** reset password of existing users (e.g. dumped `admin`) |
| `ORG_NAME` | Must match the Neon org name if you want the bootstrap user in the same org as productions |
| `ENVIRONMENT` | `prod` |
| `CORS_ORIGINS` | Keep `http://localhost:5173,http://127.0.0.1:5173` for local Vite. Add the frontend Cloud Run `https://….run.app` origin when that service exists |
| `GITHUB_TOKEN` / `GITHUB_REPO` | Optional in-app feedback |

Skip on Cloud Run API service: `POSTGRES_*`, `VITE_*`, `BACKEND_UPSTREAM`, `PORT` (Cloud Run sets `PORT` for the API container separately).

### IAM gotcha (Developer Connect)

If the build fails at `FETCHSOURCE` with `developerconnect.gitRepositoryLinks.fetchReadToken`, grant the Cloud Build SA (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) the role **Developer Connect Read Token Accessor** (`roles/developerconnect.readTokenAccessor`).

### Local frontend → Cloud Run API

`./scripts/dev` always starts a **local** API on `:8000`. To exercise the remote API from the UI, run **Vite only** and point the proxy:

```bash
cd frontend
VITE_API_PROXY_TARGET="https://YOUR-SERVICE-XXXX.run.app" npm run dev
```

Then open `http://localhost:5173` (or whatever port Vite prints if 5173 is busy). Browser calls stay same-origin to Vite; Vite forwards `/api` to Cloud Run — CORS usually does not apply on that path.

Smoke without UI:

```bash
curl -sS "https://YOUR-SERVICE-XXXX.run.app/health"
```

### Seed / org caveat

Changing `ADMIN_USERNAME` on Cloud Run can create a **second** Admin in a different org if `ORG_NAME` does not match the existing Neon organization. That user can log in but see empty production/user lists. The original dumped users (e.g. `admin`) remain the ones attached to real data. Prefer changing passwords on existing users rather than inventing new bootstrap usernames.

### Still deferred (hosting)

- Secret Manager for DB/URL secrets
- Custom domain / Cloud Armor
- Neon pooler URL for the app (migrations stay on direct URL)
- Dropping migrate/seed-from-boot
- Multi-org “platform super-admin” (future SaaS idea — not designed yet)

---

## Cloud Run frontend — owner Console steps

**Local prep (shipped in repo):** `frontend/Dockerfile` target `prod` runs nginx with runtime env:

| Variable | Purpose | Examples |
| -------- | ------- | -------- |
| `PORT` | Listen port (Cloud Run injects this) | `8080` |
| `BACKEND_UPSTREAM` | API base URL for `/api` and `/health` proxy | Compose: `http://backend:8000`; Cloud Run: `https://YOUR-BACKEND-XXXX.run.app` (no trailing slash) |

SPA keeps relative `fetch('/api/…')`. nginx proxies same-origin `/api` to the backend service.

**Decided:**

| Topic | Choice |
| ----- | ------ |
| Service name | `theater-thing-frontend` |
| Proxy | nginx `/api` → backend (not browser absolute API URL) |
| Port | Listen on `$PORT` (default 8080) |
| Domain | Default `*.run.app` for now |
| CD | Continuous deploy from GitHub `main`, build context **`frontend/`**, Dockerfile **`frontend/Dockerfile`**, target **`prod`** — after a successful manual first deploy |
| Who deploys | Owner does Console / remote steps; agents only change the local repo unless explicitly asked |

### Manual first deploy (Console)

1. Confirm backend is healthy: `curl -sS "https://YOUR-BACKEND-XXXX.run.app/health"`.
2. In Cloud Run → **Create service** (or Deploy from source / Dockerfile):
   - Name: **`theater-thing-frontend`**
   - Region: same as backend (keeps latency boring)
   - Source: this GitHub repo; build context **`frontend/`**; Dockerfile **`Dockerfile`** (final stage is **`prod`** — default build is correct; set target `prod` only if the UI asks)
   - Container port: **`8080`** (matches `PORT` default; Cloud Run still sets `PORT`)
   - Authentication: **Allow unauthenticated**
   - Min instances **0**; max low (e.g. 2–3)
3. Environment variables on the frontend service:
   - `BACKEND_UPSTREAM` = `https://YOUR-BACKEND-XXXX.run.app` (no path, no trailing slash)
   - Do **not** put `DATABASE_URL` / `SECRET_KEY` on the frontend service
4. Deploy once; open the service URL → login page should load.
5. Optional but recommended: on the **backend** service, append the frontend origin to `CORS_ORIGINS` (e.g. `https://theater-thing-frontend-XXXX.run.app`). Same-origin nginx proxy usually does not need it for day-to-day UI traffic; it helps if anything ever calls the API cross-origin.
6. After smoke-test passes, wire **continuous deploy** from `main` the same way as the backend (Developer Connect), with context **`frontend/`** and target **`prod`**. Expect a second Cloud Build when `main` changes under `frontend/` (or whenever CD is configured to rebuild).

### Local smoke (prod image shape, before or after Cloud)

```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.preview.yml up -d --build
# http://127.0.0.1:8080 — nginx on :8080 proxies /api → Compose backend
```

### Verify when Cloud frontend is live

- [ ] Frontend URL loads login
- [ ] Login against Neon data (same productions as backend-only phase)
- [ ] Overview + one write path
- [ ] Cold start after idle acceptable
- [ ] Local `./scripts/dev` path still works for day-to-day coding

### Explicitly out of scope (this pass)

- Rewriting the SPA to require a public `VITE_*` API base URL
- Merging API + UI into one container
- Custom domain
- Performance caching work ([PERFORMANCE.md](PERFORMANCE.md))

### Troubleshooting (frontend Cloud Run)

| Symptom | Likely fix |
| ------- | ---------- |
| Login page loads, API calls fail / 502 | `BACKEND_UPSTREAM` wrong, missing `https://`, trailing slash, or backend cold/unhealthy |
| Cloud Run “failed to start listening” | Container must listen on `$PORT` (entrypoint does); confirm service container port is 8080 |
| CORS errors in browser | Usually means the browser hit the API origin directly; add frontend origin to backend `CORS_ORIGINS`, or fix so calls stay same-origin `/api` via nginx |
| Build can’t find stage | Ensure CD/build uses Dockerfile target **`prod`** |

---

## Later: always-on hosting (Tier B / alternatives)

Cloud Run + Neon is the current always-on path for the **API**; frontend Console deploy for `theater-thing-frontend` is documented above. A small **VPS** remains an alternative if Cloud Run free-tier limits or ops preferences change. Custom domain + TLS can wait until a real pilot needs a stable bookmark name.

---

## Troubleshooting

| Symptom | Likely fix |
| ------- | ---------- |
| Phone cannot load app | Laptop asleep / offline; Tailscale disconnected; Serve not pointing at **5173** |
| Vite “host is not allowed” / `allowedHosts` | Ensure `frontend/vite.config.ts` has `allowedHosts: [".ts.net"]`, then restart `./scripts/dev` |
| Login works on laptop, fails on phone with CORS error | Add the Tailscale HTTPS origin to `CORS_ORIGINS` and restart `./scripts/dev` |
| `address already in use` on `:5173` or `:8000` | `docker compose stop backend frontend`, quit other local servers, then `./scripts/dev` again |
| Backend won’t start with `ENVIRONMENT=prod` | Replace default `SECRET_KEY` / weak `ADMIN_PASSWORD` |
| Too many login attempts | Wait a minute, or restart the API (in-memory limiter resets) |

---

## Appendix: optional nginx “preview” (not day-to-day)

Smoke-tests the same **prod** frontend image Cloud Run uses (nginx on `$PORT`, `/api` → `BACKEND_UPSTREAM`). **You do not need this for laptop + phone.**

```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.preview.yml up -d --build
# http://127.0.0.1:8080 — then stop and return to normal Dev
docker compose down
./scripts/dev
```

Preview sets `PORT=8080` and `BACKEND_UPSTREAM=http://backend:8000`.
