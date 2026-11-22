"""Member Pydantic v2 schemas."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.member import MemberStatus


class MemberBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    branch_id: uuid.UUID | None = None
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    emergency_contact: dict[str, Any] | None = None
    status: str = Field(default=MemberStatus.ACTIVE.value)
    notes: str | None = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is None:
            return None
        valid = {"male", "female", "other", "prefer_not_to_say"}
        clean = v.lower().strip()
        if clean not in valid:
            raise ValueError(f"Gender must be one of: {', '.join(sorted(valid))}")
        return clean

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {s.value for s in MemberStatus}
        clean = v.lower().strip()
        if clean not in valid:
            raise ValueError(f"Status must be one of: {', '.join(sorted(valid))}")
        return clean


class MemberCreate(MemberBase):
    member_code: str | None = Field(default=None, max_length=50)
    user_id: uuid.UUID | None = None


class MemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    branch_id: uuid.UUID | None = None
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    emergency_contact: dict[str, Any] | None = None
    notes: str | None = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is None:
            return None
        valid = {"male", "female", "other", "prefer_not_to_say"}
        clean = v.lower().strip()
        if clean not in valid:
            raise ValueError(f"Gender must be one of: {', '.join(sorted(valid))}")
        return clean


class MemberStatusUpdate(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {s.value for s in MemberStatus}
        clean = v.lower().strip()
        if clean not in valid:
            raise ValueError(f"Status must be one of: {', '.join(sorted(valid))}")
        return clean


class MemberRead(MemberBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID | None = None
    member_code: str
    branch_name: str | None = None
    joined_at: datetime
    created_at: datetime
    updated_at: datetime


class MemberSubscriptionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_name: str
    start_date: date
    end_date: date
    status: str
    price_paid: Decimal | None = None
    currency: str = "USD"
    auto_renew: bool = False
    notes: str | None = None
    days_remaining: int | None = None


class MemberTrainerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trainer_id: uuid.UUID
    trainer_name: str
    assigned_at: datetime
    status: str


class MemberDetailRead(MemberRead):
    subscriptions: list[MemberSubscriptionSummary] = []
    assigned_trainers: list[MemberTrainerSummary] = []
