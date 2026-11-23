"""Member repository for database persistence and querying."""

import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch
from app.models.member import Member
from app.models.membership import MembershipPlan, MemberSubscription
from app.models.trainer import TrainerMemberAssignment, TrainerProfile
from app.models.user import User
from app.schemas.member import MemberSubscriptionSummary, MemberTrainerSummary


class MemberRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, member: Member) -> Member:
        self.session.add(member)
        await self.session.flush()
        return member

    async def get_by_id(
        self, gym_id: uuid.UUID, member_id: uuid.UUID
    ) -> Member | None:
        query = select(Member).where(
            Member.gym_id == gym_id, Member.id == member_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_with_branch_name(
        self, gym_id: uuid.UUID, member_id: uuid.UUID
    ) -> tuple[Member, str | None] | None:
        query = (
            select(Member, GymBranch.name.label("branch_name"))
            .outerjoin(
                GymBranch,
                (Member.branch_id == GymBranch.id)
                & (Member.gym_id == GymBranch.gym_id),
            )
            .where(Member.gym_id == gym_id, Member.id == member_id)
        )
        result = await self.session.execute(query)
        row = result.first()
        if not row:
            return None
        return row[0], row[1]

    async def get_by_code(
        self, gym_id: uuid.UUID, member_code: str
    ) -> Member | None:
        query = select(Member).where(
            Member.gym_id == gym_id, Member.member_code == member_code
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_user_id(
        self, gym_id: uuid.UUID, user_id: uuid.UUID
    ) -> Member | None:
        query = select(Member).where(
            Member.gym_id == gym_id, Member.user_id == user_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_paginated(
        self,
        gym_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        search: str | None = None,
        status: str | None = None,
        branch_id: uuid.UUID | None = None,
        allowed_member_ids: Sequence[uuid.UUID] | None = None,
    ) -> tuple[list[tuple[Member, str | None]], int]:
        """
        Query members with search, filters, and pagination.
        Returns list of tuples (Member, branch_name) and total count.
        """
        base_filters = [Member.gym_id == gym_id]

        if allowed_member_ids is not None:
            if not allowed_member_ids:
                return [], 0
            base_filters.append(Member.id.in_(allowed_member_ids))

        if status:
            base_filters.append(Member.status == status.lower().strip())

        if branch_id:
            base_filters.append(Member.branch_id == branch_id)

        if search:
            pattern = f"%{search.strip().lower()}%"
            search_filter = or_(
                func.lower(Member.full_name).like(pattern),
                func.lower(Member.member_code).like(pattern),
                func.lower(Member.email).like(pattern),
                func.lower(Member.phone).like(pattern),
            )
            base_filters.append(search_filter)

        # Count total
        count_query = select(func.count(Member.id)).where(*base_filters)
        total = (await self.session.execute(count_query)).scalar() or 0

        # Query items joining GymBranch for branch_name
        query = (
            select(Member, GymBranch.name.label("branch_name"))
            .outerjoin(
                GymBranch,
                (Member.branch_id == GymBranch.id)
                & (Member.gym_id == GymBranch.gym_id),
            )
            .where(*base_filters)
            .order_by(Member.joined_at.desc(), Member.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(query)
        rows = result.all()

        return [(row[0], row[1]) for row in rows], total

    async def get_subscriptions_for_member(
        self, gym_id: uuid.UUID, member_id: uuid.UUID
    ) -> list[MemberSubscriptionSummary]:
        today = date.today()
        query = (
            select(
                MemberSubscription.id,
                MembershipPlan.name.label("plan_name"),
                MemberSubscription.start_date,
                MemberSubscription.end_date,
                MemberSubscription.status,
                MemberSubscription.price_paid,
                MemberSubscription.currency,
                MemberSubscription.auto_renew,
                MemberSubscription.notes,
            )
            .join(
                MembershipPlan,
                (MemberSubscription.plan_id == MembershipPlan.id)
                & (MemberSubscription.gym_id == MembershipPlan.gym_id),
            )
            .where(
                MemberSubscription.gym_id == gym_id,
                MemberSubscription.member_id == member_id,
            )
            .order_by(MemberSubscription.end_date.desc())
        )
        result = await self.session.execute(query)
        rows = result.all()
        return [
            MemberSubscriptionSummary(
                id=r.id,
                plan_name=r.plan_name,
                start_date=r.start_date,
                end_date=r.end_date,
                status=r.status,
                price_paid=r.price_paid,
                currency=r.currency,
                auto_renew=r.auto_renew,
                notes=r.notes,
                days_remaining=(r.end_date - today).days if r.status == "active" else None,
            )
            for r in rows
        ]

    async def get_assigned_trainers_for_member(
        self, gym_id: uuid.UUID, member_id: uuid.UUID
    ) -> list[MemberTrainerSummary]:
        query = (
            select(
                TrainerMemberAssignment.trainer_id,
                func.coalesce(
                    func.nullif(TrainerProfile.full_name, ""),
                    User.full_name,
                    User.email,
                    "Trainer",
                ).label("trainer_name"),
                TrainerMemberAssignment.assigned_at,
                TrainerMemberAssignment.status,
            )
            .join(
                TrainerProfile,
                (TrainerMemberAssignment.trainer_id == TrainerProfile.id)
                & (TrainerMemberAssignment.gym_id == TrainerProfile.gym_id),
            )
            .outerjoin(User, TrainerProfile.user_id == User.id)
            .where(
                TrainerMemberAssignment.gym_id == gym_id,
                TrainerMemberAssignment.member_id == member_id,
                TrainerMemberAssignment.status == "active",
            )
            .order_by(TrainerMemberAssignment.assigned_at.desc())
        )
        result = await self.session.execute(query)
        rows = result.all()
        return [
            MemberTrainerSummary(
                trainer_id=r.trainer_id,
                trainer_name=r.trainer_name,
                assigned_at=r.assigned_at,
                status=r.status,
            )
            for r in rows
        ]

    async def get_trainer_assigned_member_ids(
        self, gym_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[uuid.UUID]:
        query = (
            select(TrainerMemberAssignment.member_id)
            .join(
                TrainerProfile,
                (TrainerMemberAssignment.trainer_id == TrainerProfile.id)
                & (TrainerMemberAssignment.gym_id == TrainerProfile.gym_id),
            )
            .where(
                TrainerProfile.gym_id == gym_id,
                TrainerProfile.user_id == user_id,
                TrainerMemberAssignment.status == "active",
            )
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
