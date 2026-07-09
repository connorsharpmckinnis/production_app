from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.notes import notes_visible_to_user
from app.auth.dependencies import require_authenticated, user_has_role
from app.db.session import get_db
from app.models import Act, Bookmark, Character, Dialogue, Group, Moment, Note, Production, Scene, User
from app.schemas.notes import NoteResponse
from app.schemas.timeline import (
    ActSummary,
    DialogueLineResponse,
    MomentDetailResponse,
    MomentSummary,
)
from app.services.timeline_filters import (
    apply_timeline_filters,
    load_scene_moments,
    moment_speaking_character_ids,
    parse_character_ids,
)

router = APIRouter(prefix="/productions", tags=["timeline"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _user_display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _note_response(note: Note, current_user_id: int) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        author_display_name=_user_display_name(note.user),
        visibility=note.visibility,
        moment_id=note.moment_id,
        character_id=note.character_id,
        content=note.content,
        created_at=note.created_at,
        is_mine=note.user_id == current_user_id,
    )


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
    character_ids: str | None = Query(default=None),
    group_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    cue_only: bool = Query(default=False),
    user: User = Depends(require_authenticated),
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

    parsed_character_ids = parse_character_ids(character_ids)
    character_names: list[str] | None = None

    if group_id is not None:
        group = (
            db.query(Group)
            .options(joinedload(Group.characters))
            .filter(Group.id == group_id, Group.production_id == production_id)
            .first()
        )
        if group is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        parsed_character_ids = [character.id for character in group.characters]
        character_names = [character.name for character in group.characters]
    elif parsed_character_ids:
        rows = (
            db.query(Character.name)
            .filter(
                Character.production_id == production_id,
                Character.id.in_(parsed_character_ids),
            )
            .all()
        )
        character_names = [row[0] for row in rows]

    moments = load_scene_moments(db, scene_id)
    filtered = apply_timeline_filters(
        moments,
        user=user,
        character_ids=parsed_character_ids,
        character_names=character_names,
        search=search,
        cue_only=cue_only,
    )

    return [
        MomentSummary(
            id=moment.id,
            sequence_number=moment.sequence_number,
            moment_type=moment.moment_type.name,
            original_text=moment.original_text,
            song_id=moment.song_id,
            speaking_character_ids=moment_speaking_character_ids(moment),
        )
        for moment in filtered
    ]


@router.get("/{production_id}/moments/{moment_id}", response_model=MomentDetailResponse)
def get_moment_detail(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
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
            joinedload(Moment.notes).joinedload(Note.user),
        )
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    if user_has_role(user, "Actor") and moment.moment_type.name == "author_note":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    stage_direction = (
        moment.stage_directions[0].direction_text if moment.stage_directions else None
    )
    visible_notes = notes_visible_to_user(moment.notes, user.id)
    is_bookmarked = (
        db.query(Bookmark.id)
        .filter(Bookmark.user_id == user.id, Bookmark.moment_id == moment_id)
        .first()
        is not None
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
                character_id=line.character_id,
                character_name=line.character.name,
                dialogue_text=line.dialogue_text,
            )
            for line in moment.dialogue_lines
        ],
        stage_direction=stage_direction,
        notes=[_note_response(note, user.id) for note in visible_notes],
        is_bookmarked=is_bookmarked,
    )
