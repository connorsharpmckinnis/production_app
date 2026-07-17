"""Resolve Overview spotlight queue and message rotation."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.db.encouragement_defaults import (
    DEFAULT_MESSAGE_ROTATION_SECONDS,
    readiness_band,
)
from app.models import (
    AppOverviewMessageDefault,
    AppSetting,
    Production,
    ProductionOverviewMessage,
)
from app.schemas.overview_messages import SpotlightMessage

SETTINGS_ROW_ID = 1


@dataclass(frozen=True)
class SpotlightResult:
    rotation_seconds: int
    readiness_band: str
    spotlight: list[SpotlightMessage]


def get_or_create_app_settings(db: Session) -> AppSetting:
    settings = db.query(AppSetting).filter(AppSetting.id == SETTINGS_ROW_ID).first()
    if settings is None:
        settings = AppSetting(
            id=SETTINGS_ROW_ID,
            show_original_text=True,
            show_parsed_text=True,
            default_message_rotation_seconds=DEFAULT_MESSAGE_ROTATION_SECONDS,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def effective_rotation_seconds(
    production: Production,
    app_settings: AppSetting,
) -> int:
    if production.message_rotation_seconds is not None:
        return production.message_rotation_seconds
    return app_settings.default_message_rotation_seconds


def build_spotlight_queue(
    db: Session,
    production: Production,
    readiness_percent: int | None,
) -> SpotlightResult:
    app_settings = get_or_create_app_settings(db)
    band = readiness_band(readiness_percent)
    rotation = effective_rotation_seconds(production, app_settings)

    production_messages = (
        db.query(ProductionOverviewMessage)
        .filter(
            ProductionOverviewMessage.production_id == production.id,
            ProductionOverviewMessage.active.is_(True),
        )
        .order_by(
            ProductionOverviewMessage.sort_order.asc(),
            ProductionOverviewMessage.id.asc(),
        )
        .all()
    )

    announcements = [
        SpotlightMessage(
            kind="announcement",
            band=None,
            title=message.title,
            body=message.body,
            source="production",
        )
        for message in production_messages
        if message.kind == "announcement"
    ]
    scriptures = [
        SpotlightMessage(
            kind="scripture",
            band=None,
            title=message.title,
            body=message.body,
            source="production",
        )
        for message in production_messages
        if message.kind == "scripture"
    ]

    production_encouragement = [
        message
        for message in production_messages
        if message.kind == "encouragement" and message.band == band
    ]

    if production_encouragement:
        encouragement = [
            SpotlightMessage(
                kind="encouragement",
                band=message.band,
                title=message.title,
                body=message.body,
                source="production",
            )
            for message in production_encouragement
        ]
    else:
        global_defaults = (
            db.query(AppOverviewMessageDefault)
            .filter(
                AppOverviewMessageDefault.band == band,
                AppOverviewMessageDefault.active.is_(True),
            )
            .order_by(
                AppOverviewMessageDefault.sort_order.asc(),
                AppOverviewMessageDefault.id.asc(),
            )
            .all()
        )
        encouragement = [
            SpotlightMessage(
                kind="encouragement",
                band=message.band,
                title=message.title,
                body=message.body,
                source="global",
            )
            for message in global_defaults
        ]

    return SpotlightResult(
        rotation_seconds=rotation,
        readiness_band=band,
        spotlight=announcements + scriptures + encouragement,
    )


def list_default_messages(db: Session) -> list[AppOverviewMessageDefault]:
    return (
        db.query(AppOverviewMessageDefault)
        .order_by(
            AppOverviewMessageDefault.sort_order.asc(),
            AppOverviewMessageDefault.id.asc(),
        )
        .all()
    )


def replace_default_messages(
    db: Session,
    items: list,
) -> list[AppOverviewMessageDefault]:
    db.query(AppOverviewMessageDefault).delete()
    rows: list[AppOverviewMessageDefault] = []
    for item in items:
        row = AppOverviewMessageDefault(
            band=item.band,
            title=item.title,
            body=item.body,
            sort_order=item.sort_order,
            active=item.active,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return list_default_messages(db)


def list_production_messages(
    db: Session,
    production_id: int,
) -> list[ProductionOverviewMessage]:
    return (
        db.query(ProductionOverviewMessage)
        .filter(ProductionOverviewMessage.production_id == production_id)
        .order_by(
            ProductionOverviewMessage.sort_order.asc(),
            ProductionOverviewMessage.id.asc(),
        )
        .all()
    )


def replace_production_messages(
    db: Session,
    production_id: int,
    items: list,
) -> list[ProductionOverviewMessage]:
    db.query(ProductionOverviewMessage).filter(
        ProductionOverviewMessage.production_id == production_id
    ).delete()
    for item in items:
        db.add(
            ProductionOverviewMessage(
                production_id=production_id,
                kind=item.kind,
                band=item.band,
                title=item.title,
                body=item.body,
                sort_order=item.sort_order,
                active=item.active,
            )
        )
    db.commit()
    return list_production_messages(db, production_id)
