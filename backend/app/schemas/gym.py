"""Gym Pydantic schemas."""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.branch import BranchRead


class GymBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        clean = v.lower().strip()
        if not re.match(r"^[a-z0-9-]+$", clean):
            raise ValueError(
                "Gym slug may only contain lowercase letters, numbers, and hyphens"
            )
        return clean


class GymCreate(GymBase):
    pass


class GymUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = None
    is_active: bool | None = None


class GymRead(GymBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class GymDetailRead(GymRead):
    current_user_roles: list[str] = []
    branches: list[BranchRead] = []
