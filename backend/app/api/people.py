from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_production_capability
from app.db.session import get_db
from app.models import (
    Character,
    ProductionMembership,
    ProductionMembershipRole,
    ProductionRole,
    User,
    UserCharacterAssignment,
)
from app.schemas.people import (
    AddProductionMemberRequest,
    AssignedCharacterResponse,
    ProductionMemberCandidateResponse,
    ProductionMemberResponse,
    ProductionRoleResponse,
    UpdateProductionMemberRolesRequest,
)
from app.services.production_memberships import (
    MembershipNotFoundError,
    ProductionMembershipError,
    ProductionNotFoundError,
    ProductionRoleNotFoundError,
    UserNotEligibleError,
    create_or_reactivate_membership,
    deactivate_membership,
    effective_cast_character_ids,
    get_membership,
    replace_membership_roles,
)

router = APIRouter(prefix="/productions", tags=["people"])


def _display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _member_query(db: Session, production_id: int):
    return (
        db.query(ProductionMembership)
        .join(User, User.id == ProductionMembership.user_id)
        .options(
            joinedload(ProductionMembership.user),
            joinedload(ProductionMembership.membership_roles).joinedload(
                ProductionMembershipRole.production_role
            ),
            joinedload(ProductionMembership.user)
            .joinedload(User.character_assignments)
            .joinedload(UserCharacterAssignment.character),
        )
        .filter(
            ProductionMembership.production_id == production_id,
            ProductionMembership.is_active.is_(True),
            User.is_active.is_(True),
        )
    )


def _member_response(
    membership: ProductionMembership,
    effective_cast_ids: set[int] | None = None,
) -> ProductionMemberResponse:
    user = membership.user
    roles = sorted(
        (
            ProductionRoleResponse(
                code=assignment.production_role.code,
                name=assignment.production_role.name,
            )
            for assignment in membership.membership_roles
        ),
        key=lambda role: role.code,
    )
    characters = sorted(
        (
            AssignedCharacterResponse(id=assignment.character.id, name=assignment.character.name)
            for assignment in user.character_assignments
            if (
                assignment.character.production_id == membership.production_id
                and (
                    effective_cast_ids is None
                    or assignment.character.id in effective_cast_ids
                )
            )
        ),
        key=lambda character: (character.name.lower(), character.id),
    )
    return ProductionMemberResponse(
        user_id=user.id,
        display_name=_display_name(user),
        email=user.email,
        is_active=membership.is_active and user.is_active,
        roles=roles,
        assigned_characters=characters,
    )


def _active_membership_or_404(
    db: Session,
    production_id: int,
    user_id: int,
) -> ProductionMembership:
    membership = (
        _member_query(db, production_id)
        .filter(ProductionMembership.user_id == user_id)
        .first()
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active production membership not found",
        )
    return membership


def _membership_error_http(exc: ProductionMembershipError) -> HTTPException:
    if isinstance(exc, (ProductionNotFoundError, UserNotEligibleError, MembershipNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ProductionRoleNotFoundError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/{production_id}/people/roles",
    response_model=list[ProductionRoleResponse],
)
def list_production_roles(
    production_id: int,
    _user: User = Depends(require_production_capability("people", "read")),
    db: Session = Depends(get_db),
) -> list[ProductionRoleResponse]:
    roles = (
        db.query(ProductionRole)
        .order_by(ProductionRole.name, ProductionRole.code)
        .all()
    )
    return [
        ProductionRoleResponse(code=role.code, name=role.name)
        for role in roles
    ]


@router.get(
    "/{production_id}/people",
    response_model=list[ProductionMemberResponse],
)
def list_people(
    production_id: int,
    _user: User = Depends(require_production_capability("people", "read")),
    db: Session = Depends(get_db),
) -> list[ProductionMemberResponse]:
    memberships = (
        _member_query(db, production_id)
        .order_by(User.last_name, User.first_name, User.id)
        .all()
    )
    effective_cast_ids = effective_cast_character_ids(db, production_id)
    return [_member_response(membership, effective_cast_ids) for membership in memberships]


@router.get(
    "/{production_id}/people/candidates",
    response_model=list[ProductionMemberCandidateResponse],
)
def list_people_candidates(
    production_id: int,
    _user: User = Depends(require_production_capability("people", "read")),
    db: Session = Depends(get_db),
) -> list[ProductionMemberCandidateResponse]:
    active_membership = (
        db.query(ProductionMembership.id)
        .filter(
            ProductionMembership.production_id == production_id,
            ProductionMembership.user_id == User.id,
            ProductionMembership.is_active.is_(True),
        )
        .exists()
    )
    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.organization_id == _user.organization_id,
            ~active_membership,
        )
        .order_by(User.last_name, User.first_name, User.id)
        .all()
    )
    return [
        ProductionMemberCandidateResponse(
            user_id=user.id,
            display_name=_display_name(user),
            email=user.email,
            is_active=user.is_active,
        )
        for user in users
    ]


@router.post(
    "/{production_id}/people",
    response_model=ProductionMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_person(
    production_id: int,
    body: AddProductionMemberRequest,
    _user: User = Depends(require_production_capability("people", "create")),
    db: Session = Depends(get_db),
) -> ProductionMemberResponse:
    existing = get_membership(db, production_id, body.user_id)
    if existing is not None and existing.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already an active member of this production",
        )
    try:
        create_or_reactivate_membership(
            db,
            production_id,
            body.user_id,
            body.role_codes,
        )
        db.commit()
    except ProductionMembershipError as exc:
        db.rollback()
        raise _membership_error_http(exc) from exc
    membership = _active_membership_or_404(db, production_id, body.user_id)
    return _member_response(membership, effective_cast_character_ids(db, production_id))


@router.patch(
    "/{production_id}/people/{user_id}",
    response_model=ProductionMemberResponse,
)
def update_person_roles(
    production_id: int,
    user_id: int,
    body: UpdateProductionMemberRolesRequest,
    _user: User = Depends(require_production_capability("people", "update")),
    db: Session = Depends(get_db),
) -> ProductionMemberResponse:
    membership = _active_membership_or_404(db, production_id, user_id)
    try:
        replace_membership_roles(db, membership, body.role_codes)
        db.commit()
    except ProductionMembershipError as exc:
        db.rollback()
        raise _membership_error_http(exc) from exc
    membership = _active_membership_or_404(db, production_id, user_id)
    return _member_response(membership, effective_cast_character_ids(db, production_id))


@router.post(
    "/{production_id}/people/{user_id}/deactivate",
    response_model=ProductionMemberResponse,
)
def deactivate_person(
    production_id: int,
    user_id: int,
    _user: User = Depends(require_production_capability("people", "update")),
    db: Session = Depends(get_db),
) -> ProductionMemberResponse:
    membership = get_membership(db, production_id, user_id)
    if membership is None or not membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active production membership not found",
        )
    try:
        deactivate_membership(db, membership)
        db.commit()
    except ProductionMembershipError as exc:
        db.rollback()
        raise _membership_error_http(exc) from exc
    effective_cast_ids = effective_cast_character_ids(db, production_id)
    return ProductionMemberResponse(
        user_id=membership.user.id,
        display_name=_display_name(membership.user),
        email=membership.user.email,
        is_active=False,
        roles=sorted(
            (
                ProductionRoleResponse(
                    code=assignment.production_role.code,
                    name=assignment.production_role.name,
                )
                for assignment in membership.membership_roles
            ),
            key=lambda role: role.code,
        ),
        assigned_characters=sorted(
            (
                AssignedCharacterResponse(
                    id=assignment.character.id,
                    name=assignment.character.name,
                )
                for assignment in membership.user.character_assignments
                if (
                    assignment.character.production_id == production_id
                    and assignment.character.id in effective_cast_ids
                )
            ),
            key=lambda character: (character.name.lower(), character.id),
        ),
    )
