from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_role
from app.db.session import get_db
from app.models import Character, Group, Production, User
from app.schemas.characters import (
    GroupCreate,
    GroupMembershipUpdate,
    GroupResponse,
    GroupUpdate,
)

router = APIRouter(prefix="/productions", tags=["groups"])

require_director = require_role("Admin", "Director")


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


def _group_response(group: Group) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        character_ids=[character.id for character in group.characters],
        user_ids=[user.id for user in group.users],
    )


@router.get("/{production_id}/groups", response_model=list[GroupResponse])
def list_groups(
    production_id: int,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> list[GroupResponse]:
    _get_production_or_404(db, production_id)
    groups = (
        db.query(Group)
        .options(joinedload(Group.characters), joinedload(Group.users))
        .filter(Group.production_id == production_id)
        .order_by(Group.name)
        .all()
    )
    return [_group_response(group) for group in groups]


@router.post(
    "/{production_id}/groups",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    production_id: int,
    body: GroupCreate,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> GroupResponse:
    _get_production_or_404(db, production_id)
    group = Group(
        production_id=production_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return _group_response(group)


@router.patch("/{production_id}/groups/{group_id}", response_model=GroupResponse)
def update_group(
    production_id: int,
    group_id: int,
    body: GroupUpdate,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> GroupResponse:
    _get_production_or_404(db, production_id)
    group = (
        db.query(Group)
        .options(joinedload(Group.characters), joinedload(Group.users))
        .filter(Group.id == group_id, Group.production_id == production_id)
        .first()
    )
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if body.name is not None:
        group.name = body.name.strip()
    if body.description is not None:
        group.description = body.description

    db.commit()
    db.refresh(group)
    group = (
        db.query(Group)
        .options(joinedload(Group.characters), joinedload(Group.users))
        .filter(Group.id == group.id)
        .one()
    )
    return _group_response(group)


@router.delete("/{production_id}/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    production_id: int,
    group_id: int,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> None:
    _get_production_or_404(db, production_id)
    group = (
        db.query(Group)
        .filter(Group.id == group_id, Group.production_id == production_id)
        .first()
    )
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    db.delete(group)
    db.commit()


@router.put("/{production_id}/groups/{group_id}/members", response_model=GroupResponse)
def update_group_members(
    production_id: int,
    group_id: int,
    body: GroupMembershipUpdate,
    _director: User = Depends(require_director),
    db: Session = Depends(get_db),
) -> GroupResponse:
    _get_production_or_404(db, production_id)
    group = (
        db.query(Group)
        .options(joinedload(Group.characters), joinedload(Group.users))
        .filter(Group.id == group_id, Group.production_id == production_id)
        .first()
    )
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if body.character_ids is not None:
        characters = (
            db.query(Character)
            .filter(
                Character.id.in_(body.character_ids),
                Character.production_id == production_id,
            )
            .all()
        )
        if len(characters) != len(set(body.character_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more characters are not in this production",
            )
        group.characters = characters

    if body.user_ids is not None:
        users = db.query(User).filter(User.id.in_(body.user_ids), User.is_active.is_(True)).all()
        if len(users) != len(set(body.user_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more users were not found",
            )
        group.users = users

    db.commit()
    group = (
        db.query(Group)
        .options(joinedload(Group.characters), joinedload(Group.users))
        .filter(Group.id == group.id)
        .one()
    )
    return _group_response(group)
