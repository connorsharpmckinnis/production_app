from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_authenticated
from app.db.session import get_db
from app.models import User
from app.schemas.about_page import AboutImageUploadResponse, AboutPageResponse, AboutPageUpdate
from app.schemas.overview_messages import (
    OverviewMessageDefaultResponse,
    OverviewMessageDefaultsReplace,
)
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from app.services.about_page import get_about_image, get_about_page, store_about_image, update_about_markdown
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


@router.get("/about-page", response_model=AboutPageResponse)
def get_about_page_content(
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> AboutPageResponse:
    settings = get_about_page(db)
    return AboutPageResponse(
        markdown=settings.about_markdown,
        updated_at=settings.about_markdown_updated_at,
    )


@router.put("/about-page", response_model=AboutPageResponse)
def replace_about_page_content(
    body: AboutPageUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AboutPageResponse:
    settings = update_about_markdown(db, body.markdown)
    return AboutPageResponse(
        markdown=settings.about_markdown,
        updated_at=settings.about_markdown_updated_at,
    )


@router.post("/about-images", response_model=AboutImageUploadResponse)
async def upload_about_image(
    file: UploadFile = File(...),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AboutImageUploadResponse:
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    data = await file.read()
    image = store_about_image(db, content_type, data)
    url = f"/api/settings/about-images/{image.id}"
    return AboutImageUploadResponse(
        id=image.id,
        url=url,
        markdown=f"![image]({url})",
    )


@router.get("/about-images/{image_id}")
def get_about_image_content(
    image_id: str,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> Response:
    image = get_about_image(db, image_id)
    return Response(content=image.data, media_type=image.content_type)
