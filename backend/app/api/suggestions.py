"""API for the rules-based suggestion engine."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_accessible_production,
    require_any_production_capability,
)
from app.db.session import get_db
from app.models import Act, Scene, User
from app.schemas.suggestions import (
    SuggestionAcceptResponse,
    SuggestionFingerprintBody,
    SuggestionResponse,
)
from app.services.suggestions import (
    accept_suggestion,
    dismiss_suggestion,
    evaluate_scene_suggestions,
)

router = APIRouter(prefix="/productions", tags=["suggestions"])

_TIMELINE_EDIT = require_any_production_capability(
    ("timeline", "create"),
    ("timeline", "update"),
    ("timeline", "approve"),
)


def _scene_in_production_or_404(
    db: Session,
    production_id: int,
    scene_id: int,
) -> Scene:
    scene = (
        db.query(Scene)
        .join(Act)
        .filter(Scene.id == scene_id, Act.production_id == production_id)
        .first()
    )
    if scene is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene not found",
        )
    return scene


@router.get(
    "/{production_id}/suggestions",
    response_model=list[SuggestionResponse],
)
def list_suggestions(
    production_id: int,
    scene_id: int = Query(..., description="Scene to evaluate"),
    moment_id: int | None = Query(
        None, description="Only suggestions anchored on this moment"
    ),
    rule_id: str | None = Query(None),
    include_dismissed: bool = Query(False),
    user: User = Depends(_TIMELINE_EDIT),
    db: Session = Depends(get_db),
) -> list[SuggestionResponse]:
    get_accessible_production(db, user, production_id)
    _scene_in_production_or_404(db, production_id, scene_id)
    try:
        return evaluate_scene_suggestions(
            db,
            production_id=production_id,
            scene_id=scene_id,
            rule_id=rule_id,
            moment_id=moment_id,
            include_dismissed=include_dismissed,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{production_id}/suggestions/dismiss",
    status_code=status.HTTP_204_NO_CONTENT,
)
def dismiss_suggestion_endpoint(
    production_id: int,
    body: SuggestionFingerprintBody,
    user: User = Depends(_TIMELINE_EDIT),
    db: Session = Depends(get_db),
) -> None:
    production = get_accessible_production(db, user, production_id)
    dismiss_suggestion(
        db,
        production=production,
        user=user,
        fingerprint=body.fingerprint,
    )


@router.post(
    "/{production_id}/suggestions/accept",
    response_model=SuggestionAcceptResponse,
)
def accept_suggestion_endpoint(
    production_id: int,
    body: SuggestionFingerprintBody,
    user: User = Depends(_TIMELINE_EDIT),
    db: Session = Depends(get_db),
) -> SuggestionAcceptResponse:
    production = get_accessible_production(db, user, production_id)
    return accept_suggestion(
        db,
        production=production,
        user=user,
        fingerprint=body.fingerprint,
    )
