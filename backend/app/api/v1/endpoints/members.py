"""Member management API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentTenant, RequireGymAdmin
from app.schemas.common import PaginatedResponse
from app.schemas.member import (
    MemberCreate,
    MemberDetailRead,
    MemberRead,
    MemberStatusUpdate,
    MemberUpdate,
)
from app.services.member_service import MemberService

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[MemberRead],
    summary="List members in gym",
)
async def list_members(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=100, description="Items per page")
    ] = 20,
    search: Annotated[
        str | None,
        Query(description="Search by name, email, phone, or member code"),
    ] = None,
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="Filter by member status"),
    ] = None,
    branch_id: Annotated[
        uuid.UUID | None, Query(description="Filter by branch UUID")
    ] = None,
) -> PaginatedResponse[MemberRead]:
    """
    List members in this gym with pagination, search, and status/branch filtering.
    - Gym Owners and Admins: see all gym members.
    - Trainers: see only their assigned members.
    - Members: see only themselves.
    """
    member_service = MemberService(session)
    return await member_service.list_members(
        tenant=tenant,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        branch_id=branch_id,
    )


@router.post(
    "",
    response_model=MemberRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new gym member",
)
async def create_member(
    gym_id: uuid.UUID,
    data: MemberCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberRead:
    """
    Register a new gym member (walk-in or user-linked).
    - Requires Gym Owner or Admin role.
    - Automatically generates collision-safe member code if omitted.
    - Validates branch belongs to this gym.
    - Records an immutable audit log entry.
    """
    member_service = MemberService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await member_service.create_member(
        tenant=tenant,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/{member_id}",
    response_model=MemberDetailRead,
    summary="Get member details",
)
async def get_member(
    gym_id: uuid.UUID,
    member_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberDetailRead:
    """
    Retrieve full member profile, active subscriptions, and assigned trainers.
    - Gym Owners and Admins: can access any member in this gym.
    - Trainers: can only access assigned members.
    - Members: can only access their own profile.
    """
    member_service = MemberService(session)
    return await member_service.get_member(tenant=tenant, member_id=member_id)


@router.patch(
    "/{member_id}",
    response_model=MemberRead,
    summary="Update member profile",
)
async def update_member(
    gym_id: uuid.UUID,
    member_id: uuid.UUID,
    data: MemberUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberRead:
    """
    Update personal, contact, and branch details for a member.
    - Requires Gym Owner or Admin role.
    - If branch_id changed, validates that it belongs to this gym.
    - Records audit log of updated fields.
    """
    member_service = MemberService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await member_service.update_member(
        tenant=tenant,
        member_id=member_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.patch(
    "/{member_id}/status",
    response_model=MemberRead,
    summary="Update member status",
)
async def update_member_status(
    gym_id: uuid.UUID,
    member_id: uuid.UUID,
    data: MemberStatusUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberRead:
    """
    Update member status (active, inactive, suspended, pending) with optional audit reason.
    - Requires Gym Owner or Admin role.
    - Records status change in audit logs.
    """
    member_service = MemberService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await member_service.update_member_status(
        tenant=tenant,
        member_id=member_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )
