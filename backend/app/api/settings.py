from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_authenticated
from app.db.session import get_db
from app.models import User
from app.schemas.overview_messages import (
    OverviewMessageDefaultResponse,
    OverviewMessageDefaultsReplace,
)
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from app.services.overview_messages import (
    get_or_create_app_settings,
    list_default_messages,
    replace_default_messages,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsResponse)
def get_settings(
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> AppSettingsResponse:
    return get_or_create_app_settings(db)


@router.patch("", response_model=AppSettingsResponse)
def update_settings(
    body: AppSettingsUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AppSettingsResponse:
    settings = get_or_create_app_settings(db)

    if body.show_original_text is not None:
        settings.show_original_text = body.show_original_text
    if body.show_parsed_text is not None:
        settings.show_parsed_text = body.show_parsed_text
    if body.default_message_rotation_seconds is not None:
        settings.default_message_rotation_seconds = body.default_message_rotation_seconds

    db.commit()
    db.refresh(settings)
    return settings


@router.get(
    "/overview-message-defaults",
    response_model=list[OverviewMessageDefaultResponse],
)
def get_overview_message_defaults(
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[OverviewMessageDefaultResponse]:
    return list_default_messages(db)


@router.put(
    "/overview-message-defaults",
    response_model=list[OverviewMessageDefaultResponse],
)
def replace_overview_message_defaults(
    body: OverviewMessageDefaultsReplace,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[OverviewMessageDefaultResponse]:
    return replace_default_messages(db, body.messages)
