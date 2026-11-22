"""Role & Permission Pydantic schemas."""

import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserRoleEnum(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    TRAINER = "trainer"
    MEMBER = "member"


class RoleAssignmentCreate(BaseModel):
    email: EmailStr
    role: UserRoleEnum
    full_name: str | None = None


class GymUserRoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user_email: str | None = None
    user_name: str | None = None
