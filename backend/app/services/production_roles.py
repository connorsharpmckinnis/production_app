"""Admin-managed production role definitions and permission-row seeding."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.db.production_role_defaults import (
    PRODUCTION_PERMISSION_RESOURCES,
    PRODUCTION_ROLE_DEFINITIONS,
    actions_for_resource,
)
from app.models import ProductionMembershipRole, ProductionRole, ProductionRolePermission
from app.schemas.people import ProductionRoleDetailResponse

SYSTEM_ROLE_CODES = frozenset(code for code, _name, _description in PRODUCTION_ROLE_DEFINITIONS)

_CODE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


class ProductionRoleError(ValueError):
    """Raised when a production role create/update is invalid."""


def is_system_role_code(code: str) -> bool:
    return code.strip().lower() in SYSTEM_ROLE_CODES


def slugify_role_code(name: str) -> str:
    """Derive a stable lowercase code from a display name."""

    slug = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)
    if not slug:
        raise ProductionRoleError("Role name must contain at least one letter or number")
    if slug[0].isdigit():
        slug = f"role_{slug}"
    if len(slug) > 64:
        slug = slug[:64].rstrip("_")
    if not _CODE_PATTERN.match(slug):
        raise ProductionRoleError("Could not derive a valid role code from the name")
    return slug


def _normalize_optional_code(code: str | None) -> str | None:
    if code is None:
        return None
    normalized = code.strip().lower()
    if not normalized:
        return None
    if not _CODE_PATTERN.match(normalized):
        raise ProductionRoleError(
            "Role code must be lowercase letters, numbers, and underscores, "
            "starting with a letter"
        )
    return normalized


def _to_detail(role: ProductionRole) -> ProductionRoleDetailResponse:
    return ProductionRoleDetailResponse(
        code=role.code,
        name=role.name,
        description=role.description,
        is_active=role.is_active,
        is_system=is_system_role_code(role.code),
    )


def list_production_role_definitions(
    db: Session,
    *,
    include_inactive: bool = True,
) -> list[ProductionRoleDetailResponse]:
    query = db.query(ProductionRole)
    if not include_inactive:
        query = query.filter(ProductionRole.is_active.is_(True))
    roles = query.order_by(ProductionRole.name, ProductionRole.code).all()
    return [_to_detail(role) for role in roles]


def get_production_role_by_code(db: Session, code: str) -> ProductionRole | None:
    return (
        db.query(ProductionRole)
        .filter(ProductionRole.code == code.strip().lower())
        .first()
    )


def _permission_enabled_map(
    db: Session,
    role: ProductionRole,
) -> dict[tuple[str, str], bool]:
    rows = (
        db.query(ProductionRolePermission)
        .filter(ProductionRolePermission.production_role_id == role.id)
        .all()
    )
    return {(row.resource, row.action): row.enabled for row in rows}


def ensure_permission_rows_for_role(
    db: Session,
    role: ProductionRole,
    enabled_map: dict[tuple[str, str], bool] | None = None,
) -> None:
    """Ensure every resource/action row exists for a role (additive only)."""

    existing = {
        (row.resource, row.action): row
        for row in (
            db.query(ProductionRolePermission)
            .filter(ProductionRolePermission.production_role_id == role.id)
            .all()
        )
    }
    for resource in PRODUCTION_PERMISSION_RESOURCES:
        for action in actions_for_resource(resource):
            key = (resource, action)
            if key in existing:
                continue
            enabled = False if enabled_map is None else bool(enabled_map.get(key, False))
            db.add(
                ProductionRolePermission(
                    production_role_id=role.id,
                    resource=resource,
                    action=action,
                    enabled=enabled,
                )
            )
    db.flush()


def create_production_role(
    db: Session,
    *,
    name: str,
    description: str | None = None,
    code: str | None = None,
    copy_from_role_code: str = "member",
) -> ProductionRoleDetailResponse:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ProductionRoleError("Role name is required")
    if len(cleaned_name) > 100:
        raise ProductionRoleError("Role name must be 100 characters or fewer")

    role_code = _normalize_optional_code(code) or slugify_role_code(cleaned_name)
    if is_system_role_code(role_code):
        raise ProductionRoleError(
            f"Cannot create a role that uses a reserved system code: {role_code}"
        )
    if get_production_role_by_code(db, role_code) is not None:
        raise ProductionRoleError(f"A production role with code '{role_code}' already exists")

    source_code = copy_from_role_code.strip().lower() or "member"
    source = get_production_role_by_code(db, source_code)
    if source is None:
        raise ProductionRoleError(f"Unknown copy-from role code: {source_code}")

    cleaned_description = description.strip() if description else None
    if cleaned_description == "":
        cleaned_description = None

    role = ProductionRole(
        code=role_code,
        name=cleaned_name,
        description=cleaned_description,
        is_active=True,
    )
    db.add(role)
    db.flush()
    ensure_permission_rows_for_role(db, role, _permission_enabled_map(db, source))
    db.commit()
    db.refresh(role)
    return _to_detail(role)


def update_production_role(
    db: Session,
    code: str,
    *,
    name: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> ProductionRoleDetailResponse:
    role = get_production_role_by_code(db, code)
    if role is None:
        raise ProductionRoleError(f"Unknown production role code: {code.strip().lower()}")

    if name is not None:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ProductionRoleError("Role name is required")
        if len(cleaned_name) > 100:
            raise ProductionRoleError("Role name must be 100 characters or fewer")
        role.name = cleaned_name

    if description is not None:
        cleaned_description = description.strip()
        role.description = cleaned_description or None

    if is_active is not None:
        if is_system_role_code(role.code) and not is_active:
            raise ProductionRoleError("System production roles cannot be deactivated")
        if not is_active and role.is_active:
            assigned_count = (
                db.query(ProductionMembershipRole)
                .filter(ProductionMembershipRole.production_role_id == role.id)
                .count()
            )
            if assigned_count:
                raise ProductionRoleError(
                    "Cannot deactivate a role that is still assigned to production members. "
                    "Reassign those members first."
                )
        role.is_active = is_active

    db.commit()
    db.refresh(role)
    return _to_detail(role)
