"""Status rules and response fields for suggested/official attachments."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, object_session

from app.api.deps import user_display_name, user_has_production_capability
from app.auth.dependencies import user_has_role
from app.models import Production, Rehearsal, User
from app.services.rehearsal_stamp import matching_rehearsal_id

PrepStatus = str


def resolve_attachment_status(
    db: Session,
    user: User,
    production: Production,
    requested: str | None,
    *,
    legacy_resource: str,
) -> str:
    """Pick suggested vs official for a new attachment.

    People who already have that resource's create permission, or
    ``timeline.approve``, default to official and may choose suggested.
    ``timeline.suggest`` alone can only create suggested rows.
    """

    if requested not in (None, "suggested", "official"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be suggested or official",
        )

    can_official = _can_write_official(db, user, production, legacy_resource)
    can_suggest = user_has_role(user, "Admin") or user_has_production_capability(
        db, user, production, "timeline", "suggest"
    )
    if not can_official and not can_suggest and not user_has_production_capability(
        db, user, production, "timeline", "approve"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="timeline suggest or approve access required",
        )
    if requested == "official" and not can_official:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create an official attachment",
        )
    if requested == "suggested":
        return "suggested"
    if requested == "official":
        return "official"
    return "official" if can_official else "suggested"


def prepare_new_attachment(
    db: Session,
    production: Production,
    user: User,
    row: object,
    requested: str | None,
    *,
    legacy_resource: str,
) -> None:
    """Set status, author, and rehearsal stamp on a new attachment row."""

    chosen = resolve_attachment_status(
        db,
        user,
        production,
        requested,
        legacy_resource=legacy_resource,
    )
    row.status = chosen
    row.created_by_user_id = user.id
    row.updated_by_user_id = user.id
    row.rehearsal_id = matching_rehearsal_id(db, production.id)


def approve_attachment(row: object, user: User) -> None:
    row.status = "official"
    row.updated_by_user_id = user.id
    row.updated_at = datetime.now(timezone.utc)


def assert_can_delete_attachment(
    db: Session,
    user: User,
    production: Production,
    row: object,
    *,
    legacy_resource: str,
) -> None:
    """Official rows need the resource delete capability. Authors may delete their suggestions."""

    if user_has_role(user, "Admin") or user_has_production_capability(
        db, user, production, legacy_resource, "delete"
    ):
        return
    if (
        getattr(row, "status", None) == "suggested"
        and getattr(row, "created_by_user_id", None) == user.id
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"{legacy_resource} delete access required",
    )


def can_approve(db: Session, user: User, production: Production) -> bool:
    return user_has_role(user, "Admin") or user_has_production_capability(
        db, user, production, "timeline", "approve"
    )


def prep_fields(row: object, db: Session | None = None) -> dict:
    """Provenance payload shared by attachment responses."""

    session = db or object_session(row)
    if session is None:
        raise RuntimeError("prep_fields requires a persisted row or a session")
    created_by = _user(session, getattr(row, "created_by_user_id", None))
    updated_by = _user(session, getattr(row, "updated_by_user_id", None))
    rehearsal = _rehearsal(session, getattr(row, "rehearsal_id", None))
    created_at = getattr(row, "created_at", None)
    updated_at = getattr(row, "updated_at", None)
    return {
        "status": getattr(row, "status", None) or "official",
        "created_by_user_id": getattr(row, "created_by_user_id", None),
        "created_by_display_name": user_display_name(created_by) if created_by else None,
        "updated_by_user_id": getattr(row, "updated_by_user_id", None),
        "updated_by_display_name": user_display_name(updated_by) if updated_by else None,
        "created_at": created_at,
        "updated_at": updated_at,
        "rehearsal_id": getattr(row, "rehearsal_id", None),
        "rehearsal_label": _rehearsal_label(rehearsal),
    }


def _can_write_official(
    db: Session,
    user: User,
    production: Production,
    legacy_resource: str,
) -> bool:
    if user_has_role(user, "Admin"):
        return True
    if user_has_production_capability(db, user, production, "timeline", "approve"):
        return True
    return user_has_production_capability(db, user, production, legacy_resource, "create")


def _user(db: Session, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    return db.get(User, user_id)


def _rehearsal(db: Session, rehearsal_id: int | None) -> Rehearsal | None:
    if rehearsal_id is None:
        return None
    return db.get(Rehearsal, rehearsal_id)


def _rehearsal_label(rehearsal: Rehearsal | None) -> str | None:
    if rehearsal is None:
        return None
    if rehearsal.title:
        return rehearsal.title
    return rehearsal.starts_at.strftime("%d/%m/%Y %H:%M")
