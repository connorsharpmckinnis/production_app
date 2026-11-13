"""API schemas for analytics event retrieval."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AnalyticsEventResponse(BaseModel):
    id: int
    created_at: datetime
    organization_id: int | None
    production_id: int | None
    actor_user_id: int | None
    event_name: str
    properties: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class SuggestionRuleSummary(BaseModel):
    rule_id: str
    accepted: int
    dismissed: int
    total: int
    accept_rate: float | None


class SuggestionOutcomeTotals(BaseModel):
    accepted: int
    dismissed: int
    total: int
    accept_rate: float | None


class SuggestionAnalyticsSummaryResponse(BaseModel):
    production_id: int
    overall: SuggestionOutcomeTotals
    by_rule: list[SuggestionRuleSummary]
