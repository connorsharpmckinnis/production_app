from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Cue, CueCategory, Moment, Production, Scene, User
from app.schemas.cues import (
    CueCategoryCreate,
    CueCategoryResponse,
    CueCategoryUpdate,
    CueCreate,
    CueResponse,
    CueUpdate,
)

router = APIRouter(prefix="/productions", tags=["cues"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _get_cue_category_or_404(
    db: Session,
    production_id: int,
    cue_category_id: int,
) -> CueCategory:
    category = (
        db.query(CueCategory)
        .filter(CueCategory.id == cue_category_id, CueCategory.production_id == production_id)
        .first()
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cue category not found")
    return category


def _get_moment_in_production_or_404(
    db: Session,
    production_id: int,
    moment_id: int,
) -> Moment:
    moment = (
        db.query(Moment)
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")
    return moment


def _cue_response(cue: Cue) -> CueResponse:
    return CueResponse(
        id=cue.id,
        cue_category_id=cue.cue_category_id,
        cue_category_name=cue.cue_category.name,
        title=cue.title,
        notes=cue.notes,
        payload=cue.payload,
    )


@router.get("/{production_id}/cue-categories", response_model=list[CueCategoryResponse])
def list_cue_categories(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CueCategoryResponse]:
    _get_production_or_404(db, production_id)
    categories = (
        db.query(CueCategory)
        .filter(CueCategory.production_id == production_id)
        .order_by(CueCategory.name)
        .all()
    )
    return [
        CueCategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
        )
        for category in categories
    ]


@router.post(
    "/{production_id}/cue-categories",
    response_model=CueCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_cue_category(
    production_id: int,
    body: CueCategoryCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CueCategoryResponse:
    _get_production_or_404(db, production_id)
    category = CueCategory(
        production_id=production_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return CueCategoryResponse(
        id=category.id,
        name=category.name,
        description=category.description,
    )


@router.patch(
    "/{production_id}/cue-categories/{cue_category_id}",
    response_model=CueCategoryResponse,
)
def update_cue_category(
    production_id: int,
    cue_category_id: int,
    body: CueCategoryUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CueCategoryResponse:
    category = _get_cue_category_or_404(db, production_id, cue_category_id)

    if body.name is not None:
        category.name = body.name.strip()
    if body.description is not None:
        category.description = body.description

    db.commit()
    db.refresh(category)
    return CueCategoryResponse(
        id=category.id,
        name=category.name,
        description=category.description,
    )


@router.delete(
    "/{production_id}/cue-categories/{cue_category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_cue_category(
    production_id: int,
    cue_category_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    category = _get_cue_category_or_404(db, production_id, cue_category_id)
    db.delete(category)
    db.commit()


@router.get(
    "/{production_id}/moments/{moment_id}/cues",
    response_model=list[CueResponse],
)
def list_moment_cues(
    production_id: int,
    moment_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CueResponse]:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    cues = (
        db.query(Cue)
        .options(joinedload(Cue.cue_category))
        .filter(Cue.moment_id == moment_id)
        .order_by(Cue.id)
        .all()
    )
    return [_cue_response(cue) for cue in cues]


@router.post(
    "/{production_id}/moments/{moment_id}/cues",
    response_model=CueResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_moment_cue(
    production_id: int,
    moment_id: int,
    body: CueCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CueResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    _get_cue_category_or_404(db, production_id, body.cue_category_id)

    cue = Cue(
        moment_id=moment_id,
        cue_category_id=body.cue_category_id,
        title=body.title.strip(),
        notes=body.notes,
        payload=body.payload,
    )
    db.add(cue)
    db.commit()
    cue = (
        db.query(Cue)
        .options(joinedload(Cue.cue_category))
        .filter(Cue.id == cue.id)
        .one()
    )
    return _cue_response(cue)


@router.patch(
    "/{production_id}/moments/{moment_id}/cues/{cue_id}",
    response_model=CueResponse,
)
def update_moment_cue(
    production_id: int,
    moment_id: int,
    cue_id: int,
    body: CueUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CueResponse:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    cue = (
        db.query(Cue)
        .options(joinedload(Cue.cue_category))
        .filter(Cue.id == cue_id, Cue.moment_id == moment_id)
        .first()
    )
    if cue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cue not found")

    if body.cue_category_id is not None:
        _get_cue_category_or_404(db, production_id, body.cue_category_id)
        cue.cue_category_id = body.cue_category_id
    if body.title is not None:
        cue.title = body.title.strip()
    if body.notes is not None:
        cue.notes = body.notes
    if body.payload is not None:
        cue.payload = body.payload

    db.commit()
    db.refresh(cue)
    cue = (
        db.query(Cue)
        .options(joinedload(Cue.cue_category))
        .filter(Cue.id == cue.id)
        .one()
    )
    return _cue_response(cue)


@router.delete(
    "/{production_id}/moments/{moment_id}/cues/{cue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_moment_cue(
    production_id: int,
    moment_id: int,
    cue_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    _get_moment_in_production_or_404(db, production_id, moment_id)
    cue = (
        db.query(Cue)
        .filter(Cue.id == cue_id, Cue.moment_id == moment_id)
        .first()
    )
    if cue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cue not found")
    db.delete(cue)
    db.commit()
