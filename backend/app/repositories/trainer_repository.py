"""Trainer repository for database persistence."""

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.branch import GymBranch
from app.models.member import Member
from app.models.trainer import AssignmentStatus, TrainerMemberAssignment, TrainerProfile
from app.models.user import User


class TrainerRepository:
    """Repository handling database operations for trainer profiles and assignments."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID
    ) -> TrainerProfile | None:
        """Fetch trainer profile strictly scoped by gym_id."""
        query = (
            select(TrainerProfile)
            .where(
                TrainerProfile.gym_id == gym_id,
                TrainerProfile.id == trainer_id,
            )
            .options(selectinload(TrainerProfile.branch), selectinload(TrainerProfile.user))
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_user_id(
        self, gym_id: uuid.UUID, user_id: uuid.UUID
    ) -> TrainerProfile | None:
        """Fetch trainer profile for a specific user within a gym."""
        query = (
            select(TrainerProfile)
            .where(
                TrainerProfile.gym_id == gym_id,
                TrainerProfile.user_id == user_id,
            )
            .options(selectinload(TrainerProfile.branch), selectinload(TrainerProfile.user))
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_active_assignment_count(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID
    ) -> int:
        """Get the count of active member assignments for a trainer."""
        query = select(func.count(TrainerMemberAssignment.id)).where(
            TrainerMemberAssignment.gym_id == gym_id,
            TrainerMemberAssignment.trainer_id == trainer_id,
            TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
        )
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def list_paginated(
        self,
        gym_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
        search: str | None = None,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        specialization: str | None = None,
    ) -> tuple[list[tuple[TrainerProfile, str | None, int]], int]:
        """
        List trainers with search, branch filter, active status filter, pagination,
        and active assignment counts.
        Returns list of (TrainerProfile, branch_name, active_count) and total_count.
        """
        offset = (page - 1) * page_size

        # Subquery for active assignments per trainer
        assignment_count_subq = (
            select(func.count(TrainerMemberAssignment.id))
            .where(
                TrainerMemberAssignment.gym_id == TrainerProfile.gym_id,
                TrainerMemberAssignment.trainer_id == TrainerProfile.id,
                TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
            )
            .correlate(TrainerProfile)
            .scalar_subquery()
        )

        base_query = (
            select(
                TrainerProfile,
                GymBranch.name.label("branch_name"),
                assignment_count_subq.label("assigned_count"),
            )
            .outerjoin(GymBranch, TrainerProfile.branch_id == GymBranch.id)
            .where(TrainerProfile.gym_id == gym_id)
        )

        count_query = select(func.count(TrainerProfile.id)).where(
            TrainerProfile.gym_id == gym_id
        )

        if branch_id is not None:
            base_query = base_query.where(TrainerProfile.branch_id == branch_id)
            count_query = count_query.where(TrainerProfile.branch_id == branch_id)

        if is_active is not None:
            base_query = base_query.where(TrainerProfile.is_active == is_active)
            count_query = count_query.where(TrainerProfile.is_active == is_active)

        if search and search.strip():
            term = f"%{search.strip()}%"
            search_filter = or_(
                TrainerProfile.full_name.ilike(term),
                TrainerProfile.email.ilike(term),
                TrainerProfile.phone.ilike(term),
                TrainerProfile.bio.ilike(term),
            )
            base_query = base_query.where(search_filter)
            count_query = count_query.where(search_filter)

        base_query = (
            base_query.order_by(TrainerProfile.is_active.desc(), TrainerProfile.full_name.asc())
            .offset(offset)
            .limit(page_size)
        )

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        items_res = await self.session.execute(base_query)
        rows = items_res.all()

        formatted_items: list[tuple[TrainerProfile, str | None, int]] = []
        for profile, branch_name, count in rows:
            if specialization and specialization.strip():
                specs = profile.specializations or []
                if not any(specialization.lower() in str(s).lower() for s in specs):
                    continue
            formatted_items.append((profile, branch_name, count or 0))

        return formatted_items, total

    async def create(self, profile: TrainerProfile) -> TrainerProfile:
        """Persist a new trainer profile."""
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(profile)
        return profile

    async def update(self, profile: TrainerProfile) -> TrainerProfile:
        """Update an existing trainer profile."""
        await self.session.flush()
        return profile

    async def get_stats(self, gym_id: uuid.UUID) -> dict[str, int | Decimal]:
        """Aggregate statistics for all trainers in a gym."""
        # Total and active trainers
        trainer_counts_q = select(
            func.count(TrainerProfile.id).label("total"),
            func.count(TrainerProfile.id)
            .filter(TrainerProfile.is_active.is_(True))
            .label("active"),
            func.coalesce(func.avg(TrainerProfile.hourly_rate), Decimal("0.00")).label(
                "avg_rate"
            ),
        ).where(TrainerProfile.gym_id == gym_id)

        counts_res = await self.session.execute(trainer_counts_q)
        counts_row = counts_res.one()

        # Total active assigned members (distinct members)
        assigned_q = select(
            func.count(func.distinct(TrainerMemberAssignment.member_id))
        ).where(
            TrainerMemberAssignment.gym_id == gym_id,
            TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
        )
        assigned_res = await self.session.execute(assigned_q)
        total_assigned = assigned_res.scalar() or 0

        return {
            "total_trainers": counts_row.total or 0,
            "active_trainers": counts_row.active or 0,
            "total_assigned_members": total_assigned,
            "average_hourly_rate": round(Decimal(str(counts_row.avg_rate or 0)), 2),
        }

    # ── Assignments ───────────────────────────────────────────────────────────

    async def get_assignment(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID, member_id: uuid.UUID
    ) -> TrainerMemberAssignment | None:
        """Fetch existing assignment between a trainer and member in this gym."""
        query = select(TrainerMemberAssignment).where(
            TrainerMemberAssignment.gym_id == gym_id,
            TrainerMemberAssignment.trainer_id == trainer_id,
            TrainerMemberAssignment.member_id == member_id,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_active_assignment(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID, member_id: uuid.UUID
    ) -> TrainerMemberAssignment | None:
        """Fetch active assignment between a trainer and member in this gym."""
        query = select(TrainerMemberAssignment).where(
            TrainerMemberAssignment.gym_id == gym_id,
            TrainerMemberAssignment.trainer_id == trainer_id,
            TrainerMemberAssignment.member_id == member_id,
            TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_active_assignments_for_member(
        self, gym_id: uuid.UUID, member_id: uuid.UUID
    ) -> Sequence[tuple[TrainerMemberAssignment, TrainerProfile]]:
        """Fetch active assignments for a member joined with trainer profile."""
        query = (
            select(TrainerMemberAssignment, TrainerProfile)
            .join(
                TrainerProfile,
                (TrainerMemberAssignment.trainer_id == TrainerProfile.id)
                & (TrainerMemberAssignment.gym_id == TrainerProfile.gym_id),
            )
            .where(
                TrainerMemberAssignment.gym_id == gym_id,
                TrainerMemberAssignment.member_id == member_id,
                TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
            )
            .order_by(TrainerMemberAssignment.assigned_at.desc())
        )
        result = await self.session.execute(query)
        return result.all()

    async def create_assignment(
        self, assignment: TrainerMemberAssignment
    ) -> TrainerMemberAssignment:
        """Create a new trainer-member assignment."""
        self.session.add(assignment)
        await self.session.flush()
        await self.session.refresh(assignment)
        return assignment

    async def update_assignment(
        self, assignment: TrainerMemberAssignment
    ) -> TrainerMemberAssignment:
        """Update an existing assignment."""
        await self.session.flush()
        await self.session.refresh(assignment)
        return assignment

    async def get_assigned_members_for_trainer(
        self,
        gym_id: uuid.UUID,
        trainer_id: uuid.UUID,
        status: str | None = None,
    ) -> Sequence[tuple[TrainerMemberAssignment, Member, str | None]]:
        """Fetch members assigned to a trainer with assignment details and branch name."""
        query = (
            select(
                TrainerMemberAssignment,
                Member,
                GymBranch.name.label("branch_name"),
            )
            .join(
                Member,
                (TrainerMemberAssignment.member_id == Member.id)
                & (TrainerMemberAssignment.gym_id == Member.gym_id),
            )
            .outerjoin(GymBranch, Member.branch_id == GymBranch.id)
            .where(
                TrainerMemberAssignment.gym_id == gym_id,
                TrainerMemberAssignment.trainer_id == trainer_id,
            )
        )
        if status:
            query = query.where(TrainerMemberAssignment.status == status)

        query = query.order_by(TrainerMemberAssignment.assigned_at.desc())
        result = await self.session.execute(query)
        return result.all()

    async def delete_assignment(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID, member_id: uuid.UUID
    ) -> bool:
        """Delete assignment record strictly within tenant context."""
        stmt = delete(TrainerMemberAssignment).where(
            TrainerMemberAssignment.gym_id == gym_id,
            TrainerMemberAssignment.trainer_id == trainer_id,
            TrainerMemberAssignment.member_id == member_id,
        )
        result = await self.session.execute(stmt)
        return bool(result.rowcount and result.rowcount > 0)
