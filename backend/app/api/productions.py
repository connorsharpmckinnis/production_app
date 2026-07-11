from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_authenticated, user_has_role
from app.config import get_settings
from app.db.session import get_db
from app.models import Act, Character, Moment, Organization, Production, Scene, User, UserCharacterAssignment
from app.schemas.production import (
    ImportErrorResponse,
    ImportSuccessResponse,
    ProductionCreate,
    ProductionOverviewResponse,
    ProductionResponse,
)
from app.services.importer import ImportLineError, import_script

router = APIRouter(prefix="/productions", tags=["productions"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


@router.get("", response_model=list[ProductionResponse])
def list_productions(
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[Production]:
    query = db.query(Production).order_by(Production.created_at.desc())

    # Actors only see productions where they have at least one casting assignment.
    if user_has_role(user, "Actor") and not user_has_role(user, "Admin") and not user_has_role(user, "Director"):
        query = (
            query.join(Character, Character.production_id == Production.id)
            .join(
                UserCharacterAssignment,
                UserCharacterAssignment.character_id == Character.id,
            )
            .filter(UserCharacterAssignment.user_id == user.id)
            .distinct()
        )

    return query.all()


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
    db.commit()
    db.refresh(production)
    return production


@router.get("/{production_id}", response_model=ProductionResponse)
def get_production(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> Production:
    return _get_production_or_404(db, production_id)


@router.get("/{production_id}/overview", response_model=ProductionOverviewResponse)
def get_production_overview(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> ProductionOverviewResponse:
    production = _get_production_or_404(db, production_id)

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
    cast_count = (
        db.query(func.count(UserCharacterAssignment.id))
        .join(Character, Character.id == UserCharacterAssignment.character_id)
        .filter(Character.production_id == production_id)
        .scalar()
        or 0
    )

    imported_at = None
    if production.author is not None:
        imported_at = (
            db.query(func.min(Moment.created_at))
            .join(Scene)
            .join(Act)
            .filter(Act.production_id == production_id)
            .scalar()
        )

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
    )


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production(
    production_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    production = _get_production_or_404(db, production_id)
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
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportSuccessResponse:
    if not file.filename or not file.filename.lower().endswith(".md"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md script files are accepted",
        )

    production = _get_production_or_404(db, production_id)
    content = await file.read()

    try:
        result = import_script(db, production, content)
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
