from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.encouragement_defaults import DEFAULT_MESSAGE_ROTATION_SECONDS


class AppSetting(Base):
    """Singleton application settings row (id=1)."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    show_original_text: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_parsed_text: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_message_rotation_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=DEFAULT_MESSAGE_ROTATION_SECONDS,
    )
    about_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    about_markdown_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
