"""User Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class GymMembershipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gym_id: uuid.UUID
    gym_name: str
    gym_slug: str
    role: str
    is_active: bool


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None
    is_super_admin: bool = False
    created_at: datetime
    updated_at: datetime


class UserProfileResponse(UserRead):
    gyms: list[GymMembershipSummary] = []


class UserUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
