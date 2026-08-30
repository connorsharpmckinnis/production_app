from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.auth.jwt import AccessTokenClaims, decode_access_token
from app.db.session import get_db
from app.models import User

security = HTTPBearer(auto_error=False)


def get_token_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AccessTokenClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def get_current_user(
    claims: AccessTokenClaims = Depends(get_token_claims),
    db: Session = Depends(get_db),
) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == claims.user_id, User.is_active.is_(True))
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


def require_role(*role_names: str):
    """Return a dependency that requires the user to have at least one of the given roles."""

    def _require_role(user: User = Depends(get_current_user)) -> User:
        if not any(user_has_role(user, role_name) for role_name in role_names):
            if len(role_names) == 1:
                detail = f"{role_names[0]} access required"
            else:
                detail = f"Requires one of: {', '.join(role_names)}"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )
        return user

    return _require_role


require_admin = require_role("Admin")

# Production-scoped authorization is handled by app.api.deps. Keep this name
# temporarily for route families that have not yet migrated; global Director
# must never grant access now that production roles live on memberships.
require_director_or_admin = require_admin


def require_authenticated(user: User = Depends(get_current_user)) -> User:
    return user
