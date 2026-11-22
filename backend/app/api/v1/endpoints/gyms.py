"""Gym and Branch management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentTenant, CurrentUser, RequireGymAdmin
from app.schemas.branch import BranchCreate, BranchRead
from app.schemas.gym import GymCreate, GymDetailRead, GymRead
from app.schemas.role import GymUserRoleRead, RoleAssignmentCreate
from app.services.branch_service import BranchService
from app.services.gym_service import GymService
from app.services.role_service import RoleService

router = APIRouter()


# ── Gyms ───────────────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=GymDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new gym",
)
async def create_gym(
    data: GymCreate,
    current_user: CurrentUser,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> GymDetailRead:
    """
    Register a new gym as an authenticated user.
    Atomically:
    - Creates the gym record with a unique slug
    - Grants the caller the 'owner' role
    - Creates a default 'Main' branch
    - Writes an immutable audit log entry
    """
    gym_service = GymService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await gym_service.create_gym(
        user=current_user,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "",
    response_model=list[GymRead],
    summary="List accessible gyms",
)
async def list_my_gyms(
    current_user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[GymRead]:
    """
    Lists all gyms the authenticated user belongs to.
    Platform super administrators receive all gyms.
    """
    gym_service = GymService(session)
    return await gym_service.list_user_gyms(current_user)


@router.get(
    "/{gym_id}",
    response_model=GymDetailRead,
    summary="Get gym details",
)
async def get_gym_detail(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> GymDetailRead:
    """
    Get detailed gym profile and its branches.
    Enforces tenant context resolution: fails with 403 if user lacks active
    membership in gym_id.
    """
    gym_service = GymService(session)
    return await gym_service.get_gym_detail(tenant.gym_id, tenant.user)


# ── Branches ───────────────────────────────────────────────────────────────────
@router.post(
    "/{gym_id}/branches",
    response_model=BranchRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new gym branch",
)
async def create_branch(
    gym_id: uuid.UUID,
    data: BranchCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> BranchRead:
    """
    Add a branch/location to the gym.
    Requires Gym Owner or Gym Admin role in the authoritative tenant gym.
    Uses tenant.gym_id to guarantee operation is executed against the authorized gym.
    """
    branch_service = BranchService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await branch_service.create_branch(
        gym_id=tenant.gym_id,
        data=data,
        current_user=tenant.user,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/{gym_id}/branches",
    response_model=list[BranchRead],
    summary="List branches of a gym",
)
async def list_branches(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[BranchRead]:
    """
    List all branches of the gym.
    Available to any member or staff of this gym.
    Uses tenant.gym_id to guarantee operation is executed against the authorized gym.
    """
    branch_service = BranchService(session)
    return await branch_service.list_branches(gym_id=tenant.gym_id)


# ── Gym Users & Roles ──────────────────────────────────────────────────────────
@router.post(
    "/{gym_id}/users",
    response_model=GymUserRoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Assign or invite user role in gym",
)
async def assign_gym_user_role(
    gym_id: uuid.UUID,
    data: RoleAssignmentCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> GymUserRoleRead:
    """
    Assign a role ('owner', 'admin', 'trainer', 'member') to a user.
    - Requires Gym Owner or Admin in the authorized gym.
    - Only Gym Owners can assign other Owners.
    - Admins cannot escalate privileges to Owner.
    - Uses tenant.gym_id to guarantee operation is executed against the authorized gym.
    """
    role_service = RoleService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await role_service.assign_role(
        gym_id=tenant.gym_id,
        data=data,
        current_user=tenant.user,
        current_user_roles=tenant.roles,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/{gym_id}/users",
    response_model=list[GymUserRoleRead],
    summary="List users and roles in gym",
)
async def list_gym_users(
    gym_id: uuid.UUID,
    tenant: RequireGymAdmin,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[GymUserRoleRead]:
    """
    List all staff and member role assignments in this gym.
    Requires Gym Owner or Admin in the authorized gym.
    Uses tenant.gym_id to guarantee operation is executed against the authorized gym.
    """
    role_service = RoleService(session)
    return await role_service.list_gym_roles(gym_id=tenant.gym_id)
