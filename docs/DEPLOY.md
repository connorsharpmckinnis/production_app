# Deploy & Private Access

How to run The Theater Thing on your laptop day to day, reach it from your phone over Tailscale, and (later) move to a real host.

Companion to [PHASE_10.md](PHASE_10.md). Latency / Neon query-cost ideas: [PERFORMANCE.md](PERFORMANCE.md). **Day-to-day:** Postgres in Docker; API + Vite on the host via `./scripts/dev`. Tailscale Serve on port **5173** for private multi-device access when Tailscale is available.

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

## Later: always-on hosting (Tier B)

When STP pilots for real:

- Prefer a small **VPS** (or similar hands-off host) over a home Pi for uptime.
- Use the **production frontend image** (nginx) there — see appendix below.
- Put TLS in front with a real domain; you keep deploy credentials.
- Exact vendor can wait until after the August conversation.

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

Kept in the repo for a future VPS smoke-test. **You do not need this for laptop + phone.**

```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.preview.yml up -d --build
# http://127.0.0.1:8080 — then stop and return to normal Dev
docker compose down
./scripts/dev
```

The frontend `prod` Dockerfile stage and fixed nginx `/api` proxy live here so Tier B does not reinvent them.
