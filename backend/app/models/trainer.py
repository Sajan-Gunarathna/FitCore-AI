"""Trainer ORM models."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AssignmentStatus(enum.StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrainerProfile(Base):
    __tablename__ = "trainer_profiles"
    __table_args__ = (
        UniqueConstraint("gym_id", "user_id", name="uq_trainer_user_per_gym"),
        UniqueConstraint("gym_id", "id", name="uq_trainer_profiles_gym_id_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specializations: Mapped[list[str] | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
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
    gym: Mapped["Gym"] = relationship("Gym", back_populates="trainer_profiles")  # noqa: F821
    user: Mapped["User"] = relationship("User", back_populates="trainer_profiles")  # noqa: F821


class TrainerMemberAssignment(Base):
    __tablename__ = "trainer_member_assignments"
    __table_args__ = (
        UniqueConstraint(
            "gym_id", "trainer_id", "member_id", name="uq_trainer_member_assignment"
        ),
        ForeignKeyConstraint(
            ["gym_id", "trainer_id"],
            ["trainer_profiles.gym_id", "trainer_profiles.id"],
            ondelete="CASCADE",
            name="fk_assignment_trainer_composite",
        ),
        ForeignKeyConstraint(
            ["gym_id", "member_id"],
            ["members.gym_id", "members.id"],
            ondelete="CASCADE",
            name="fk_assignment_member_composite",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trainer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default=AssignmentStatus.ACTIVE.value, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
