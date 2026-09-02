from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production, require_production_capability
from app.db.session import get_db
from app.models import User
from app.schemas.lav_chart import (
    LavChartProposeRequest,
    LavChartResponse,
    LavChartSaveRequest,
)
from app.services.lav_chart import (
    apply_propose,
    build_lav_chart_response,
    reject_wire_pack_conflicts,
    replace_pack_assignments,
    replace_row_locks,
    replace_wire_assignments,
)

router = APIRouter(prefix="/productions", tags=["lav-chart"])


@router.get("/{production_id}/lav-chart", response_model=LavChartResponse)
def get_lav_chart(
    production_id: int,
    user: User = Depends(require_production_capability("lav_chart", "read")),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    return build_lav_chart_response(db, production_id)


@router.put("/{production_id}/lav-chart", response_model=LavChartResponse)
def save_lav_chart(
    production_id: int,
    body: LavChartSaveRequest,
    user: User = Depends(require_production_capability("lav_chart", "update")),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    conflict = reject_wire_pack_conflicts(db, production_id, body.wire_cells, body.pack_cells)
    if conflict is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=conflict)
    if body.locked_row_keys is not None:
        try:
            replace_row_locks(db, production_id, body.locked_row_keys)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    replace_wire_assignments(db, production_id, body.wire_cells)
    replace_pack_assignments(db, production_id, body.pack_cells)
    db.commit()
    return build_lav_chart_response(db, production_id)


@router.post("/{production_id}/lav-chart/propose", response_model=LavChartResponse)
def propose_lav_chart_endpoint(
    production_id: int,
    body: LavChartProposeRequest,
    user: User = Depends(require_production_capability("lav_chart", "update")),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    sheets = body.sheets or ["wires", "packs"]
    return apply_propose(
        db,
        production_id,
        sheets,
        preserve_filled_and_locked=body.preserve_filled_and_locked,
    )
