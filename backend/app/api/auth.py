from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_token_claims, require_admin, user_has_role
from app.auth.jwt import AccessTokenClaims, create_access_token
from app.auth.password import verify_password
from app.auth.rate_limit import check_login_rate_limit
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ActAsRequest,
    ImpersonationInfo,
    LoginRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(
    user: User,
    *,
    impersonation: ImpersonationInfo | None = None,
) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        is_active=user.is_active,
        roles=[role.name for role in user.app_roles],
        impersonation=impersonation,
    )


def _load_active_user(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    client_host = request.client.host if request.client else "unknown"
    check_login_rate_limit(f"{client_host}:{body.username.casefold()}")

    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def me(
    user: User = Depends(get_current_user),
    claims: AccessTokenClaims = Depends(get_token_claims),
    db: Session = Depends(get_db),
) -> UserResponse:
    impersonation = None
    if claims.impersonator_id is not None:
        original = _load_active_user(db, claims.impersonator_id)
        if original is not None:
            impersonation = ImpersonationInfo(
                original_user_id=original.id,
                original_username=original.username,
                original_first_name=original.first_name,
                original_last_name=original.last_name,
            )
    return _user_response(user, impersonation=impersonation)


@router.post("/act-as", response_model=TokenResponse)
def act_as(
    body: ActAsRequest,
    admin: User = Depends(require_admin),
    claims: AccessTokenClaims = Depends(get_token_claims),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if claims.impersonator_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Already acting as another user; return to your account first",
        )
    if body.user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already signed in as that user",
        )

    target = _load_active_user(db, body.user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or inactive",
        )
    if target.organization_id != admin.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or inactive",
        )

    return TokenResponse(
        access_token=create_access_token(target.id, impersonator_id=admin.id),
    )


@router.post("/stop-act-as", response_model=TokenResponse)
def stop_act_as(
    claims: AccessTokenClaims = Depends(get_token_claims),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if claims.impersonator_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not acting as another user",
        )

    original = _load_active_user(db, claims.impersonator_id)
    if original is None or not user_has_role(original, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Original admin session is no longer valid",
        )

    return TokenResponse(access_token=create_access_token(original.id))


@router.post("/logout")
def logout(_user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "ok"}
