from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.catalog_csv_routes import (
    catalog_csv_error_http,
    catalog_template_response,
    read_catalog_upload,
)
from app.api.deps import get_accessible_production
from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Character, Moment, MomentProp, Prop, Scene, User
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.props import MomentPropCreate, MomentPropResponse, PropCreate, PropResponse, PropUpdate
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
    response_model=list[MomentPropResponse],
)
def list_moment_props(
    production_id: int,
    moment_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentPropResponse]:
    get_accessible_production(db, user, production_id)
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_props = (
        db.query(MomentProp)
        .options(
            joinedload(MomentProp.prop),
            joinedload(MomentProp.character),
        )
        .filter(MomentProp.moment_id == moment_id)
        .order_by(MomentProp.id)
        .all()
    )
    return [_moment_prop_response(moment_prop) for moment_prop in moment_props]


@router.post(
    "/{production_id}/moments/{moment_id}/props",
    response_model=MomentPropResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_prop(
    production_id: int,
    moment_id: int,
    body: MomentPropCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentPropResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_prop_or_404(db, production_id, body.prop_id)

    if body.character_id is not None:
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

    existing = (
        db.query(MomentProp)
        .filter(MomentProp.moment_id == moment_id, MomentProp.prop_id == body.prop_id)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This prop is already attached to the moment",
        )

    moment_prop = MomentProp(
        moment_id=moment_id,
        prop_id=body.prop_id,
        character_id=body.character_id,
        notes=body.notes,
    )
    db.add(moment_prop)
    db.commit()
    moment_prop = (
        db.query(MomentProp)
        .options(
            joinedload(MomentProp.prop),
            joinedload(MomentProp.character),
        )
        .filter(MomentProp.id == moment_prop.id)
        .one()
    )
    return _moment_prop_response(moment_prop)


@router.delete(
    "/{production_id}/moments/{moment_id}/props/{moment_prop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_prop(
    production_id: int,
    moment_id: int,
    moment_prop_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_prop = (
        db.query(MomentProp)
        .filter(MomentProp.id == moment_prop_id, MomentProp.moment_id == moment_id)
        .first()
    )
    if moment_prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop attachment not found",
        )
    db.delete(moment_prop)
    db.commit()
