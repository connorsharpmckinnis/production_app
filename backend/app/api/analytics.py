"""Retrieve product analytics events (suggestion outcomes + org-scoped auth)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    get_accessible_production,
    require_any_production_capability,
)
from app.auth.dependencies import require_admin
from app.db.session import get_db
from app.models import User
from app.schemas.analytics import (
    AnalyticsEventResponse,
    SuggestionAnalyticsSummaryResponse,
)
from app.services.analytics import (
    list_organization_events,
    list_production_events,
    suggestion_outcome_summary,
)

router = APIRouter(prefix="/productions", tags=["analytics"])
org_router = APIRouter(prefix="/analytics", tags=["analytics"])

# Editors who can act on suggestions — same cohort that cares about usefulness.
# App Admin bypasses membership checks inside get_accessible_production.
_ANALYTICS_READ = require_any_production_capability(
    ("timeline", "create"),
    ("timeline", "update"),
    ("timeline", "approve"),
)


@router.get(
    "/{production_id}/analytics/suggestions/summary",
    response_model=SuggestionAnalyticsSummaryResponse,
)
def get_suggestion_analytics_summary(
    production_id: int,
    user: User = Depends(_ANALYTICS_READ),
    db: Session = Depends(get_db),
) -> SuggestionAnalyticsSummaryResponse:
    get_accessible_production(db, user, production_id)
    payload = suggestion_outcome_summary(db, production_id=production_id)
    return SuggestionAnalyticsSummaryResponse.model_validate(payload)


@router.get(
    "/{production_id}/analytics/events",
    response_model=list[AnalyticsEventResponse],
)
def list_analytics_events(
    production_id: int,
    event_name: str | None = Query(None),
    event_name_prefix: str | None = Query(
        None, description="e.g. suggestion. for all suggestion events"
    ),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(_ANALYTICS_READ),
    db: Session = Depends(get_db),
) -> list[AnalyticsEventResponse]:
    get_accessible_production(db, user, production_id)
    rows = list_production_events(
        db,
        production_id=production_id,
        event_name=event_name,
        event_name_prefix=event_name_prefix,
        limit=limit,
    )
    return [AnalyticsEventResponse.model_validate(row) for row in rows]


@org_router.get(
    "/events",
    response_model=list[AnalyticsEventResponse],
)
def list_organization_analytics_events(
    event_name: str | None = Query(None),
    event_name_prefix: str | None = Query(
        None,
        description="e.g. auth. for login / act-as events",
    ),
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AnalyticsEventResponse]:
    """Admin: recent org events (auth has no production_id)."""
    rows = list_organization_events(
        db,
        organization_id=admin.organization_id,
        event_name=event_name,
        event_name_prefix=event_name_prefix,
        limit=limit,
    )
    return [AnalyticsEventResponse.model_validate(row) for row in rows]
