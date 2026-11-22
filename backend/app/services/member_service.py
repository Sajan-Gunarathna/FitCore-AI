"""Member business logic service."""

import math
import secrets
import string
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.models.member import Member
from app.repositories.audit_repository import AuditRepository
from app.repositories.branch_repository import BranchRepository
from app.repositories.member_repository import MemberRepository
from app.repositories.user_repository import UserRepository
from app.schemas.common import PaginatedResponse
from app.schemas.member import (
    MemberCreate,
    MemberDetailRead,
    MemberRead,
    MemberStatusUpdate,
    MemberUpdate,
)

SAFE_CODE_CHARS = string.ascii_uppercase + string.digits


class MemberService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.member_repo = MemberRepository(session)
        self.branch_repo = BranchRepository(session)
        self.audit_repo = AuditRepository(session)
        self.user_repo = UserRepository(session)

    async def generate_member_code(self, gym_id: uuid.UUID) -> str:
        """
        Collision-safe member code generation with database-backed retry loop.
        Format: MEM-XXXXXX (6 alphanumeric characters)
        """
        for _ in range(5):
            suffix = "".join(secrets.choice(SAFE_CODE_CHARS) for _ in range(6))
            candidate = f"MEM-{suffix}"
            existing = await self.member_repo.get_by_code(gym_id, candidate)
            if not existing:
                return candidate
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a unique member code. Please retry.",
        )

    async def create_member(
        self,
        tenant: TenantContext,
        data: MemberCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberRead:
        """
        Create a new gym member (walk-in or user-linked).
        Validates branch belongs to gym, ensures unique member code,
        and logs audit trail.
        """
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        branch_name: str | None = None
        if data.branch_id:
            branch = await self.branch_repo.get_by_id(data.branch_id)
            if not branch or branch.gym_id != tenant.gym_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid branch_id: branch does not belong to this gym.",
                )
            branch_name = branch.name

        if data.user_id:
            user = await self.user_repo.get_by_id(data.user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found.",
                )
            existing_user_member = await self.member_repo.get_by_user_id(
                tenant.gym_id, data.user_id
            )
            if existing_user_member:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A member record already exists for this user in this gym.",
                )

        if data.member_code and data.member_code.strip():
            code = data.member_code.strip().upper()
            existing_code = await self.member_repo.get_by_code(tenant.gym_id, code)
            if existing_code:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Member code '{code}' already exists in this gym.",
                )
        else:
            code = await self.generate_member_code(tenant.gym_id)

        clean_full_name = data.full_name.strip()
        clean_email = str(data.email).strip().lower() if data.email else None
        clean_phone = data.phone.strip() if data.phone else None
        clean_notes = data.notes.strip() if data.notes else None

        member = Member(
            id=uuid.uuid4(),
            gym_id=tenant.gym_id,
            user_id=data.user_id,
            branch_id=data.branch_id,
            member_code=code,
            full_name=clean_full_name,
            email=clean_email,
            phone=clean_phone,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            emergency_contact=data.emergency_contact,
            status=data.status,
            notes=clean_notes,
        )

        await self.member_repo.create(member)
        await self.session.refresh(member)

        # Audit Log
        await self.audit_repo.log(
            action="member.create",
            entity_type="member",
            entity_id=str(member.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "member_code": member.member_code,
                "full_name": member.full_name,
                "email": member.email,
                "phone": member.phone,
                "branch_id": str(member.branch_id) if member.branch_id else None,
                "status": member.status,
                "user_id": str(member.user_id) if member.user_id else None,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MemberRead(
            id=member.id,
            gym_id=member.gym_id,
            user_id=member.user_id,
            branch_id=member.branch_id,
            branch_name=branch_name,
            member_code=member.member_code,
            full_name=member.full_name,
            email=member.email,
            phone=member.phone,
            date_of_birth=member.date_of_birth,
            gender=member.gender,
            emergency_contact=member.emergency_contact,
            status=member.status,
            notes=member.notes,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
        )

    async def list_members(
        self,
        tenant: TenantContext,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        status_filter: str | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> PaginatedResponse[MemberRead]:
        """
        List members with pagination, filters, and role-based data isolation.
        - Gym Owners and Admins: view all members in the gym.
        - Trainers: view only assigned members.
        - Members: view only their own profile.
        """
        allowed_member_ids: list[uuid.UUID] | None = None

        if tenant.is_admin:
            allowed_member_ids = None
        elif tenant.is_trainer:
            assigned = await self.member_repo.get_trainer_assigned_member_ids(
                tenant.gym_id, tenant.user.id
            )
            if not assigned:
                return PaginatedResponse[MemberRead](
                    items=[],
                    total=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0,
                )
            allowed_member_ids = assigned
        elif tenant.is_member:
            own = await self.member_repo.get_by_user_id(tenant.gym_id, tenant.user.id)
            if not own:
                return PaginatedResponse[MemberRead](
                    items=[],
                    total=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0,
                )
            allowed_member_ids = [own.id]
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view members in this gym.",
            )

        offset = (page - 1) * page_size
        rows, total = await self.member_repo.list_paginated(
            gym_id=tenant.gym_id,
            offset=offset,
            limit=page_size,
            search=search,
            status=status_filter,
            branch_id=branch_id,
            allowed_member_ids=allowed_member_ids,
        )

        items = [
            MemberRead(
                id=m.id,
                gym_id=m.gym_id,
                user_id=m.user_id,
                branch_id=m.branch_id,
                branch_name=b_name,
                member_code=m.member_code,
                full_name=m.full_name,
                email=m.email,
                phone=m.phone,
                date_of_birth=m.date_of_birth,
                gender=m.gender,
                emergency_contact=m.emergency_contact,
                status=m.status,
                notes=m.notes,
                joined_at=m.joined_at,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m, b_name in rows
        ]

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return PaginatedResponse[MemberRead](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_member(
        self, tenant: TenantContext, member_id: uuid.UUID
    ) -> MemberDetailRead:
        """
        Fetch member profile details, subscriptions, and assigned trainers.
        Enforces tenant and role authorization.
        """
        row = await self.member_repo.get_with_branch_name(tenant.gym_id, member_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        member, branch_name = row

        # Authorization
        if tenant.is_admin:
            pass
        elif tenant.is_trainer:
            assigned = await self.member_repo.get_trainer_assigned_member_ids(
                tenant.gym_id, tenant.user.id
            )
            if member.id not in assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You are not assigned to this member.",
                )
        elif tenant.is_member:
            if member.user_id != tenant.user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You may only view your own member profile.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

        subscriptions = await self.member_repo.get_subscriptions_for_member(
            tenant.gym_id, member.id
        )
        trainers = await self.member_repo.get_assigned_trainers_for_member(
            tenant.gym_id, member.id
        )

        return MemberDetailRead(
            id=member.id,
            gym_id=member.gym_id,
            user_id=member.user_id,
            branch_id=member.branch_id,
            branch_name=branch_name,
            member_code=member.member_code,
            full_name=member.full_name,
            email=member.email,
            phone=member.phone,
            date_of_birth=member.date_of_birth,
            gender=member.gender,
            emergency_contact=member.emergency_contact,
            status=member.status,
            notes=member.notes,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
            subscriptions=subscriptions,
            assigned_trainers=trainers,
        )

    async def update_member(
        self,
        tenant: TenantContext,
        member_id: uuid.UUID,
        data: MemberUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberRead:
        """
        Update member details.
        Requires Gym Owner or Admin role.
        """
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        row = await self.member_repo.get_with_branch_name(tenant.gym_id, member_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        member, branch_name = row

        if data.branch_id is not None and data.branch_id != member.branch_id:
            branch = await self.branch_repo.get_by_id(data.branch_id)
            if not branch or branch.gym_id != tenant.gym_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid branch_id: branch does not belong to this gym.",
                )
            branch_name = branch.name

        old_values: dict[str, str | None] = {}
        new_values: dict[str, str | None] = {}

        fields = [
            "full_name",
            "email",
            "phone",
            "branch_id",
            "date_of_birth",
            "gender",
            "emergency_contact",
            "notes",
        ]

        for field in fields:
            val = getattr(data, field, None)
            if val is not None:
                curr = getattr(member, field)
                # Normalize types for comparison
                val_comp = str(val).strip() if isinstance(val, str) else val
                curr_comp = str(curr).strip() if isinstance(curr, str) else curr
                if val_comp != curr_comp:
                    old_values[field] = str(curr) if curr is not None else None
                    setattr(member, field, val)
                    new_values[field] = str(val) if val is not None else None

        if new_values:
            await self.session.flush()
            await self.session.refresh(member)
            await self.audit_repo.log(
                action="member.update",
                entity_type="member",
                entity_id=str(member.id),
                gym_id=tenant.gym_id,
                user_id=tenant.user.id,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return MemberRead(
            id=member.id,
            gym_id=member.gym_id,
            user_id=member.user_id,
            branch_id=member.branch_id,
            branch_name=branch_name,
            member_code=member.member_code,
            full_name=member.full_name,
            email=member.email,
            phone=member.phone,
            date_of_birth=member.date_of_birth,
            gender=member.gender,
            emergency_contact=member.emergency_contact,
            status=member.status,
            notes=member.notes,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
        )

    async def update_member_status(
        self,
        tenant: TenantContext,
        member_id: uuid.UUID,
        data: MemberStatusUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberRead:
        """
        Update member status with an audit log reason.
        Requires Gym Owner or Admin role.
        """
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        row = await self.member_repo.get_with_branch_name(tenant.gym_id, member_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        member, branch_name = row

        if data.status != member.status:
            old_status = member.status
            member.status = data.status
            await self.session.flush()
            await self.session.refresh(member)

            await self.audit_repo.log(
                action="member.status_change",
                entity_type="member",
                entity_id=str(member.id),
                gym_id=tenant.gym_id,
                user_id=tenant.user.id,
                old_values={"status": old_status},
                new_values={"status": data.status, "reason": data.reason},
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return MemberRead(
            id=member.id,
            gym_id=member.gym_id,
            user_id=member.user_id,
            branch_id=member.branch_id,
            branch_name=branch_name,
            member_code=member.member_code,
            full_name=member.full_name,
            email=member.email,
            phone=member.phone,
            date_of_birth=member.date_of_birth,
            gender=member.gender,
            emergency_contact=member.emergency_contact,
            status=member.status,
            notes=member.notes,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
        )
