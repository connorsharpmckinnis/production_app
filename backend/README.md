# Production App Backend

FastAPI API for theater production management. It owns business logic, authentication, the PostgreSQL data model, and script import.

The backend exposes a REST API under `/api`. The Timeline is the core domain: productions, acts, scenes, moments, characters, and songs are stored here and surfaced to the React frontend.

See the root [README.md](../README.md) for full-stack Docker setup.

## Local Development

From the `backend/` directory:

```bash
uv sync
```

Set a database URL (PostgreSQL must be running):

```bash
export DATABASE_URL=postgresql://production_app:production_app@localhost:5432/production_app
```

Apply migrations and seed bootstrap data:

```bash
uv run alembic upgrade head
uv run python -m app.seed
```

Start the API server:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health

### Tests

```bash
uv run pytest
```

Quiet output:

```bash
uv run pytest -q
```

## Script Importer

Script import lives in [`app/services/importer/`](app/services/importer/). It parses Google Docs Markdown exports into production timeline records without modifying the original script text.

| Module | Purpose |
|--------|---------|
| `importer.py` | Main `import_script()` entry point and line-by-line state machine |
| `patterns.py` | Regex patterns for acts, scenes, dialogue, songs, etc. |
| `preprocessing.py` | Normalizes raw Markdown before parsing |
| `parentheticals.py` | Parses speaker names and singer attribution lines |
| `builtins.py` | Built-in character and singer name lists |
| `word_numbers.py` | Converts written numbers (e.g. "One") to integers |
| `errors.py` | `ImportLineError` for line-level import failures |

Import rules and line classification are defined in [docs/IMPORT_SPEC.md](../docs/IMPORT_SPEC.md). Authoring format is in [docs/SCRIPT_FORMAT.md](../docs/SCRIPT_FORMAT.md).

The import API endpoint is `POST /api/productions/{id}/import` (Admin only).

## Environment Variables

Configured via `.env` in the project root or environment. See [`app/config.py`](app/config.py).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/production_app` | SQLAlchemy connection string |
| `SECRET_KEY` | Yes (prod) | `dev-secret-change-in-production-32chars` | JWT signing secret — use a strong random value in production |
| `ADMIN_USERNAME` | No | `admin` | Bootstrap admin username (created on first seed) |
| `ADMIN_PASSWORD` | Prod: Yes | `admin` (dev only) | Bootstrap admin password |
| `ORG_NAME` | No | `Default Organization` | Organization name created during seed |
| `ENVIRONMENT` | No | `dev` | `dev` seeds test users; `prod` requires `ADMIN_PASSWORD` |

In `prod`, the app refuses to start without `ADMIN_PASSWORD` set.

## Docker Startup

The backend image runs [`scripts/start.sh`](scripts/start.sh) on container start:

1. **Migrations** — `alembic upgrade head` applies pending schema changes.
2. **Seed** — `python -m app.seed` creates the organization, app roles, moment types, and bootstrap users if the database is empty.
3. **Server** — `uvicorn app.main:app --host 0.0.0.0 --port 8000` starts the API.

The Dockerfile copies the app, installs dependencies with `uv sync`, and sets `CMD` to `sh scripts/start.sh`. In Docker Compose, the backend waits for the `db` service health check before starting.

Default dev login after seed: `admin` / `admin`. See [docs/SEED_DATA.md](../docs/SEED_DATA.md) for full seed behavior.

## Project Layout

```
backend/
├── app/
│   ├── api/           # Route handlers
│   ├── auth/          # JWT, password hashing, dependencies
│   ├── db/            # Session, seed helpers
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic request/response models
│   └── services/
│       └── importer/  # Script import pipeline
├── alembic/           # Database migrations
├── scripts/           # start.sh, import_report.py
└── tests/
```
