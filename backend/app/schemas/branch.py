"""Gym Branch Pydantic schemas."""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    is_main: bool = False

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        clean = v.lower().strip()
        if not re.match(r"^[a-z0-9-]+$", clean):
            raise ValueError(
                "Branch slug may only contain lowercase letters, numbers, and hyphens"
            )
        return clean


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    is_main: bool | None = None
    is_active: bool | None = None

    @field_validator("email", "phone", "address", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: str | None) -> str | None:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class BranchRead(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
