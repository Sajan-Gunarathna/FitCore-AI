"""User repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import GymUserRole
from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.gym_roles).selectinload(GymUserRole.gym)
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower().strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_or_create_from_jwt(
        self, user_id: uuid.UUID, email: str, full_name: str | None = None
    ) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            user = User(
                id=user_id,
                email=email.lower().strip(),
                full_name=full_name,
                is_super_admin=False,
            )
            self.session.add(user)
            await self.session.flush()
        return user

    async def get_user_gyms_with_roles(
        self, user_id: uuid.UUID
    ) -> list[GymUserRole]:
        stmt = (
            select(GymUserRole)
            .where(GymUserRole.user_id == user_id, GymUserRole.is_active == True)  # noqa: E712
            .options(selectinload(GymUserRole.gym))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
