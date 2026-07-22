"""Shared API helpers for production-scoped routes."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import user_has_role
from app.models import Character, Production, User, UserCharacterAssignment


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
