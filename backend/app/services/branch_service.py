"""Gym Branch service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.branch_repository import BranchRepository
from app.repositories.gym_repository import GymRepository
from app.repositories.role_repository import RoleRepository
from app.schemas.branch import BranchCreate, BranchRead


class BranchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.gym_repo = GymRepository(session)
        self.branch_repo = BranchRepository(session)
        self.role_repo = RoleRepository(session)
        self.audit_repo = AuditRepository(session)

    async def create_branch(
        self,
        gym_id: uuid.UUID,
        data: BranchCreate,
        current_user: User,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> BranchRead:
        gym = await self.gym_repo.get_by_id(gym_id)
        if not gym:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gym not found.",
            )

        # Check slug uniqueness within this gym
        existing = await self.branch_repo.get_by_slug(gym_id, data.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A branch with slug '{data.slug}' already exists in this gym.",
            )

        branch = GymBranch(
            id=uuid.uuid4(),
            gym_id=gym_id,
            name=data.name,
            slug=data.slug,
            address=data.address,
            phone=data.phone,
            email=data.email,
            is_main=data.is_main,
            is_active=True,
        )
        await self.branch_repo.create(branch)

        # If designated as main branch, demote any other main branch in this gym
        if data.is_main:
            await self.branch_repo.unset_other_main_branches(gym_id, branch.id)

        await self.audit_repo.log(
            action="branch.create",
            entity_type="gym_branch",
            entity_id=str(branch.id),
            gym_id=gym_id,
            user_id=current_user.id,
            new_values={"name": branch.name, "slug": branch.slug, "is_main": branch.is_main},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return BranchRead.model_validate(branch)

    async def list_branches(
        self, gym_id: uuid.UUID
    ) -> list[BranchRead]:
        branches = await self.branch_repo.list_by_gym(gym_id)
        return [BranchRead.model_validate(b) for b in branches]
