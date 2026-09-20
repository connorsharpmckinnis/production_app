from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_accessible_production,
    require_any_production_capability,
    require_production_capability,
    user_display_name,
    validate_blocking_subject,
)
from app.db.session import get_db
from app.models import (
    Act,
    Character,
    Group,
    Moment,
    MomentBlocking,
    MomentEntrance,
    MomentExit,
    Scene,
    User,
)
from app.schemas.stage_movements import (
    MomentBlockingCreate,
    MomentBlockingResponse,
    MomentBlockingUpdate,
    MomentEntranceCreate,
    MomentEntranceResponse,
    MomentExitCreate,
    MomentExitResponse,
)
from app.services.prep_records import (
    assert_can_delete_attachment,
    prep_fields,
    prepare_new_attachment,
)

router = APIRouter(prefix="/productions", tags=["stage-movements"])

_TIMELINE_ATTACH = require_any_production_capability(
    ("timeline", "create"),
    ("timeline", "suggest"),
    ("timeline", "approve"),
)
_TIMELINE_REMOVE = require_any_production_capability(
    ("timeline", "delete"),
    ("timeline", "suggest"),
    ("timeline", "approve"),
)


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


def _validate_character_in_production(
    db: Session,
    production_id: int,
    character_id: int,
) -> Character:
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
    return character


def _validate_group_in_production(
    db: Session,
    production_id: int,
    group_id: int,
) -> Group:
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
    return group


def _validate_entrance_exit_subject(
    db: Session,
    production_id: int,
    character_id: int | None,
    group_id: int | None,
) -> None:
    subjects = [character_id is not None, group_id is not None]
    if sum(subjects) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement must target exactly one of character or group",
        )
    if character_id is not None:
        _validate_character_in_production(db, production_id, character_id)
    if group_id is not None:
        _validate_group_in_production(db, production_id, group_id)


def _entrance_load_options():
    return (
        joinedload(MomentEntrance.character),
        joinedload(MomentEntrance.group),
    )


def _exit_load_options():
    return (
        joinedload(MomentExit.character),
        joinedload(MomentExit.group),
    )


def _entrance_response(db: Session, entrance: MomentEntrance) -> MomentEntranceResponse:
    return MomentEntranceResponse(
        id=entrance.id,
        character_id=entrance.character_id,
        character_name=entrance.character.name if entrance.character else None,
        group_id=entrance.group_id,
        group_name=entrance.group.name if entrance.group else None,
        notes=entrance.notes,
        **prep_fields(entrance),
    )


def _exit_response(db: Session, exit_row: MomentExit) -> MomentExitResponse:
    return MomentExitResponse(
        id=exit_row.id,
        character_id=exit_row.character_id,
        character_name=exit_row.character.name if exit_row.character else None,
        group_id=exit_row.group_id,
        group_name=exit_row.group.name if exit_row.group else None,
        notes=exit_row.notes,
        **prep_fields(exit_row),
    )


def _blocking_load_options():
    return (
        joinedload(MomentBlocking.character),
        joinedload(MomentBlocking.user),
        joinedload(MomentBlocking.group),
    )


def _blocking_response(db: Session, blocking: MomentBlocking) -> MomentBlockingResponse:
    return MomentBlockingResponse(
        id=blocking.id,
        character_id=blocking.character_id,
        character_name=blocking.character.name if blocking.character else None,
        user_id=blocking.user_id,
        user_display_name=user_display_name(blocking.user) if blocking.user else None,
        group_id=blocking.group_id,
        group_name=blocking.group.name if blocking.group else None,
        notes=blocking.notes,
        **prep_fields(blocking),
    )


@router.get(
    "/{production_id}/moments/{moment_id}/entrances",
    response_model=list[MomentEntranceResponse],
)
def list_moment_entrances(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_production_capability("timeline", "read")),
    db: Session = Depends(get_db),
) -> list[MomentEntranceResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    entrances = (
        db.query(MomentEntrance)
        .options(*_entrance_load_options())
        .filter(MomentEntrance.moment_id == moment_id)
        .order_by(MomentEntrance.id)
        .all()
    )
    return [_entrance_response(db, entrance) for entrance in entrances]


@router.post(
    "/{production_id}/moments/{moment_id}/entrances",
    response_model=MomentEntranceResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_entrance(
    production_id: int,
    moment_id: int,
    body: MomentEntranceCreate,
    user: User = Depends(_TIMELINE_ATTACH),
    db: Session = Depends(get_db),
) -> MomentEntranceResponse:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_entrance_exit_subject(
        db, production_id, body.character_id, body.group_id,
    )

    if body.character_id is not None:
        existing = (
            db.query(MomentEntrance)
            .filter(
                MomentEntrance.moment_id == moment_id,
                MomentEntrance.character_id == body.character_id,
            )
            .first()
        )
        conflict_detail = "This character already has an entrance on this moment"
    else:
        existing = (
            db.query(MomentEntrance)
            .filter(
                MomentEntrance.moment_id == moment_id,
                MomentEntrance.group_id == body.group_id,
            )
            .first()
        )
        conflict_detail = "This group already has an entrance on this moment"
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=conflict_detail,
        )

    entrance = MomentEntrance(
        moment_id=moment_id,
        character_id=body.character_id,
        group_id=body.group_id,
        notes=body.notes,
    )
    prepare_new_attachment(
        db, production, user, entrance, body.status, legacy_resource="timeline",
    )
    db.add(entrance)
    db.commit()
    entrance = (
        db.query(MomentEntrance)
        .options(*_entrance_load_options())
        .filter(MomentEntrance.id == entrance.id)
        .one()
    )
    return _entrance_response(db, entrance)


@router.delete(
    "/{production_id}/moments/{moment_id}/entrances/{entrance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_entrance(
    production_id: int,
    moment_id: int,
    entrance_id: int,
    user: User = Depends(_TIMELINE_REMOVE),
    db: Session = Depends(get_db),
) -> None:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    entrance = (
        db.query(MomentEntrance)
        .filter(MomentEntrance.id == entrance_id, MomentEntrance.moment_id == moment_id)
        .first()
    )
    if entrance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrance attachment not found",
        )
    assert_can_delete_attachment(
        db, user, production, entrance, legacy_resource="timeline",
    )
    db.delete(entrance)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/exits",
    response_model=list[MomentExitResponse],
)
def list_moment_exits(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_production_capability("timeline", "read")),
    db: Session = Depends(get_db),
) -> list[MomentExitResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    exits = (
        db.query(MomentExit)
        .options(*_exit_load_options())
        .filter(MomentExit.moment_id == moment_id)
        .order_by(MomentExit.id)
        .all()
    )
    return [_exit_response(db, exit_row) for exit_row in exits]


@router.post(
    "/{production_id}/moments/{moment_id}/exits",
    response_model=MomentExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_exit(
    production_id: int,
    moment_id: int,
    body: MomentExitCreate,
    user: User = Depends(_TIMELINE_ATTACH),
    db: Session = Depends(get_db),
) -> MomentExitResponse:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_entrance_exit_subject(
        db, production_id, body.character_id, body.group_id,
    )

    if body.character_id is not None:
        existing = (
            db.query(MomentExit)
            .filter(
                MomentExit.moment_id == moment_id,
                MomentExit.character_id == body.character_id,
            )
            .first()
        )
        conflict_detail = "This character already has an exit on this moment"
    else:
        existing = (
            db.query(MomentExit)
            .filter(
                MomentExit.moment_id == moment_id,
                MomentExit.group_id == body.group_id,
            )
            .first()
        )
        conflict_detail = "This group already has an exit on this moment"
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=conflict_detail,
        )

    exit_row = MomentExit(
        moment_id=moment_id,
        character_id=body.character_id,
        group_id=body.group_id,
        notes=body.notes,
    )
    prepare_new_attachment(
        db, production, user, exit_row, body.status, legacy_resource="timeline",
    )
    db.add(exit_row)
    db.commit()
    exit_row = (
        db.query(MomentExit)
        .options(*_exit_load_options())
        .filter(MomentExit.id == exit_row.id)
        .one()
    )
    return _exit_response(db, exit_row)


@router.delete(
    "/{production_id}/moments/{moment_id}/exits/{exit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_exit(
    production_id: int,
    moment_id: int,
    exit_id: int,
    user: User = Depends(_TIMELINE_REMOVE),
    db: Session = Depends(get_db),
) -> None:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    exit_row = (
        db.query(MomentExit)
        .filter(MomentExit.id == exit_id, MomentExit.moment_id == moment_id)
        .first()
    )
    if exit_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exit attachment not found",
        )
    assert_can_delete_attachment(
        db, user, production, exit_row, legacy_resource="timeline",
    )
    db.delete(exit_row)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/blocking",
    response_model=list[MomentBlockingResponse],
)
def list_moment_blocking(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_production_capability("timeline", "read")),
    db: Session = Depends(get_db),
) -> list[MomentBlockingResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    blocking_rows = (
        db.query(MomentBlocking)
        .options(*_blocking_load_options())
        .filter(MomentBlocking.moment_id == moment_id)
        .order_by(MomentBlocking.id)
        .all()
    )
    return [_blocking_response(db, row) for row in blocking_rows]


@router.post(
    "/{production_id}/moments/{moment_id}/blocking",
    response_model=MomentBlockingResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_blocking(
    production_id: int,
    moment_id: int,
    body: MomentBlockingCreate,
    user: User = Depends(_TIMELINE_ATTACH),
    db: Session = Depends(get_db),
) -> MomentBlockingResponse:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    validate_blocking_subject(
        db,
        production_id,
        body.character_id,
        body.user_id,
        body.group_id,
    )

    existing_query = db.query(MomentBlocking).filter(MomentBlocking.moment_id == moment_id)
    if body.character_id is not None:
        existing_query = existing_query.filter(
            MomentBlocking.character_id == body.character_id,
        )
        conflict_detail = "This character already has blocking on this moment"
    elif body.user_id is not None:
        existing_query = existing_query.filter(MomentBlocking.user_id == body.user_id)
        conflict_detail = "This user already has blocking on this moment"
    else:
        existing_query = existing_query.filter(MomentBlocking.group_id == body.group_id)
        conflict_detail = "This group already has blocking on this moment"

    if existing_query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=conflict_detail,
        )

    blocking = MomentBlocking(
        moment_id=moment_id,
        character_id=body.character_id,
        user_id=body.user_id,
        group_id=body.group_id,
        notes=body.notes.strip(),
    )
    prepare_new_attachment(
        db, production, user, blocking, body.status, legacy_resource="timeline",
    )
    db.add(blocking)
    db.commit()
    blocking = (
        db.query(MomentBlocking)
        .options(*_blocking_load_options())
        .filter(MomentBlocking.id == blocking.id)
        .one()
    )
    return _blocking_response(db, blocking)


@router.patch(
    "/{production_id}/moments/{moment_id}/blocking/{blocking_id}",
    response_model=MomentBlockingResponse,
)
def update_moment_blocking(
    production_id: int,
    moment_id: int,
    blocking_id: int,
    body: MomentBlockingUpdate,
    user: User = Depends(require_production_capability("timeline", "update")),
    db: Session = Depends(get_db),
) -> MomentBlockingResponse:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    blocking = (
        db.query(MomentBlocking)
        .options(*_blocking_load_options())
        .filter(MomentBlocking.id == blocking_id, MomentBlocking.moment_id == moment_id)
        .first()
    )
    if blocking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blocking attachment not found",
        )
    blocking.notes = body.notes.strip()
    db.commit()
    blocking = (
        db.query(MomentBlocking)
        .options(*_blocking_load_options())
        .filter(MomentBlocking.id == blocking_id)
        .one()
    )
    return _blocking_response(db, blocking)


@router.delete(
    "/{production_id}/moments/{moment_id}/blocking/{blocking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_blocking(
    production_id: int,
    moment_id: int,
    blocking_id: int,
    user: User = Depends(_TIMELINE_REMOVE),
    db: Session = Depends(get_db),
) -> None:
    production = get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    blocking = (
        db.query(MomentBlocking)
        .filter(MomentBlocking.id == blocking_id, MomentBlocking.moment_id == moment_id)
        .first()
    )
    if blocking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blocking attachment not found",
        )
    assert_can_delete_attachment(
        db, user, production, blocking, legacy_resource="timeline",
    )
    db.delete(blocking)
    db.commit()
