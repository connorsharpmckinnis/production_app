from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_admin
from app.auth.password import hash_password
from app.db.session import get_db
from app.models import AppRole, Organization, User, UserAppRole
from app.schemas.auth import (
    CreateUserRequest,
    ResetPasswordRequest,
    UpdateAdminRoleRequest,
    UserResponse,
)

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
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    users = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.organization_id == admin.organization_id)
        .order_by(User.username)
        .all()
    )
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

    role = None
    if body.role_name is not None:
        if body.role_name != "Admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only the Admin organization role is supported",
            )
        role = db.query(AppRole).filter(AppRole.name == body.role_name).first()
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role",
            )

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
    if role is not None:
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
        .filter(
            User.id == user_id,
            User.organization_id == _admin.organization_id,
        )
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.patch("/{user_id}/admin", response_model=UserResponse)
def update_admin_role(
    user_id: int,
    body: UpdateAdminRoleRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    # Serialize Admin changes per organization so the last-Admin check and
    # the role update happen as one decision on PostgreSQL.
    db.query(Organization).filter(
        Organization.id == admin.organization_id
    ).with_for_update().one()
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(
            User.id == user_id,
            User.organization_id == admin.organization_id,
        )
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    admin_role = db.query(AppRole).filter(AppRole.name == "Admin").first()
    if admin_role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin role is not configured",
        )

    currently_admin = any(role.id == admin_role.id for role in user.app_roles)
    if body.is_admin == currently_admin:
        return _user_response(user)

    if not body.is_admin:
        if user.id == admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove Admin from your own account",
            )

        active_admin_count = (
            db.query(User.id)
            .join(UserAppRole, UserAppRole.user_id == User.id)
            .filter(
                User.organization_id == admin.organization_id,
                User.is_active.is_(True),
                UserAppRole.app_role_id == admin_role.id,
            )
            .count()
        )
        if active_admin_count <= 1 and user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last active Admin",
            )
        user.app_roles.remove(admin_role)
    else:
        user.app_roles.append(admin_role)

    db.commit()
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(User.id == user.id)
        .one()
    )
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

    # Use the same organization lock as Admin role changes. This prevents two
    # concurrent requests from both passing the last-Admin check.
    db.query(Organization).filter(
        Organization.id == admin.organization_id
    ).with_for_update().one()
    user = (
        db.query(User)
        .options(joinedload(User.app_roles))
        .filter(
            User.id == user_id,
            User.organization_id == admin.organization_id,
        )
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    admin_role = next((role for role in user.app_roles if role.name == "Admin"), None)
    if user.is_active and admin_role is not None:
        active_admin_count = (
            db.query(User.id)
            .join(UserAppRole, UserAppRole.user_id == User.id)
            .filter(
                User.organization_id == admin.organization_id,
                User.is_active.is_(True),
                UserAppRole.app_role_id == admin_role.id,
            )
            .count()
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active Admin",
            )

    user.is_active = False
    db.commit()
    db.refresh(user)
    return _user_response(user)
