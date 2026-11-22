"""Trainer Pydantic validation and serialization schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TrainerCreate(BaseModel):
    """Schema for creating a trainer profile and linking a user."""

    email: EmailStr = Field(description="Email address of the trainer's user account")
    user_id: uuid.UUID | None = Field(
        default=None, description="Optional direct user UUID if known"
    )
    full_name: str | None = Field(
        default=None, max_length=255, description="Optional display name update"
    )
    bio: str | None = Field(
        default=None, max_length=2000, description="Trainer professional biography"
    )
    specializations: list[str] = Field(
        default_factory=list, description="List of coaching specializations/skills"
    )
    hourly_rate: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        max_digits=10,
        decimal_places=2,
        description="Hourly coaching rate in gym currency",
    )


class TrainerUpdate(BaseModel):
    """Schema for updating trainer profile details."""

    full_name: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)
    specializations: list[str] | None = Field(default=None)
    hourly_rate: Decimal | None = Field(
        default=None, ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )


class TrainerStatusUpdate(BaseModel):
    """Schema for activating or deactivating a trainer."""

    is_active: bool = Field(description="Active coaching status")


class TrainerAssignedMemberSummary(BaseModel):
    """Summary of a member assigned to this trainer."""

    model_config = ConfigDict(from_attributes=True)

    assignment_id: uuid.UUID
    member_id: uuid.UUID
    member_code: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    member_status: str
    assignment_status: str
    assigned_at: datetime
    notes: str | None = None


class TrainerRead(BaseModel):
    """Schema for trainer directory view."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None = None
    bio: str | None = None
    specializations: list[str] = Field(default_factory=list)
    hourly_rate: Decimal
    is_active: bool
    assigned_member_count: int = 0
    created_at: datetime
    updated_at: datetime


class TrainerDetailRead(TrainerRead):
    """Detailed trainer profile view including assigned members."""

    assigned_members: list[TrainerAssignedMemberSummary] = Field(default_factory=list)


class TrainerMemberAssignmentCreate(BaseModel):
    """Schema for assigning a member to a trainer."""

    member_id: uuid.UUID = Field(description="UUID of the member to assign")
    notes: str | None = Field(
        default=None, max_length=1000, description="Coaching goals or assignment remarks"
    )


class TrainerMemberAssignmentRead(BaseModel):
    """Schema for assignment response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    trainer_id: uuid.UUID
    member_id: uuid.UUID
    assigned_at: datetime
    status: str
    notes: str | None = None
