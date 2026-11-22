"""Member subscription Pydantic v2 schemas."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.membership import SubscriptionStatus


class MemberSubscriptionBase(BaseModel):
    member_id: uuid.UUID = Field(..., description="Member UUID")
    plan_id: uuid.UUID = Field(..., description="Membership Plan UUID")
    start_date: date = Field(..., description="Subscription start date")
    end_date: date = Field(..., description="Subscription end date")
    price_paid: Decimal = Field(
        ..., ge=0, decimal_places=2, description="Price paid for this cycle"
    )
    currency: str = Field(
        default="USD", max_length=10, description="Currency code (e.g., USD, EUR)"
    )
    status: str = Field(
        default=SubscriptionStatus.ACTIVE.value,
        description="Subscription status: active, expired, cancelled, trial",
    )
    auto_renew: bool = Field(default=False, description="Whether to auto renew")
    notes: str | None = Field(default=None, description="Administrative or billing notes")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        clean = v.strip().upper()
        if not (2 <= len(clean) <= 10):
            raise ValueError("Currency code must be between 2 and 10 characters")
        return clean

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {s.value for s in SubscriptionStatus}
        clean = v.strip().lower()
        if clean not in valid:
            raise ValueError(f"Status must be one of: {', '.join(sorted(valid))}")
        return clean


class MemberSubscriptionCreate(BaseModel):
    member_id: uuid.UUID = Field(..., description="Target member UUID")
    plan_id: uuid.UUID = Field(..., description="Membership plan UUID")
    start_date: date | None = Field(
        default=None, description="Start date (defaults to today if omitted)"
    )
    end_date: date | None = Field(
        default=None, description="End date (defaults to start_date + plan duration)"
    )
    price_paid: Decimal | None = Field(
        default=None, ge=0, decimal_places=2, description="Price paid (defaults to plan price)"
    )
    currency: str | None = Field(
        default=None, max_length=10, description="Currency (defaults to plan currency)"
    )
    auto_renew: bool = Field(default=False, description="Auto-renew flag")
    notes: str | None = Field(default=None, description="Optional notes")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip().upper()
        if not (2 <= len(clean) <= 10):
            raise ValueError("Currency code must be between 2 and 10 characters")
        return clean


class MemberSubscriptionUpdate(BaseModel):
    end_date: date | None = None
    auto_renew: bool | None = None
    notes: str | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is None:
            return None
        valid = {s.value for s in SubscriptionStatus}
        clean = v.strip().lower()
        if clean not in valid:
            raise ValueError(f"Status must be one of: {', '.join(sorted(valid))}")
        return clean


class MemberSubscriptionRenew(BaseModel):
    plan_id: uuid.UUID | None = Field(
        default=None, description="Optional plan change/upgrade; defaults to current plan"
    )
    duration_days: int | None = Field(
        default=None, ge=1, le=3650, description="Custom duration in days"
    )
    price_paid: Decimal | None = Field(
        default=None, ge=0, decimal_places=2, description="Renewal price"
    )
    notes: str | None = Field(default=None, description="Renewal notes")


class SubscriptionCancel(BaseModel):
    reason: str | None = Field(
        default=None, max_length=500, description="Reason for cancellation"
    )


class MemberSubscriptionRead(MemberSubscriptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # Augmented fields for dashboard & directory display
    member_name: str | None = None
    member_code: str | None = None
    member_email: str | None = None
    plan_name: str | None = None
    days_remaining: int | None = None
