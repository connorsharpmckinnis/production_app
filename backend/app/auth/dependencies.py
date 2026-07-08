from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.auth.jwt import decode_access_token
from app.db.session import get_db
from app.models import AppRole, User, UserAppRole

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        user_id = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def user_has_role(user: User, role_name: str) -> bool:
    return any(role.name == role_name for role in user.app_roles)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user_has_role(user, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_authenticated(user: User = Depends(get_current_user)) -> User:
    return user
