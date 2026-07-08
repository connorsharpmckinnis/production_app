# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY app ./app
RUN uv sync --no-dev --frozen

FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

COPY --from=builder /app/.venv /app/.venv
COPY . .

RUN sed -i 's/\r$//' scripts/start.sh && chmod +x scripts/start.sh

EXPOSE 8000

CMD ["sh", "scripts/start.sh"]
