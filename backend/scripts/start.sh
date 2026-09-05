#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Running seed data..."
python -m app.seed

PORT="${PORT:-8000}"
echo "Starting API server on :${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
