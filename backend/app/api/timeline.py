from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_accessible_production, user_display_name
from app.api.notes import notes_visible_to_user
from app.auth.dependencies import require_authenticated, require_director_or_admin, user_has_role
from app.db.session import get_db
from app.models import (
    Act,
    Bookmark,
    Character,
    Costume,
    Cue,
    Dialogue,
    Group,
    LyricLine,
    Moment,
    MomentBlocking,
    MomentCostumeEvent,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    MomentSetPieceEvent,
    MomentType,
    Note,
    Prop,
    Scene,
    SetPiece,
    Song,
    SongAttributionCharacter,
    StageDirection,
    User,
)
from app.schemas.costumes import CostumeWearingResponse, MomentCostumeEventResponse
from app.schemas.cues import CueResponse
from app.schemas.notes import NoteResponse
from app.schemas.props import MomentPropEventResponse, PropInPlayResponse
from app.schemas.set_pieces import MomentSetPieceEventResponse, SetPieceInPlayResponse
from app.schemas.stage_movements import (
    MomentBlockingResponse,
    MomentEntranceResponse,
    MomentExitResponse,
    OnStageCharacterResponse,
)
from app.schemas.timeline import (
    ActSummary,
    DialogueLineResponse,
    LyricLineResponse,
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
from app.services.asset_state import (
    AssetMomentRef,
    AssetStateSnapshot,
    compute_costume_state_by_moment,
    compute_prop_state_by_moment,
    compute_set_piece_state_by_moment,
    find_next_asset_event_refs,
    find_prior_on_refs,
    group_costume_events_by_moment_id,
    group_prop_events_by_moment_id,
    group_set_piece_events_by_moment_id,
    load_production_moments_in_show_order,
)
from app.services.on_stage import compute_on_stage_ids_by_moment, on_stage_characters_for_moment
from app.services.moment_sequence import (
    move_moment_sequence,
    renumber_moments_after_delete,
    shift_moments_from,
)
from app.services.timeline_filters import (
    moment_display_text,
    apply_timeline_filters,
    load_scene_moments,
    moment_ids_with_cue_category,
    moment_ids_with_cues,
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


def _note_response(note: Note, current_user_id: int) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        author_display_name=user_display_name(note.user),
        visibility=note.visibility,
        moment_id=note.moment_id,
        character_id=note.character_id,
        content=note.content,
        created_at=note.created_at,
        is_mine=note.user_id == current_user_id,
    )


def _moment_prop_event_response(
    event: MomentPropEvent,
    *,
    prior_on: dict[str, int | None] | None = None,
) -> MomentPropEventResponse:
    return MomentPropEventResponse(
        id=event.id,
        prop_id=event.prop_id,
        prop_name=event.prop.name,
        kind=event.kind,
        character_id=event.character_id,
        character_name=event.character.name if event.character else None,
        user_id=event.user_id,
        user_display_name=user_display_name(event.user) if event.user else None,
        notes=event.notes,
        **(prior_on or {}),
    )


def _moment_set_piece_event_response(
    event: MomentSetPieceEvent,
    *,
    prior_on: dict[str, int | None] | None = None,
) -> MomentSetPieceEventResponse:
    return MomentSetPieceEventResponse(
        id=event.id,
        set_piece_id=event.set_piece_id,
        set_piece_name=event.set_piece.name,
        kind=event.kind,
        character_id=event.character_id,
        character_name=event.character.name if event.character else None,
        user_id=event.user_id,
        user_display_name=user_display_name(event.user) if event.user else None,
        notes=event.notes,
        **(prior_on or {}),
    )


def _prior_on_deep_link_fields(
    prior_ref: AssetMomentRef | None,
    positions: dict[int, tuple[int, int, int]],
) -> dict[str, int | None]:
    return _deep_link_fields(
        prior_ref.moment_id if prior_ref else None,
        positions,
        prior_ref.scene_id if prior_ref else None,
        prefix="prior_on",
    )


def _moment_costume_event_response(
    event: MomentCostumeEvent,
    *,
    prior_on: dict[str, int | None] | None = None,
) -> MomentCostumeEventResponse:
    return MomentCostumeEventResponse(
        id=event.id,
        character_id=event.character_id,
        character_name=event.character.name,
        kind=event.kind,
        costume_id=event.costume_id,
        costume_name=event.costume.name if event.costume else None,
        notes=event.notes,
        **(prior_on or {}),
    )


def _resolve_names(
    db: Session,
    states: dict[int, AssetStateSnapshot],
) -> tuple[dict[int, str], dict[int, str]]:
    """Look up character/user display names referenced by a set of snapshots."""
    character_ids = {state.character_id for state in states.values() if state.character_id}
    user_ids = {state.user_id for state in states.values() if state.user_id}
    character_names = {
        character.id: character.name
        for character in (
            db.query(Character).filter(Character.id.in_(character_ids)).all()
            if character_ids
            else []
        )
    }
    user_names = {
        user.id: user_display_name(user)
        for user in (
            db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        )
    }
    return character_names, user_names


def _moment_show_positions(
    db: Session, moment_ids: set[int]
) -> dict[int, tuple[int, int, int]]:
    """moment_id -> (act_number, scene_number, sequence_number)."""
    if not moment_ids:
        return {}
    rows = (
        db.query(Moment.id, Act.number, Scene.number, Moment.sequence_number)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Moment.id.in_(moment_ids))
        .all()
    )
    return {
        moment_id: (act_number, scene_number, sequence_number)
        for moment_id, act_number, scene_number, sequence_number in rows
    }


def _deep_link_fields(
    moment_id: int | None,
    positions: dict[int, tuple[int, int, int]],
    scene_id: int | None,
    *,
    prefix: str,
) -> dict[str, int | None]:
    """Build source_* or next_change_* fields for an in-play response row."""
    if moment_id is None:
        return {
            f"{prefix}_moment_id": None,
            f"{prefix}_scene_id": None,
            f"{prefix}_act_number": None,
            f"{prefix}_scene_number": None,
            f"{prefix}_sequence_number": None,
        }
    act_number, scene_number, sequence_number = positions[moment_id]
    return {
        f"{prefix}_moment_id": moment_id,
        f"{prefix}_scene_id": scene_id,
        f"{prefix}_act_number": act_number,
        f"{prefix}_scene_number": scene_number,
        f"{prefix}_sequence_number": sequence_number,
    }


def _props_in_play_response(
    db: Session, production_id: int, moment_id: int
) -> list[PropInPlayResponse]:
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = group_prop_events_by_moment_id(db, production_id)
    states = compute_prop_state_by_moment(moments, events_by_moment_id).get(moment_id, {})
    in_play = {prop_id: state for prop_id, state in states.items() if state.in_play}
    if not in_play:
        return []

    next_refs = find_next_asset_event_refs(
        moments,
        events_by_moment_id,
        current_moment_id=moment_id,
        asset_ids=set(in_play.keys()),
        asset_id_attr="prop_id",
    )
    position_ids = {
        state.source_moment_id
        for state in in_play.values()
        if state.source_moment_id is not None
    }
    position_ids.update(ref.moment_id for ref in next_refs.values())
    positions = _moment_show_positions(db, position_ids)

    props_by_id = {
        prop.id: prop
        for prop in db.query(Prop).filter(Prop.id.in_(in_play.keys())).all()
    }
    character_names, user_names = _resolve_names(db, in_play)

    rows: list[PropInPlayResponse] = []
    for prop_id, state in sorted(in_play.items(), key=lambda item: props_by_id[item[0]].name):
        if state.source_moment_id is None or state.source_scene_id is None:
            continue
        next_ref: AssetMomentRef | None = next_refs.get(prop_id)
        rows.append(
            PropInPlayResponse(
                prop_id=prop_id,
                prop_name=props_by_id[prop_id].name,
                character_id=state.character_id,
                character_name=(
                    character_names.get(state.character_id) if state.character_id else None
                ),
                user_id=state.user_id,
                user_display_name=(
                    user_names.get(state.user_id) if state.user_id else None
                ),
                notes=state.notes,
                **_deep_link_fields(
                    state.source_moment_id,
                    positions,
                    state.source_scene_id,
                    prefix="source",
                ),
                **_deep_link_fields(
                    next_ref.moment_id if next_ref else None,
                    positions,
                    next_ref.scene_id if next_ref else None,
                    prefix="next_change",
                ),
            )
        )
    return rows


def _set_pieces_in_play_response(
    db: Session, production_id: int, moment_id: int
) -> list[SetPieceInPlayResponse]:
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = group_set_piece_events_by_moment_id(db, production_id)
    states = compute_set_piece_state_by_moment(moments, events_by_moment_id).get(
        moment_id, {}
    )
    in_play = {
        set_piece_id: state for set_piece_id, state in states.items() if state.in_play
    }
    if not in_play:
        return []

    next_refs = find_next_asset_event_refs(
        moments,
        events_by_moment_id,
        current_moment_id=moment_id,
        asset_ids=set(in_play.keys()),
        asset_id_attr="set_piece_id",
    )
    position_ids = {
        state.source_moment_id
        for state in in_play.values()
        if state.source_moment_id is not None
    }
    position_ids.update(ref.moment_id for ref in next_refs.values())
    positions = _moment_show_positions(db, position_ids)

    set_pieces_by_id = {
        set_piece.id: set_piece
        for set_piece in db.query(SetPiece).filter(SetPiece.id.in_(in_play.keys())).all()
    }
    character_names, user_names = _resolve_names(db, in_play)

    rows: list[SetPieceInPlayResponse] = []
    for set_piece_id, state in sorted(
        in_play.items(), key=lambda item: set_pieces_by_id[item[0]].name
    ):
        if state.source_moment_id is None or state.source_scene_id is None:
            continue
        next_ref: AssetMomentRef | None = next_refs.get(set_piece_id)
        rows.append(
            SetPieceInPlayResponse(
                set_piece_id=set_piece_id,
                set_piece_name=set_pieces_by_id[set_piece_id].name,
                character_id=state.character_id,
                character_name=(
                    character_names.get(state.character_id) if state.character_id else None
                ),
                user_id=state.user_id,
                user_display_name=(
                    user_names.get(state.user_id) if state.user_id else None
                ),
                notes=state.notes,
                **_deep_link_fields(
                    state.source_moment_id,
                    positions,
                    state.source_scene_id,
                    prefix="source",
                ),
                **_deep_link_fields(
                    next_ref.moment_id if next_ref else None,
                    positions,
                    next_ref.scene_id if next_ref else None,
                    prefix="next_change",
                ),
            )
        )
    return rows


def _costumes_wearing_response(
    db: Session, production_id: int, moment_id: int
) -> list[CostumeWearingResponse]:
    """Characters currently wearing a costume as of this Moment (event-derived)."""
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = group_costume_events_by_moment_id(db, production_id)
    states = compute_costume_state_by_moment(moments, events_by_moment_id).get(
        moment_id, {}
    )
    wearing = {
        character_id: state for character_id, state in states.items() if state.costume_id
    }
    if not wearing:
        return []

    next_refs = find_next_asset_event_refs(
        moments,
        events_by_moment_id,
        current_moment_id=moment_id,
        asset_ids=set(wearing.keys()),
        asset_id_attr="character_id",
    )
    position_ids = {
        state.source_moment_id
        for state in wearing.values()
        if state.source_moment_id is not None
    }
    position_ids.update(ref.moment_id for ref in next_refs.values())
    positions = _moment_show_positions(db, position_ids)

    character_names = {
        character.id: character.name
        for character in (
            db.query(Character).filter(Character.id.in_(wearing.keys())).all()
        )
    }
    costume_ids = {state.costume_id for state in wearing.values()}
    costume_names = {
        costume.id: costume.name
        for costume in db.query(Costume).filter(Costume.id.in_(costume_ids)).all()
    }

    rows: list[CostumeWearingResponse] = []
    for character_id, state in sorted(
        wearing.items(), key=lambda item: character_names.get(item[0], "")
    ):
        if (
            state.costume_id is None
            or state.source_moment_id is None
            or state.source_scene_id is None
        ):
            continue
        next_ref: AssetMomentRef | None = next_refs.get(character_id)
        rows.append(
            CostumeWearingResponse(
                character_id=character_id,
                character_name=character_names.get(character_id, ""),
                costume_id=state.costume_id,
                costume_name=costume_names.get(state.costume_id, ""),
                notes=state.notes,
                **_deep_link_fields(
                    state.source_moment_id,
                    positions,
                    state.source_scene_id,
                    prefix="source",
                ),
                **_deep_link_fields(
                    next_ref.moment_id if next_ref else None,
                    positions,
                    next_ref.scene_id if next_ref else None,
                    prefix="next_change",
                ),
            )
        )
    return rows


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
        character_name=blocking.character.name if blocking.character else None,
        user_id=blocking.user_id,
        user_display_name=user_display_name(blocking.user) if blocking.user else None,
        group_id=blocking.group_id,
        group_name=blocking.group.name if blocking.group else None,
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
    set_piece_moment_ids = (
        moment_ids_with_set_piece(db, scene_id, set_piece_id)
        if set_piece_id is not None
        else None
    )
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
        set_piece_id=set_piece_id,
        costume_only=costume_only,
        entrance_only=entrance_only,
        exit_only=exit_only,
        blocking_only=blocking_only,
        blocking_character_ids=blocking_char_ids,
        moment_ids_with_cues=cued_moment_ids,
        moment_ids_with_prop=prop_moment_ids,
        moment_ids_with_cue_category=category_moment_ids,
        moment_ids_with_set_piece=set_piece_moment_ids,
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
            has_props=len(moment.moment_prop_events) > 0,
            has_cues=len(moment.cues) > 0,
            has_set_piece=len(moment.moment_set_piece_events) > 0,
            has_costume=len(moment.moment_costume_events) > 0,
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
            joinedload(Moment.lyric_lines).joinedload(LyricLine.character),
            joinedload(Moment.song_attribution_characters).joinedload(
                SongAttributionCharacter.character,
            ),
            joinedload(Moment.stage_directions),
            joinedload(Moment.song),
            joinedload(Moment.notes).joinedload(Note.user),
            joinedload(Moment.moment_prop_events).joinedload(MomentPropEvent.prop),
            joinedload(Moment.moment_prop_events).joinedload(MomentPropEvent.character),
            joinedload(Moment.moment_prop_events).joinedload(MomentPropEvent.user),
            joinedload(Moment.moment_set_piece_events).joinedload(MomentSetPieceEvent.set_piece),
            joinedload(Moment.moment_set_piece_events).joinedload(MomentSetPieceEvent.character),
            joinedload(Moment.moment_set_piece_events).joinedload(MomentSetPieceEvent.user),
            joinedload(Moment.moment_costume_events).joinedload(MomentCostumeEvent.character),
            joinedload(Moment.moment_costume_events).joinedload(MomentCostumeEvent.costume),
            joinedload(Moment.moment_entrances).joinedload(MomentEntrance.character),
            joinedload(Moment.moment_exits).joinedload(MomentExit.character),
            joinedload(Moment.moment_blocking).joinedload(MomentBlocking.character),
            joinedload(Moment.moment_blocking).joinedload(MomentBlocking.user),
            joinedload(Moment.moment_blocking).joinedload(MomentBlocking.group),
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

    show_moments = load_production_moments_in_show_order(db, production_id)
    prop_events_by_moment = group_prop_events_by_moment_id(db, production_id)
    set_piece_events_by_moment = group_set_piece_events_by_moment_id(db, production_id)
    costume_events_by_moment = group_costume_events_by_moment_id(db, production_id)
    prop_states_by_moment = compute_prop_state_by_moment(show_moments, prop_events_by_moment)
    set_piece_states_by_moment = compute_set_piece_state_by_moment(
        show_moments, set_piece_events_by_moment
    )
    costume_states_by_moment = compute_costume_state_by_moment(
        show_moments, costume_events_by_moment
    )
    off_prop_ids = {
        event.prop_id for event in moment.moment_prop_events if event.kind == "off"
    }
    off_set_piece_ids = {
        event.set_piece_id
        for event in moment.moment_set_piece_events
        if event.kind == "off"
    }
    off_character_ids = {
        event.character_id
        for event in moment.moment_costume_events
        if event.kind == "off"
    }
    prior_prop_refs = find_prior_on_refs(
        show_moments,
        prop_states_by_moment,
        current_moment_id=moment.id,
        asset_ids=off_prop_ids,
    )
    prior_set_piece_refs = find_prior_on_refs(
        show_moments,
        set_piece_states_by_moment,
        current_moment_id=moment.id,
        asset_ids=off_set_piece_ids,
    )
    prior_costume_refs = find_prior_on_refs(
        show_moments,
        costume_states_by_moment,
        current_moment_id=moment.id,
        asset_ids=off_character_ids,
    )
    prior_position_ids = (
        {ref.moment_id for ref in prior_prop_refs.values()}
        | {ref.moment_id for ref in prior_set_piece_refs.values()}
        | {ref.moment_id for ref in prior_costume_refs.values()}
    )
    prior_positions = _moment_show_positions(db, prior_position_ids)

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
        lyrics=[
            LyricLineResponse(
                id=line.id,
                character_id=line.character_id,
                character_name=line.character.name,
                lyric_text=line.lyric_text,
            )
            for line in moment.lyric_lines
        ],
        stage_direction=stage_direction,
        props=[
            _moment_prop_event_response(
                event,
                prior_on=_prior_on_deep_link_fields(
                    prior_prop_refs.get(event.prop_id) if event.kind == "off" else None,
                    prior_positions,
                ),
            )
            for event in moment.moment_prop_events
        ],
        props_in_play=_props_in_play_response(db, production_id, moment.id),
        set_pieces=[
            _moment_set_piece_event_response(
                event,
                prior_on=_prior_on_deep_link_fields(
                    prior_set_piece_refs.get(event.set_piece_id)
                    if event.kind == "off"
                    else None,
                    prior_positions,
                ),
            )
            for event in moment.moment_set_piece_events
        ],
        set_pieces_in_play=_set_pieces_in_play_response(db, production_id, moment.id),
        costume_events=[
            _moment_costume_event_response(
                event,
                prior_on=_prior_on_deep_link_fields(
                    prior_costume_refs.get(event.character_id)
                    if event.kind == "off"
                    else None,
                    prior_positions,
                ),
            )
            for event in moment.moment_costume_events
        ],
        costumes_wearing=_costumes_wearing_response(db, production_id, moment.id),
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
            if moment.lyric_lines and new_type != "lyric":
                orphaned.append("lyric lines")
            if moment.song_attribution_characters and new_type != "song_attribution":
                orphaned.append("song attribution characters")
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
