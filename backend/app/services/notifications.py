"""Announcements authorship, audience fan-out, and notification inbox."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy import exists, false, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import user_display_name
from app.auth.dependencies import user_has_role
from app.models import (
    Announcement,
    AnnouncementAudienceRole,
    AnnouncementCta,
    AppRole,
    Notification,
    Production,
    ProductionMembership,
    User,
    UserAppRole,
)
from app.schemas.notifications import (
    AnnouncementCreate,
    AnnouncementCtaCreate,
    AnnouncementCtaResponse,
    AnnouncementResponse,
    AnnouncementUpdate,
    NotificationInboxItem,
    NotificationInboxResponse,
)
from app.services.production_memberships import list_active_production_users

INBOX_RECENT_LIMIT = 100

VALID_ROLES = frozenset({"Admin", "Director", "Actor", "Member"})
GLOBAL_AUDIENCE_ROLES = frozenset({"Admin"})
PRODUCTION_AUDIENCE_ROLE_CODES = {
    "Director": "director",
    "Actor": "actor",
    "Member": "member",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_internal_path(target: str) -> str:
    cleaned = target.strip()
    path = cleaned if cleaned.startswith("/") else f"/{cleaned}"
    if "#" in path:
        path = path.split("#", 1)[0]
    base = path.split("?", 1)[0]
    if base.endswith("/") and base != "/":
        base = base[:-1]
    if "://" in base or base.lower().startswith("javascript:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Internal CTA must be an app path",
        )
    allowed_exact = {"/about", "/settings", "/users", "/productions"}
    if base in allowed_exact:
        return path
    prod_match = re.match(r"^/productions/(\d+)(?:/([a-z0-9-]+))?$", base)
    if prod_match:
        child = prod_match.group(2)
        allowed_children = {
            None,
            "overview",
            "rehearse",
            "timeline",
            "import",
            "characters",
            "songs",
            "props",
            "costumes",
            "set-pieces",
            "groups",
            "lav-chart",
            "reports",
            "announcements",
        }
        if child in allowed_children:
            return path
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Internal CTA path is not allowed: {cleaned}",
    )


def validate_cta(cta: AnnouncementCtaCreate) -> tuple[str, str]:
    cleaned = cta.target.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CTA target is required",
        )
    if cta.kind == "external":
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"https", "http"} or not parsed.netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="External CTA must be an http(s) URL",
            )
        return cta.kind, cleaned
    return cta.kind, _validate_internal_path(cleaned)


def announcement_in_schedule(announcement: Announcement, now: datetime | None = None) -> bool:
    now = now or _utcnow()
    starts = announcement.starts_at
    ends = announcement.ends_at
    if starts is not None and starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    if ends is not None and ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    if starts and now < starts:
        return False
    if ends and now > ends:
        return False
    return True


def resolve_audience_user_ids(
    db: Session,
    *,
    organization_id: int,
    production_id: int | None,
    role_names: list[str],
) -> list[int]:
    """Users who have any of the target roles and can see the announcement scope."""
    if production_id is None:
        roles = set(role_names) & GLOBAL_AUDIENCE_ROLES
        if not roles:
            return []

        role_rows = db.query(AppRole).filter(AppRole.name.in_(roles)).all()
        role_ids = [role.id for role in role_rows]
        if not role_ids:
            return []

        candidates = (
            db.query(User)
            .join(UserAppRole, UserAppRole.user_id == User.id)
            .filter(
                User.organization_id == organization_id,
                User.is_active.is_(True),
                UserAppRole.app_role_id.in_(role_ids),
            )
            .distinct()
            .all()
        )
        return sorted({user.id for user in candidates})

    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None or production.organization_id != organization_id:
        return []

    user_ids: set[int] = set()
    requested_roles = set(role_names) & VALID_ROLES

    # Admin remains an organization-wide bypass for production announcements.
    if "Admin" in requested_roles:
        admin_role = db.query(AppRole).filter(AppRole.name == "Admin").first()
        if admin_role is not None:
            admin_ids = (
                db.query(User.id)
                .join(UserAppRole, UserAppRole.user_id == User.id)
                .filter(
                    User.organization_id == production.organization_id,
                    User.is_active.is_(True),
                    UserAppRole.app_role_id == admin_role.id,
                )
                .all()
            )
            user_ids.update(user_id for (user_id,) in admin_ids)

    for role_name, role_code in PRODUCTION_AUDIENCE_ROLE_CODES.items():
        if role_name not in requested_roles:
            continue
        user_ids.update(
            user.id
            for user in list_active_production_users(
                db,
                production.id,
                role_code=role_code,
            )
        )

    return sorted(user_ids)


def _build_ctas(announcement_id: int, ctas: list[AnnouncementCtaCreate]) -> list[AnnouncementCta]:
    rows: list[AnnouncementCta] = []
    for index, cta in enumerate(ctas):
        kind, target = validate_cta(cta)
        rows.append(
            AnnouncementCta(
                announcement_id=announcement_id,
                label=cta.label.strip(),
                kind=kind,
                target=target,
                style=cta.style,
                sort_order=cta.sort_order if cta.sort_order else index,
            )
        )
    return rows


def _load_announcement(db: Session, announcement_id: int) -> Announcement:
    return (
        db.query(Announcement)
        .options(
            joinedload(Announcement.audience_roles),
            joinedload(Announcement.ctas),
            joinedload(Announcement.production),
        )
        .filter(Announcement.id == announcement_id)
        .one()
    )


def fan_out_announcement_notifications(db: Session, announcement: Announcement) -> int:
    """Create per-user notification rows for the announcement audience. Idempotent per user."""
    if not announcement.active:
        return 0

    production = announcement.production
    organization_id = (
        production.organization_id
        if production is not None
        else db.query(User.organization_id)
        .filter(User.id == announcement.created_by_user_id)
        .scalar()
    )
    if organization_id is None:
        return 0

    role_names = [r.role_name for r in announcement.audience_roles]
    user_ids = resolve_audience_user_ids(
        db,
        organization_id=organization_id,
        production_id=announcement.production_id,
        role_names=role_names,
    )

    existing = {
        row.user_id
        for row in db.query(Notification.user_id)
        .filter(
            Notification.announcement_id == announcement.id,
            Notification.kind == "announcement",
        )
        .all()
    }

    deep_link = None
    if announcement.production_id is not None:
        deep_link = f"/productions/{announcement.production_id}"

    created = 0
    for user_id in user_ids:
        if user_id in existing:
            continue
        emit_notification(
            db,
            user_id=user_id,
            kind="announcement",
            title=announcement.title,
            body=announcement.body,
            production_id=announcement.production_id,
            announcement_id=announcement.id,
            actor_user_id=announcement.created_by_user_id,
            resource_type="announcement",
            resource_id=announcement.id,
            deep_link=deep_link,
            severity=announcement.severity,
        )
        created += 1
    return created


def emit_notification(
    db: Session,
    *,
    user_id: int,
    kind: str,
    title: str,
    body: str | None = None,
    production_id: int | None = None,
    announcement_id: int | None = None,
    actor_user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    deep_link: str | None = None,
    severity: str | None = None,
) -> Notification:
    """Write one inbox row. Used by announcements, system events, and (later) mentions."""
    row = Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        production_id=production_id,
        announcement_id=announcement_id,
        actor_user_id=actor_user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        deep_link=deep_link,
        severity=severity,
    )
    db.add(row)
    return row


def notify_admins_production_created(
    db: Session,
    *,
    production: Production,
    actor: User,
) -> int:
    """System notification: new production → all Admins in the org."""
    admin_role = db.query(AppRole).filter(AppRole.name == "Admin").first()
    if admin_role is None:
        return 0

    admins = (
        db.query(User)
        .join(UserAppRole, UserAppRole.user_id == User.id)
        .filter(
            User.organization_id == production.organization_id,
            User.is_active.is_(True),
            UserAppRole.app_role_id == admin_role.id,
        )
        .all()
    )

    actor_name = user_display_name(actor)
    title = f"New production: {production.title}"
    body = f'{actor_name} created a new production: "{production.title}".'
    deep_link = f"/productions/{production.id}"

    created = 0
    for admin in admins:
        emit_notification(
            db,
            user_id=admin.id,
            kind="system",
            title=title,
            body=body,
            production_id=production.id,
            actor_user_id=actor.id,
            resource_type="production",
            resource_id=production.id,
            deep_link=deep_link,
            severity="info",
        )
        created += 1
    return created


def create_announcement(
    db: Session,
    *,
    author: User,
    body: AnnouncementCreate,
    production_id: int | None,
    allow_modal: bool,
) -> Announcement:
    if body.show_as_modal and not allow_modal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins can create blocking modal announcements",
        )
    if production_id is None and not user_has_role(author, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins can create org-wide announcements",
        )

    announcement = Announcement(
        title=body.title.strip(),
        body=body.body.strip(),
        severity=body.severity,
        show_as_banner=body.show_as_banner,
        show_as_modal=body.show_as_modal,
        production_id=production_id,
        route_filter=body.route_filter,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        active=body.active,
        priority=body.priority,
        created_by_user_id=author.id,
    )
    db.add(announcement)
    db.flush()

    for role_name in body.audience_roles:
        db.add(
            AnnouncementAudienceRole(
                announcement_id=announcement.id,
                role_name=role_name,
            )
        )
    for cta_row in _build_ctas(announcement.id, body.ctas):
        db.add(cta_row)

    db.flush()
    announcement = _load_announcement(db, announcement.id)
    fan_out_announcement_notifications(db, announcement)
    db.commit()
    return _load_announcement(db, announcement.id)


def update_announcement(
    db: Session,
    *,
    announcement: Announcement,
    body: AnnouncementUpdate,
    allow_modal: bool,
) -> Announcement:
    if body.show_as_modal is True and not allow_modal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins can enable blocking modal announcements",
        )

    if body.title is not None:
        announcement.title = body.title.strip()
    if body.body is not None:
        announcement.body = body.body.strip()
    if body.severity is not None:
        announcement.severity = body.severity
    if body.show_as_banner is not None:
        announcement.show_as_banner = body.show_as_banner
    if body.show_as_modal is not None:
        announcement.show_as_modal = body.show_as_modal
    if body.route_filter is not None:
        announcement.route_filter = body.route_filter or None
    if "starts_at" in body.model_fields_set:
        announcement.starts_at = body.starts_at
    if "ends_at" in body.model_fields_set:
        announcement.ends_at = body.ends_at
    if body.active is not None:
        announcement.active = body.active
    if body.priority is not None:
        announcement.priority = body.priority

    if body.audience_roles is not None:
        announcement.audience_roles.clear()
        db.flush()
        for role_name in body.audience_roles:
            db.add(
                AnnouncementAudienceRole(
                    announcement_id=announcement.id,
                    role_name=role_name,
                )
            )

    if body.ctas is not None:
        announcement.ctas.clear()
        db.flush()
        for cta_row in _build_ctas(announcement.id, body.ctas):
            db.add(cta_row)

    db.flush()

    db.query(Notification).filter(
        Notification.announcement_id == announcement.id,
        Notification.kind == "announcement",
    ).update(
        {
            Notification.title: announcement.title,
            Notification.body: announcement.body,
            Notification.severity: announcement.severity,
        },
        synchronize_session=False,
    )

    announcement = _load_announcement(db, announcement.id)
    fan_out_announcement_notifications(db, announcement)
    db.commit()
    return _load_announcement(db, announcement.id)


def deactivate_announcement(db: Session, announcement: Announcement) -> Announcement:
    announcement.active = False
    db.commit()
    db.refresh(announcement)
    return announcement


def hard_delete_announcement(db: Session, announcement: Announcement) -> None:
    """Permanently remove an announcement.

    Inbox notification rows keep their denormalized title/body; announcement_id
    is SET NULL by FK. CTAs and audience roles cascade-delete with the row.
    """
    db.delete(announcement)
    db.commit()


def list_announcements(
    db: Session,
    *,
    production_id: int | None,
    include_inactive: bool = True,
) -> list[Announcement]:
    query = db.query(Announcement).options(
        joinedload(Announcement.audience_roles),
        joinedload(Announcement.ctas),
    )
    if production_id is None:
        query = query.filter(Announcement.production_id.is_(None))
    else:
        query = query.filter(Announcement.production_id == production_id)
    if not include_inactive:
        query = query.filter(Announcement.active.is_(True))
    return query.order_by(Announcement.created_at.desc()).all()


def get_announcement_or_404(db: Session, announcement_id: int) -> Announcement:
    announcement = (
        db.query(Announcement)
        .options(
            joinedload(Announcement.audience_roles),
            joinedload(Announcement.ctas),
            joinedload(Announcement.production),
        )
        .filter(Announcement.id == announcement_id)
        .first()
    )
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    return announcement


def serialize_announcement(announcement: Announcement) -> AnnouncementResponse:
    return AnnouncementResponse(
        id=announcement.id,
        title=announcement.title,
        body=announcement.body,
        severity=announcement.severity,  # type: ignore[arg-type]
        show_as_banner=announcement.show_as_banner,
        show_as_modal=announcement.show_as_modal,
        production_id=announcement.production_id,
        route_filter=announcement.route_filter,
        starts_at=announcement.starts_at,
        ends_at=announcement.ends_at,
        active=announcement.active,
        priority=announcement.priority,
        created_by_user_id=announcement.created_by_user_id,
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
        audience_roles=[r.role_name for r in announcement.audience_roles],  # type: ignore[misc]
        ctas=[
            AnnouncementCtaResponse.model_validate(c)
            for c in sorted(announcement.ctas, key=lambda c: c.sort_order)
        ],
    )


def _route_matches(route_filter: str | None, current_route_key: str | None) -> bool:
    if not route_filter:
        return True
    if not current_route_key:
        return False
    return route_filter == current_route_key


def _notification_to_item(
    notification: Notification,
    *,
    production_title: str | None = None,
) -> NotificationInboxItem:
    announcement = notification.announcement
    ctas: list[AnnouncementCtaResponse] = []
    show_as_banner = False
    show_as_modal = False
    route_filter = None
    priority = 0
    title = notification.title
    body = notification.body
    severity = notification.severity

    if announcement is not None:
        title = announcement.title
        body = announcement.body
        severity = announcement.severity
        in_window = announcement.active and announcement_in_schedule(announcement)
        show_as_banner = announcement.show_as_banner and in_window
        show_as_modal = announcement.show_as_modal and in_window
        route_filter = announcement.route_filter
        priority = announcement.priority
        ctas = [
            AnnouncementCtaResponse.model_validate(c)
            for c in sorted(announcement.ctas, key=lambda c: c.sort_order)
        ]

    actor_name = None
    if notification.actor is not None:
        actor_name = user_display_name(notification.actor)

    return NotificationInboxItem(
        id=notification.id,
        kind=notification.kind,  # type: ignore[arg-type]
        title=title,
        body=body,
        production_id=notification.production_id,
        production_title=production_title,
        announcement_id=notification.announcement_id,
        actor_user_id=notification.actor_user_id,
        actor_display_name=actor_name,
        resource_type=notification.resource_type,
        resource_id=notification.resource_id,
        deep_link=notification.deep_link,
        severity=severity,  # type: ignore[arg-type]
        read_at=notification.read_at,
        dismissed_at=notification.dismissed_at,
        created_at=notification.created_at,
        show_as_banner=show_as_banner,
        show_as_modal=show_as_modal,
        route_filter=route_filter,
        priority=priority,
        ctas=ctas,
    )


def _notification_scope_filter(user: User):
    """Keep production notifications limited to currently eligible users."""
    if not user.is_active:
        return false()

    production_exists = exists().where(
        Production.id == Notification.production_id,
        Production.organization_id == user.organization_id,
    )
    if user_has_role(user, "Admin"):
        return or_(Notification.production_id.is_(None), production_exists)

    active_membership_exists = exists().where(
        Production.id == Notification.production_id,
        Production.organization_id == user.organization_id,
        ProductionMembership.production_id == Production.id,
        ProductionMembership.user_id == user.id,
        ProductionMembership.is_active.is_(True),
    )
    return or_(Notification.production_id.is_(None), active_membership_exists)


def build_inbox(
    db: Session,
    user: User,
    *,
    current_production_id: int | None = None,
    current_route_key: str | None = None,
) -> NotificationInboxResponse:
    notification_scope = _notification_scope_filter(user)
    unread_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
            notification_scope,
        )
        .count()
    )

    rows = (
        db.query(Notification)
        .options(
            joinedload(Notification.announcement).joinedload(Announcement.ctas),
            joinedload(Notification.actor),
            joinedload(Notification.production),
        )
        .filter(Notification.user_id == user.id, notification_scope)
        .order_by(Notification.created_at.desc())
        .limit(max(INBOX_RECENT_LIMIT * 2, 200))
        .all()
    )

    unread_items = [r for r in rows if r.read_at is None]
    read_items = [r for r in rows if r.read_at is not None]
    selected = (unread_items + read_items)[:INBOX_RECENT_LIMIT]

    items = [
        _notification_to_item(
            row,
            production_title=row.production.title if row.production else None,
        )
        for row in selected
    ]

    undismissed = (
        db.query(Notification)
        .options(
            joinedload(Notification.announcement).joinedload(Announcement.ctas),
            joinedload(Notification.actor),
            joinedload(Notification.production),
        )
        .filter(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
            Notification.dismissed_at.is_(None),
            Notification.kind == "announcement",
            Notification.announcement_id.isnot(None),
            notification_scope,
        )
        .all()
    )

    banner_pool: list[NotificationInboxItem] = []
    modal_pool: list[NotificationInboxItem] = []
    for row in undismissed:
        item = _notification_to_item(
            row,
            production_title=row.production.title if row.production else None,
        )
        if item.show_as_banner and _route_matches(item.route_filter, current_route_key):
            if item.production_id is None or (
                current_production_id is not None
                and item.production_id == current_production_id
            ):
                banner_pool.append(item)
        if item.show_as_modal:
            modal_pool.append(item)

    active_banner = None
    if banner_pool:
        banner_pool.sort(key=lambda i: (-i.priority, -i.created_at.timestamp()))
        active_banner = banner_pool[0]

    pending_modal = None
    if modal_pool:
        modal_pool.sort(key=lambda i: (-i.priority, i.created_at.timestamp()))
        pending_modal = modal_pool[0]

    return NotificationInboxResponse(
        unread_count=unread_count,
        items=items,
        active_banner=active_banner,
        pending_modal=pending_modal,
    )


def mark_notification_read(db: Session, user: User, notification_id: int) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    now = _utcnow()
    if notification.read_at is None:
        notification.read_at = now
    if notification.dismissed_at is None:
        notification.dismissed_at = now
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user: User) -> int:
    now = _utcnow()
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update(
            {Notification.read_at: now, Notification.dismissed_at: now},
            synchronize_session=False,
        )
    )
    db.commit()
    return int(updated or 0)
