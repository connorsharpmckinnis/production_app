from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_admin
from app.auth.password import hash_password
from app.db.session import get_db
from app.models import AppRole, User, UserAppRole
from app.schemas.auth import CreateUserRequest, ResetPasswordRequest, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        is_active=user.is_active,
        roles=[role.name for role in user.app_roles],
    )


@router.get("", response_model=list[UserResponse])
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    users = db.query(User).options(joinedload(User.app_roles)).order_by(User.username).all()
    return [_user_response(user) for user in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    existing = db.query(User).filter(User.username == body.username).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    role = db.query(AppRole).filter(AppRole.name == body.role_name).first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    user = User(
        organization_id=admin.organization_id,
        username=body.username,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserAppRole(user_id=user.id, app_role_id=role.id))
    db.commit()
    db.refresh(user)
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user.id)
        .one()
    )
    return _user_response(user)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
def reset_password(
    user_id: int,
    body: ResetPasswordRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user_id)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.post("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user_id)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    db.commit()
    db.refresh(user)
    return _user_response(user)
