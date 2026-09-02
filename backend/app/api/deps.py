"""Shared API helpers for production-scoped routes."""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, user_has_role
from app.db.session import get_db
from app.models import Character, Group, Production, ProductionMembership, User
from app.services.production_memberships import (
    effective_permissions,
    get_active_production_user,
    get_membership,
)


def user_display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def validate_optional_person(
    db: Session,
    production_id: int,
    character_id: int | None,
    user_id: int | None,
) -> None:
    """Confirm an optional character/user "who did this" reference is usable.

    character_id must belong to this production; user_id must be an active
    member of this production. Used anywhere a Moment attachment records a
    character-or-user person (Phase 14 prop and set piece events today; the lav
    chart has its own equivalent checks).
    """
    if character_id is not None:
        character = (
            db.query(Character)
            .filter(Character.id == character_id, Character.production_id == production_id)
            .first()
        )
        if character is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Character is not in this production",
            )
    if user_id is not None:
        user = get_active_production_user(db, production_id, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not an active member of this production",
            )


def validate_blocking_subject(
    db: Session,
    production_id: int,
    character_id: int | None,
    user_id: int | None,
    group_id: int | None,
) -> None:
    """Confirm blocking targets exactly one valid character, user, or group."""
    subjects = [
        character_id is not None,
        user_id is not None,
        group_id is not None,
    ]
    if sum(subjects) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blocking must target exactly one of character, user, or group",
        )
    validate_optional_person(db, production_id, character_id, user_id)
    if group_id is not None:
        group = (
            db.query(Group)
            .filter(Group.id == group_id, Group.production_id == production_id)
            .first()
        )
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group is not in this production",
            )


def get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def get_active_production_membership(
    db: Session,
    user: User,
    production_id: int,
) -> ProductionMembership | None:
    """Return an active, same-organization membership for this user."""
    if not user.is_active:
        return None

    production = (
        db.query(Production)
        .filter(
            Production.id == production_id,
            Production.organization_id == user.organization_id,
        )
        .first()
    )
    if production is None:
        return None

    membership = get_membership(db, production_id, user.id)
    if membership is None or not membership.is_active:
        return None
    return membership


get_active_membership = get_active_production_membership


def user_has_production_capability(
    db: Session,
    user: User,
    production: Production,
    resource: str,
    action: str,
) -> bool:
    """Check one production capability without crossing organization boundaries."""
    if production.organization_id != user.organization_id or not user.is_active:
        return False
    if user_has_role(user, "Admin"):
        return True

    membership = get_active_production_membership(db, user, production.id)
    if membership is None:
        return False
    return (resource, action) in effective_permissions(db, membership)


has_production_capability = user_has_production_capability


def user_can_access_production(db: Session, user: User, production: Production) -> bool:
    """Return whether the user can read this production."""
    return user_has_production_capability(db, user, production, "production", "read")


def get_accessible_production(db: Session, user: User, production_id: int) -> Production:
    """Load an accessible production, hiding inaccessible IDs with a 404."""
    production = get_production_or_404(db, production_id)
    if not user_can_access_production(db, user, production):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def require_production_capability(resource: str, action: str):
    """Build a dependency for a capability on the route's production_id."""

    def _require_production_capability(
        production_id: int,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        production = get_production_or_404(db, production_id)
        if production.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Production not found",
            )

        membership = get_active_production_membership(db, user, production_id)
        if membership is None and not user_has_role(user, "Admin"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Production not found",
            )
        if not user_has_production_capability(db, user, production, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{resource} {action} access required",
            )
        return user

    return _require_production_capability
