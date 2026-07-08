from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_authenticated
from app.db.session import get_db
from app.models import Act, Character, Dialogue, Moment, Production, Scene, Song, User
from app.schemas.timeline import (
    ActSummary,
    CharacterResponse,
    MomentDetailResponse,
    MomentSummary,
    DialogueLineResponse,
)

router = APIRouter(prefix="/productions", tags=["timeline"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


@router.get("/{production_id}/acts", response_model=list[ActSummary])
def list_acts(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[Act]:
    _get_production_or_404(db, production_id)
    return (
        db.query(Act)
        .options(joinedload(Act.scenes))
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order)
        .all()
    )


@router.get("/{production_id}/scenes/{scene_id}/moments", response_model=list[MomentSummary])
def list_scene_moments(
    production_id: int,
    scene_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentSummary]:
    _get_production_or_404(db, production_id)
    scene = (
        db.query(Scene)
        .join(Act)
        .filter(Scene.id == scene_id, Act.production_id == production_id)
        .first()
    )
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    moments = (
        db.query(Moment)
        .options(joinedload(Moment.moment_type))
        .filter(Moment.scene_id == scene_id)
        .order_by(Moment.sequence_number)
        .all()
    )
    return [
        MomentSummary(
            id=m.id,
            sequence_number=m.sequence_number,
            moment_type=m.moment_type.name,
            original_text=m.original_text,
            song_id=m.song_id,
        )
        for m in moments
    ]


@router.get("/{production_id}/moments/{moment_id}", response_model=MomentDetailResponse)
def get_moment_detail(
    production_id: int,
    moment_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    _get_production_or_404(db, production_id)
    moment = (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_type),
            joinedload(Moment.dialogue_lines).joinedload(Dialogue.character),
            joinedload(Moment.stage_directions),
            joinedload(Moment.song),
        )
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    stage_direction = (
        moment.stage_directions[0].direction_text if moment.stage_directions else None
    )
    return MomentDetailResponse(
        id=moment.id,
        sequence_number=moment.sequence_number,
        moment_type=moment.moment_type.name,
        original_text=moment.original_text,
        parsed_text=moment.parsed_text,
        song_id=moment.song_id,
        song_title=moment.song.title if moment.song else None,
        dialogue=[
            DialogueLineResponse(
                character_name=line.character.name,
                dialogue_text=line.dialogue_text,
            )
            for line in moment.dialogue_lines
        ],
        stage_direction=stage_direction,
    )


@router.get("/{production_id}/characters", response_model=list[CharacterResponse])
def list_characters(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[Character]:
    _get_production_or_404(db, production_id)
    return (
        db.query(Character)
        .filter(Character.production_id == production_id)
        .order_by(Character.name)
        .all()
    )
