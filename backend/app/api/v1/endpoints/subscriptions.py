"""Member subscription API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentTenant, RequireGymAdmin
from app.schemas.common import PaginatedResponse
from app.schemas.subscription import (
    MemberSubscriptionCreate,
    MemberSubscriptionRead,
    MemberSubscriptionRenew,
    MemberSubscriptionUpdate,
    SubscriptionCancel,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[MemberSubscriptionRead],
    summary="List member subscriptions in gym",
)
async def list_subscriptions(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=100, description="Items per page")
    ] = 20,
    member_id: Annotated[
        uuid.UUID | None,
        Query(description="Filter by specific member UUID"),
    ] = None,
    plan_id: Annotated[
        uuid.UUID | None,
        Query(description="Filter by membership plan UUID"),
    ] = None,
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="Filter by status: active, expired, cancelled, trial"),
    ] = None,
    expiring_within_days: Annotated[
        int | None,
        Query(ge=0, description="Filter subscriptions expiring within N days"),
    ] = None,
    search: Annotated[
        str | None,
        Query(description="Search member name, code, email or plan name"),
    ] = None,
) -> PaginatedResponse[MemberSubscriptionRead]:
    """
    List subscriptions in this gym.
    - Gym Owners & Admins: see all subscriptions.
    - Trainers: see only their assigned members' subscriptions.
    - Members: see only their own subscriptions.
    """
    service = SubscriptionService(session)
    return await service.list_subscriptions(
        tenant=tenant,
        page=page,
        page_size=page_size,
        member_id=member_id,
        plan_id=plan_id,
        status_filter=status_filter,
        expiring_within_days=expiring_within_days,
        search=search,
    )


@router.post(
    "",
    response_model=MemberSubscriptionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a membership plan to a member",
)
async def create_subscription(
    gym_id: uuid.UUID,
    data: MemberSubscriptionCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberSubscriptionRead:
    """
    Create/assign a new subscription to a member.
    - Requires Gym Owner or Admin role.
    - Validates member and plan belong to this gym.
    - Enforces no overlapping active subscriptions.
    - Logs audit trail.
    """
    service = SubscriptionService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.create_subscription(
        tenant=tenant,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/{subscription_id}",
    response_model=MemberSubscriptionRead,
    summary="Get subscription details",
)
async def get_subscription(
    gym_id: uuid.UUID,
    subscription_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberSubscriptionRead:
    """Get details for a specific member subscription."""
    service = SubscriptionService(session)
    return await service.get_subscription(
        tenant=tenant, subscription_id=subscription_id
    )


@router.patch(
    "/{subscription_id}",
    response_model=MemberSubscriptionRead,
    summary="Update subscription details",
)
async def update_subscription(
    gym_id: uuid.UUID,
    subscription_id: uuid.UUID,
    data: MemberSubscriptionUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberSubscriptionRead:
    """
    Update subscription details (e.g., end date, notes, auto-renew).
    - Requires Gym Owner or Admin role.
    - Logs audit trail.
    """
    service = SubscriptionService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.update_subscription(
        tenant=tenant,
        subscription_id=subscription_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.post(
    "/{subscription_id}/renew",
    response_model=MemberSubscriptionRead,
    summary="Renew member subscription",
)
async def renew_subscription(
    gym_id: uuid.UUID,
    subscription_id: uuid.UUID,
    data: MemberSubscriptionRenew,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberSubscriptionRead:
    """
    Renew a subscription for a new billing cycle.
    - Starts the day after existing end_date if active, or today if expired.
    - Requires Gym Owner or Admin role.
    - Logs audit trail.
    """
    service = SubscriptionService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.renew_subscription(
        tenant=tenant,
        subscription_id=subscription_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.patch(
    "/{subscription_id}/cancel",
    response_model=MemberSubscriptionRead,
    summary="Cancel member subscription",
)
async def cancel_subscription(
    gym_id: uuid.UUID,
    subscription_id: uuid.UUID,
    data: SubscriptionCancel,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberSubscriptionRead:
    """
    Cancel an active subscription.
    - Requires Gym Owner or Admin role.
    - Sets status to cancelled and turns off auto-renew.
    - Logs audit trail.
    """
    service = SubscriptionService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.cancel_subscription(
        tenant=tenant,
        subscription_id=subscription_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )
