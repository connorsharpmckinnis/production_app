from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_accessible_production
from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import (
    Act,
    Character,
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

router = APIRouter(prefix="/productions", tags=["stage-movements"])


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


def _entrance_response(entrance: MomentEntrance) -> MomentEntranceResponse:
    return MomentEntranceResponse(
        id=entrance.id,
        character_id=entrance.character_id,
        character_name=entrance.character.name,
        notes=entrance.notes,
    )


def _exit_response(exit_row: MomentExit) -> MomentExitResponse:
    return MomentExitResponse(
        id=exit_row.id,
        character_id=exit_row.character_id,
        character_name=exit_row.character.name,
        notes=exit_row.notes,
    )


def _blocking_response(blocking: MomentBlocking) -> MomentBlockingResponse:
    return MomentBlockingResponse(
        id=blocking.id,
        character_id=blocking.character_id,
        character_name=blocking.character.name,
        notes=blocking.notes,
    )


@router.get(
    "/{production_id}/moments/{moment_id}/entrances",
    response_model=list[MomentEntranceResponse],
)
def list_moment_entrances(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentEntranceResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    entrances = (
        db.query(MomentEntrance)
        .options(joinedload(MomentEntrance.character))
        .filter(MomentEntrance.moment_id == moment_id)
        .order_by(MomentEntrance.id)
        .all()
    )
    return [_entrance_response(entrance) for entrance in entrances]


@router.post(
    "/{production_id}/moments/{moment_id}/entrances",
    response_model=MomentEntranceResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_entrance(
    production_id: int,
    moment_id: int,
    body: MomentEntranceCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentEntranceResponse:
    get_accessible_production(db, director, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_character_in_production(db, production_id, body.character_id)

    existing = (
        db.query(MomentEntrance)
        .filter(
            MomentEntrance.moment_id == moment_id,
            MomentEntrance.character_id == body.character_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This character already has an entrance on this moment",
        )

    entrance = MomentEntrance(
        moment_id=moment_id,
        character_id=body.character_id,
        notes=body.notes,
    )
    db.add(entrance)
    db.commit()
    entrance = (
        db.query(MomentEntrance)
        .options(joinedload(MomentEntrance.character))
        .filter(MomentEntrance.id == entrance.id)
        .one()
    )
    return _entrance_response(entrance)


@router.delete(
    "/{production_id}/moments/{moment_id}/entrances/{entrance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_entrance(
    production_id: int,
    moment_id: int,
    entrance_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, director, production_id)
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
    db.delete(entrance)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/exits",
    response_model=list[MomentExitResponse],
)
def list_moment_exits(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentExitResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    exits = (
        db.query(MomentExit)
        .options(joinedload(MomentExit.character))
        .filter(MomentExit.moment_id == moment_id)
        .order_by(MomentExit.id)
        .all()
    )
    return [_exit_response(exit_row) for exit_row in exits]


@router.post(
    "/{production_id}/moments/{moment_id}/exits",
    response_model=MomentExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_exit(
    production_id: int,
    moment_id: int,
    body: MomentExitCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentExitResponse:
    get_accessible_production(db, director, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_character_in_production(db, production_id, body.character_id)

    existing = (
        db.query(MomentExit)
        .filter(
            MomentExit.moment_id == moment_id,
            MomentExit.character_id == body.character_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This character already has an exit on this moment",
        )

    exit_row = MomentExit(
        moment_id=moment_id,
        character_id=body.character_id,
        notes=body.notes,
    )
    db.add(exit_row)
    db.commit()
    exit_row = (
        db.query(MomentExit)
        .options(joinedload(MomentExit.character))
        .filter(MomentExit.id == exit_row.id)
        .one()
    )
    return _exit_response(exit_row)


@router.delete(
    "/{production_id}/moments/{moment_id}/exits/{exit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_exit(
    production_id: int,
    moment_id: int,
    exit_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, director, production_id)
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
    db.delete(exit_row)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/blocking",
    response_model=list[MomentBlockingResponse],
)
def list_moment_blocking(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentBlockingResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    blocking_rows = (
        db.query(MomentBlocking)
        .options(joinedload(MomentBlocking.character))
        .filter(MomentBlocking.moment_id == moment_id)
        .order_by(MomentBlocking.id)
        .all()
    )
    return [_blocking_response(row) for row in blocking_rows]


@router.post(
    "/{production_id}/moments/{moment_id}/blocking",
    response_model=MomentBlockingResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_blocking(
    production_id: int,
    moment_id: int,
    body: MomentBlockingCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentBlockingResponse:
    get_accessible_production(db, director, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_character_in_production(db, production_id, body.character_id)

    existing = (
        db.query(MomentBlocking)
        .filter(
            MomentBlocking.moment_id == moment_id,
            MomentBlocking.character_id == body.character_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This character already has blocking on this moment",
        )

    blocking = MomentBlocking(
        moment_id=moment_id,
        character_id=body.character_id,
        notes=body.notes.strip(),
    )
    db.add(blocking)
    db.commit()
    blocking = (
        db.query(MomentBlocking)
        .options(joinedload(MomentBlocking.character))
        .filter(MomentBlocking.id == blocking.id)
        .one()
    )
    return _blocking_response(blocking)


@router.patch(
    "/{production_id}/moments/{moment_id}/blocking/{blocking_id}",
    response_model=MomentBlockingResponse,
)
def update_moment_blocking(
    production_id: int,
    moment_id: int,
    blocking_id: int,
    body: MomentBlockingUpdate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentBlockingResponse:
    get_accessible_production(db, director, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    blocking = (
        db.query(MomentBlocking)
        .options(joinedload(MomentBlocking.character))
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
    db.refresh(blocking)
    return _blocking_response(blocking)


@router.delete(
    "/{production_id}/moments/{moment_id}/blocking/{blocking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_blocking(
    production_id: int,
    moment_id: int,
    blocking_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, director, production_id)
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
    db.delete(blocking)
    db.commit()
