from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AppRole(Base):
    __tablename__ = "app_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    users: Mapped[list["User"]] = relationship(
        secondary="user_app_roles",
        back_populates="app_roles",
    )


class UserAppRole(Base):
    __tablename__ = "user_app_roles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        primary_key=True,
        index=True,
    )
    app_role_id: Mapped[int] = mapped_column(
        ForeignKey("app_roles.id"),
        primary_key=True,
        index=True,
    )
