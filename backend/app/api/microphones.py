from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.catalog_csv_routes import (
    catalog_csv_error_http,
    catalog_template_response,
    read_catalog_upload,
)
from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Character, Microphone, Moment, MomentMicrophone, Production, Scene, User
from app.schemas.catalog_csv import CatalogImportResult
from app.schemas.microphones import (
    MicrophoneCreate,
    MicrophoneResponse,
    MicrophoneUpdate,
    MomentMicrophoneCreate,
    MomentMicrophoneResponse,
)
from app.services.catalog_csv import (
    CatalogCsvError,
    MICROPHONES_COLUMNS,
    import_microphones_csv,
)

router = APIRouter(prefix="/productions", tags=["microphones"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _get_microphone_or_404(db: Session, production_id: int, microphone_id: int) -> Microphone:
    microphone = (
        db.query(Microphone)
        .filter(Microphone.id == microphone_id, Microphone.production_id == production_id)
        .first()
    )
    if microphone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Microphone not found")
    return microphone


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


def _moment_microphone_response(moment_microphone: MomentMicrophone) -> MomentMicrophoneResponse:
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


def _microphone_response(microphone: Microphone) -> MicrophoneResponse:
    return MicrophoneResponse(
        id=microphone.id,
        identifier=microphone.identifier,
        notes=microphone.notes,
    )


@router.get("/{production_id}/microphones", response_model=list[MicrophoneResponse])
def list_microphones(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MicrophoneResponse]:
    _get_production_or_404(db, production_id)
    microphones = (
        db.query(Microphone)
        .filter(Microphone.production_id == production_id)
        .order_by(Microphone.identifier)
        .all()
    )
    return [_microphone_response(microphone) for microphone in microphones]


@router.post(
    "/{production_id}/microphones",
    response_model=MicrophoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_microphone(
    production_id: int,
    body: MicrophoneCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MicrophoneResponse:
    _get_production_or_404(db, production_id)
    microphone = Microphone(
        production_id=production_id,
        identifier=body.identifier.strip(),
        notes=body.notes,
    )
    db.add(microphone)
    db.commit()
    db.refresh(microphone)
    return _microphone_response(microphone)


@router.patch(
    "/{production_id}/microphones/{microphone_id}",
    response_model=MicrophoneResponse,
)
def update_microphone(
    production_id: int,
    microphone_id: int,
    body: MicrophoneUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MicrophoneResponse:
    microphone = _get_microphone_or_404(db, production_id, microphone_id)
    if body.identifier is not None:
        microphone.identifier = body.identifier.strip()
    if body.notes is not None:
        microphone.notes = body.notes
    db.commit()
    db.refresh(microphone)
    return _microphone_response(microphone)


@router.delete(
    "/{production_id}/microphones/{microphone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_microphone(
    production_id: int,
    microphone_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    microphone = _get_microphone_or_404(db, production_id, microphone_id)
    db.delete(microphone)
    db.commit()


@router.get("/{production_id}/microphones/import/template")
def download_microphones_csv_template(
    production_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> Response:
    _get_production_or_404(db, production_id)
    return catalog_template_response("microphones_template.csv", MICROPHONES_COLUMNS)


@router.post(
    "/{production_id}/microphones/import",
    response_model=CatalogImportResult,
)
async def import_microphones(
    production_id: int,
    file: UploadFile = File(...),
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CatalogImportResult:
    _get_production_or_404(db, production_id)
    content = await read_catalog_upload(file)
    try:
        return import_microphones_csv(db, production_id, content)
    except CatalogCsvError as exc:
        raise catalog_csv_error_http(exc) from exc


@router.get(
    "/{production_id}/moments/{moment_id}/microphones",
    response_model=list[MomentMicrophoneResponse],
)
def list_moment_microphones(
    production_id: int,
    moment_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MomentMicrophoneResponse]:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_microphones = (
        db.query(MomentMicrophone)
        .options(
            joinedload(MomentMicrophone.microphone),
            joinedload(MomentMicrophone.character),
        )
        .filter(MomentMicrophone.moment_id == moment_id)
        .order_by(MomentMicrophone.id)
        .all()
    )
    return [_moment_microphone_response(item) for item in moment_microphones]


@router.post(
    "/{production_id}/moments/{moment_id}/microphones",
    response_model=MomentMicrophoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_moment_microphone(
    production_id: int,
    moment_id: int,
    body: MomentMicrophoneCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> MomentMicrophoneResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_microphone_or_404(db, production_id, body.microphone_id)

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
        db.query(MomentMicrophone)
        .filter(
            MomentMicrophone.moment_id == moment_id,
            MomentMicrophone.microphone_id == body.microphone_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This microphone is already attached to the moment",
        )

    moment_microphone = MomentMicrophone(
        moment_id=moment_id,
        microphone_id=body.microphone_id,
        character_id=body.character_id,
        notes=body.notes,
    )
    db.add(moment_microphone)
    db.commit()
    moment_microphone = (
        db.query(MomentMicrophone)
        .options(
            joinedload(MomentMicrophone.microphone),
            joinedload(MomentMicrophone.character),
        )
        .filter(MomentMicrophone.id == moment_microphone.id)
        .one()
    )
    return _moment_microphone_response(moment_microphone)


@router.delete(
    "/{production_id}/moments/{moment_id}/microphones/{moment_microphone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_moment_microphone(
    production_id: int,
    moment_id: int,
    moment_microphone_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    moment_microphone = (
        db.query(MomentMicrophone)
        .filter(
            MomentMicrophone.id == moment_microphone_id,
            MomentMicrophone.moment_id == moment_id,
        )
        .first()
    )
    if moment_microphone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Microphone attachment not found",
        )
    db.delete(moment_microphone)
    db.commit()
