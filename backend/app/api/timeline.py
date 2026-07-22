from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_accessible_production
from app.api.notes import notes_visible_to_user
from app.auth.dependencies import require_authenticated, require_director_or_admin, user_has_role
from app.db.session import get_db
from app.models import (
    Act,
    Bookmark,
    Character,
    Cue,
    Dialogue,
    Group,
    Microphone,
    Moment,
    MomentBlocking,
    MomentEntrance,
    MomentExit,
    MomentMicrophone,
    MomentProp,
    MomentSetPiece,
    MomentType,
    Note,
    Scene,
    SetPiece,
    Song,
    StageDirection,
    User,
)
from app.schemas.cues import CueResponse
from app.schemas.microphones import MomentMicrophoneResponse
from app.schemas.notes import NoteResponse
from app.schemas.props import MomentPropResponse
from app.schemas.set_pieces import MomentSetPieceResponse
from app.schemas.stage_movements import (
    MomentBlockingResponse,
    MomentEntranceResponse,
    MomentExitResponse,
    OnStageCharacterResponse,
)
from app.schemas.timeline import (
    ActSummary,
    DialogueLineResponse,
    MomentDetailResponse,
    MomentSummary,
)
from app.schemas.timeline_editing import (
    DialogueUpdate,
    MomentCreate,
    MomentSequenceUpdate,
    MomentTypeResponse,
    MomentUpdate,
    StageDirectionUpdate,
)
from app.services.on_stage import compute_on_stage_ids_by_moment, on_stage_characters_for_moment
from app.services.moment_sequence import (
    move_moment_sequence,
    renumber_moments_after_delete,
    shift_moments_from,
)
from app.services.timeline_filters import (
    costume_character_ids_for_scene,
    moment_display_text,
    moment_has_costume,
    apply_timeline_filters,
    load_scene_moments,
    moment_ids_with_cue_category,
    moment_ids_with_cues,
    moment_ids_with_microphone,
    moment_ids_with_prop,
    moment_ids_with_set_piece,
    moment_speaking_character_ids,
    parse_character_ids,
)

router = APIRouter(prefix="/productions", tags=["timeline"])
lookup_router = APIRouter(tags=["timeline"])


def _get_moment_in_production_or_404(
    db: Session,
    production_id: int,
    moment_id: int,
) -> Moment:
    moment = (
        db.query(Moment)
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")
    return moment


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


def _moment_prop_response(moment_prop: MomentProp) -> MomentPropResponse:
    character_name = None
    if moment_prop.character is not None:
        character_name = moment_prop.character.name
    return MomentPropResponse(
        id=moment_prop.id,
        prop_id=moment_prop.prop_id,
        prop_name=moment_prop.prop.name,
        character_id=moment_prop.character_id,
        character_name=character_name,
        notes=moment_prop.notes,
    )


def _moment_microphone_response(
    moment_microphone: MomentMicrophone,
) -> MomentMicrophoneResponse:
    character_name = None
    if moment_microphone.character is not None:
        character_name = moment_microphone.character.name
    return MomentMicrophoneResponse(
        id=moment_microphone.id,
        microphone_id=moment_microphone.microphone_id,
        microphone_identifier=moment_microphone.microphone.identifier,
        character_id=moment_microphone.character_id,
        character_name=character_name,
        notes=moment_microphone.notes,
    )


def _moment_set_piece_response(moment_set_piece: MomentSetPiece) -> MomentSetPieceResponse:
    return MomentSetPieceResponse(
        id=moment_set_piece.id,
        set_piece_id=moment_set_piece.set_piece_id,
        set_piece_name=moment_set_piece.set_piece.name,
        notes=moment_set_piece.notes,
    )


def _moment_entrance_response(entrance: MomentEntrance) -> MomentEntranceResponse:
    return MomentEntranceResponse(
        id=entrance.id,
        character_id=entrance.character_id,
        character_name=entrance.character.name,
        notes=entrance.notes,
    )


def _moment_exit_response(exit_row: MomentExit) -> MomentExitResponse:
    return MomentExitResponse(
        id=exit_row.id,
        character_id=exit_row.character_id,
        character_name=exit_row.character.name,
        notes=exit_row.notes,
    )


def _moment_blocking_response(blocking: MomentBlocking) -> MomentBlockingResponse:
    return MomentBlockingResponse(
        id=blocking.id,
        character_id=blocking.character_id,
        character_name=blocking.character.name,
        notes=blocking.notes,
    )


def _cue_response(cue: Cue) -> CueResponse:
    return CueResponse(
        id=cue.id,
        cue_category_id=cue.cue_category_id,
        cue_category_name=cue.cue_category.name,
        title=cue.title,
        notes=cue.notes,
        payload=cue.payload,
    )


@lookup_router.get("/moment-types", response_model=list[MomentTypeResponse])
def list_moment_types(
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentTypeResponse]:
    return db.query(MomentType).order_by(MomentType.name).all()


@router.get("/{production_id}/acts", response_model=list[ActSummary])
def list_acts(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[Act]:
    get_accessible_production(db, user, production_id)
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
    song_id: int | None = Query(default=None),
    prop_id: int | None = Query(default=None),
    cue_category_id: int | None = Query(default=None),
    microphone_id: int | None = Query(default=None),
    set_piece_id: int | None = Query(default=None),
    costume_only: bool = Query(default=False),
    entrance_only: bool = Query(default=False),
    exit_only: bool = Query(default=False),
    blocking_only: bool = Query(default=False),
    blocking_character_id: int | None = Query(default=None),
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentSummary]:
    get_accessible_production(db, user, production_id)
    scene = (
        db.query(Scene)
        .join(Act)
        .filter(Scene.id == scene_id, Act.production_id == production_id)
        .first()
    )
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    try:
        parsed_character_ids = parse_character_ids(character_ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
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

    if song_id is not None:
        song = (
            db.query(Song)
            .filter(Song.id == song_id, Song.production_id == production_id)
            .first()
        )
        if song is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")

    if prop_id is not None:
        from app.models import Prop

        prop = (
            db.query(Prop)
            .filter(Prop.id == prop_id, Prop.production_id == production_id)
            .first()
        )
        if prop is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prop not found")

    if cue_category_id is not None:
        from app.models import CueCategory

        category = (
            db.query(CueCategory)
            .filter(
                CueCategory.id == cue_category_id,
                CueCategory.production_id == production_id,
            )
            .first()
        )
        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cue category not found",
            )

    if microphone_id is not None:
        microphone = (
            db.query(Microphone)
            .filter(
                Microphone.id == microphone_id,
                Microphone.production_id == production_id,
            )
            .first()
        )
        if microphone is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Microphone not found",
            )

    if set_piece_id is not None:
        set_piece = (
            db.query(SetPiece)
            .filter(SetPiece.id == set_piece_id, SetPiece.production_id == production_id)
            .first()
        )
        if set_piece is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Set piece not found",
            )

    cued_moment_ids = moment_ids_with_cues(db, scene_id)
    prop_moment_ids = (
        moment_ids_with_prop(db, scene_id, prop_id) if prop_id is not None else None
    )
    category_moment_ids = (
        moment_ids_with_cue_category(db, scene_id, cue_category_id)
        if cue_category_id is not None
        else None
    )
    microphone_moment_ids = (
        moment_ids_with_microphone(db, scene_id, microphone_id)
        if microphone_id is not None
        else None
    )
    set_piece_moment_ids = (
        moment_ids_with_set_piece(db, scene_id, set_piece_id)
        if set_piece_id is not None
        else None
    )
    costume_char_ids = costume_character_ids_for_scene(db, scene_id)
    blocking_char_ids = None
    if blocking_only:
        if blocking_character_id is not None:
            blocking_char_ids = {blocking_character_id}
        elif parsed_character_ids:
            blocking_char_ids = set(parsed_character_ids)

    moments = load_scene_moments(db, scene_id)
    on_stage_by_moment = compute_on_stage_ids_by_moment(moments)
    filtered = apply_timeline_filters(
        moments,
        user=user,
        character_ids=parsed_character_ids,
        character_names=character_names,
        search=search,
        cue_only=cue_only,
        song_id=song_id,
        prop_id=prop_id,
        cue_category_id=cue_category_id,
        microphone_id=microphone_id,
        set_piece_id=set_piece_id,
        costume_only=costume_only,
        entrance_only=entrance_only,
        exit_only=exit_only,
        blocking_only=blocking_only,
        blocking_character_ids=blocking_char_ids,
        moment_ids_with_cues=cued_moment_ids,
        moment_ids_with_prop=prop_moment_ids,
        moment_ids_with_cue_category=category_moment_ids,
        moment_ids_with_microphone=microphone_moment_ids,
        moment_ids_with_set_piece=set_piece_moment_ids,
        costume_character_ids=costume_char_ids,
    )

    return [
        MomentSummary(
            id=moment.id,
            sequence_number=moment.sequence_number,
            moment_type=moment.moment_type.name,
            original_text=moment.original_text,
            display_text=moment_display_text(moment),
            song_id=moment.song_id,
            speaking_character_ids=moment_speaking_character_ids(moment),
            has_props=len(moment.moment_props) > 0,
            has_cues=len(moment.cues) > 0,
            has_microphone=len(moment.moment_microphones) > 0,
            has_set_piece=len(moment.moment_set_pieces) > 0,
            has_costume=moment_has_costume(moment, costume_char_ids),
            has_entrance=len(moment.moment_entrances) > 0,
            has_exit=len(moment.moment_exits) > 0,
            has_blocking=len(moment.moment_blocking) > 0,
            on_stage_character_ids=on_stage_by_moment.get(moment.id, []),
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
    get_accessible_production(db, user, production_id)
    moment = (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_type),
            joinedload(Moment.dialogue_lines).joinedload(Dialogue.character),
            joinedload(Moment.stage_directions),
            joinedload(Moment.song),
            joinedload(Moment.notes).joinedload(Note.user),
            joinedload(Moment.moment_props).joinedload(MomentProp.prop),
            joinedload(Moment.moment_props).joinedload(MomentProp.character),
            joinedload(Moment.moment_microphones).joinedload(MomentMicrophone.microphone),
            joinedload(Moment.moment_microphones).joinedload(MomentMicrophone.character),
            joinedload(Moment.moment_set_pieces).joinedload(MomentSetPiece.set_piece),
            joinedload(Moment.moment_entrances).joinedload(MomentEntrance.character),
            joinedload(Moment.moment_exits).joinedload(MomentExit.character),
            joinedload(Moment.moment_blocking).joinedload(MomentBlocking.character),
            joinedload(Moment.cues).joinedload(Cue.cue_category),
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

    on_stage = on_stage_characters_for_moment(db, moment)

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
                id=line.id,
                character_id=line.character_id,
                character_name=line.character.name,
                dialogue_text=line.dialogue_text,
            )
            for line in moment.dialogue_lines
        ],
        stage_direction=stage_direction,
        props=[_moment_prop_response(moment_prop) for moment_prop in moment.moment_props],
        microphones=[
            _moment_microphone_response(item) for item in moment.moment_microphones
        ],
        set_pieces=[
            _moment_set_piece_response(item) for item in moment.moment_set_pieces
        ],
        entrances=[_moment_entrance_response(item) for item in moment.moment_entrances],
        exits=[_moment_exit_response(item) for item in moment.moment_exits],
        blocking=[_moment_blocking_response(item) for item in moment.moment_blocking],
        on_stage_characters=[
            OnStageCharacterResponse(id=character.id, name=character.name)
            for character in on_stage
        ],
        cues=[_cue_response(cue) for cue in moment.cues],
        notes=[_note_response(note, user.id) for note in visible_notes],
        is_bookmarked=is_bookmarked,
    )


@router.patch("/{production_id}/moments/{moment_id}", response_model=MomentDetailResponse)
def update_moment(
    production_id: int,
    moment_id: int,
    body: MomentUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    moment = _get_moment_in_production_or_404(db, production_id, moment_id)

    if "moment_type_id" in body.model_fields_set:
        moment_type = db.query(MomentType).filter(MomentType.id == body.moment_type_id).first()
        if moment_type is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid moment type",
            )
        if body.moment_type_id != moment.moment_type_id and not body.force_type_change:
            current_type = moment.moment_type.name
            new_type = moment_type.name
            orphaned: list[str] = []
            if moment.dialogue_lines and new_type != "dialogue":
                orphaned.append("dialogue lines")
            if moment.stage_directions and new_type != "stage_direction":
                orphaned.append("stage direction")
            if orphaned:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Changing moment type from {current_type} to {new_type} would "
                        f"orphan {' and '.join(orphaned)}. "
                        "Send force_type_change: true to proceed."
                    ),
                )
        moment.moment_type_id = body.moment_type_id

    if "parsed_text" in body.model_fields_set:
        moment.parsed_text = body.parsed_text

    if "song_id" in body.model_fields_set:
        if body.song_id is not None:
            song = (
                db.query(Song)
                .filter(Song.id == body.song_id, Song.production_id == production_id)
                .first()
            )
            if song is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Song is not in this production",
                )
        moment.song_id = body.song_id

    db.commit()
    return get_moment_detail(production_id, moment_id, _director, db)


@router.patch(
    "/{production_id}/moments/{moment_id}/dialogue/{line_id}",
    response_model=MomentDetailResponse,
)
def update_dialogue(
    production_id: int,
    moment_id: int,
    line_id: int,
    body: DialogueUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    line = (
        db.query(Dialogue)
        .filter(Dialogue.id == line_id, Dialogue.moment_id == moment_id)
        .first()
    )
    if line is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialogue line not found")

    if "character_id" in body.model_fields_set:
        if body.character_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="character_id cannot be null",
            )
        character = (
            db.query(Character)
            .filter(
                Character.id == body.character_id,
                Character.production_id == production_id,
            )
            .first()
        )
        if character is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Character is not in this production",
            )
        line.character_id = body.character_id

    if "dialogue_text" in body.model_fields_set:
        if body.dialogue_text is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="dialogue_text cannot be null",
            )
        line.dialogue_text = body.dialogue_text

    db.commit()
    return get_moment_detail(production_id, moment_id, _director, db)


@router.patch(
    "/{production_id}/moments/{moment_id}/stage-direction",
    response_model=MomentDetailResponse,
)
def update_stage_direction(
    production_id: int,
    moment_id: int,
    body: StageDirectionUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    stage_direction = (
        db.query(StageDirection)
        .filter(StageDirection.moment_id == moment_id)
        .first()
    )
    if stage_direction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage direction not found",
        )

    if "direction_text" in body.model_fields_set:
        if body.direction_text is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="direction_text cannot be null",
            )
        stage_direction.direction_text = body.direction_text

    db.commit()
    return get_moment_detail(production_id, moment_id, _director, db)


def _get_scene_in_production_or_404(
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return scene


def _create_moment_child_rows(
    db: Session,
    moment: Moment,
    moment_type_name: str,
    original_text: str,
    character_id: int | None,
    production_id: int,
) -> None:
    if moment_type_name == "dialogue":
        if character_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="character_id is required for dialogue moments",
            )
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
        db.add(
            Dialogue(
                moment_id=moment.id,
                character_id=character_id,
                dialogue_text=original_text,
            )
        )
    elif moment_type_name == "stage_direction":
        db.add(
            StageDirection(
                moment_id=moment.id,
                direction_text=original_text,
            )
        )


@router.post(
    "/{production_id}/scenes/{scene_id}/moments",
    response_model=MomentDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def insert_moment(
    production_id: int,
    scene_id: int,
    body: MomentCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    get_accessible_production(db, director, production_id)
    _get_scene_in_production_or_404(db, production_id, scene_id)

    moment_type = db.query(MomentType).filter(MomentType.id == body.moment_type_id).first()
    if moment_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid moment type",
        )

    max_sequence = (
        db.query(Moment.sequence_number)
        .filter(Moment.scene_id == scene_id)
        .order_by(Moment.sequence_number.desc())
        .first()
    )
    if body.sequence_number > (max_sequence[0] if max_sequence else 0) + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sequence_number is out of range for this scene",
        )

    shift_moments_from(db, scene_id, body.sequence_number, 1)

    moment = Moment(
        scene_id=scene_id,
        moment_type_id=body.moment_type_id,
        sequence_number=body.sequence_number,
        original_text=body.original_text,
        parsed_text=body.original_text,
    )
    db.add(moment)
    db.flush()

    _create_moment_child_rows(
        db,
        moment,
        moment_type.name,
        body.original_text,
        body.character_id,
        production_id,
    )

    db.commit()
    return get_moment_detail(production_id, moment.id, director, db)


@router.delete(
    "/{production_id}/moments/{moment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_moment(
    production_id: int,
    moment_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    moment = _get_moment_in_production_or_404(db, production_id, moment_id)
    scene_id = moment.scene_id
    deleted_sequence = moment.sequence_number

    db.query(Bookmark).filter(Bookmark.moment_id == moment_id).delete()
    db.delete(moment)
    db.flush()
    renumber_moments_after_delete(db, scene_id, deleted_sequence)
    db.commit()


@router.patch(
    "/{production_id}/moments/{moment_id}/sequence",
    response_model=MomentDetailResponse,
)
def update_moment_sequence(
    production_id: int,
    moment_id: int,
    body: MomentSequenceUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentDetailResponse:
    moment = _get_moment_in_production_or_404(db, production_id, moment_id)

    max_sequence = (
        db.query(Moment.sequence_number)
        .filter(Moment.scene_id == moment.scene_id)
        .count()
    )
    if body.sequence_number > max_sequence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sequence_number is out of range for this scene",
        )

    move_moment_sequence(db, moment, body.sequence_number)
    db.commit()
    return get_moment_detail(production_id, moment_id, _director, db)
