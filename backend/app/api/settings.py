from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_authenticated
from app.db.session import get_db
from app.models import AppSetting, User
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_ROW_ID = 1


def _get_settings_row(db: Session) -> AppSetting:
    settings = db.query(AppSetting).filter(AppSetting.id == SETTINGS_ROW_ID).first()
    if settings is None:
        settings = AppSetting(
            id=SETTINGS_ROW_ID,
            show_original_text=True,
            show_parsed_text=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=AppSettingsResponse)
def get_settings(
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> AppSettingsResponse:
    return _get_settings_row(db)


@router.patch("", response_model=AppSettingsResponse)
def update_settings(
    body: AppSettingsUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AppSettingsResponse:
    settings = _get_settings_row(db)

    if body.show_original_text is not None:
        settings.show_original_text = body.show_original_text
    if body.show_parsed_text is not None:
        settings.show_parsed_text = body.show_parsed_text

    db.commit()
    db.refresh(settings)
    return settings
