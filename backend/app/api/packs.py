from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production, require_production_capability
from app.db.session import get_db
from app.models import Pack, User
from app.schemas.packs import PackCreate, PackResponse, PackUpdate

router = APIRouter(prefix="/productions", tags=["packs"])


def _get_pack_or_404(db: Session, production_id: int, pack_id: int) -> Pack:
    pack = (
        db.query(Pack)
        .filter(Pack.id == pack_id, Pack.production_id == production_id)
        .first()
    )
    if pack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    return pack


def _pack_response(pack: Pack) -> PackResponse:
    return PackResponse(id=pack.id, identifier=pack.identifier, notes=pack.notes)


@router.get("/{production_id}/packs", response_model=list[PackResponse])
def list_packs(
    production_id: int,
    user: User = Depends(require_production_capability("lav_chart", "read")),
    db: Session = Depends(get_db),
) -> list[PackResponse]:
    get_accessible_production(db, user, production_id)
    packs = (
        db.query(Pack)
        .filter(Pack.production_id == production_id)
        .order_by(Pack.identifier)
        .all()
    )
    return [_pack_response(pack) for pack in packs]


@router.post(
    "/{production_id}/packs",
    response_model=PackResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_pack(
    production_id: int,
    body: PackCreate,
    user: User = Depends(require_production_capability("lav_chart", "create")),
    db: Session = Depends(get_db),
) -> PackResponse:
    get_accessible_production(db, user, production_id)
    pack = Pack(
        production_id=production_id,
        identifier=body.identifier.strip(),
        notes=body.notes,
    )
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return _pack_response(pack)


@router.patch("/{production_id}/packs/{pack_id}", response_model=PackResponse)
def update_pack(
    production_id: int,
    pack_id: int,
    body: PackUpdate,
    user: User = Depends(require_production_capability("lav_chart", "update")),
    db: Session = Depends(get_db),
) -> PackResponse:
    get_accessible_production(db, user, production_id)
    pack = _get_pack_or_404(db, production_id, pack_id)
    if body.identifier is not None:
        pack.identifier = body.identifier.strip()
    if "notes" in body.model_fields_set:
        pack.notes = body.notes
    db.commit()
    db.refresh(pack)
    return _pack_response(pack)


@router.delete("/{production_id}/packs/{pack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pack(
    production_id: int,
    pack_id: int,
    user: User = Depends(require_production_capability("lav_chart", "delete")),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, user, production_id)
    pack = _get_pack_or_404(db, production_id, pack_id)
    db.delete(pack)
    db.commit()
