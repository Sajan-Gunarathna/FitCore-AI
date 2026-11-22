"""Gym Branch repository."""

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch


class BranchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, branch: GymBranch) -> GymBranch:
        self.session.add(branch)
        await self.session.flush()
        return branch

    async def get_by_id(self, branch_id: uuid.UUID) -> GymBranch | None:
        stmt = select(GymBranch).where(GymBranch.id == branch_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_id_and_gym(
        self, branch_id: uuid.UUID, gym_id: uuid.UUID
    ) -> GymBranch | None:
        stmt = select(GymBranch).where(
            GymBranch.id == branch_id, GymBranch.gym_id == gym_id
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update(self, branch: GymBranch) -> GymBranch:
        await self.session.flush()
        await self.session.refresh(branch)
        return branch

    async def get_by_slug(self, gym_id: uuid.UUID, slug: str) -> GymBranch | None:
        stmt = select(GymBranch).where(
            GymBranch.gym_id == gym_id, GymBranch.slug == slug.lower().strip()
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_by_gym(self, gym_id: uuid.UUID) -> list[GymBranch]:
        stmt = (
            select(GymBranch)
            .where(GymBranch.gym_id == gym_id)
            .order_by(GymBranch.is_main.desc(), GymBranch.name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def unset_other_main_branches(
        self, gym_id: uuid.UUID, current_branch_id: uuid.UUID
    ) -> None:
        stmt = (
            update(GymBranch)
            .where(GymBranch.gym_id == gym_id, GymBranch.id != current_branch_id)
            .values(is_main=False)
        )
        await self.session.execute(stmt)
