"""Membership plan API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentTenant, RequireGymAdmin
from app.schemas.common import PaginatedResponse
from app.schemas.plan import (
    MembershipPlanCreate,
    MembershipPlanRead,
    MembershipPlanUpdate,
    PlanStatusUpdate,
)
from app.services.plan_service import PlanService

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[MembershipPlanRead],
    summary="List membership plans in gym",
)
async def list_plans(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=100, description="Items per page")
    ] = 50,
    search: Annotated[
        str | None,
        Query(description="Search by name or description"),
    ] = None,
    is_active: Annotated[
        bool | None,
        Query(description="Filter by active status"),
    ] = None,
) -> PaginatedResponse[MembershipPlanRead]:
    """
    List membership plans available in this gym.
    Accessible to all authorized tenant roles (Owner, Admin, Trainer, Member).
    """
    service = PlanService(session)
    return await service.list_plans(
        tenant=tenant,
        page=page,
        page_size=page_size,
        is_active=is_active,
        search=search,
    )


@router.post(
    "",
    response_model=MembershipPlanRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new membership plan",
)
async def create_plan(
    gym_id: uuid.UUID,
    data: MembershipPlanCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MembershipPlanRead:
    """
    Create a new membership plan with pricing and duration.
    - Requires Gym Owner or Admin role.
    - Enforces unique plan name per gym.
    - Logs audit trail.
    """
    service = PlanService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.create_plan(
        tenant=tenant,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/{plan_id}",
    response_model=MembershipPlanRead,
    summary="Get membership plan details",
)
async def get_plan(
    gym_id: uuid.UUID,
    plan_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MembershipPlanRead:
    """Get details for a specific membership plan."""
    service = PlanService(session)
    return await service.get_plan(tenant=tenant, plan_id=plan_id)


@router.patch(
    "/{plan_id}",
    response_model=MembershipPlanRead,
    summary="Update membership plan",
)
async def update_plan(
    gym_id: uuid.UUID,
    plan_id: uuid.UUID,
    data: MembershipPlanUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MembershipPlanRead:
    """
    Update details of an existing membership plan.
    - Requires Gym Owner or Admin role.
    - Preserves historical subscription prices and terms.
    - Logs audit trail.
    """
    service = PlanService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.update_plan(
        tenant=tenant,
        plan_id=plan_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.patch(
    "/{plan_id}/status",
    response_model=MembershipPlanRead,
    summary="Activate or deactivate membership plan",
)
async def update_plan_status(
    gym_id: uuid.UUID,
    plan_id: uuid.UUID,
    data: PlanStatusUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MembershipPlanRead:
    """
    Activate or deactivate a membership plan.
    - Requires Gym Owner or Admin role.
    - Logs audit trail.
    """
    service = PlanService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.update_plan_status(
        tenant=tenant,
        plan_id=plan_id,
        is_active=data.is_active,
        ip_address=client_ip,
        user_agent=user_agent,
    )
