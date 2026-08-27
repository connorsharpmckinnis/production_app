"""About page content and embedded images."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import AppContentImage, AppSetting
from app.services.overview_messages import SETTINGS_ROW_ID, get_or_create_app_settings

ALLOWED_IMAGE_TYPES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    }
)
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def get_about_page(db: Session) -> AppSetting:
    return get_or_create_app_settings(db)


def update_about_markdown(db: Session, markdown: str) -> AppSetting:
    settings = get_or_create_app_settings(db)
    settings.about_markdown = markdown.strip()
    settings.about_markdown_updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(settings)
    return settings


def store_about_image(db: Session, content_type: str, data: bytes) -> AppContentImage:
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPEG, GIF, and WebP images are accepted",
        )
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Image is too large; the maximum size is 2 MB",
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file is empty",
        )

    image = AppContentImage(
        id=str(uuid.uuid4()),
        content_type=content_type,
        data=data,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def get_about_image(db: Session, image_id: str) -> AppContentImage:
    image = db.get(AppContentImage, image_id)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return image
