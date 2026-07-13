# Production App

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
   docker compose up --build
   ```

4. Open the app:

   | Service  | URL                          |
   |----------|------------------------------|
   | Frontend | http://localhost:5173        |
   | Backend  | http://localhost:8000/health |
   | Database | localhost:5432 (internal)    |

5. Default admin login (development only):

   - **Username:** `admin`
   - **Password:** `admin`

   Change these before any production deployment.

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
| `frontend` | Vite dev server (hot reload)                   | 5173 |

### Production frontend build

To serve the built frontend with nginx on port 80, change the frontend service in `docker-compose.yml`:

```yaml
frontend:
  build:
    context: ./frontend
    target: prod
  ports:
    - "80:80"
```

## Environment Variables

Set these in a root `.env` file or pass them to `docker compose`.

### Database (`db` service)

| Variable            | Required | Default           | Description              |
|---------------------|----------|-------------------|--------------------------|
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
| `ENVIRONMENT`     | No       | `dev`                      | `dev` seeds test users; `prod` enforces security |

\* Use a strong random value in production (32+ characters recommended for JWT).

**Security:** The backend must refuse to start in production without `ADMIN_PASSWORD` set. See [docs/SEED_DATA.md](docs/SEED_DATA.md).

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

The project includes a basic shadcn/ui configuration (`components.json`, `src/lib/utils.ts`). Add components with:

```bash
cd frontend
npx shadcn@latest add button
```

## Project Structure

```
production_app/
├── backend/          # FastAPI, SQLAlchemy, Alembic
├── frontend/         # React, TypeScript, Vite, Tailwind
├── docker-compose.yml
├── docs/             # Architecture and phase plans
└── fixtures/scripts/ # Sample scripts for import testing
```

## Documentation

- [docs/PROJECT.md](docs/PROJECT.md) — product vision and architecture
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
