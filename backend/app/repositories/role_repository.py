"""Gym user role repository."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import GymUserRole


class RoleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, role_record: GymUserRole) -> GymUserRole:
        self.session.add(role_record)
        await self.session.flush()
        return role_record

    async def get(
        self, gym_id: uuid.UUID, user_id: uuid.UUID, role: str
    ) -> GymUserRole | None:
        stmt = select(GymUserRole).where(
            GymUserRole.gym_id == gym_id,
            GymUserRole.user_id == user_id,
            GymUserRole.role == role,
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_user_roles_in_gym(
        self, gym_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[GymUserRole]:
        stmt = select(GymUserRole).where(
            GymUserRole.gym_id == gym_id,
            GymUserRole.user_id == user_id,
            GymUserRole.is_active == True,  # noqa: E712
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_gym(self, gym_id: uuid.UUID) -> list[GymUserRole]:
        stmt = (
            select(GymUserRole)
            .where(GymUserRole.gym_id == gym_id)
            .options(selectinload(GymUserRole.user))
            .order_by(GymUserRole.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def has_role(
        self, gym_id: uuid.UUID, user_id: uuid.UUID, roles: Sequence[str]
    ) -> bool:
        stmt = select(GymUserRole).where(
            GymUserRole.gym_id == gym_id,
            GymUserRole.user_id == user_id,
            GymUserRole.role.in_(roles),
            GymUserRole.is_active == True,  # noqa: E712
        )
        result = await self.session.execute(stmt)
        return result.scalars().first() is not None
