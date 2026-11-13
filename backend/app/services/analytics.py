"""Append-only product analytics helpers."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AnalyticsEvent, Production, User


def record_event(
    db: Session,
    *,
    event_name: str,
    user: User | None = None,
    production: Production | None = None,
    organization_id: int | None = None,
    properties: dict[str, Any] | None = None,
) -> AnalyticsEvent:
    """Queue an analytics event on the session (caller commits)."""
    org_id = organization_id
    if org_id is None and production is not None:
        org_id = production.organization_id

    row = AnalyticsEvent(
        event_name=event_name,
        organization_id=org_id,
        production_id=production.id if production is not None else None,
        actor_user_id=user.id if user is not None else None,
        properties=dict(properties or {}),
    )
    db.add(row)
    return row


def list_production_events(
    db: Session,
    *,
    production_id: int,
    event_name: str | None = None,
    event_name_prefix: str | None = None,
    limit: int = 100,
) -> list[AnalyticsEvent]:
    query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.production_id == production_id
    )
    if event_name is not None:
        query = query.filter(AnalyticsEvent.event_name == event_name)
    if event_name_prefix is not None:
        query = query.filter(AnalyticsEvent.event_name.like(f"{event_name_prefix}%"))
    return (
        query.order_by(AnalyticsEvent.created_at.desc(), AnalyticsEvent.id.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )


def suggestion_outcome_summary(
    db: Session,
    *,
    production_id: int,
) -> dict[str, Any]:
    """Aggregate suggestion.accepted / suggestion.dismissed for a production."""
    rows = (
        db.query(AnalyticsEvent.event_name, AnalyticsEvent.properties)
        .filter(
            AnalyticsEvent.production_id == production_id,
            AnalyticsEvent.event_name.in_(
                ("suggestion.accepted", "suggestion.dismissed")
            ),
        )
        .all()
    )

    by_rule: dict[str, dict[str, int]] = defaultdict(
        lambda: {"accepted": 0, "dismissed": 0, "total": 0}
    )
    overall = {"accepted": 0, "dismissed": 0, "total": 0}

    for event_name, properties in rows:
        props = properties if isinstance(properties, dict) else {}
        rule_id = str(props.get("rule_id") or "unknown")
        bucket = by_rule[rule_id]
        if event_name == "suggestion.accepted":
            bucket["accepted"] += 1
            overall["accepted"] += 1
        else:
            bucket["dismissed"] += 1
            overall["dismissed"] += 1
        bucket["total"] += 1
        overall["total"] += 1

    rules = [
        {
            "rule_id": rule_id,
            "accepted": counts["accepted"],
            "dismissed": counts["dismissed"],
            "total": counts["total"],
            "accept_rate": (
                counts["accepted"] / counts["total"] if counts["total"] else None
            ),
        }
        for rule_id, counts in sorted(by_rule.items())
    ]

    return {
        "production_id": production_id,
        "overall": {
            **overall,
            "accept_rate": (
                overall["accepted"] / overall["total"] if overall["total"] else None
            ),
        },
        "by_rule": rules,
    }


def count_events_by_name(
    db: Session,
    *,
    production_id: int,
    event_names: list[str],
) -> dict[str, int]:
    rows = (
        db.query(AnalyticsEvent.event_name, func.count())
        .filter(
            AnalyticsEvent.production_id == production_id,
            AnalyticsEvent.event_name.in_(event_names),
        )
        .group_by(AnalyticsEvent.event_name)
        .all()
    )
    return {name: count for name, count in rows}
