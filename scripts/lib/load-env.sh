# shellcheck shell=bash
# Load KEY=VALUE pairs from a .env file into the current shell.
# Does not override variables already set in the environment (CLI wins).
# Supports optional single/double quotes around values; ignores blank lines and # comments.

load_env_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim leading whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"

    if [[ "$line" != *=* ]]; then
      continue
    fi
    key="${line%%=*}"
    value="${line#*=}"
    # Trim key whitespace
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    # Already set in environment (including empty) → keep CLI / parent value
    if printenv "$key" >/dev/null 2>&1; then
      continue
    fi

    # Strip matching surrounding quotes
    if [[ "$value" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    export "$key=$value"
  done < "$env_file"
}
