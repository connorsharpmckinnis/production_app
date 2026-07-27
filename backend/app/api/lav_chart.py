from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production
from app.auth.dependencies import require_director_or_admin
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
    replace_pack_assignments,
    replace_wire_assignments,
)

router = APIRouter(prefix="/productions", tags=["lav-chart"])


@router.get("/{production_id}/lav-chart", response_model=LavChartResponse)
def get_lav_chart(
    production_id: int,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    return build_lav_chart_response(db, production_id)


@router.put("/{production_id}/lav-chart", response_model=LavChartResponse)
def save_lav_chart(
    production_id: int,
    body: LavChartSaveRequest,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    replace_wire_assignments(db, production_id, body.wire_cells)
    replace_pack_assignments(db, production_id, body.pack_cells)
    db.commit()
    return build_lav_chart_response(db, production_id)


@router.post("/{production_id}/lav-chart/propose", response_model=LavChartResponse)
def propose_lav_chart_endpoint(
    production_id: int,
    body: LavChartProposeRequest,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> LavChartResponse:
    get_accessible_production(db, user, production_id)
    sheets = body.sheets or ["wires", "packs"]
    return apply_propose(db, production_id, sheets)
