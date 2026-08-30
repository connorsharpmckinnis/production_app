from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import (
    get_accessible_production,
    get_active_production_membership,
    require_production_capability,
    user_can_access_production,
)
from app.auth.dependencies import (
    require_admin,
    require_authenticated,
    user_has_role,
)
from app.db.session import get_db
from app.models import (
    Act,
    Character,
    Moment,
    Production,
    Scene,
    User,
)
from app.schemas.overview_messages import (
    ProductionOverviewMessageResponse,
    ProductionOverviewMessagesReplace,
    ProductionOverviewSettingsResponse,
    ProductionOverviewSettingsUpdate,
)
from app.schemas.production import (
    ImportErrorResponse,
    ImportSuccessResponse,
    ProductionAccessResponse,
    ProductionCreate,
    ProductionOverviewResponse,
    ProductionResponse,
    ReadinessDimension,
)
from app.services.importer import ImportLineError, import_script
from app.services.notifications import notify_admins_production_created
from app.services.production_memberships import (
    active_role_codes,
    effective_cast_character_ids,
    effective_permissions,
)
from app.services.overview_messages import (
    build_spotlight_queue,
    effective_rotation_seconds,
    get_or_create_app_settings,
    list_production_messages,
    replace_production_messages,
)
from app.services.readiness import compute_readiness

router = APIRouter(prefix="/productions", tags=["productions"])


@router.get("", response_model=list[ProductionResponse])
def list_productions(
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[Production]:
    productions = (
        db.query(Production)
        .filter(Production.organization_id == user.organization_id)
        .order_by(Production.created_at.desc())
        .all()
    )
    if user_has_role(user, "Admin"):
        return productions
    return [
        production
        for production in productions
        if user_can_access_production(db, user, production)
    ]


@router.post("", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED)
def create_production(
    body: ProductionCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Production:
    production = Production(
        organization_id=admin.organization_id,
        title=body.title,
        season=body.season,
    )
    db.add(production)
    db.flush()
    notify_admins_production_created(db, production=production, actor=admin)
    db.commit()
    db.refresh(production)
    return production


@router.get("/{production_id}", response_model=ProductionResponse)
def get_production(
    production_id: int,
    user: User = Depends(require_production_capability("production", "read")),
    db: Session = Depends(get_db),
) -> Production:
    return get_accessible_production(db, user, production_id)


@router.get("/{production_id}/access", response_model=ProductionAccessResponse)
def get_production_access(
    production_id: int,
    user: User = Depends(require_production_capability("production", "read")),
    db: Session = Depends(get_db),
) -> ProductionAccessResponse:
    """Return the caller's production roles and effective CRUD capabilities."""
    production = get_accessible_production(db, user, production_id)
    membership = get_active_production_membership(db, user, production.id)
    if membership is None:
        return ProductionAccessResponse(
            production_id=production.id,
            role_codes=["admin"],
            capabilities=[],
        )

    permissions = effective_permissions(db, membership)
    capabilities = sorted(f"{resource}:{action}" for resource, action in permissions)
    return ProductionAccessResponse(
        production_id=production.id,
        role_codes=sorted(active_role_codes(db, membership)),
        capabilities=capabilities,
    )


@router.get("/{production_id}/overview", response_model=ProductionOverviewResponse)
def get_production_overview(
    production_id: int,
    user: User = Depends(require_production_capability("production", "read")),
    db: Session = Depends(get_db),
) -> ProductionOverviewResponse:
    production = get_accessible_production(db, user, production_id)

    act_count = (
        db.query(func.count(Act.id)).filter(Act.production_id == production_id).scalar() or 0
    )
    scene_count = (
        db.query(func.count(Scene.id))
        .join(Act)
        .filter(Act.production_id == production_id)
        .scalar()
        or 0
    )
    moment_count = (
        db.query(func.count(Moment.id))
        .join(Scene)
        .join(Act)
        .filter(Act.production_id == production_id)
        .scalar()
        or 0
    )
    character_count = (
        db.query(func.count(Character.id))
        .filter(Character.production_id == production_id)
        .scalar()
        or 0
    )
    cast_count = len(effective_cast_character_ids(db, production_id))

    # Import state is based on timeline structure (acts), not author metadata.
    imported_at = None
    if act_count > 0:
        imported_at = (
            db.query(func.min(Moment.created_at))
            .join(Scene)
            .join(Act)
            .filter(Act.production_id == production_id)
            .scalar()
        )

    readiness = compute_readiness(db, production_id)
    spotlight = build_spotlight_queue(db, production, readiness.readiness_percent)
    membership = get_active_production_membership(db, user, production_id)
    role_codes = active_role_codes(db, membership) if membership is not None else set()
    is_actor_only = "actor" in role_codes and "director" not in role_codes

    return ProductionOverviewResponse(
        id=production.id,
        title=production.title,
        season=production.season,
        author=production.author,
        created_at=production.created_at,
        imported_at=imported_at,
        act_count=act_count,
        scene_count=scene_count,
        moment_count=moment_count,
        character_count=character_count,
        cast_count=cast_count,
        readiness_percent=None if is_actor_only else readiness.readiness_percent,
        dimensions=[]
        if is_actor_only
        else [
            ReadinessDimension(
                key=dimension.key,
                label=dimension.label,
                score=dimension.score,
                summary=dimension.summary,
                href_hint=dimension.href_hint,
                gaps=dimension.gaps,
            )
            for dimension in readiness.dimensions
        ],
        readiness_band=spotlight.readiness_band,
        rotation_seconds=spotlight.rotation_seconds,
        spotlight=spotlight.spotlight,
    )


@router.get(
    "/{production_id}/overview-messages",
    response_model=list[ProductionOverviewMessageResponse],
)
def get_production_overview_messages(
    production_id: int,
    user: User = Depends(require_production_capability("overview", "read")),
    db: Session = Depends(get_db),
) -> list[ProductionOverviewMessageResponse]:
    get_accessible_production(db, user, production_id)
    return list_production_messages(db, production_id)


@router.put(
    "/{production_id}/overview-messages",
    response_model=list[ProductionOverviewMessageResponse],
)
def replace_production_overview_messages(
    production_id: int,
    body: ProductionOverviewMessagesReplace,
    user: User = Depends(require_production_capability("announcements", "update")),
    db: Session = Depends(get_db),
) -> list[ProductionOverviewMessageResponse]:
    get_accessible_production(db, user, production_id)
    return replace_production_messages(db, production_id, body.messages)


@router.get(
    "/{production_id}/overview-settings",
    response_model=ProductionOverviewSettingsResponse,
)
def get_production_overview_settings(
    production_id: int,
    user: User = Depends(require_production_capability("overview", "read")),
    db: Session = Depends(get_db),
) -> ProductionOverviewSettingsResponse:
    production = get_accessible_production(db, user, production_id)
    app_settings = get_or_create_app_settings(db)
    return ProductionOverviewSettingsResponse(
        message_rotation_seconds=production.message_rotation_seconds,
        effective_rotation_seconds=effective_rotation_seconds(production, app_settings),
    )


@router.patch(
    "/{production_id}/overview-settings",
    response_model=ProductionOverviewSettingsResponse,
)
def update_production_overview_settings(
    production_id: int,
    body: ProductionOverviewSettingsUpdate,
    user: User = Depends(require_production_capability("production", "update")),
    db: Session = Depends(get_db),
) -> ProductionOverviewSettingsResponse:
    production = get_accessible_production(db, user, production_id)
    production.message_rotation_seconds = body.message_rotation_seconds
    db.commit()
    db.refresh(production)
    app_settings = get_or_create_app_settings(db)
    return ProductionOverviewSettingsResponse(
        message_rotation_seconds=production.message_rotation_seconds,
        effective_rotation_seconds=effective_rotation_seconds(production, app_settings),
    )


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production(
    production_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    production = get_accessible_production(db, admin, production_id)
    db.delete(production)
    db.commit()


@router.post(
    "/{production_id}/import",
    response_model=ImportSuccessResponse,
    responses={400: {"model": ImportErrorResponse}},
)
async def import_production_script(
    production_id: int,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportSuccessResponse:
    filename = file.filename or ""
    lower_name = filename.lower()
    if not lower_name.endswith((".md", ".docx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md and .docx script files are accepted",
        )

    production = get_accessible_production(db, admin, production_id)
    content = await file.read()

    max_upload_bytes = 5 * 1024 * 1024
    if len(content) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Script file is too large; the maximum size is 5 MB",
        )

    # .docx files are binary, so a UTF-8 decode check only makes sense for .md text files.
    if lower_name.endswith(".md"):
        try:
            content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Script file is not valid UTF-8 text",
            ) from exc

    try:
        result = import_script(db, production, content, filename=filename)
    except ImportLineError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.to_dict(),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return ImportSuccessResponse(
        acts_created=result.acts_created,
        scenes_created=result.scenes_created,
        moments_created=result.moments_created,
        characters_created=result.characters_created,
        songs_created=result.songs_created,
    )
