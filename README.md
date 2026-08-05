# The Theater Thing

A production preparation and rehearsal tool for community theater groups.

> **Note for developers:**  
> If you're here for setup instructions, technical details, or contributing guidelines, skip down to the [For developers](#for-developers) section. Everything above that is aimed at directors, admins, cast, and others curious about what this app does for a production.

**Status:** Early but usable (version 0.1)  
**Built by:** Connor McKinnis, with Spiritual Twist Productions (and similar community theaters) in mind

---

## What it is

The Theater Thing turns a script into a shared **Timeline** of the show — acts, scenes, and moments — then lets the production team layer real prep onto those moments: casting, props, cues, costumes, entrances and exits, blocking, and notes. It is designed to be a flexible platform that can store and manage any and all documentable information related to a show, from auditions through the final performance. 

Actors use the same material in **Rehearse Mode** to run lines. Directors can view **Reports** (prop sheets, cue sheets, and more) from that Timeline instead of maintaining separate lists that drift out of date.

It is **not** a replacement for good writing, directing, or talking to each other. It is a place to keep the *production* side of a show tied to the script, so everyone is looking at the same living picture.

```
Script  →  Timeline  →  Prep layered on moments  →  Rehearse + Reports
```

The script text itself stays sacred. Production decisions sit on top of it; they do not rewrite the words. The whole production is centered around adding details, notes, and directions onto moments in the show. 

![Timeline — main view (as seen by an Admin)](docs/screenshots/timeline-page.png?raw=true)

---

## The problem it solves

In most theaters, show knowledge gets scattered:

- Script in Google Docs and print versions  
- Casting in a spreadsheet or email thread  
- Prop lists somewhere else  
- Blocking in a notebook or in the director's head  
- "Who's on mic when" as tribal knowledge  
- Actors waiting until the next rehearsal to ask questions about their character  

That works, but it limits the elegance that can be achieved. People leave. Details get lost between runs of the same show. The same questions get asked every rehearsal. Tech week gets more repetitive than it needs to be.

The Theater Thing aims to be **one source of truth for production prep**, without asking volunteers to learn enterprise software. Directors prep incrementally. Actors get a clean digital space to run lines and keep notes. Admins get enough control to keep actors, staff, and volunteers organized at the whole-theater level.

---

## Who it's for

| Role in the app | Who that usually is | What they can do |
| --------------- | ------------------- | ---------------- |
| **Admin** | Production or organizational managers | Create productions, import scripts, manage user accounts, full system access |
| **Director** | Directors, assistant directors, and people doing show-specific prep | Cast the show, edit the Timeline, manage props/cues/costumes/etc., run reports, use Rehearse Mode |
| **Actor** | Cast members | See productions they're cast in; use the Timeline (read-only) and Rehearse Mode; leave notes and bookmarks |

More specialized crew roles (stage manager, lighting, sound, and so on) are on the roadmap. For now, directors cover most prep, and the Timeline is the shared hub.

---

## A quick tour of the app

The current product is very much a Minimum Viable Product (MVP), but the general concept of the platform is easy to grasp.

### 1. Productions list

Sign in and see the shows available to you. Admins can create and manage productions here.

![Productions page — as seen by an Admin](docs/screenshots/productions-page.png?raw=true)

### 2. Start a show (Admin)

An admin creates a **Production**, then imports the script (Markdown or Word, following a standardized format). On success, you land on the Timeline.

![Creating a New Production](docs/screenshots/production-start-modal.png?raw=true)

### 3. Overview

Each production has an **Overview**: a snapshot of prep status, casting gaps, and sensible next steps so you're not guessing where to start.
Eventually the **Overview** page can include information about upcoming scheduled rehearsals, user-specific to-do lists, and more. 

![Production Overview](docs/screenshots/production-dashboard.png?raw=true)

### 4. Preparation pages

Separate pages hold the asset catalogs that Directors build once and reuse across the show: **Characters**, **Props**, **Costumes**, **Set pieces**, **Songs**, **Groups**, **Cue Categories**. Lav **wires** and **packs** are planned on the **Lav chart** (Director/Admin).
Some assets can be re-used between completely different productions (props, costume pieces, lavs, etc). Integration with existing digital asset catalogs will allow directors to import or 'order' already-documented assets for use in their production. 

![Manage Props](docs/screenshots/prop-page.png?raw=true)

![Cues of Any Type](docs/screenshots/cue-page.png?raw=true)

### 5. Timeline (the heart of the app)

The **Timeline** is a beat-by-beat walk through the show. Directors live here for prep:

- Review and adjust structure (add, delete, reorder moments)  
- Cast characters to actors  
- Attach prep to specific moments: props, cues, entrances, exits, blocking, notes  
- Bookmark moments that need attention later  

![Timeline — the main view](docs/screenshots/timeline-page.png?raw=true)

![Moment detail panel — where the real meat lives](docs/screenshots/moment-detail.png?raw=true)


### 6. Rehearse

**Rehearse Mode** gives actors practice modes that match real habits:

- **Scene run-through** — full scene with your lines highlighted  
- **My lines** — only what you say  
- **Line cues** — your line plus the line that feeds it  
- Optional **Blur my lines** — hide your text until you tap or hover

![Rehearsal Mode](docs/screenshots/rehearsal-mode.png?raw=true)

### 7. Reports

**Reports** currently include basic views for:

- Prop sheet  
- Cue sheet  
- Costume changes (wear/clear)  
- Entrances & exits  
- Blocking sheet  

**Lav chart** (Preparation → Lav chart) is an editable wire/pack assignment matrix with Propose, conflict flags, and browser print — linked from Reports.

Click a moment reference in a report and jump straight back to that spot on the Timeline.

![Prop 'wish list' report](docs/screenshots/prop-sheet-report.png?raw=true)

![Costume tracking](docs/screenshots/costumes-by-scene-report.png?raw=true)


### 8. Admin tools

Admins can manage **Users** (accounts and roles) and **Settings**. Anyone can open **About the App** for a plain-language summary of what works today and what's planned.

---

## How to actually use it

**Admin path:** create production → import script → invite or create users → hand off to director

**Director path:** live in Timeline for prep → use Overview to see casting gaps and next steps → check Rehearse occasionally so you know what actors see → print reports when tech needs a sheet

**Actor path:** open the show → go to Rehearse (or Timeline) → practice → leave a note or bookmark on a moment when something's unclear

For actors, the app keeps Rehearse and Timeline front and center so they aren't bombarded with tools they can't use.

---

## What it is *not* (yet)

The Theater Thing does **not** currently replace:

- Rehearsal **scheduling** or a company calendar  
- **Attendance** tracking  
- Assignable **task lists**  
- Live **show calling** / board-op consoles  
- Polished **PDF call sheets** 
- In-app **playwriting** (writers still author in Google Docs or similar; the app imports the result)  

Those are definite possibilities, and most are already on the roadmap. The current version deliberately focuses on the hardest under-tooled problem first: **structured production prep glued to the script**, plus rehearsal practice that uses that same data.

## What it *won't* be (probably)

The Theater Thing is not currently planned to incorporate features that compete with or fulfill some delicate or complex functions:

- Payment management (Registrations, ticketing)
- Sensitive information/PII (actor allergies, medical data, private messaging)
- PlanningCenter (volunteer management)

---

## What's coming eventually

Features under active thought (not day-one promises):

1. **Better sheets for tech** — print-ready / PDF layouts, lav-change charts, per-character "what do I need tonight?" packs, readiness checklists  
2. **Richer entrances, exits, and blocking** — including clearer "who's on stage" from the Timeline  
3. **Timeline and Rehearse polish** — faster search, better filters, character colors, saved views  
4. **Director notes from the house** — phone-friendly notes onto the current moment while watching from the audience (dictated and/or typed)
5. **Scheduling, attendance, tasks, and archives** — moving from prep into running (and archiving) the show  
6. **More roles** — stage manager, lighting, sound, and views tuned to each job  

Feedback from real productions and in-the-field staff will shape what gets built.

---

## To sum it up:

- **Elevator:** Theater App keeps casting, props, cues, blocking, and line practice attached to the script so the whole production stays in sync.  
- **For leadership:** An early production tool that turns a script into a shared timeline for prep and rehearsal.  
- **For cast:** An app where you can run your lines (with cues and blur-to-memorize) against the same production the directors are preparing.

---

## Learn more (still readable)

These docs go deeper without requiring you to read/run any code:

- [docs/STP_PRODUCT_OVERVIEW.md](docs/STP_PRODUCT_OVERVIEW.md) — longer introduction written for Spiritual Twist Productions  
- [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) — a short click-through path if someone sets the app up for you  
- [docs/PROJECT.md](docs/PROJECT.md) — product vision and architecture (more technical)

---

# For developers

Theater production management platform — monorepo with FastAPI backend, React frontend, and PostgreSQL.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- (Optional, local dev) [uv](https://docs.astral.sh/uv/) for Python, [Node.js](https://nodejs.org/) 22+ for frontend

## Quick Start (Docker)

1. Clone the repository and open a terminal in the project root.

2. Copy environment defaults (optional — `docker compose` works without a `.env` file):

   ```bash
   cp .env.example .env
   ```

3. Start all services:

   ```bash
   docker compose up -d --build
   ```

4. Open the app:

   | Service  | URL                          |
   |----------|------------------------------|
   | Frontend | http://localhost:5173        |
   | Backend  | http://localhost:8000/health |
   | Database | internal only (not published)|

5. Default admin login (development only):

   - **Username:** `admin`
   - **Password:** `admin`

   Change these before any shared or production-like deploy. For phone access over Tailscale (Serve on port 5173), see [docs/DEPLOY.md](docs/DEPLOY.md).

## Importing a script

1. Create a production (Admin) — the name you enter is the production title and **stays** after import.
2. Open **Import script** and upload a Google Docs export as **Markdown (`.md`)** or **Word (`.docx`)**.
3. For Word/Google Docs: use Heading 1 for acts, Heading 2 for scenes, Heading 3 for song titles (ALL CAPS; hyperlink optional), italic Body for stage directions, and ALL CAPS (centered in the gold-standard script) for singers/lyrics.
4. On success you land on the Timeline. Author is taken from the script title page when present; the script `Title:` line does not rename the production.

See [docs/IMPORT_SPEC.md](docs/IMPORT_SPEC.md) and [docs/SCRIPT_FORMAT.md](docs/SCRIPT_FORMAT.md).

## Services

| Service  | Description                                      | Port |
|----------|--------------------------------------------------|------|
| `db`     | PostgreSQL 16                                    | 5432 |
| `backend`| FastAPI API — migrations and seed run on startup | 8000 |
| `frontend` | Vite **dev** server (code baked into the image; rebuild frontend after host edits) | 5173 |

### Phone access (Tailscale)

Day-to-day stack is the Vite **dev** frontend above. Source is copied into the image at build time (no bind mounts), so after editing frontend or backend code run `docker compose up -d --build` for the service you changed. To open the same app on your phone over a private Tailscale URL (`tailscale serve --bg 5173`), see **[docs/DEPLOY.md](docs/DEPLOY.md)**.

An optional nginx “preview” Compose overlay exists only for future VPS smoke-tests; it is not required for laptop + phone.

## Environment Variables

Set these in a root `.env` file or pass them to `docker compose`.

### Database (`db` service)

| Variable            | Required | Default           | Description              |
|---------------------|----------|-------------------|----------|
| `POSTGRES_USER`     | No       | `production_app`  | PostgreSQL username      |
| `POSTGRES_PASSWORD` | No       | `production_app`  | PostgreSQL password      |
| `POSTGRES_DB`       | No       | `production_app`  | PostgreSQL database name |

### Backend (`backend` service)

| Variable          | Required | Default                    | Description                                      |
|-------------------|----------|----------------------------|--------------------------------------------------|
| `DATABASE_URL`    | Auto     | (built from `POSTGRES_*`)  | SQLAlchemy connection string                     |
| `SECRET_KEY`      | Yes*     | `dev-secret-change-in-production` | Session/JWT signing secret                |
| `ADMIN_USERNAME`  | No       | `admin`                    | Bootstrap admin username                         |
| `ADMIN_PASSWORD`  | Prod: Yes| `admin` (dev only)         | Bootstrap admin password                         |
| `ORG_NAME`        | No       | `Default Organization`     | Single organization display name                 |
| `ENVIRONMENT`     | No       | `dev`                      | `dev` seeds test users; `prod` refuses weak secrets / disables docs |
| `CORS_ORIGINS`    | No       | localhost Vite             | Comma-separated allowed browser origins (add Tailscale Serve `https://…`) |


\* Use a strong random value in production (32+ characters recommended for JWT).

**Security:** With `ENVIRONMENT=prod`, the backend refuses the documented default `SECRET_KEY` and weak `ADMIN_PASSWORD` values. See [docs/DEPLOY.md](docs/DEPLOY.md) and [docs/SEED_DATA.md](docs/SEED_DATA.md).

### Frontend (`frontend` service)

| Variable                 | Required | Default                  | Description                          |
|--------------------------|----------|--------------------------|--------------------------------------|
| `VITE_API_PROXY_TARGET`  | No       | `http://localhost:8000`  | Backend URL for Vite dev proxy       |

In Docker, this is set to `http://backend:8000` automatically. API requests from the browser go to `/api/*` and are proxied to the backend.

## Local Development (without Docker)

### Backend

```bash
cd backend
uv sync
export DATABASE_URL=postgresql://production_app:production_app@localhost:5432/production_app
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173. The Vite dev server proxies `/api` to http://localhost:8000.

### shadcn/ui

Configured via `components.json` with Tailwind CSS variables. Shared primitives live in `frontend/src/components/ui/` (`button`, `badge`, `alert`, `dialog`, `alert-dialog`, `sheet`, `skeleton`, `input`, `label`, `textarea`, `checkbox`, `switch`, `radio-group`, `select`, `table`).

Add more with:

```bash
cd frontend
npx shadcn@latest add <component>
```

Admin component gallery (theme preview + all primitives): `/dev/ui` (also linked from Settings → Developer).
## Project Structure

```
production_app/
├── backend/          # FastAPI, SQLAlchemy, Alembic
├── frontend/         # React, TypeScript, Vite, Tailwind
├── docker-compose.yml
├── docs/             # Architecture and phase plans
│   └── screenshots/  # README images (add annotated screenshots here)
└── fixtures/scripts/ # Sample scripts for import testing
```

## Documentation

- [docs/PROJECT.md](docs/PROJECT.md) — product vision and architecture
- [docs/STP_PRODUCT_OVERVIEW.md](docs/STP_PRODUCT_OVERVIEW.md) — non-technical product intro for STP
- [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) — click-through demo path
- [docs/PHASE_1.md](docs/PHASE_1.md) — current implementation plan
- [docs/SEED_DATA.md](docs/SEED_DATA.md) — bootstrap seed specification
- [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) — coding standards

## Troubleshooting

**Backend won't start — database connection refused**

Wait for the `db` health check to pass. The backend depends on a healthy database.

**Port already in use**

Change the host port mapping in `docker-compose.yml`, e.g. `"5174:5173"` for frontend.

**Frontend API calls fail**

Confirm the backend is running at http://localhost:8000/health. In Docker, ensure `VITE_API_PROXY_TARGET=http://backend:8000`.

## Tests

```bash
cd backend
uv run pytest
```
