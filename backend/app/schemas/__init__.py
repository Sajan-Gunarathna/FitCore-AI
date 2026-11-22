"""Pydantic v2 schemas for FitCore AI."""

from app.schemas.branch import (
    BranchCreate,
    BranchRead,
    BranchUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse, PaginationParams
from app.schemas.gym import (
    GymCreate,
    GymDetailRead,
    GymRead,
    GymUpdate,
)
from app.schemas.role import (
    GymUserRoleRead,
    RoleAssignmentCreate,
    UserRoleEnum,
)
from app.schemas.user import (
    GymMembershipSummary,
    UserProfileResponse,
    UserRead,
    UserUpdate,
)

__all__ = [
    "MessageResponse",
    "PaginationParams",
    "PaginatedResponse",
    "UserRead",
    "UserUpdate",
    "UserProfileResponse",
    "GymMembershipSummary",
    "UserRoleEnum",
    "RoleAssignmentCreate",
    "GymUserRoleRead",
    "GymCreate",
    "GymUpdate",
    "GymRead",
    "GymDetailRead",
    "BranchCreate",
    "BranchUpdate",
    "BranchRead",
]
