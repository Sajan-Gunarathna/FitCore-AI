"""Membership plan Pydantic v2 schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.membership import BillingFrequency


class MembershipPlanBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Name of the plan")
    description: str | None = Field(default=None, description="Detailed description")
    duration_days: int = Field(..., ge=1, le=3650, description="Duration in days")
    price: Decimal = Field(..., ge=0, decimal_places=2, description="Price of plan")
    currency: str = Field(
        default="USD", max_length=10, description="Currency code (e.g., USD, EUR)"
    )
    billing_frequency: str = Field(
        default=BillingFrequency.MONTHLY.value,
        description="Billing cycle frequency: one_time, monthly, quarterly, yearly",
    )
    is_active: bool = Field(
        default=True, description="Whether plan is available for assignment"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Plan name must be at least 2 characters")
        return clean

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        clean = v.strip().upper()
        if not (2 <= len(clean) <= 10):
            raise ValueError("Currency code must be between 2 and 10 characters")
        return clean

    @field_validator("billing_frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        valid = {f.value for f in BillingFrequency}
        clean = v.strip().lower()
        if clean not in valid:
            raise ValueError(f"billing_frequency must be one of: {', '.join(sorted(valid))}")
        return clean


class MembershipPlanCreate(MembershipPlanBase):
    pass


class MembershipPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    price: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, max_length=10)
    billing_frequency: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Plan name must be at least 2 characters")
        return clean

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip().upper()
        if not (2 <= len(clean) <= 10):
            raise ValueError("Currency code must be between 2 and 10 characters")
        return clean

    @field_validator("billing_frequency")
    @classmethod
    def validate_frequency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        valid = {f.value for f in BillingFrequency}
        clean = v.strip().lower()
        if clean not in valid:
            raise ValueError(f"billing_frequency must be one of: {', '.join(sorted(valid))}")
        return clean


class PlanStatusUpdate(BaseModel):
    is_active: bool = Field(..., description="Active status of plan")


class MembershipPlanRead(MembershipPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
