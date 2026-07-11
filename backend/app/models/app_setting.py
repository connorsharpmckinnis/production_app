from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSetting(Base):
    """Singleton application settings row (id=1)."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    show_original_text: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_parsed_text: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
