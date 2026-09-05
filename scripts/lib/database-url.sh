# shellcheck shell=bash
# Helpers for postgres DATABASE_URL values.

database_url_host() {
  local url="${1:-}"
  local rest host
  rest="${url#*://}"
  if [[ "$rest" == *"@"* ]]; then
    rest="${rest##*@}"
  fi
  host="${rest%%[:/?]*}"
  printf '%s\n' "$host"
}

database_url_is_local() {
  local host
  host="$(database_url_host "${1:-}")"
  case "$host" in
    127.0.0.1 | localhost | db | "")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
