from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.catalog_csv_routes import (
    catalog_csv_error_http,
    catalog_template_response,
    read_catalog_upload,
)
from app.api.deps import get_accessible_production, user_display_name, validate_optional_person
from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Moment, MomentSetPieceEvent, Scene, SetPiece, User
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.set_pieces import (
    MomentSetPieceEventCreate,
    MomentSetPieceEventResponse,
    MomentSetPieceEventUpdate,
    SetPieceCreate,
    SetPieceResponse,
    SetPieceUpdate,
)
from app.services.catalog_csv import CatalogCsvError, SET_PIECES_COLUMNS, import_set_pieces_csv

router = APIRouter(prefix="/productions", tags=["set-pieces"])


def _get_set_piece_or_404(db: Session, production_id: int, set_piece_id: int) -> SetPiece:
    set_piece = (
        db.query(SetPiece)
        .filter(SetPiece.id == set_piece_id, SetPiece.production_id == production_id)
        .first()
    )
    if set_piece is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Set piece not found")
    return set_piece


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


def _moment_set_piece_event_response(event: MomentSetPieceEvent) -> MomentSetPieceEventResponse:
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
    )


@router.get("/{production_id}/set-pieces", response_model=list[SetPieceResponse])
def list_set_pieces(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[SetPieceResponse]:
    get_accessible_production(db, user, production_id)
    set_pieces = (
        db.query(SetPiece)
        .filter(SetPiece.production_id == production_id)
        .order_by(SetPiece.name)
        .all()
    )
    return [
        SetPieceResponse(
            id=set_piece.id,
            name=set_piece.name,
            mobile=set_piece.mobile,
            description=set_piece.description,
        )
        for set_piece in set_pieces
    ]


@router.post(
    "/{production_id}/set-pieces",
    response_model=SetPieceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_set_piece(
    production_id: int,
    body: SetPieceCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> SetPieceResponse:
    get_accessible_production(db, director, production_id)
    set_piece = SetPiece(
        production_id=production_id,
        name=body.name.strip(),
        mobile=body.mobile,
        description=body.description,
    )
    db.add(set_piece)
    db.commit()
    db.refresh(set_piece)
    return SetPieceResponse(
        id=set_piece.id,
        name=set_piece.name,
        mobile=set_piece.mobile,
        description=set_piece.description,
    )


@router.patch(
    "/{production_id}/set-pieces/{set_piece_id}",
    response_model=SetPieceResponse,
)
def update_set_piece(
    production_id: int,
    set_piece_id: int,
    body: SetPieceUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> SetPieceResponse:
    set_piece = _get_set_piece_or_404(db, production_id, set_piece_id)
    if body.name is not None:
        set_piece.name = body.name.strip()
    if body.mobile is not None:
        set_piece.mobile = body.mobile
    if body.description is not None:
        set_piece.description = body.description
    db.commit()
    db.refresh(set_piece)
    return SetPieceResponse(
        id=set_piece.id,
        name=set_piece.name,
        mobile=set_piece.mobile,
        description=set_piece.description,
    )


@router.delete(
    "/{production_id}/set-pieces/{set_piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_set_piece(
    production_id: int,
    set_piece_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    set_piece = _get_set_piece_or_404(db, production_id, set_piece_id)
    db.delete(set_piece)
    db.commit()


@router.get("/{production_id}/set-pieces/import/template")
def download_set_pieces_csv_template(
    production_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> Response:
    get_accessible_production(db, director, production_id)
    return catalog_template_response("set_pieces_template.csv", SET_PIECES_COLUMNS)


@router.post(
    "/{production_id}/set-pieces/import",
    response_model=CatalogImportResult,
)
async def import_set_pieces(
    production_id: int,
    file: UploadFile = File(...),
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CatalogImportResult:
    get_accessible_production(db, director, production_id)
    content = await read_catalog_upload(file)
    try:
        return import_set_pieces_csv(db, production_id, content)
    except CatalogCsvError as exc:
        raise catalog_csv_error_http(exc) from exc


@router.get(
    "/{production_id}/moments/{moment_id}/set-pieces",
    response_model=list[MomentSetPieceEventResponse],
)
def list_moment_set_piece_events(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentSetPieceEventResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    events = (
        db.query(MomentSetPieceEvent)
        .options(
            joinedload(MomentSetPieceEvent.set_piece),
            joinedload(MomentSetPieceEvent.character),
            joinedload(MomentSetPieceEvent.user),
        )
        .filter(MomentSetPieceEvent.moment_id == moment_id)
        .order_by(MomentSetPieceEvent.id)
        .all()
    )
    return [_moment_set_piece_event_response(event) for event in events]


@router.post(
    "/{production_id}/moments/{moment_id}/set-pieces",
    response_model=MomentSetPieceEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_moment_set_piece_event(
    production_id: int,
    moment_id: int,
    body: MomentSetPieceEventCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentSetPieceEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_set_piece_or_404(db, production_id, body.set_piece_id)
    validate_optional_person(db, production_id, body.character_id, body.user_id)

    existing = (
        db.query(MomentSetPieceEvent)
        .filter(
            MomentSetPieceEvent.moment_id == moment_id,
            MomentSetPieceEvent.set_piece_id == body.set_piece_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This set piece already has an event on this moment",
        )

    event = MomentSetPieceEvent(
        moment_id=moment_id,
        set_piece_id=body.set_piece_id,
        kind=body.kind,
        character_id=body.character_id,
        user_id=body.user_id,
        notes=body.notes,
    )
    db.add(event)
    db.commit()
    event = (
        db.query(MomentSetPieceEvent)
        .options(
            joinedload(MomentSetPieceEvent.set_piece),
            joinedload(MomentSetPieceEvent.character),
            joinedload(MomentSetPieceEvent.user),
        )
        .filter(MomentSetPieceEvent.id == event.id)
        .one()
    )
    return _moment_set_piece_event_response(event)


@router.patch(
    "/{production_id}/moments/{moment_id}/set-pieces/{moment_set_piece_event_id}",
    response_model=MomentSetPieceEventResponse,
)
def update_moment_set_piece_event(
    production_id: int,
    moment_id: int,
    moment_set_piece_event_id: int,
    body: MomentSetPieceEventUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentSetPieceEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentSetPieceEvent)
        .filter(
            MomentSetPieceEvent.id == moment_set_piece_event_id,
            MomentSetPieceEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Set piece event not found",
        )
    validate_optional_person(db, production_id, body.character_id, body.user_id)

    event.kind = body.kind
    event.character_id = body.character_id
    event.user_id = body.user_id
    event.notes = body.notes

    db.commit()
    event = (
        db.query(MomentSetPieceEvent)
        .options(
            joinedload(MomentSetPieceEvent.set_piece),
            joinedload(MomentSetPieceEvent.character),
            joinedload(MomentSetPieceEvent.user),
        )
        .filter(MomentSetPieceEvent.id == event.id)
        .one()
    )
    return _moment_set_piece_event_response(event)


@router.delete(
    "/{production_id}/moments/{moment_id}/set-pieces/{moment_set_piece_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_moment_set_piece_event(
    production_id: int,
    moment_id: int,
    moment_set_piece_event_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentSetPieceEvent)
        .filter(
            MomentSetPieceEvent.id == moment_set_piece_event_id,
            MomentSetPieceEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Set piece event not found",
        )
    db.delete(event)
    db.commit()
