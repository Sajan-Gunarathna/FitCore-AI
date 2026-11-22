"""Gym User Role service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import GymUserRole, UserRole
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.gym_repository import GymRepository
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.role import GymUserRoleRead, RoleAssignmentCreate


class RoleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.gym_repo = GymRepository(session)
        self.user_repo = UserRepository(session)
        self.role_repo = RoleRepository(session)
        self.audit_repo = AuditRepository(session)

    async def assign_role(
        self,
        gym_id: uuid.UUID,
        data: RoleAssignmentCreate,
        current_user: User,
        current_user_roles: list[str],
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> GymUserRoleRead:
        """
        Assign a role to a user in the given gym.
        Enforces strict hierarchy:
        - Only owners or super admins can assign another owner.
        - Admins cannot escalate themselves or others to owners.
        """
        # Validate caller permission
        is_owner = UserRole.OWNER.value in current_user_roles
        is_admin = UserRole.ADMIN.value in current_user_roles

        if not current_user.is_super_admin and not is_owner and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners or administrators can assign roles.",
            )

        # Prevent non-owners from assigning 'owner' role
        if data.role == UserRole.OWNER and not is_owner and not current_user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners can grant the owner role.",
            )

        # Verify gym exists
        gym = await self.gym_repo.get_by_id(gym_id)
        if not gym:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gym not found.",
            )

        # Find or provision target user by email
        target_email = data.email.lower().strip()
        target_user = await self.user_repo.get_by_email(target_email)
        if not target_user:
            # Provision an application user account so invitations can bind
            target_user = User(
                id=uuid.uuid4(),
                email=target_email,
                full_name=data.full_name,
                is_super_admin=False,
            )
            await self.user_repo.create(target_user)

        # Check if already assigned
        existing_role = await self.role_repo.get(
            gym_id=gym_id, user_id=target_user.id, role=data.role.value
        )
        if existing_role:
            if not existing_role.is_active:
                existing_role.is_active = True
                await self.session.flush()
            role_record = existing_role
        else:
            role_record = GymUserRole(
                id=uuid.uuid4(),
                gym_id=gym_id,
                user_id=target_user.id,
                role=data.role.value,
                is_active=True,
            )
            await self.role_repo.create(role_record)

        # Audit log
        await self.audit_repo.log(
            action="role.assign",
            entity_type="gym_user_role",
            entity_id=str(role_record.id),
            gym_id=gym_id,
            user_id=current_user.id,
            new_values={
                "target_user_id": str(target_user.id),
                "target_email": target_email,
                "role": data.role.value,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return GymUserRoleRead(
            id=role_record.id,
            gym_id=role_record.gym_id,
            user_id=role_record.user_id,
            role=role_record.role,
            is_active=role_record.is_active,
            created_at=role_record.created_at,
            updated_at=role_record.updated_at,
            user_email=target_user.email,
            user_name=target_user.full_name,
        )

    async def list_gym_roles(self, gym_id: uuid.UUID) -> list[GymUserRoleRead]:
        roles = await self.role_repo.list_by_gym(gym_id)
        return [
            GymUserRoleRead(
                id=r.id,
                gym_id=r.gym_id,
                user_id=r.user_id,
                role=r.role,
                is_active=r.is_active,
                created_at=r.created_at,
                updated_at=r.updated_at,
                user_email=r.user.email if r.user else None,
                user_name=r.user.full_name if r.user else None,
            )
            for r in roles
        ]
