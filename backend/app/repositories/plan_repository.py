"""Membership plan repository for persistence and querying."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.membership import MembershipPlan


class PlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, plan: MembershipPlan) -> MembershipPlan:
        self.session.add(plan)
        await self.session.flush()
        return plan

    async def get_by_id(
        self, gym_id: uuid.UUID, plan_id: uuid.UUID
    ) -> MembershipPlan | None:
        query = select(MembershipPlan).where(
            MembershipPlan.gym_id == gym_id, MembershipPlan.id == plan_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_name(
        self, gym_id: uuid.UUID, name: str
    ) -> MembershipPlan | None:
        query = select(MembershipPlan).where(
            MembershipPlan.gym_id == gym_id,
            func.lower(MembershipPlan.name) == name.strip().lower(),
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_paginated(
        self,
        gym_id: uuid.UUID,
        offset: int = 0,
        limit: int = 50,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> tuple[list[MembershipPlan], int]:
        query = select(MembershipPlan).where(MembershipPlan.gym_id == gym_id)
        count_query = select(func.count(MembershipPlan.id)).where(
            MembershipPlan.gym_id == gym_id
        )

        if is_active is not None:
            query = query.where(MembershipPlan.is_active.is_(is_active))
            count_query = count_query.where(MembershipPlan.is_active.is_(is_active))

        if search and search.strip():
            term = f"%{search.strip()}%"
            filter_cond = MembershipPlan.name.ilike(term) | MembershipPlan.description.ilike(term)
            query = query.where(filter_cond)
            count_query = count_query.where(filter_cond)

        total = (await self.session.execute(count_query)).scalar() or 0
        items = (
            (
                await self.session.execute(
                    query.order_by(MembershipPlan.created_at.desc()).offset(offset).limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return list(items), total

    async def update(self, plan: MembershipPlan) -> MembershipPlan:
        await self.session.flush()
        return plan
