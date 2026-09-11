from dataclasses import asdict

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
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
    ImportPreviewResponse,
    ImportSuccessResponse,
    ProductionAccessResponse,
    ProductionCreate,
    ProductionOverviewResponse,
    ProductionResponse,
    ReadinessDimension,
)
from app.services.importer import ImportLineError, import_script
from app.services.importer.extract import extract_script
from app.services.importer.mapped_importer import persist_profile_preview
from app.services.importer.profiles import ImportProfileDefinition
from app.services.importer.rule_engine import classify_with_profile
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

MAX_STANDARD_SCRIPT_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PDF_SCRIPT_UPLOAD_BYTES = 20 * 1024 * 1024


def _max_script_upload_bytes(filename: str) -> int:
    if filename.lower().endswith(".pdf"):
        return MAX_PDF_SCRIPT_UPLOAD_BYTES
    return MAX_STANDARD_SCRIPT_UPLOAD_BYTES


def _production_ids_with_acts(db: Session, production_ids: list[int]) -> set[int]:
    if not production_ids:
        return set()
    rows = (
        db.query(Act.production_id)
        .filter(Act.production_id.in_(production_ids))
        .distinct()
        .all()
    )
    return {production_id for (production_id,) in rows}


def _to_production_response(
    production: Production,
    *,
    has_imported_script: bool,
) -> ProductionResponse:
    return ProductionResponse(
        id=production.id,
        title=production.title,
        season=production.season,
        author=production.author,
        created_at=production.created_at,
        has_imported_script=has_imported_script,
    )


def _to_production_responses(
    db: Session,
    productions: list[Production],
) -> list[ProductionResponse]:
    imported_ids = _production_ids_with_acts(db, [p.id for p in productions])
    return [
        _to_production_response(
            production,
            has_imported_script=production.id in imported_ids,
        )
        for production in productions
    ]


@router.get("", response_model=list[ProductionResponse])
def list_productions(
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[ProductionResponse]:
    productions = (
        db.query(Production)
        .filter(Production.organization_id == user.organization_id)
        .order_by(Production.created_at.desc())
        .all()
    )
    if not user_has_role(user, "Admin"):
        productions = [
            production
            for production in productions
            if user_can_access_production(db, user, production)
        ]
    return _to_production_responses(db, productions)


@router.post("", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED)
def create_production(
    body: ProductionCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductionResponse:
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
    return _to_production_response(production, has_imported_script=False)


@router.get("/{production_id}", response_model=ProductionResponse)
def get_production(
    production_id: int,
    user: User = Depends(require_production_capability("production", "read")),
    db: Session = Depends(get_db),
) -> ProductionResponse:
    production = get_accessible_production(db, user, production_id)
    has_imported_script = (
        db.query(Act.id).filter(Act.production_id == production.id).first() is not None
    )
    return _to_production_response(
        production,
        has_imported_script=has_imported_script,
    )


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
    "/{production_id}/import/preview",
    response_model=ImportPreviewResponse,
)
async def preview_production_script_import(
    production_id: int,
    file: UploadFile = File(...),
    profile: str = Form(...),
    page_from: int | None = Form(default=None),
    page_to: int | None = Form(default=None),
    max_lines: int | None = Form(default=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportPreviewResponse:
    """
    Classify a page window using the live editor draft without writing rows.

    Saved profile IDs deliberately are not used here: the submitted profile
    body is the exact draft the admin is currently testing.
    """
    production = get_accessible_production(db, admin, production_id)
    if db.query(Act).filter(Act.production_id == production.id).count():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Production already has imported content; re-import is not allowed",
        )

    filename = file.filename or ""
    lower_name = filename.lower()
    if not lower_name.endswith((".md", ".docx", ".pdf")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md, .docx, and .pdf script files are accepted",
        )
    content = await file.read()
    max_upload_bytes = _max_script_upload_bytes(filename)
    if len(content) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=(
                "Script file is too large; the maximum size is "
                f"{max_upload_bytes // (1024 * 1024)} MB"
            ),
        )
    if max_lines is not None and not 1 <= max_lines <= 2_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_lines must be between 1 and 2000",
        )

    try:
        profile_definition = ImportProfileDefinition.model_validate_json(profile)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(include_url=False, include_context=False),
        ) from exc

    source_format = lower_name.rsplit(".", 1)[-1]
    if source_format not in profile_definition.source_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Profile "{profile_definition.name}" does not accept {source_format} files',
        )

    effective_page_from: int | None = None
    effective_page_to: int | None = None
    if source_format == "pdf":
        effective_page_from = page_from or profile_definition.pdf.start_page
        configured_end = profile_definition.pdf.end_page
        effective_page_to = page_to or min(
            configured_end or effective_page_from + 4,
            effective_page_from + 4,
        )
        if effective_page_to < effective_page_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="page_to must be greater than or equal to page_from",
            )

    try:
        extraction = extract_script(
            filename,
            content,
            start_page=effective_page_from,
            end_page=effective_page_to,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    lines = extraction.lines[:max_lines] if max_lines is not None else extraction.lines
    preview = classify_with_profile(lines, profile_definition)
    character_names = {
        speaker
        for moment in preview.moments
        for speaker in moment.speakers
    }
    return ImportPreviewResponse(
        source_format=extraction.source_format,
        preview_window={
            "page_from": effective_page_from,
            "page_to": effective_page_to,
            "line_count": len(lines),
        },
        counts={
            "acts": len(preview.acts),
            "scenes": sum(len(act.scenes) for act in preview.acts),
            "moments": len(preview.moments),
            "characters": len(character_names),
            "unclassified": len(preview.unclassified),
        },
        acts=[asdict(act) for act in preview.acts],
        warnings=[asdict(warning) for warning in preview.warnings],
        unclassified=[asdict(line) for line in preview.unclassified[:100]],
    )


@router.post(
    "/{production_id}/import",
    response_model=ImportSuccessResponse,
    responses={400: {"model": ImportErrorResponse}},
)
async def import_production_script(
    production_id: int,
    file: UploadFile = File(...),
    profile: str | None = Form(default=None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportSuccessResponse:
    filename = file.filename or ""
    lower_name = filename.lower()
    if not lower_name.endswith((".md", ".docx", ".pdf")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md, .docx, and .pdf script files are accepted",
        )

    production = get_accessible_production(db, admin, production_id)
    content = await file.read()

    max_upload_bytes = _max_script_upload_bytes(filename)
    if len(content) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=(
                "Script file is too large; the maximum size is "
                f"{max_upload_bytes // (1024 * 1024)} MB"
            ),
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
        if profile is not None:
            try:
                profile_definition = ImportProfileDefinition.model_validate_json(profile)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(include_url=False, include_context=False),
                ) from exc
            source_format = lower_name.rsplit(".", 1)[-1]
            if source_format not in profile_definition.source_formats:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f'Profile "{profile_definition.name}" does not accept '
                        f"{source_format} files"
                    ),
                )
            extraction = extract_script(
                filename,
                content,
                start_page=(
                    profile_definition.pdf.start_page
                    if source_format == "pdf"
                    else None
                ),
                end_page=(
                    profile_definition.pdf.end_page
                    if source_format == "pdf"
                    else None
                ),
            )
            preview = classify_with_profile(extraction.lines, profile_definition)
            result = persist_profile_preview(db, production, preview)
        elif lower_name.endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF imports require an import profile",
            )
        else:
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
