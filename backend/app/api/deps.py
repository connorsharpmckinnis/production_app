"""Shared API helpers for production-scoped routes."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import user_has_role
from app.models import Character, Production, User, UserCharacterAssignment


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
    user in the same organization as this production. Used anywhere a
    Moment attachment records a character-or-user person (Phase 14 prop and
    set piece events today; the lav chart has its own equivalent checks).
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
        user = (
            db.query(User)
            .join(Production, Production.organization_id == User.organization_id)
            .filter(
                User.id == user_id,
                User.is_active.is_(True),
                Production.id == production_id,
            )
            .first()
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not available in this organization",
            )


def get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def user_can_access_production(db: Session, user: User, production: Production) -> bool:
    """Admin/Director: any production. Actor-only: only if cast in that production."""
    if user_has_role(user, "Admin") or user_has_role(user, "Director"):
        return True
    if not user_has_role(user, "Actor"):
        return False
    assignment = (
        db.query(UserCharacterAssignment.id)
        .join(Character, Character.id == UserCharacterAssignment.character_id)
        .filter(
            UserCharacterAssignment.user_id == user.id,
            Character.production_id == production.id,
        )
        .first()
    )
    return assignment is not None


def get_accessible_production(db: Session, user: User, production_id: int) -> Production:
    """Load a production the user may access, or 404 (no existence leak for actors)."""
    production = get_production_or_404(db, production_id)
    if not user_can_access_production(db, user, production):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production
