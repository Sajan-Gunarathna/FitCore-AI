"""Gym ORM model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Gym(Base):
    __tablename__ = "gyms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    branches: Mapped[list["GymBranch"]] = relationship(  # noqa: F821
        "GymBranch", back_populates="gym", cascade="all, delete-orphan"
    )
    user_roles: Mapped[list["GymUserRole"]] = relationship(  # noqa: F821
        "GymUserRole", back_populates="gym", cascade="all, delete-orphan"
    )
    members: Mapped[list["Member"]] = relationship(  # noqa: F821
        "Member", back_populates="gym", cascade="all, delete-orphan"
    )
    trainer_profiles: Mapped[list["TrainerProfile"]] = relationship(  # noqa: F821
        "TrainerProfile", back_populates="gym", cascade="all, delete-orphan"
    )
    membership_plans: Mapped[list["MembershipPlan"]] = relationship(  # noqa: F821
        "MembershipPlan", back_populates="gym", cascade="all, delete-orphan"
    )
