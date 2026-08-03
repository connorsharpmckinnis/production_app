from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from app.config import get_settings


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: int
    impersonator_id: int | None = None


def create_access_token(user_id: int, *, impersonator_id: int | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=24)
    payload: dict[str, object] = {"sub": str(user_id), "exp": expire}
    if impersonator_id is not None:
        payload["imp"] = str(impersonator_id)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> AccessTokenClaims:
    settings = get_settings()
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    impersonator_raw = payload.get("imp")
    impersonator_id = int(impersonator_raw) if impersonator_raw is not None else None
    return AccessTokenClaims(user_id=int(payload["sub"]), impersonator_id=impersonator_id)
