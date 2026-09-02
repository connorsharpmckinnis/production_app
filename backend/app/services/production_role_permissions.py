from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.db.production_role_defaults import (
    PERMISSION_ACTIONS,
    PRODUCTION_PERMISSION_RESOURCES,
)
from app.models import ProductionRole, ProductionRolePermission
from app.schemas.people import (
    ProductionRolePermissionResponse,
    ProductionRolePermissionUpdate,
)


class ProductionRolePermissionError(ValueError):
    """Raised when a permission matrix update contains an invalid row."""


def list_production_role_permissions(
    db: Session,
) -> list[ProductionRolePermissionResponse]:
    """Return the complete matrix in a deterministic role/resource/action order."""

    rows = (
        db.query(ProductionRolePermission, ProductionRole)
        .join(
            ProductionRole,
            ProductionRole.id == ProductionRolePermission.production_role_id,
        )
        .all()
    )
    action_order = {action: index for index, action in enumerate(PERMISSION_ACTIONS)}
    resource_order = {
        resource: index
        for index, resource in enumerate(PRODUCTION_PERMISSION_RESOURCES)
    }
    rows.sort(
        key=lambda pair: (
            pair[1].code,
            resource_order.get(pair[0].resource, len(resource_order)),
            pair[0].resource,
            action_order.get(pair[0].action, len(action_order)),
            pair[0].action,
        )
    )
    return [
        ProductionRolePermissionResponse(
            role_code=role.code,
            role_name=role.name,
            resource=permission.resource,
            action=permission.action,
            enabled=permission.enabled,
        )
        for permission, role in rows
    ]


def update_production_role_permissions(
    db: Session,
    updates: Iterable[ProductionRolePermissionUpdate],
) -> list[ProductionRolePermissionResponse]:
    """Update enabled flags in place without replacing matrix rows."""

    update_rows = list(updates)
    if not update_rows:
        raise ProductionRolePermissionError("At least one permission row is required")

    role_codes = {row.role_code for row in update_rows}
    roles = (
        db.query(ProductionRole)
        .filter(ProductionRole.code.in_(role_codes))
        .all()
    )
    roles_by_code = {role.code: role for role in roles}
    unknown_roles = sorted(role_codes - roles_by_code.keys())
    if unknown_roles:
        raise ProductionRolePermissionError(
            f"Unknown production role code(s): {', '.join(unknown_roles)}"
        )

    valid_resources = set(PRODUCTION_PERMISSION_RESOURCES)
    valid_actions = set(PERMISSION_ACTIONS)
    seen_keys: set[tuple[str, str, str]] = set()
    for row in update_rows:
        key = (row.role_code, row.resource, row.action)
        if key in seen_keys:
            raise ProductionRolePermissionError(
                "Permission update contains duplicate role/resource/action rows"
            )
        seen_keys.add(key)
        if row.resource not in valid_resources:
            raise ProductionRolePermissionError(
                f"Unknown production permission resource: {row.resource}"
            )
        if row.action not in valid_actions:
            raise ProductionRolePermissionError(
                f"Unknown production permission action: {row.action}"
            )

    permission_keys = [
        (
            roles_by_code[row.role_code].id,
            row.resource,
            row.action,
        )
        for row in update_rows
    ]
    existing_rows = (
        db.query(ProductionRolePermission)
        .filter(
            ProductionRolePermission.production_role_id.in_(
                {role_id for role_id, _, _ in permission_keys}
            )
        )
        .all()
    )
    rows_by_key = {
        (row.production_role_id, row.resource, row.action): row
        for row in existing_rows
    }
    for update, key in zip(update_rows, permission_keys):
        permission = rows_by_key.get(key)
        if permission is None:
            raise ProductionRolePermissionError(
                "Permission row does not exist for the supplied role/resource/action"
            )
        permission.enabled = update.enabled

    db.commit()
    return list_production_role_permissions(db)
