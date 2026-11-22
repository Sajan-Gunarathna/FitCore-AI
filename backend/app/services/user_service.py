"""User service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    GymMembershipSummary,
    UserProfileResponse,
    UserRead,
    UserUpdate,
)


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)

    async def get_or_create_user(
        self, user_id: uuid.UUID, email: str, full_name: str | None = None
    ) -> User:
        return await self.user_repo.get_or_create_from_jwt(
            user_id=user_id, email=email, full_name=full_name
        )

    async def get_profile(self, user_id: uuid.UUID) -> UserProfileResponse:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )

        gym_roles = await self.user_repo.get_user_gyms_with_roles(user_id)
        gym_summaries = [
            GymMembershipSummary(
                gym_id=role.gym_id,
                gym_name=role.gym.name,
                gym_slug=role.gym.slug,
                role=role.role,
                is_active=role.is_active,
            )
            for role in gym_roles
            if role.gym is not None
        ]

        return UserProfileResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_super_admin=user.is_super_admin,
            created_at=user.created_at,
            updated_at=user.updated_at,
            gyms=gym_summaries,
        )

    async def update_profile(
        self, user_id: uuid.UUID, data: UserUpdate
    ) -> UserRead:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )

        if data.full_name is not None:
            user.full_name = data.full_name
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url

        await self.session.flush()
        return UserRead.model_validate(user)
