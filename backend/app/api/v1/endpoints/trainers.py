"""Trainer and Assignment API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentTenant, RequireGymAdmin
from app.schemas.common import PaginatedResponse
from app.schemas.trainer import (
    MemberTrainerAssignmentRead,
    TrainerAssignedMemberSummary,
    TrainerCreate,
    TrainerDetailRead,
    TrainerMemberAssignmentCreate,
    TrainerMemberReassignInput,
    TrainerRead,
    TrainerStatsResponse,
    TrainerStatusUpdate,
    TrainerUpdate,
)
from app.services.trainer_service import TrainerService

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[TrainerRead],
    summary="List gym trainers",
)
async def list_trainers(
    gym_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search by name, email, phone, or bio"),
    branch_id: uuid.UUID | None = Query(None, description="Filter by assigned branch"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    specialization: str | None = Query(None, description="Filter by specialization"),
) -> PaginatedResponse[TrainerRead]:
    """
    List trainers in the tenant's gym with optional branch and status filters.
    Available to gym owners, administrators, and trainers.
    Members cannot access trainer administration.
    """
    if tenant.is_member and not (tenant.is_admin or tenant.is_trainer):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Members cannot access trainer management.",
        )

    service = TrainerService(session)
    items, total = await service.list_trainers(
        tenant=tenant,
        page=page,
        page_size=page_size,
        search=search,
        branch_id=branch_id,
        is_active=is_active,
        specialization=specialization,
    )
    import math

    total_pages = math.ceil(total / page_size) if page_size > 0 else 0
    return PaginatedResponse[TrainerRead](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "",
    response_model=TrainerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create trainer profile",
)
async def create_trainer(
    gym_id: uuid.UUID,
    data: TrainerCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainerRead:
    """
    Register a new trainer profile for this gym.
    Supports Type A staff without an Auth account, or Type B linked to a user.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.create_trainer(
        tenant=tenant,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get(
    "/stats",
    response_model=TrainerStatsResponse,
    summary="Get gym trainer statistics",
)
async def get_trainer_stats(
    gym_id: uuid.UUID,
    tenant: RequireGymAdmin,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainerStatsResponse:
    """
    Retrieve aggregate statistics for trainers in this gym.
    Available strictly to Gym Owners and Gym Administrators.
    """
    service = TrainerService(session)
    return await service.get_stats(tenant)


@router.get(
    "/{trainer_id}",
    response_model=TrainerDetailRead,
    summary="Get trainer details",
)
async def get_trainer_detail(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainerDetailRead:
    """
    Get detailed trainer profile and assigned members.
    Trainers can only view their own profile; Gym Admins/Owners can view any.
    """
    if tenant.is_member and not (tenant.is_admin or tenant.is_trainer):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Members cannot access trainer details.",
        )

    service = TrainerService(session)
    return await service.get_trainer_detail(tenant, trainer_id)


@router.patch(
    "/{trainer_id}",
    response_model=TrainerRead,
    summary="Update trainer profile",
)
async def update_trainer(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    data: TrainerUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainerRead:
    """
    Update trainer profile details.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.update_trainer(
        tenant=tenant,
        trainer_id=trainer_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.patch(
    "/{trainer_id}/status",
    response_model=TrainerRead,
    summary="Activate or deactivate a trainer",
)
async def update_trainer_status(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    data: TrainerStatusUpdate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainerRead:
    """
    Activate or deactivate a trainer profile.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.update_status(
        tenant=tenant,
        trainer_id=trainer_id,
        is_active=data.is_active,
        ip_address=client_ip,
        user_agent=user_agent,
    )


# ── Assignments ───────────────────────────────────────────────────────────────


@router.get(
    "/{trainer_id}/members",
    response_model=list[TrainerAssignedMemberSummary],
    summary="List members assigned to a trainer",
)
async def list_assigned_members(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[TrainerAssignedMemberSummary]:
    """
    List members assigned to a specific trainer.
    Trainers can only view their own assigned members.
    """
    if tenant.is_member and not (tenant.is_admin or tenant.is_trainer):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Members cannot access assigned member lists.",
        )

    service = TrainerService(session)
    detail = await service.get_trainer_detail(tenant, trainer_id)
    return detail.assigned_members


@router.post(
    "/{trainer_id}/members",
    response_model=MemberTrainerAssignmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a member to a trainer",
)
async def assign_member_to_trainer(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    data: TrainerMemberAssignmentCreate,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberTrainerAssignmentRead:
    """
    Assign a member to a trainer within this gym.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.assign_member(
        tenant=tenant,
        trainer_id=trainer_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.delete(
    "/{trainer_id}/members/{member_id}",
    summary="Unassign a member from a trainer",
)
async def unassign_member_from_trainer(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    member_id: uuid.UUID,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """
    Unassign a member from a trainer.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.unassign_member(
        tenant=tenant,
        trainer_id=trainer_id,
        member_id=member_id,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.post(
    "/{trainer_id}/members/{member_id}/reassign",
    response_model=MemberTrainerAssignmentRead,
    summary="Reassign a member to a new trainer",
)
async def reassign_member(
    gym_id: uuid.UUID,
    trainer_id: uuid.UUID,
    member_id: uuid.UUID,
    data: TrainerMemberReassignInput,
    tenant: RequireGymAdmin,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberTrainerAssignmentRead:
    """
    Atomically reassign a member from current trainer to another trainer.
    Requires Gym Owner or Gym Admin role.
    """
    service = TrainerService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await service.reassign_member(
        tenant=tenant,
        current_trainer_id=trainer_id,
        member_id=member_id,
        data=data,
        ip_address=client_ip,
        user_agent=user_agent,
    )
