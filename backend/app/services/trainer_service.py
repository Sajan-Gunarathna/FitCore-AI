"""Trainer service containing core business logic and authorization rules."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.models.trainer import AssignmentStatus, TrainerMemberAssignment, TrainerProfile
from app.repositories.audit_repository import AuditRepository
from app.repositories.branch_repository import BranchRepository
from app.repositories.member_repository import MemberRepository
from app.repositories.trainer_repository import TrainerRepository
from app.repositories.user_repository import UserRepository
from app.schemas.trainer import (
    MemberTrainerAssignmentRead,
    TrainerAssignedMemberSummary,
    TrainerCreate,
    TrainerDetailRead,
    TrainerMemberAssignmentCreate,
    TrainerMemberReassignInput,
    TrainerRead,
    TrainerStatsResponse,
    TrainerUpdate,
)


class TrainerService:
    """Service layer managing trainer lifecycle, assignments, and tenant isolation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.trainer_repo = TrainerRepository(session)
        self.branch_repo = BranchRepository(session)
        self.member_repo = MemberRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditRepository(session)

    async def list_trainers(
        self,
        tenant: TenantContext,
        page: int = 1,
        page_size: int = 50,
        search: str | None = None,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        specialization: str | None = None,
    ) -> tuple[list[TrainerRead], int]:
        """List gym trainers with search, branch filter, and assignment counts."""
        rows, total = await self.trainer_repo.list_paginated(
            gym_id=tenant.gym_id,
            page=page,
            page_size=page_size,
            search=search,
            branch_id=branch_id,
            is_active=is_active,
            specialization=specialization,
        )

        results: list[TrainerRead] = []
        for profile, branch_name, count in rows:
            can_view_rate = tenant.is_admin or (
                tenant.is_trainer and profile.user_id == tenant.user.id
            )
            rate = profile.hourly_rate if can_view_rate else Decimal("0.00")

            results.append(
                TrainerRead(
                    id=profile.id,
                    gym_id=profile.gym_id,
                    branch_id=profile.branch_id,
                    branch_name=branch_name,
                    user_id=profile.user_id,
                    full_name=profile.full_name,
                    email=profile.email,
                    phone=profile.phone,
                    avatar_url=profile.user.avatar_url if profile.user else None,
                    bio=profile.bio,
                    specializations=profile.specializations or [],
                    certifications=profile.certifications or [],
                    years_of_experience=profile.years_of_experience,
                    hourly_rate=rate,
                    is_active=profile.is_active,
                    assigned_member_count=count,
                    joined_at=profile.joined_at,
                    created_at=profile.created_at,
                    updated_at=profile.updated_at,
                )
            )

        return results, total

    async def create_trainer(
        self,
        tenant: TenantContext,
        data: TrainerCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TrainerRead:
        """Create a new trainer profile (Type A staff without login or Type B linked)."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can create trainer profiles.",
            )

        branch_name: str | None = None
        if data.branch_id:
            branch = await self.branch_repo.get_by_id_and_gym(data.branch_id, tenant.gym_id)
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected branch does not belong to this gym.",
                )
            branch_name = branch.name

        if data.user_id:
            user = await self.user_repo.get_by_id(data.user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified user does not exist.",
                )
            existing_user_trainer = await self.trainer_repo.get_by_user_id(
                tenant.gym_id, data.user_id
            )
            if existing_user_trainer:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This user already has a trainer profile registered in this gym.",
                )

        profile = TrainerProfile(
            id=uuid.uuid4(),
            gym_id=tenant.gym_id,
            branch_id=data.branch_id,
            user_id=data.user_id,
            full_name=data.full_name.strip(),
            email=str(data.email).strip().lower() if data.email else None,
            phone=data.phone.strip() if data.phone else None,
            bio=data.bio.strip() if data.bio else None,
            specializations=data.specializations or [],
            certifications=data.certifications or [],
            years_of_experience=data.years_of_experience,
            hourly_rate=data.hourly_rate,
            joined_at=data.joined_at or datetime.now(timezone.utc),
            is_active=data.is_active,
        )
        await self.trainer_repo.create(profile)

        await self.audit_repo.log(
            action="trainer.create",
            entity_type="trainer_profile",
            entity_id=str(profile.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "full_name": profile.full_name,
                "email": profile.email,
                "branch_id": str(profile.branch_id) if profile.branch_id else None,
                "is_active": profile.is_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return TrainerRead(
            id=profile.id,
            gym_id=profile.gym_id,
            branch_id=profile.branch_id,
            branch_name=branch_name,
            user_id=profile.user_id,
            full_name=profile.full_name,
            email=profile.email,
            phone=profile.phone,
            avatar_url=None,
            bio=profile.bio,
            specializations=profile.specializations or [],
            certifications=profile.certifications or [],
            years_of_experience=profile.years_of_experience,
            hourly_rate=profile.hourly_rate,
            is_active=profile.is_active,
            assigned_member_count=0,
            joined_at=profile.joined_at,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    async def get_trainer_detail(
        self, tenant: TenantContext, trainer_id: uuid.UUID
    ) -> TrainerDetailRead:
        """Get trainer profile and active assigned members."""
        profile = await self.trainer_repo.get_by_id(tenant.gym_id, trainer_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trainer profile not found in this gym.",
            )

        # RBAC Check: Trainers can only view their own profile; Owner/Admin can view all
        if tenant.is_trainer and not tenant.is_admin:
            if not profile.user_id or profile.user_id != tenant.user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You may only view your own trainer profile.",
                )

        branch_name = profile.branch.name if profile.branch else None
        active_count = await self.trainer_repo.get_active_assignment_count(
            tenant.gym_id, profile.id
        )

        # Fetch assigned members
        assigned_rows = await self.trainer_repo.get_assigned_members_for_trainer(
            tenant.gym_id, profile.id, status=AssignmentStatus.ACTIVE.value
        )

        assigned_members = [
            TrainerAssignedMemberSummary(
                assignment_id=assignment.id,
                member_id=member.id,
                member_code=member.member_code,
                full_name=member.full_name,
                email=member.email,
                phone=member.phone,
                branch_id=member.branch_id,
                branch_name=m_branch_name,
                member_status=member.status,
                assignment_status=assignment.status,
                assigned_at=assignment.assigned_at,
                notes=assignment.notes,
            )
            for assignment, member, m_branch_name in assigned_rows
        ]

        can_view_rate = tenant.is_admin or (
            tenant.is_trainer and profile.user_id == tenant.user.id
        )
        rate = profile.hourly_rate if can_view_rate else Decimal("0.00")

        return TrainerDetailRead(
            id=profile.id,
            gym_id=profile.gym_id,
            branch_id=profile.branch_id,
            branch_name=branch_name,
            user_id=profile.user_id,
            full_name=profile.full_name,
            email=profile.email,
            phone=profile.phone,
            avatar_url=profile.user.avatar_url if profile.user else None,
            bio=profile.bio,
            specializations=profile.specializations or [],
            certifications=profile.certifications or [],
            years_of_experience=profile.years_of_experience,
            hourly_rate=rate,
            is_active=profile.is_active,
            assigned_member_count=active_count,
            joined_at=profile.joined_at,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
            assigned_members=assigned_members,
        )

    async def update_trainer(
        self,
        tenant: TenantContext,
        trainer_id: uuid.UUID,
        data: TrainerUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TrainerRead:
        """Update trainer profile attributes."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can update trainer profiles.",
            )

        profile = await self.trainer_repo.get_by_id(tenant.gym_id, trainer_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trainer profile not found in this gym.",
            )

        old_values = {
            "full_name": profile.full_name,
            "branch_id": str(profile.branch_id) if profile.branch_id else None,
            "hourly_rate": str(profile.hourly_rate),
            "is_active": profile.is_active,
        }

        branch_name = profile.branch.name if profile.branch else None
        if data.branch_id is not None:
            if data.branch_id != profile.branch_id:
                branch = await self.branch_repo.get_by_id_and_gym(data.branch_id, tenant.gym_id)
                if not branch:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Selected branch does not belong to this gym.",
                    )
                profile.branch_id = data.branch_id
                branch_name = branch.name

        if data.full_name is not None:
            profile.full_name = data.full_name.strip()
        if data.email is not None:
            profile.email = str(data.email).strip().lower() if data.email else None
        if data.phone is not None:
            profile.phone = data.phone.strip() if data.phone else None
        if data.bio is not None:
            profile.bio = data.bio.strip() if data.bio else None
        if data.specializations is not None:
            profile.specializations = data.specializations
        if data.certifications is not None:
            profile.certifications = data.certifications
        if data.years_of_experience is not None:
            profile.years_of_experience = data.years_of_experience
        if data.hourly_rate is not None:
            profile.hourly_rate = data.hourly_rate
        if data.is_active is not None:
            profile.is_active = data.is_active

        profile.updated_at = datetime.now(timezone.utc)
        await self.trainer_repo.update(profile)

        await self.audit_repo.log(
            action="trainer.update",
            entity_type="trainer_profile",
            entity_id=str(profile.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values=old_values,
            new_values={
                "full_name": profile.full_name,
                "branch_id": str(profile.branch_id) if profile.branch_id else None,
                "hourly_rate": str(profile.hourly_rate),
                "is_active": profile.is_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        active_count = await self.trainer_repo.get_active_assignment_count(
            tenant.gym_id, profile.id
        )

        return TrainerRead(
            id=profile.id,
            gym_id=profile.gym_id,
            branch_id=profile.branch_id,
            branch_name=branch_name,
            user_id=profile.user_id,
            full_name=profile.full_name,
            email=profile.email,
            phone=profile.phone,
            avatar_url=profile.user.avatar_url if profile.user else None,
            bio=profile.bio,
            specializations=profile.specializations or [],
            certifications=profile.certifications or [],
            years_of_experience=profile.years_of_experience,
            hourly_rate=profile.hourly_rate,
            is_active=profile.is_active,
            assigned_member_count=active_count,
            joined_at=profile.joined_at,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    async def update_status(
        self,
        tenant: TenantContext,
        trainer_id: uuid.UUID,
        is_active: bool,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TrainerRead:
        """Activate or deactivate a trainer profile."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can change trainer status.",
            )

        profile = await self.trainer_repo.get_by_id(tenant.gym_id, trainer_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trainer profile not found in this gym.",
            )

        profile.is_active = is_active
        profile.updated_at = datetime.now(timezone.utc)
        await self.trainer_repo.update(profile)

        await self.audit_repo.log(
            action="trainer.status",
            entity_type="trainer_profile",
            entity_id=str(profile.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values={"is_active": not is_active},
            new_values={"is_active": is_active},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        active_count = await self.trainer_repo.get_active_assignment_count(
            tenant.gym_id, profile.id
        )

        return TrainerRead(
            id=profile.id,
            gym_id=profile.gym_id,
            branch_id=profile.branch_id,
            branch_name=profile.branch.name if profile.branch else None,
            user_id=profile.user_id,
            full_name=profile.full_name,
            email=profile.email,
            phone=profile.phone,
            avatar_url=profile.user.avatar_url if profile.user else None,
            bio=profile.bio,
            specializations=profile.specializations or [],
            certifications=profile.certifications or [],
            years_of_experience=profile.years_of_experience,
            hourly_rate=profile.hourly_rate,
            is_active=profile.is_active,
            assigned_member_count=active_count,
            joined_at=profile.joined_at,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    async def get_stats(self, tenant: TenantContext) -> TrainerStatsResponse:
        """Get aggregate trainer statistics. Strictly accessible to gym owners and admins."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can access gym trainer statistics.",
            )

        data = await self.trainer_repo.get_stats(tenant.gym_id)
        return TrainerStatsResponse(
            total_trainers=int(data["total_trainers"]),
            active_trainers=int(data["active_trainers"]),
            total_assigned_members=int(data["total_assigned_members"]),
            average_hourly_rate=Decimal(str(data["average_hourly_rate"])),
        )

    # ── Assignments ───────────────────────────────────────────────────────────

    async def assign_member(
        self,
        tenant: TenantContext,
        trainer_id: uuid.UUID,
        data: TrainerMemberAssignmentCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberTrainerAssignmentRead:
        """Assign a member to a trainer within the gym."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can assign trainers to members.",
            )

        trainer = await self.trainer_repo.get_by_id(tenant.gym_id, trainer_id)
        if not trainer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trainer profile not found in this gym.",
            )

        if not trainer.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign members to an inactive trainer.",
            )

        member = await self.member_repo.get_by_id(tenant.gym_id, data.member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        # Check existing active assignment
        existing = await self.trainer_repo.get_assignment(
            tenant.gym_id, trainer_id, data.member_id
        )
        if existing and existing.status == AssignmentStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Member '{member.full_name}' is already assigned to this trainer.",
            )

        if existing:
            # Reactivate existing record
            existing.status = AssignmentStatus.ACTIVE.value
            existing.assigned_at = datetime.now(timezone.utc)
            existing.notes = data.notes.strip() if data.notes else None
            assignment = await self.trainer_repo.update_assignment(existing)
        else:
            assignment = TrainerMemberAssignment(
                id=uuid.uuid4(),
                gym_id=tenant.gym_id,
                trainer_id=trainer.id,
                member_id=member.id,
                status=AssignmentStatus.ACTIVE.value,
                notes=data.notes.strip() if data.notes else None,
            )
            assignment = await self.trainer_repo.create_assignment(assignment)

        await self.audit_repo.log(
            action="trainer.assign",
            entity_type="trainer_member_assignment",
            entity_id=str(assignment.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "trainer_id": str(trainer.id),
                "trainer_name": trainer.full_name,
                "member_id": str(member.id),
                "member_name": member.full_name,
                "notes": assignment.notes,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MemberTrainerAssignmentRead(
            assignment_id=assignment.id,
            gym_id=tenant.gym_id,
            trainer_id=trainer.id,
            trainer_name=trainer.full_name,
            member_id=member.id,
            member_name=member.full_name,
            status=assignment.status,
            assigned_at=assignment.assigned_at,
            notes=assignment.notes,
        )

    async def reassign_member(
        self,
        tenant: TenantContext,
        current_trainer_id: uuid.UUID,
        member_id: uuid.UUID,
        data: TrainerMemberReassignInput,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberTrainerAssignmentRead:
        """Atomically reassign a member from one trainer to another."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can reassign members.",
            )

        if current_trainer_id == data.new_trainer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New trainer must be different from the currently assigned trainer.",
            )

        current_trainer = await self.trainer_repo.get_by_id(tenant.gym_id, current_trainer_id)
        if not current_trainer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current trainer profile not found in this gym.",
            )

        new_trainer = await self.trainer_repo.get_by_id(tenant.gym_id, data.new_trainer_id)
        if not new_trainer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New trainer profile not found in this gym.",
            )

        if not new_trainer.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reassign to an inactive trainer.",
            )

        member = await self.member_repo.get_by_id(tenant.gym_id, member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        # Current active assignment
        active_current = await self.trainer_repo.get_active_assignment(
            tenant.gym_id, current_trainer_id, member_id
        )
        if not active_current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active assignment between this member and current trainer not found.",
            )

        # Mark current assignment completed
        active_current.status = AssignmentStatus.COMPLETED.value
        await self.trainer_repo.update_assignment(active_current)

        # Create or reactivate assignment with new trainer
        existing_new = await self.trainer_repo.get_assignment(
            tenant.gym_id, data.new_trainer_id, member_id
        )
        if existing_new:
            existing_new.status = AssignmentStatus.ACTIVE.value
            existing_new.assigned_at = datetime.now(timezone.utc)
            existing_new.notes = data.notes.strip() if data.notes else None
            new_assignment = await self.trainer_repo.update_assignment(existing_new)
        else:
            new_assignment = TrainerMemberAssignment(
                id=uuid.uuid4(),
                gym_id=tenant.gym_id,
                trainer_id=new_trainer.id,
                member_id=member.id,
                status=AssignmentStatus.ACTIVE.value,
                notes=data.notes.strip() if data.notes else None,
            )
            new_assignment = await self.trainer_repo.create_assignment(new_assignment)

        await self.audit_repo.log(
            action="trainer.reassign",
            entity_type="trainer_member_assignment",
            entity_id=str(new_assignment.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values={
                "trainer_id": str(current_trainer.id),
                "trainer_name": current_trainer.full_name,
            },
            new_values={
                "trainer_id": str(new_trainer.id),
                "trainer_name": new_trainer.full_name,
                "member_id": str(member.id),
                "member_name": member.full_name,
                "notes": new_assignment.notes,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return MemberTrainerAssignmentRead(
            assignment_id=new_assignment.id,
            gym_id=tenant.gym_id,
            trainer_id=new_trainer.id,
            trainer_name=new_trainer.full_name,
            member_id=member.id,
            member_name=member.full_name,
            status=new_assignment.status,
            assigned_at=new_assignment.assigned_at,
            notes=new_assignment.notes,
        )

    async def unassign_member(
        self,
        tenant: TenantContext,
        trainer_id: uuid.UUID,
        member_id: uuid.UUID,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict[str, str]:
        """Unassign a member from a trainer."""
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only gym owners and administrators can unassign trainers.",
            )

        assignment = await self.trainer_repo.get_active_assignment(
            tenant.gym_id, trainer_id, member_id
        )
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active assignment between this trainer and member not found.",
            )

        assignment.status = AssignmentStatus.COMPLETED.value
        await self.trainer_repo.update_assignment(assignment)

        await self.audit_repo.log(
            action="trainer.unassign",
            entity_type="trainer_member_assignment",
            entity_id=str(assignment.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values={
                "trainer_id": str(trainer_id),
                "member_id": str(member_id),
                "status": "active",
            },
            new_values={"status": "completed"},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return {"message": "Member successfully unassigned from trainer."}
