"""Gym repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.gym import Gym
from app.models.role import GymUserRole


class GymRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, gym: Gym) -> Gym:
        self.session.add(gym)
        await self.session.flush()
        await self.session.refresh(gym)
        return gym

    async def get_by_id(self, gym_id: uuid.UUID) -> Gym | None:
        stmt = (
            select(Gym)
            .where(Gym.id == gym_id)
            .options(selectinload(Gym.branches))
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_slug(self, slug: str) -> Gym | None:
        stmt = select(Gym).where(Gym.slug == slug.lower().strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_for_user(self, user_id: uuid.UUID) -> list[Gym]:
        stmt = (
            select(Gym)
            .join(GymUserRole, GymUserRole.gym_id == Gym.id)
            .where(GymUserRole.user_id == user_id, GymUserRole.is_active == True)  # noqa: E712
            .order_by(Gym.name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self) -> list[Gym]:
        stmt = select(Gym).order_by(Gym.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
