"""Member subscription repository for persistence and querying."""

import uuid
from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member
from app.models.membership import MembershipPlan, MemberSubscription, SubscriptionStatus


class SubscriptionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, sub: MemberSubscription) -> MemberSubscription:
        self.session.add(sub)
        await self.session.flush()
        return sub

    async def get_by_id(
        self, gym_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> MemberSubscription | None:
        query = select(MemberSubscription).where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.id == subscription_id,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_with_details(
        self, gym_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> tuple[MemberSubscription, str, str, str | None, str] | None:
        query = (
            select(
                MemberSubscription,
                Member.full_name.label("member_name"),
                Member.member_code.label("member_code"),
                Member.email.label("member_email"),
                MembershipPlan.name.label("plan_name"),
            )
            .join(
                Member,
                (MemberSubscription.member_id == Member.id)
                & (MemberSubscription.gym_id == Member.gym_id),
            )
            .join(
                MembershipPlan,
                (MemberSubscription.plan_id == MembershipPlan.id)
                & (MemberSubscription.gym_id == MembershipPlan.gym_id),
            )
            .where(
                MemberSubscription.gym_id == gym_id,
                MemberSubscription.id == subscription_id,
            )
        )
        result = await self.session.execute(query)
        row = result.first()
        if not row:
            return None
        return row[0], row[1], row[2], row[3], row[4]

    async def get_active_overlapping(
        self,
        gym_id: uuid.UUID,
        member_id: uuid.UUID,
        start_date: date,
        end_date: date,
        exclude_id: uuid.UUID | None = None,
    ) -> list[MemberSubscription]:
        """
        Find any active/trial subscription for the member overlapping with the given range.
        Overlap: existing.start_date <= end_date AND existing.end_date >= start_date.
        """
        query = select(MemberSubscription).where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.member_id == member_id,
            MemberSubscription.status.in_([
                SubscriptionStatus.ACTIVE.value,
                SubscriptionStatus.TRIAL.value,
            ]),
            MemberSubscription.start_date <= end_date,
            MemberSubscription.end_date >= start_date,
        )
        if exclude_id:
            query = query.where(MemberSubscription.id != exclude_id)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_paginated(
        self,
        gym_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        member_id: uuid.UUID | None = None,
        plan_id: uuid.UUID | None = None,
        status: str | None = None,
        expiring_within_days: int | None = None,
        search: str | None = None,
        allowed_member_ids: Sequence[uuid.UUID] | None = None,
    ) -> tuple[list[tuple[MemberSubscription, str, str, str | None, str]], int]:
        base_query = (
            select(
                MemberSubscription,
                Member.full_name.label("member_name"),
                Member.member_code.label("member_code"),
                Member.email.label("member_email"),
                MembershipPlan.name.label("plan_name"),
            )
            .join(
                Member,
                (MemberSubscription.member_id == Member.id)
                & (MemberSubscription.gym_id == Member.gym_id),
            )
            .join(
                MembershipPlan,
                (MemberSubscription.plan_id == MembershipPlan.id)
                & (MemberSubscription.gym_id == MembershipPlan.gym_id),
            )
            .where(MemberSubscription.gym_id == gym_id)
        )

        count_query = (
            select(func.count(MemberSubscription.id))
            .join(
                Member,
                (MemberSubscription.member_id == Member.id)
                & (MemberSubscription.gym_id == Member.gym_id),
            )
            .join(
                MembershipPlan,
                (MemberSubscription.plan_id == MembershipPlan.id)
                & (MemberSubscription.gym_id == MembershipPlan.gym_id),
            )
            .where(MemberSubscription.gym_id == gym_id)
        )

        if allowed_member_ids is not None:
            base_query = base_query.where(MemberSubscription.member_id.in_(allowed_member_ids))
            count_query = count_query.where(MemberSubscription.member_id.in_(allowed_member_ids))

        if member_id:
            base_query = base_query.where(MemberSubscription.member_id == member_id)
            count_query = count_query.where(MemberSubscription.member_id == member_id)

        if plan_id:
            base_query = base_query.where(MemberSubscription.plan_id == plan_id)
            count_query = count_query.where(MemberSubscription.plan_id == plan_id)

        if status:
            base_query = base_query.where(MemberSubscription.status == status)
            count_query = count_query.where(MemberSubscription.status == status)

        if expiring_within_days is not None and expiring_within_days >= 0:
            today = date.today()
            target_date = today + timedelta(days=expiring_within_days)
            condition = (
                (MemberSubscription.status == SubscriptionStatus.ACTIVE.value)
                & (MemberSubscription.start_date <= today)
                & (MemberSubscription.end_date >= today)
                & (MemberSubscription.end_date <= target_date)
            )
            base_query = base_query.where(condition)
            count_query = count_query.where(condition)

        if search and search.strip():
            term = f"%{search.strip()}%"
            search_cond = (
                Member.full_name.ilike(term)
                | Member.member_code.ilike(term)
                | Member.email.ilike(term)
                | MembershipPlan.name.ilike(term)
            )
            base_query = base_query.where(search_cond)
            count_query = count_query.where(search_cond)

        total = (await self.session.execute(count_query)).scalar() or 0
        items = (
            (
                await self.session.execute(
                    base_query.order_by(MemberSubscription.created_at.desc())
                    .offset(offset)
                    .limit(limit)
                )
            )
            .all()
        )

        results = [(r[0], r[1], r[2], r[3], r[4]) for r in items]
        return results, total

    async def update(self, sub: MemberSubscription) -> MemberSubscription:
        await self.session.flush()
        return sub
