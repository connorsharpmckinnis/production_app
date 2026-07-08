#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Running seed data..."
python -m app.seed

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
