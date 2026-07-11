from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_authenticated, require_director_or_admin
from app.db.session import get_db
from app.models import Act, Character, Costume, Production, Scene, User
from app.schemas.costumes import CostumeCreate, CostumeResponse, CostumeUpdate

router = APIRouter(prefix="/productions", tags=["costumes"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _get_costume_or_404(db: Session, production_id: int, costume_id: int) -> Costume:
    costume = (
        db.query(Costume)
        .options(
            joinedload(Costume.character),
            joinedload(Costume.scene),
        )
        .filter(Costume.id == costume_id, Costume.production_id == production_id)
        .first()
    )
    if costume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Costume not found")
    return costume


def _validate_character_in_production(
    db: Session, production_id: int, character_id: int
) -> Character:
    character = (
        db.query(Character)
        .filter(Character.id == character_id, Character.production_id == production_id)
        .first()
    )
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Character is not in this production",
        )
    return character


def _validate_scene_in_production(db: Session, production_id: int, scene_id: int) -> Scene:
    scene = (
        db.query(Scene)
        .join(Act)
        .filter(Scene.id == scene_id, Act.production_id == production_id)
        .first()
    )
    if scene is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scene is not in this production",
        )
    return scene


def _costume_response(costume: Costume) -> CostumeResponse:
    return CostumeResponse(
        id=costume.id,
        character_id=costume.character_id,
        character_name=costume.character.name,
        scene_id=costume.scene_id,
        scene_number=costume.scene.number,
        scene_title=costume.scene.title,
        name=costume.name,
        description=costume.description,
    )


@router.get("/{production_id}/costumes", response_model=list[CostumeResponse])
def list_costumes(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CostumeResponse]:
    _get_production_or_404(db, production_id)
    costumes = (
        db.query(Costume)
        .options(
            joinedload(Costume.character),
            joinedload(Costume.scene),
        )
        .filter(Costume.production_id == production_id)
        .order_by(Costume.scene_id, Costume.character_id, Costume.name)
        .all()
    )
    return [_costume_response(costume) for costume in costumes]


@router.post(
    "/{production_id}/costumes",
    response_model=CostumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_costume(
    production_id: int,
    body: CostumeCreate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CostumeResponse:
    _get_production_or_404(db, production_id)
    _validate_character_in_production(db, production_id, body.character_id)
    _validate_scene_in_production(db, production_id, body.scene_id)

    costume = Costume(
        production_id=production_id,
        character_id=body.character_id,
        scene_id=body.scene_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(costume)
    db.commit()
    costume = _get_costume_or_404(db, production_id, costume.id)
    return _costume_response(costume)


@router.patch("/{production_id}/costumes/{costume_id}", response_model=CostumeResponse)
def update_costume(
    production_id: int,
    costume_id: int,
    body: CostumeUpdate,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> CostumeResponse:
    costume = _get_costume_or_404(db, production_id, costume_id)

    if body.character_id is not None:
        _validate_character_in_production(db, production_id, body.character_id)
        costume.character_id = body.character_id
    if body.scene_id is not None:
        _validate_scene_in_production(db, production_id, body.scene_id)
        costume.scene_id = body.scene_id
    if body.name is not None:
        costume.name = body.name.strip()
    if body.description is not None:
        costume.description = body.description

    db.commit()
    costume = _get_costume_or_404(db, production_id, costume_id)
    return _costume_response(costume)


@router.delete(
    "/{production_id}/costumes/{costume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_costume(
    production_id: int,
    costume_id: int,
    _director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    costume = _get_costume_or_404(db, production_id, costume_id)
    db.delete(costume)
    db.commit()
