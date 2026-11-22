"""Trainer repository for database persistence."""

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
        query = select(TrainerProfile).where(
            TrainerProfile.gym_id == gym_id,
            TrainerProfile.id == trainer_id,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_user_id(
        self, gym_id: uuid.UUID, user_id: uuid.UUID
    ) -> TrainerProfile | None:
        """Fetch trainer profile for a specific user within a gym."""
        query = select(TrainerProfile).where(
            TrainerProfile.gym_id == gym_id,
            TrainerProfile.user_id == user_id,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_with_user_and_count(
        self, gym_id: uuid.UUID, trainer_id: uuid.UUID
    ) -> tuple[TrainerProfile, User, int] | None:
        """Fetch trainer profile joined with User and active assignment count."""
        assignment_subq = (
            select(func.count(TrainerMemberAssignment.id))
            .where(
                TrainerMemberAssignment.gym_id == gym_id,
                TrainerMemberAssignment.trainer_id == trainer_id,
                TrainerMemberAssignment.status == AssignmentStatus.ACTIVE.value,
            )
            .scalar_subquery()
        )

        query = (
            select(
                TrainerProfile,
                User,
                assignment_subq.label("assigned_count"),
            )
            .join(User, TrainerProfile.user_id == User.id)
            .where(
                TrainerProfile.gym_id == gym_id,
                TrainerProfile.id == trainer_id,
            )
        )
        result = await self.session.execute(query)
        row = result.first()
        if not row:
            return None
        profile, user, count = row
        return profile, user, count or 0

    async def list_paginated(
        self,
        gym_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
        search: str | None = None,
        is_active: bool | None = None,
        specialization: str | None = None,
    ) -> tuple[list[tuple[TrainerProfile, User, int]], int]:
        """List trainers with search, filters, pagination, and active assignment counts."""
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
                User,
                assignment_count_subq.label("assigned_count"),
            )
            .join(User, TrainerProfile.user_id == User.id)
            .where(TrainerProfile.gym_id == gym_id)
        )

        count_query = (
            select(func.count(TrainerProfile.id))
            .join(User, TrainerProfile.user_id == User.id)
            .where(TrainerProfile.gym_id == gym_id)
        )

        if is_active is not None:
            base_query = base_query.where(TrainerProfile.is_active == is_active)
            count_query = count_query.where(TrainerProfile.is_active == is_active)

        if search and search.strip():
            term = f"%{search.strip()}%"
            search_filter = or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                TrainerProfile.bio.ilike(term),
            )
            base_query = base_query.where(search_filter)
            count_query = count_query.where(search_filter)

        # Ordering & Pagination
        base_query = (
            base_query.order_by(TrainerProfile.is_active.desc(), User.full_name.asc())
            .offset(offset)
            .limit(page_size)
        )

        total_res = await self.session.execute(count_query)
        total = total_res.scalar() or 0

        items_res = await self.session.execute(base_query)
        rows = items_res.all()

        formatted_items: list[tuple[TrainerProfile, User, int]] = []
        for profile, user, count in rows:
            # If specialization filter provided, filter in memory or via array contains
            if specialization and specialization.strip():
                specs = profile.specializations or []
                if not any(specialization.lower() in s.lower() for s in specs):
                    continue
            formatted_items.append((profile, user, count or 0))

        return formatted_items, total

    async def create(self, profile: TrainerProfile) -> TrainerProfile:
        """Persist a new trainer profile."""
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def update(self, profile: TrainerProfile) -> TrainerProfile:
        """Update an existing trainer profile."""
        await self.session.flush()
        return profile

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

    async def create_assignment(
        self, assignment: TrainerMemberAssignment
    ) -> TrainerMemberAssignment:
        """Create a new trainer-member assignment."""
        self.session.add(assignment)
        await self.session.flush()
        return assignment

    async def get_assigned_members_for_trainer(
        self,
        gym_id: uuid.UUID,
        trainer_id: uuid.UUID,
        status: str | None = None,
    ) -> Sequence[tuple[TrainerMemberAssignment, Member]]:
        """Fetch members assigned to a trainer with assignment details."""
        query = (
            select(TrainerMemberAssignment, Member)
            .join(
                Member,
                (TrainerMemberAssignment.member_id == Member.id)
                & (TrainerMemberAssignment.gym_id == Member.gym_id),
            )
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
