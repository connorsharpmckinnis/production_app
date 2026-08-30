"""Pydantic schemas for announcements and the notification inbox."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

AppRoleName = Literal["Admin", "Director", "Actor", "Member"]
Severity = Literal["info", "success", "warning", "urgent"]
CtaKind = Literal["internal", "external"]
CtaStyle = Literal["primary", "secondary", "link"]
NotificationKind = Literal["announcement", "system", "mention", "task_assigned"]

ALLOWED_ROUTE_FILTERS = {
    None,
    "",
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
}


class AnnouncementCtaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=100)
    kind: CtaKind
    target: str = Field(min_length=1, max_length=1000)
    style: CtaStyle = "primary"
    sort_order: int = 0


class AnnouncementCtaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    kind: CtaKind
    target: str
    style: CtaStyle
    sort_order: int


class AnnouncementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    severity: Severity = "info"
    show_as_banner: bool = False
    show_as_modal: bool = False
    audience_roles: list[AppRoleName] = Field(min_length=1)
    route_filter: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    active: bool = True
    priority: int = 0
    ctas: list[AnnouncementCtaCreate] = Field(default_factory=list)

    @field_validator("audience_roles")
    @classmethod
    def unique_roles(cls, value: list[AppRoleName]) -> list[AppRoleName]:
        if len(set(value)) != len(value):
            raise ValueError("audience_roles must be unique")
        return value

    @field_validator("route_filter")
    @classmethod
    def normalize_route_filter(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        normalized = value.strip().lstrip("/")
        if normalized not in ALLOWED_ROUTE_FILTERS - {None, ""}:
            raise ValueError(f"Unsupported route_filter: {value}")
        return normalized

    @model_validator(mode="after")
    def validate_schedule(self) -> "AnnouncementCreate":
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class AnnouncementUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = Field(default=None, min_length=1)
    severity: Severity | None = None
    show_as_banner: bool | None = None
    show_as_modal: bool | None = None
    audience_roles: list[AppRoleName] | None = Field(default=None, min_length=1)
    route_filter: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    active: bool | None = None
    priority: int | None = None
    ctas: list[AnnouncementCtaCreate] | None = None

    @field_validator("audience_roles")
    @classmethod
    def unique_roles(cls, value: list[AppRoleName] | None) -> list[AppRoleName] | None:
        if value is not None and len(set(value)) != len(value):
            raise ValueError("audience_roles must be unique")
        return value

    @field_validator("route_filter")
    @classmethod
    def normalize_route_filter(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value.strip() == "":
            return ""
        normalized = value.strip().lstrip("/")
        if normalized not in ALLOWED_ROUTE_FILTERS - {None, ""}:
            raise ValueError(f"Unsupported route_filter: {value}")
        return normalized


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    severity: Severity
    show_as_banner: bool
    show_as_modal: bool
    production_id: int | None
    route_filter: str | None
    starts_at: datetime | None
    ends_at: datetime | None
    active: bool
    priority: int
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime
    audience_roles: list[AppRoleName]
    ctas: list[AnnouncementCtaResponse]


class NotificationInboxItem(BaseModel):
    id: int
    kind: NotificationKind
    title: str
    body: str | None
    production_id: int | None
    production_title: str | None = None
    announcement_id: int | None
    actor_user_id: int | None
    actor_display_name: str | None = None
    resource_type: str | None
    resource_id: int | None
    deep_link: str | None
    severity: Severity | None
    read_at: datetime | None
    dismissed_at: datetime | None
    created_at: datetime
    show_as_banner: bool = False
    show_as_modal: bool = False
    route_filter: str | None = None
    priority: int = 0
    ctas: list[AnnouncementCtaResponse] = Field(default_factory=list)


class NotificationInboxResponse(BaseModel):
    unread_count: int
    items: list[NotificationInboxItem]
    active_banner: NotificationInboxItem | None = None
    pending_modal: NotificationInboxItem | None = None
