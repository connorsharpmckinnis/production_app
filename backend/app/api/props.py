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
from app.models import Act, Moment, MomentPropEvent, Prop, Scene, User
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.props import (
    MomentPropEventCreate,
    MomentPropEventResponse,
    MomentPropEventUpdate,
    PropCreate,
    PropResponse,
    PropUpdate,
)
from app.services.catalog_csv import CatalogCsvError, PROPS_COLUMNS, import_props_csv

router = APIRouter(prefix="/productions", tags=["props"])


def _get_prop_or_404(db: Session, production_id: int, prop_id: int) -> Prop:
    prop = (
        db.query(Prop)
        .filter(Prop.id == prop_id, Prop.production_id == production_id)
        .first()
    )
    if prop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prop not found")
    return prop


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


def _moment_prop_event_response(event: MomentPropEvent) -> MomentPropEventResponse:
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
    )


@router.get("/{production_id}/props", response_model=list[PropResponse])
def list_props(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[PropResponse]:
    get_accessible_production(db, user, production_id)
    props = (
        db.query(Prop)
        .filter(Prop.production_id == production_id)
        .order_by(Prop.name)
        .all()
    )
    return [
        PropResponse(
            id=prop.id,
            name=prop.name,
            description=prop.description,
            notes=prop.notes,
        )
        for prop in props
    ]


@router.post(
    "/{production_id}/props",
    response_model=PropResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_prop(
    production_id: int,
    body: PropCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> PropResponse:
    get_accessible_production(db, director, production_id)
    prop = Prop(
        production_id=production_id,
        name=body.name.strip(),
        description=body.description,
        notes=body.notes,
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return PropResponse(
        id=prop.id,
        name=prop.name,
        description=prop.description,
        notes=prop.notes,
    )


@router.patch("/{production_id}/props/{prop_id}", response_model=PropResponse)
def update_prop(
    production_id: int,
    prop_id: int,
    body: PropUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> PropResponse:
    prop = _get_prop_or_404(db, production_id, prop_id)

    if body.name is not None:
        prop.name = body.name.strip()
    if body.description is not None:
        prop.description = body.description
    if body.notes is not None:
        prop.notes = body.notes

    db.commit()
    db.refresh(prop)
    return PropResponse(
        id=prop.id,
        name=prop.name,
        description=prop.description,
        notes=prop.notes,
    )


@router.delete("/{production_id}/props/{prop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prop(
    production_id: int,
    prop_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    prop = _get_prop_or_404(db, production_id, prop_id)
    db.delete(prop)
    db.commit()


@router.get("/{production_id}/props/import/template")
def download_props_csv_template(
    production_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> Response:
    get_accessible_production(db, director, production_id)
    return catalog_template_response("props_template.csv", PROPS_COLUMNS)


@router.post(
    "/{production_id}/props/import",
    response_model=CatalogImportResult,
)
async def import_props(
    production_id: int,
    file: UploadFile = File(...),
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CatalogImportResult:
    get_accessible_production(db, director, production_id)
    content = await read_catalog_upload(file)
    try:
        return import_props_csv(db, production_id, content)
    except CatalogCsvError as exc:
        raise catalog_csv_error_http(exc) from exc


@router.get(
    "/{production_id}/moments/{moment_id}/props",
    response_model=list[MomentPropEventResponse],
)
def list_moment_prop_events(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentPropEventResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    events = (
        db.query(MomentPropEvent)
        .options(
            joinedload(MomentPropEvent.prop),
            joinedload(MomentPropEvent.character),
            joinedload(MomentPropEvent.user),
        )
        .filter(MomentPropEvent.moment_id == moment_id)
        .order_by(MomentPropEvent.id)
        .all()
    )
    return [_moment_prop_event_response(event) for event in events]


@router.post(
    "/{production_id}/moments/{moment_id}/props",
    response_model=MomentPropEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_moment_prop_event(
    production_id: int,
    moment_id: int,
    body: MomentPropEventCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentPropEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_prop_or_404(db, production_id, body.prop_id)
    validate_optional_person(db, production_id, body.character_id, body.user_id)

    existing = (
        db.query(MomentPropEvent)
        .filter(MomentPropEvent.moment_id == moment_id, MomentPropEvent.prop_id == body.prop_id)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This prop already has an event on this moment",
        )

    event = MomentPropEvent(
        moment_id=moment_id,
        prop_id=body.prop_id,
        kind=body.kind,
        character_id=body.character_id,
        user_id=body.user_id,
        notes=body.notes,
    )
    db.add(event)
    db.commit()
    event = (
        db.query(MomentPropEvent)
        .options(
            joinedload(MomentPropEvent.prop),
            joinedload(MomentPropEvent.character),
            joinedload(MomentPropEvent.user),
        )
        .filter(MomentPropEvent.id == event.id)
        .one()
    )
    return _moment_prop_event_response(event)


@router.patch(
    "/{production_id}/moments/{moment_id}/props/{moment_prop_event_id}",
    response_model=MomentPropEventResponse,
)
def update_moment_prop_event(
    production_id: int,
    moment_id: int,
    moment_prop_event_id: int,
    body: MomentPropEventUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentPropEventResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentPropEvent)
        .filter(
            MomentPropEvent.id == moment_prop_event_id,
            MomentPropEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop event not found",
        )
    validate_optional_person(db, production_id, body.character_id, body.user_id)

    event.kind = body.kind
    event.character_id = body.character_id
    event.user_id = body.user_id
    event.notes = body.notes

    db.commit()
    event = (
        db.query(MomentPropEvent)
        .options(
            joinedload(MomentPropEvent.prop),
            joinedload(MomentPropEvent.character),
            joinedload(MomentPropEvent.user),
        )
        .filter(MomentPropEvent.id == event.id)
        .one()
    )
    return _moment_prop_event_response(event)


@router.delete(
    "/{production_id}/moments/{moment_id}/props/{moment_prop_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_moment_prop_event(
    production_id: int,
    moment_id: int,
    moment_prop_event_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    event = (
        db.query(MomentPropEvent)
        .filter(
            MomentPropEvent.id == moment_prop_event_id,
            MomentPropEvent.moment_id == moment_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop event not found",
        )
    db.delete(event)
    db.commit()
