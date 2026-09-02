from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production, require_production_capability
from app.db.session import get_db
from app.models import User, Wire
from app.schemas.wires import WireCreate, WireResponse, WireUpdate

router = APIRouter(prefix="/productions", tags=["wires"])


def _get_wire_or_404(db: Session, production_id: int, wire_id: int) -> Wire:
    wire = (
        db.query(Wire)
        .filter(Wire.id == wire_id, Wire.production_id == production_id)
        .first()
    )
    if wire is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wire not found")
    return wire


def _wire_response(wire: Wire) -> WireResponse:
    return WireResponse(id=wire.id, identifier=wire.identifier, notes=wire.notes)


@router.get("/{production_id}/wires", response_model=list[WireResponse])
def list_wires(
    production_id: int,
    user: User = Depends(require_production_capability("lav_chart", "read")),
    db: Session = Depends(get_db),
) -> list[WireResponse]:
    get_accessible_production(db, user, production_id)
    wires = (
        db.query(Wire)
        .filter(Wire.production_id == production_id)
        .order_by(Wire.identifier)
        .all()
    )
    return [_wire_response(wire) for wire in wires]


@router.post(
    "/{production_id}/wires",
    response_model=WireResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wire(
    production_id: int,
    body: WireCreate,
    user: User = Depends(require_production_capability("lav_chart", "create")),
    db: Session = Depends(get_db),
) -> WireResponse:
    get_accessible_production(db, user, production_id)
    wire = Wire(
        production_id=production_id,
        identifier=body.identifier.strip(),
        notes=body.notes,
    )
    db.add(wire)
    db.commit()
    db.refresh(wire)
    return _wire_response(wire)


@router.patch("/{production_id}/wires/{wire_id}", response_model=WireResponse)
def update_wire(
    production_id: int,
    wire_id: int,
    body: WireUpdate,
    user: User = Depends(require_production_capability("lav_chart", "update")),
    db: Session = Depends(get_db),
) -> WireResponse:
    get_accessible_production(db, user, production_id)
    wire = _get_wire_or_404(db, production_id, wire_id)
    if body.identifier is not None:
        wire.identifier = body.identifier.strip()
    if "notes" in body.model_fields_set:
        wire.notes = body.notes
    db.commit()
    db.refresh(wire)
    return _wire_response(wire)


@router.delete("/{production_id}/wires/{wire_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wire(
    production_id: int,
    wire_id: int,
    user: User = Depends(require_production_capability("lav_chart", "delete")),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, user, production_id)
    wire = _get_wire_or_404(db, production_id, wire_id)
    db.delete(wire)
    db.commit()
