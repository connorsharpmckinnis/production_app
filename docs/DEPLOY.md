# Deploy & Private Access

How to run The Theater Thing on your laptop day to day, reach it from your phone over Tailscale, and (later) move to a real host.

Companion to [PHASE_10.md](PHASE_10.md). **One stack for daily use:** Docker Compose with the Vite **dev** frontend. Tailscale Serve on port **5173** for private multi-device access when Tailscale is available.

---

## Day-to-day (Dev)

```bash
cp .env.example .env   # optional
docker compose up -d --build
```

| What | URL |
| ---- | --- |
| App | http://localhost:5173 |
| API health | http://localhost:8000/health |

Dev logins (when `ENVIRONMENT=dev`): `admin` / `admin`, plus seeded `director` / `actor`.

Stop:

```bash
docker compose down
```

That is the only Compose command you need for normal work. On a machine **without Tailscale** (for example a secondary Windows laptop), browser testing at `http://localhost:5173` is enough — leave the Tailscale steps for the machine that has Tailscale installed.

---

## Phone / tablet via Tailscale Serve

Goal: one bookmarkable private HTTPS URL. The laptop must be awake and online. Skip this section until Tailscale is installed on the host machine.

1. Install/sign in to Tailscale on the laptop and phone (same account/tailnet).
2. Start the app: `docker compose up -d --build`.
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
   `server.allowedHosts: [".ts.net"]` (already set in this repo). Rebuild/restart
   the frontend container if you still see the error after pulling that change.
6. Add the exact `https://…` origin to `CORS_ORIGINS` in `.env` (keep the localhost entries), then recreate the backend so it picks up the env:

   ```bash
   docker compose up -d --force-recreate backend
   ```

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
4. `docker compose up -d --force-recreate backend` (or full `up -d --build`).

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
- [ ] Postgres is not published publicly (Compose already keeps it internal)

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
| Vite “host is not allowed” / `allowedHosts` | Ensure `frontend/vite.config.ts` has `allowedHosts: [".ts.net"]`, then recreate frontend |
| Login works on laptop, fails on phone with CORS error | Add the Tailscale HTTPS origin to `CORS_ORIGINS` and recreate backend |
| `address already in use` on `:5173` or `:8000` | `docker compose down`, quit other local servers, then `up` again |
| Backend won’t start with `ENVIRONMENT=prod` | Replace default `SECRET_KEY` / weak `ADMIN_PASSWORD` |
| Too many login attempts | Wait a minute, or restart the backend container (in-memory limiter resets) |

---

## Appendix: optional nginx “preview” (not day-to-day)

Kept in the repo for a future VPS smoke-test. **You do not need this for laptop + phone.**

```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.preview.yml up -d --build
# http://127.0.0.1:8080 — then stop and return to normal Dev
docker compose down
docker compose up -d --build
```

The frontend `prod` Dockerfile stage and fixed nginx `/api` proxy live here so Tier B does not reinvent them.
