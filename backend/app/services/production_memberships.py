"""Framework-light lifecycle and capability helpers for production members."""

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import (
    ProductionMembership,
    ProductionMembershipRole,
    Production,
    ProductionRole,
    ProductionRolePermission,
    User,
)


class ProductionMembershipError(ValueError):
    """Base error for invalid production membership operations."""


class ProductionNotFoundError(ProductionMembershipError):
    """Raised when a requested production does not exist."""


class MembershipNotFoundError(ProductionMembershipError):
    """Raised when a requested membership does not exist."""


class UserNotEligibleError(ProductionMembershipError):
    """Raised when a user is inactive or belongs to another organization."""


class ProductionRoleNotFoundError(ProductionMembershipError):
    """Raised when one or more production role codes are unknown."""


def get_membership(
    db: Session,
    production_id: int,
    user_id: int,
) -> ProductionMembership | None:
    """Load the unique membership for a production/user pair, if present."""

    return (
        db.query(ProductionMembership)
        .filter(
            ProductionMembership.production_id == production_id,
            ProductionMembership.user_id == user_id,
        )
        .first()
    )


get_production_membership = get_membership


def _active_production_user_query(
    db: Session,
    production_id: int,
    user_id: int | None = None,
    *,
    role_code: str | None = None,
):
    """Build the shared active-production-member query."""
    query = (
        db.query(User)
        .join(
            ProductionMembership,
            ProductionMembership.user_id == User.id,
        )
        .join(Production, Production.id == ProductionMembership.production_id)
        .filter(
            Production.id == production_id,
            User.organization_id == Production.organization_id,
            User.is_active.is_(True),
            ProductionMembership.is_active.is_(True),
        )
    )
    if user_id is not None:
        query = query.filter(User.id == user_id)
    if role_code is not None:
        query = (
            query.join(
                ProductionMembershipRole,
                ProductionMembershipRole.membership_id == ProductionMembership.id,
            )
            .join(
                ProductionRole,
                ProductionRole.id == ProductionMembershipRole.production_role_id,
            )
            .filter(ProductionRole.code == role_code)
        )
    return query


def get_active_production_user(
    db: Session,
    production_id: int,
    user_id: int | None = None,
    *,
    role_code: str | None = None,
) -> User | None:
    """Return an active same-org production member, optionally by role."""

    return _active_production_user_query(
        db,
        production_id,
        user_id,
        role_code=role_code,
    ).first()


def list_active_production_users(
    db: Session,
    production_id: int,
    *,
    role_code: str | None = None,
) -> list[User]:
    """List active same-org production members, optionally by role."""

    query = _active_production_user_query(
        db,
        production_id,
        role_code=role_code,
    )
    return (
        query.distinct()
        .order_by(User.last_name, User.first_name, User.id)
        .all()
    )


def validate_active_same_org_user(
    db: Session,
    production_id: int,
    user_id: int,
) -> User:
    """Return an eligible user or raise a domain error."""

    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise ProductionNotFoundError(f"Production {production_id} does not exist")

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.organization_id == production.organization_id,
            User.is_active.is_(True),
        )
        .first()
    )
    if user is None:
        raise UserNotEligibleError(
            "Membership requires an active user in the production's organization"
        )
    return user


def _normalized_role_codes(role_codes: Iterable[str]) -> list[str]:
    normalized = {code.strip().lower() for code in role_codes}
    normalized.discard("")
    if not normalized:
        raise ProductionMembershipError(
            "An active production membership must have at least one role"
        )
    return sorted(normalized)


def _get_roles_by_code(
    db: Session,
    role_codes: Iterable[str],
) -> dict[str, ProductionRole]:
    normalized_codes = _normalized_role_codes(role_codes)
    roles = (
        db.query(ProductionRole)
        .filter(ProductionRole.code.in_(normalized_codes))
        .all()
    )
    roles_by_code = {role.code: role for role in roles}
    missing = [code for code in normalized_codes if code not in roles_by_code]
    if missing:
        raise ProductionRoleNotFoundError(
            f"Unknown production role code(s): {', '.join(missing)}"
        )
    return roles_by_code


def replace_membership_roles(
    db: Session,
    membership: ProductionMembership | int,
    role_codes: Iterable[str],
) -> ProductionMembership:
    """Replace all role assignments while preserving the membership row."""

    if isinstance(membership, int):
        resolved_membership = (
            db.query(ProductionMembership)
            .filter(ProductionMembership.id == membership)
            .first()
        )
        if resolved_membership is None:
            raise MembershipNotFoundError(f"Membership {membership} does not exist")
        membership = resolved_membership

    roles_by_code = _get_roles_by_code(db, role_codes)
    membership.membership_roles.clear()
    for code in sorted(roles_by_code):
        membership.membership_roles.append(
            ProductionMembershipRole(production_role=roles_by_code[code])
        )
    db.flush()
    return membership


def create_or_reactivate_membership(
    db: Session,
    production_id: int,
    user_id: int,
    role_codes: Iterable[str],
) -> ProductionMembership:
    """Create a membership or reactivate the existing unique row."""

    validate_active_same_org_user(db, production_id, user_id)
    roles_by_code = _get_roles_by_code(db, role_codes)
    membership = get_membership(db, production_id, user_id)

    if membership is None:
        membership = ProductionMembership(
            production_id=production_id,
            user_id=user_id,
            is_active=True,
        )
        db.add(membership)
        db.flush()
    else:
        membership.is_active = True

    membership.membership_roles.clear()
    for code in sorted(roles_by_code):
        membership.membership_roles.append(
            ProductionMembershipRole(production_role=roles_by_code[code])
        )
    db.flush()
    return membership


create_membership = create_or_reactivate_membership


def _resolve_membership(
    db: Session,
    membership_or_production_id: ProductionMembership | int,
    user_id: int | None = None,
) -> ProductionMembership:
    if isinstance(membership_or_production_id, ProductionMembership):
        return membership_or_production_id
    if user_id is None:
        membership = db.get(ProductionMembership, membership_or_production_id)
    else:
        membership = get_membership(db, membership_or_production_id, user_id)
    if membership is None:
        if user_id is None:
            raise MembershipNotFoundError(
                f"Membership {membership_or_production_id} does not exist"
            )
        raise MembershipNotFoundError(
            f"No membership for production {membership_or_production_id} and user {user_id}"
        )
    return membership


def deactivate_membership(
    db: Session,
    membership_or_production_id: ProductionMembership | int,
    user_id: int | None = None,
) -> ProductionMembership:
    """Deactivate a membership without removing roles or cast data."""

    membership = _resolve_membership(db, membership_or_production_id, user_id)
    membership.is_active = False
    db.flush()
    return membership


def active_role_codes(
    db: Session,
    membership_or_production_id: ProductionMembership | int,
    user_id: int | None = None,
) -> set[str]:
    """Return role codes assigned to an active membership."""

    membership = _resolve_membership(db, membership_or_production_id, user_id)
    if not membership.is_active:
        return set()
    return {role.production_role.code for role in membership.membership_roles}


def effective_permissions(
    db: Session,
    membership_or_production_id: ProductionMembership | int,
    user_id: int | None = None,
) -> set[tuple[str, str]]:
    """Return the enabled resource/action union for an active member."""

    membership = _resolve_membership(db, membership_or_production_id, user_id)
    if not membership.is_active:
        return set()

    rows = (
        db.query(ProductionRolePermission)
        .join(
            ProductionMembershipRole,
            ProductionMembershipRole.production_role_id
            == ProductionRolePermission.production_role_id,
        )
        .filter(
            ProductionMembershipRole.membership_id == membership.id,
            ProductionRolePermission.enabled.is_(True),
        )
        .all()
    )
    return {(row.resource, row.action) for row in rows}


get_effective_permissions = effective_permissions
