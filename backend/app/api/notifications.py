"""Notification inbox and announcement authorship APIs."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production
from app.auth.dependencies import (
    require_admin,
    require_authenticated,
    require_director_or_admin,
    user_has_role,
)
from app.db.session import get_db
from app.models import User
from app.schemas.notifications import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
    NotificationInboxResponse,
)
from app.services import notifications as notif_service

router = APIRouter(tags=["notifications"])


class MarkAllReadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated: int


@router.get("/notifications/inbox", response_model=NotificationInboxResponse)
def get_notification_inbox(
    production_id: int | None = Query(default=None),
    route_key: str | None = Query(default=None),
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> NotificationInboxResponse:
    return notif_service.build_inbox(
        db,
        user,
        current_production_id=production_id,
        current_route_key=route_key,
    )


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> None:
    notif_service.mark_notification_read(db, user, notification_id)


@router.post("/notifications/read-all", response_model=MarkAllReadResponse)
def mark_all_notifications_read(
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> MarkAllReadResponse:
    updated = notif_service.mark_all_notifications_read(db, user)
    return MarkAllReadResponse(updated=updated)


@router.get("/announcements", response_model=list[AnnouncementResponse])
def list_org_announcements(
    include_inactive: bool = Query(default=True),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AnnouncementResponse]:
    rows = notif_service.list_announcements(
        db, production_id=None, include_inactive=include_inactive
    )
    return [notif_service.serialize_announcement(row) for row in rows]


@router.post(
    "/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_org_announcement(
    body: AnnouncementCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    announcement = notif_service.create_announcement(
        db,
        author=admin,
        body=body,
        production_id=None,
        allow_modal=True,
    )
    return notif_service.serialize_announcement(announcement)


@router.get(
    "/productions/{production_id}/announcements",
    response_model=list[AnnouncementResponse],
)
def list_production_announcements(
    production_id: int,
    include_inactive: bool = Query(default=True),
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> list[AnnouncementResponse]:
    get_accessible_production(db, user, production_id)
    rows = notif_service.list_announcements(
        db, production_id=production_id, include_inactive=include_inactive
    )
    return [notif_service.serialize_announcement(row) for row in rows]


@router.post(
    "/productions/{production_id}/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_production_announcement(
    production_id: int,
    body: AnnouncementCreate,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    get_accessible_production(db, user, production_id)
    announcement = notif_service.create_announcement(
        db,
        author=user,
        body=body,
        production_id=production_id,
        allow_modal=user_has_role(user, "Admin"),
    )
    return notif_service.serialize_announcement(announcement)


@router.get("/announcements/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: int,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    announcement = notif_service.get_announcement_or_404(db, announcement_id)
    if announcement.production_id is None and not user_has_role(user, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins can view org-wide announcements",
        )
    if announcement.production_id is not None:
        get_accessible_production(db, user, announcement.production_id)
    return notif_service.serialize_announcement(announcement)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementResponse)
def patch_announcement(
    announcement_id: int,
    body: AnnouncementUpdate,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    announcement = notif_service.get_announcement_or_404(db, announcement_id)
    if announcement.production_id is None:
        if not user_has_role(user, "Admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins can edit org-wide announcements",
            )
    else:
        get_accessible_production(db, user, announcement.production_id)

    updated = notif_service.update_announcement(
        db,
        announcement=announcement,
        body=body,
        allow_modal=user_has_role(user, "Admin"),
    )
    return notif_service.serialize_announcement(updated)


@router.delete(
    "/announcements/{announcement_id}",
    response_model=AnnouncementResponse | None,
    responses={204: {"description": "Announcement permanently deleted"}},
)
def delete_announcement(
    announcement_id: int,
    user: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> AnnouncementResponse | Response:
    """Deactivate an active announcement; permanently delete an inactive one."""
    announcement = notif_service.get_announcement_or_404(db, announcement_id)
    if announcement.production_id is None:
        if not user_has_role(user, "Admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins can delete org-wide announcements",
            )
    else:
        get_accessible_production(db, user, announcement.production_id)

    if announcement.active:
        deactivated = notif_service.deactivate_announcement(db, announcement)
        deactivated = notif_service.get_announcement_or_404(db, deactivated.id)
        return notif_service.serialize_announcement(deactivated)

    notif_service.hard_delete_announcement(db, announcement)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
