"""Membership plan service orchestrating business rules and audit logging."""

import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.models.membership import MembershipPlan
from app.repositories.audit_repository import AuditRepository
from app.repositories.plan_repository import PlanRepository
from app.schemas.common import PaginatedResponse
from app.schemas.plan import (
    MembershipPlanCreate,
    MembershipPlanRead,
    MembershipPlanUpdate,
)


class PlanService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.plan_repo = PlanRepository(session)
        self.audit_repo = AuditRepository(session)

    async def list_plans(
        self,
        tenant: TenantContext,
        page: int = 1,
        page_size: int = 50,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[MembershipPlanRead]:
        offset = (page - 1) * page_size
        items, total = await self.plan_repo.list_paginated(
            gym_id=tenant.gym_id,
            offset=offset,
            limit=page_size,
            is_active=is_active,
            search=search,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        return PaginatedResponse(
            items=[MembershipPlanRead.model_validate(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_plan(
        self, tenant: TenantContext, plan_id: uuid.UUID
    ) -> MembershipPlanRead:
        plan = await self.plan_repo.get_by_id(tenant.gym_id, plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership plan not found in this gym.",
            )
        return MembershipPlanRead.model_validate(plan)

    async def create_plan(
        self,
        tenant: TenantContext,
        data: MembershipPlanCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MembershipPlanRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        existing = await self.plan_repo.get_by_name(tenant.gym_id, data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A membership plan named '{data.name}' already exists in this gym.",
            )

        plan = MembershipPlan(
            id=uuid.uuid4(),
            gym_id=tenant.gym_id,
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            duration_days=data.duration_days,
            price=data.price,
            currency=data.currency.strip().upper(),
            billing_frequency=data.billing_frequency.strip().lower(),
            is_active=data.is_active,
        )

        await self.plan_repo.create(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        await self.audit_repo.log(
            action="plan.create",
            entity_type="membership_plan",
            entity_id=str(plan.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "name": plan.name,
                "price": str(plan.price),
                "currency": plan.currency,
                "duration_days": plan.duration_days,
                "billing_frequency": plan.billing_frequency,
                "is_active": plan.is_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MembershipPlanRead.model_validate(plan)

    async def update_plan(
        self,
        tenant: TenantContext,
        plan_id: uuid.UUID,
        data: MembershipPlanUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MembershipPlanRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        plan = await self.plan_repo.get_by_id(tenant.gym_id, plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership plan not found in this gym.",
            )

        prev_values = {
            "name": plan.name,
            "description": plan.description,
            "duration_days": plan.duration_days,
            "price": str(plan.price),
            "currency": plan.currency,
            "billing_frequency": plan.billing_frequency,
            "is_active": plan.is_active,
        }

        if data.name is not None and data.name.strip().lower() != plan.name.lower():
            conflict = await self.plan_repo.get_by_name(tenant.gym_id, data.name)
            if conflict and conflict.id != plan.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A membership plan named '{data.name}' already exists in this gym.",
                )
            plan.name = data.name.strip()

        if data.description is not None:
            plan.description = data.description.strip() if data.description else None
        if data.duration_days is not None:
            plan.duration_days = data.duration_days
        if data.price is not None:
            plan.price = data.price
        if data.currency is not None:
            plan.currency = data.currency.strip().upper()
        if data.billing_frequency is not None:
            plan.billing_frequency = data.billing_frequency.strip().lower()
        if data.is_active is not None:
            plan.is_active = data.is_active

        await self.plan_repo.update(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        await self.audit_repo.log(
            action="plan.update",
            entity_type="membership_plan",
            entity_id=str(plan.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values=prev_values,
            new_values={
                "name": plan.name,
                "description": plan.description,
                "duration_days": plan.duration_days,
                "price": str(plan.price),
                "currency": plan.currency,
                "billing_frequency": plan.billing_frequency,
                "is_active": plan.is_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MembershipPlanRead.model_validate(plan)

    async def update_plan_status(
        self,
        tenant: TenantContext,
        plan_id: uuid.UUID,
        is_active: bool,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MembershipPlanRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        plan = await self.plan_repo.get_by_id(tenant.gym_id, plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership plan not found in this gym.",
            )

        prev_status = plan.is_active
        plan.is_active = is_active
        await self.plan_repo.update(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        await self.audit_repo.log(
            action="plan.status_change",
            entity_type="membership_plan",
            entity_id=str(plan.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values={"is_active": prev_status},
            new_values={"is_active": plan.is_active},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MembershipPlanRead.model_validate(plan)
