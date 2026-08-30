from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.catalog_csv_routes import (
    catalog_csv_error_http,
    catalog_template_response,
    read_catalog_upload,
)
from app.api.deps import get_accessible_production, require_production_capability
from app.db.session import get_db
from app.models import Act, Character, Costume, Moment, MomentCostumeEvent, Scene, User
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.costumes import (
    CostumeCreate,
    CostumeResponse,
    CostumeUpdate,
    MomentCostumeEventCreate,
    MomentCostumeEventResponse,
    MomentCostumeEventUpdate,
)
from app.services.catalog_csv import CatalogCsvError, COSTUMES_COLUMNS, import_costumes_csv

router = APIRouter(prefix="/productions", tags=["costumes"])


def _get_costume_or_404(db: Session, production_id: int, costume_id: int) -> Costume:
    costume = (
        db.query(Costume)
        .options(joinedload(Costume.character))
        .filter(Costume.id == costume_id, Costume.production_id == production_id)
        .first()
    )
    if costume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Costume not found")
    return costume


def _validate_character_in_production(
    db: Session, production_id: int, character_id: int
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


def _costume_response(costume: Costume) -> CostumeResponse:
    return CostumeResponse(
        id=costume.id,
        character_id=costume.character_id,
        character_name=costume.character.name,
        name=costume.name,
        description=costume.description,
    )


def _moment_costume_event_response(event: MomentCostumeEvent) -> MomentCostumeEventResponse:
    return MomentCostumeEventResponse(
        id=event.id,
        character_id=event.character_id,
        character_name=event.character.name,
        kind=event.kind,
        costume_id=event.costume_id,
        costume_name=event.costume.name if event.costume else None,
        notes=event.notes,
    )


@router.get("/{production_id}/costumes", response_model=list[CostumeResponse])
def list_costumes(
    production_id: int,
    user: User = Depends(require_production_capability("costumes", "read")),
    db: Session = Depends(get_db),
) -> list[CostumeResponse]:
    get_accessible_production(db, user, production_id)
    costumes = (
        db.query(Costume)
        .options(joinedload(Costume.character))
        .filter(Costume.production_id == production_id)
        .order_by(Costume.character_id, Costume.name)
        .all()
    )
    return [_costume_response(costume) for costume in costumes]


@router.post(
    "/{production_id}/costumes",
    response_model=CostumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_costume(
    production_id: int,
    body: CostumeCreate,
    user: User = Depends(require_production_capability("costumes", "create")),
    db: Session = Depends(get_db),
) -> CostumeResponse:
    get_accessible_production(db, user, production_id)
    _validate_character_in_production(db, production_id, body.character_id)

    costume = Costume(
        production_id=production_id,
        character_id=body.character_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(costume)
    db.commit()
    costume = _get_costume_or_404(db, production_id, costume.id)
    return _costume_response(costume)


@router.patch("/{production_id}/costumes/{costume_id}", response_model=CostumeResponse)
def update_costume(
    production_id: int,
    costume_id: int,
    body: CostumeUpdate,
    _user: User = Depends(require_production_capability("costumes", "update")),
    db: Session = Depends(get_db),
) -> CostumeResponse:
    costume = _get_costume_or_404(db, production_id, costume_id)

    if body.character_id is not None:
        _validate_character_in_production(db, production_id, body.character_id)
        costume.character_id = body.character_id
    if body.name is not None:
        costume.name = body.name.strip()
    if body.description is not None:
        costume.description = body.description

    db.commit()
    costume = _get_costume_or_404(db, production_id, costume_id)
    return _costume_response(costume)


@router.delete(
    "/{production_id}/costumes/{costume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_costume(
    production_id: int,
    costume_id: int,
    _user: User = Depends(require_production_capability("costumes", "delete")),
    db: Session = Depends(get_db),
) -> None:
    costume = _get_costume_or_404(db, production_id, costume_id)
    db.delete(costume)
    db.commit()


@router.get("/{production_id}/costumes/import/template")
def download_costumes_csv_template(
    production_id: int,
    user: User = Depends(require_production_capability("costumes", "read")),
    db: Session = Depends(get_db),
) -> Response:
    get_accessible_production(db, user, production_id)
    return catalog_template_response("costumes_template.csv", COSTUMES_COLUMNS)


@router.post(
    "/{production_id}/costumes/import",
    response_model=CatalogImportResult,
)
async def import_costumes(
    production_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_production_capability("costumes", "create")),
    db: Session = Depends(get_db),
) -> CatalogImportResult:
    get_accessible_production(db, user, production_id)
    content = await read_catalog_upload(file)
    try:
        return import_costumes_csv(db, production_id, content)
    except CatalogCsvError as exc:
        raise catalog_csv_error_http(exc) from exc


@router.get(
    "/{production_id}/moments/{moment_id}/costumes",
    response_model=list[MomentCostumeEventResponse],
)
def list_moment_costume_events(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_production_capability("costumes", "read")),
    db: Session = Depends(get_db),
) -> list[MomentCostumeEventResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    events = (
        db.query(MomentCostumeEvent)
        .options(
            joinedload(MomentCostumeEvent.character),
            joinedload(MomentCostumeEvent.costume),
        )
        .filter(MomentCostumeEvent.moment_id == moment_id)
        .order_by(MomentCostumeEvent.id)
        .all()
    )
    return [_moment_costume_event_response(event) for event in events]


@router.post(
    "/{production_id}/moments/{moment_id}/costumes",
    response_model=MomentCostumeEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_moment_costume_event(
    production_id: int,
    moment_id: int,
    body: MomentCostumeEventCreate,
    _user: User = Depends(require_production_capability("costumes", "create")),
    db: Session = Depends(get_db),
) -> MomentCostumeEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _validate_character_in_production(db, production_id, body.character_id)
    if body.costume_id is not None:
        _get_costume_or_404(db, production_id, body.costume_id)

    existing = (
        db.query(MomentCostumeEvent)
        .filter(
            MomentCostumeEvent.moment_id == moment_id,
            MomentCostumeEvent.character_id == body.character_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This character already has a costume event on this moment",
        )

    event = MomentCostumeEvent(
        moment_id=moment_id,
        character_id=body.character_id,
        kind=body.kind,
        costume_id=body.costume_id,
        notes=body.notes,
    )
    db.add(event)
    db.commit()
    event = (
        db.query(MomentCostumeEvent)
        .options(
            joinedload(MomentCostumeEvent.character),
            joinedload(MomentCostumeEvent.costume),
        )
        .filter(MomentCostumeEvent.id == event.id)
        .one()
    )
    return _moment_costume_event_response(event)


@router.patch(
    "/{production_id}/moments/{moment_id}/costumes/{moment_costume_event_id}",
    response_model=MomentCostumeEventResponse,
)
def update_moment_costume_event(
    production_id: int,
    moment_id: int,
    moment_costume_event_id: int,
    body: MomentCostumeEventUpdate,
    _user: User = Depends(require_production_capability("costumes", "update")),
    db: Session = Depends(get_db),
) -> MomentCostumeEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentCostumeEvent)
        .filter(
            MomentCostumeEvent.id == moment_costume_event_id,
            MomentCostumeEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costume event not found",
        )
    if body.costume_id is not None:
        _get_costume_or_404(db, production_id, body.costume_id)

    event.kind = body.kind
    event.costume_id = body.costume_id
    event.notes = body.notes

    db.commit()
    event = (
        db.query(MomentCostumeEvent)
        .options(
            joinedload(MomentCostumeEvent.character),
            joinedload(MomentCostumeEvent.costume),
        )
        .filter(MomentCostumeEvent.id == event.id)
        .one()
    )
    return _moment_costume_event_response(event)


@router.delete(
    "/{production_id}/moments/{moment_id}/costumes/{moment_costume_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_moment_costume_event(
    production_id: int,
    moment_id: int,
    moment_costume_event_id: int,
    _user: User = Depends(require_production_capability("costumes", "delete")),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentCostumeEvent)
        .filter(
            MomentCostumeEvent.id == moment_costume_event_id,
            MomentCostumeEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costume event not found",
        )
    db.delete(event)
    db.commit()
