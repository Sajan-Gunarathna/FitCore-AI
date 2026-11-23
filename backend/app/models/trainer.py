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
    Integer,
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
        UniqueConstraint("gym_id", "id", name="uq_trainer_profiles_gym_id_id"),
        ForeignKeyConstraint(
            ["gym_id", "branch_id"],
            ["gym_branches.gym_id", "gym_branches.id"],
            ondelete="SET NULL",
            name="fk_trainer_branch_composite",
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
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), default="", nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specializations: Mapped[list[str] | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    certifications: Mapped[list[str] | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    years_of_experience: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    gym: Mapped["Gym"] = relationship("Gym", back_populates="trainer_profiles")  # noqa: F821
    user: Mapped["User | None"] = relationship(
        "User", back_populates="trainer_profiles", lazy="selectin"
    )  # noqa: F821
    branch: Mapped["GymBranch | None"] = relationship(
        "GymBranch",
        primaryjoin="and_(TrainerProfile.branch_id == GymBranch.id, TrainerProfile.gym_id == GymBranch.gym_id)",
        foreign_keys="[TrainerProfile.gym_id, TrainerProfile.branch_id]",
        lazy="selectin",
        overlaps="gym,trainer_profiles",
    )  # noqa: F821
    assignments: Mapped[list["TrainerMemberAssignment"]] = relationship(
        "TrainerMemberAssignment",
        back_populates="trainer",
        cascade="all, delete-orphan",
    )


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

    # Relationships
    trainer: Mapped["TrainerProfile"] = relationship(
        "TrainerProfile", back_populates="assignments"
    )
    member: Mapped["Member"] = relationship("Member", overlaps="assignments,trainer")  # noqa: F821
