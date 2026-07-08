from datetime import UTC, datetime, timedelta

import jwt
from app.config import get_settings


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=24)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> int:
    settings = get_settings()
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    return int(payload["sub"])
