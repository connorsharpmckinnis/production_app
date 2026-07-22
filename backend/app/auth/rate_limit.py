"""Simple in-memory login rate limiting (no Redis). Fine for a single-host deploy."""

from collections import defaultdict
from time import monotonic

from fastapi import HTTPException, status

# key -> list of attempt timestamps (monotonic seconds)
_attempts: dict[str, list[float]] = defaultdict(list)

# Generous for a solo/small-team host; still blocks casual brute force.
MAX_ATTEMPTS = 20
WINDOW_SECONDS = 60


def check_login_rate_limit(key: str) -> None:
    """Raise 429 if `key` (usually client IP + username) has too many recent tries."""
    now = monotonic()
    recent = [t for t in _attempts[key] if now - t < WINDOW_SECONDS]
    if len(recent) >= MAX_ATTEMPTS:
        _attempts[key] = recent
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in a minute.",
        )
    recent.append(now)
    _attempts[key] = recent


def clear_login_rate_limits() -> None:
    """Test helper."""
    _attempts.clear()
