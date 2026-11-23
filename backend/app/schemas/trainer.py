"""Trainer Pydantic validation and serialization schemas."""

from typing import Any
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TrainerCreate(BaseModel):
    """Schema for creating a trainer profile (Type A staff without login or Type B linked)."""

    full_name: str = Field(..., min_length=2, max_length=255, description="Trainer's display name")
    email: EmailStr | None = Field(default=None, description="Contact email address")
    phone: str | None = Field(default=None, max_length=50, description="Contact phone number")
    branch_id: uuid.UUID | None = Field(default=None, description="Optional primary branch ID")
    user_id: uuid.UUID | None = Field(
        default=None, description="Optional direct Supabase Auth user UUID if linking existing account"
    )
    bio: str | None = Field(
        default=None, max_length=2000, description="Trainer professional biography"
    )
    specializations: list[str] = Field(
        default_factory=list, description="List of coaching specializations/skills"
    )
    certifications: list[str] = Field(
        default_factory=list, description="List of professional fitness certifications"
    )
    years_of_experience: int = Field(
        default=0, ge=0, le=100, description="Years of coaching experience"
    )
    hourly_rate: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        max_digits=10,
        decimal_places=2,
        description="Hourly coaching rate in gym currency",
    )
    joined_at: datetime | None = Field(
        default=None, description="Date trainer joined the gym"
    )
    is_active: bool = Field(default=True, description="Active status")

    @field_validator("email", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TrainerUpdate(BaseModel):
    """Schema for updating trainer profile details."""

    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = Field(default=None)
    phone: str | None = Field(default=None, max_length=50)
    branch_id: uuid.UUID | None = Field(default=None)
    bio: str | None = Field(default=None, max_length=2000)
    specializations: list[str] | None = Field(default=None)
    certifications: list[str] | None = Field(default=None)
    years_of_experience: int | None = Field(default=None, ge=0, le=100)
    hourly_rate: Decimal | None = Field(
        default=None, ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    is_active: bool | None = Field(default=None)


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
    branch_id: uuid.UUID | None = None
    branch_name: str | None = None
    member_status: str
    assignment_status: str
    assigned_at: datetime
    notes: str | None = None


class TrainerRead(BaseModel):
    """Schema for trainer directory view."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    branch_name: str | None = None
    user_id: uuid.UUID | None = None
    full_name: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    specializations: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    years_of_experience: int = 0
    hourly_rate: Decimal
    is_active: bool
    assigned_member_count: int = 0
    joined_at: datetime
    created_at: datetime
    updated_at: datetime


class TrainerDetailRead(TrainerRead):
    """Detailed trainer profile view including assigned members."""

    assigned_members: list[TrainerAssignedMemberSummary] = Field(default_factory=list)


class TrainerStatsResponse(BaseModel):
    """Aggregate statistics for gym trainers."""

    total_trainers: int
    active_trainers: int
    total_assigned_members: int
    average_hourly_rate: Decimal


class TrainerMemberAssignmentCreate(BaseModel):
    """Schema for assigning a member to a trainer."""

    member_id: uuid.UUID = Field(description="UUID of the member to assign")
    notes: str | None = Field(
        default=None, max_length=1000, description="Coaching goals or assignment remarks"
    )


class TrainerMemberReassignInput(BaseModel):
    """Schema for atomically reassigning a member to another trainer."""

    new_trainer_id: uuid.UUID = Field(description="UUID of the new trainer")
    notes: str | None = Field(
        default=None, max_length=1000, description="Optional notes for reassignment"
    )


class MemberTrainerAssignmentRead(BaseModel):
    """Schema returned after assigning/reassigning a member to a trainer."""

    model_config = ConfigDict(from_attributes=True)

    assignment_id: uuid.UUID
    gym_id: uuid.UUID
    trainer_id: uuid.UUID
    trainer_name: str
    member_id: uuid.UUID
    member_name: str
    status: str
    assigned_at: datetime
    notes: str | None = None


class MemberAssignTrainerInput(BaseModel):
    """Schema for assigning a trainer from the member profile perspective."""

    trainer_id: uuid.UUID = Field(description="UUID of the trainer to assign")
    notes: str | None = Field(default=None, max_length=1000)


class MemberReassignTrainerInput(BaseModel):
    """Schema for reassigning a trainer from the member profile perspective."""

    new_trainer_id: uuid.UUID = Field(description="UUID of the new trainer to assign")
    current_trainer_id: uuid.UUID | None = Field(
        default=None, description="Current trainer UUID to replace"
    )
    notes: str | None = Field(default=None, max_length=1000)
