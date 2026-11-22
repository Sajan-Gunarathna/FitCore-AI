"""Gym service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch
from app.models.gym import Gym
from app.models.role import GymUserRole, UserRole
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.branch_repository import BranchRepository
from app.repositories.gym_repository import GymRepository
from app.repositories.role_repository import RoleRepository
from app.schemas.branch import BranchRead
from app.schemas.gym import GymCreate, GymDetailRead, GymRead


class GymService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.gym_repo = GymRepository(session)
        self.branch_repo = BranchRepository(session)
        self.role_repo = RoleRepository(session)
        self.audit_repo = AuditRepository(session)

    async def create_gym(
        self,
        user: User,
        data: GymCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> GymDetailRead:
        """
        Atomically register a new gym, assign the creator as 'owner',
        create the default main branch, and record audit logs.
        """
        # 1. Unique slug check
        existing = await self.gym_repo.get_by_slug(data.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A gym with slug '{data.slug}' already exists. Please choose another slug.",
            )

        # 2. Create Gym
        gym = Gym(
            id=uuid.uuid4(),
            name=data.name,
            slug=data.slug,
            description=data.description,
            logo_url=data.logo_url,
            created_by=user.id,
            is_active=True,
        )
        await self.gym_repo.create(gym)

        # 3. Automatically assign 'owner' role to the creator
        owner_role = GymUserRole(
            id=uuid.uuid4(),
            gym_id=gym.id,
            user_id=user.id,
            role=UserRole.OWNER.value,
            is_active=True,
        )
        await self.role_repo.create(owner_role)

        # 4. Automatically create default Main Branch
        main_branch = GymBranch(
            id=uuid.uuid4(),
            gym_id=gym.id,
            name=f"{gym.name} Main",
            slug="main",
            is_main=True,
            is_active=True,
        )
        await self.branch_repo.create(main_branch)

        # 5. Audit Log
        await self.audit_repo.log(
            action="gym.create",
            entity_type="gym",
            entity_id=str(gym.id),
            gym_id=gym.id,
            user_id=user.id,
            new_values={"name": gym.name, "slug": gym.slug, "owner_id": str(user.id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return GymDetailRead(
            id=gym.id,
            name=gym.name,
            slug=gym.slug,
            description=gym.description,
            logo_url=gym.logo_url,
            is_active=gym.is_active,
            created_by=gym.created_by,
            created_at=gym.created_at,
            updated_at=gym.updated_at,
            current_user_roles=[UserRole.OWNER.value],
            branches=[BranchRead.model_validate(main_branch)],
        )

    async def list_user_gyms(self, user: User) -> list[GymRead]:
        if user.is_super_admin:
            gyms = await self.gym_repo.list_all()
        else:
            gyms = await self.gym_repo.list_for_user(user.id)
        return [GymRead.model_validate(g) for g in gyms]

    async def get_gym_detail(
        self, gym_id: uuid.UUID, user: User
    ) -> GymDetailRead:
        gym = await self.gym_repo.get_by_id(gym_id)
        if not gym:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gym not found.",
            )

        roles = await self.role_repo.list_user_roles_in_gym(gym_id, user.id)
        role_names = [r.role for r in roles]

        if not user.is_super_admin and not role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this gym.",
            )

        branches = await self.branch_repo.list_by_gym(gym_id)

        return GymDetailRead(
            id=gym.id,
            name=gym.name,
            slug=gym.slug,
            description=gym.description,
            logo_url=gym.logo_url,
            is_active=gym.is_active,
            created_by=gym.created_by,
            created_at=gym.created_at,
            updated_at=gym.updated_at,
            current_user_roles=role_names,
            branches=[BranchRead.model_validate(b) for b in branches],
        )
