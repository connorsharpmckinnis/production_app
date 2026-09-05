#!/bin/sh
set -eu

PORT="${PORT:-8080}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://backend:8000}"

export PORT BACKEND_UPSTREAM

# Only substitute our knobs — leave nginx vars like $host / $uri alone.
envsubst '${PORT} ${BACKEND_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
