"""Member subscription service orchestrating business rules and audit logging."""

import math
import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import TenantContext
from app.models.member import MemberStatus
from app.models.membership import MemberSubscription, SubscriptionStatus
from app.repositories.audit_repository import AuditRepository
from app.repositories.member_repository import MemberRepository
from app.repositories.plan_repository import PlanRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.schemas.common import PaginatedResponse
from app.schemas.subscription import (
    MemberSubscriptionCreate,
    MemberSubscriptionRead,
    MemberSubscriptionRenew,
    MemberSubscriptionUpdate,
    SubscriptionCancel,
)


class SubscriptionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sub_repo = SubscriptionRepository(session)
        self.plan_repo = PlanRepository(session)
        self.member_repo = MemberRepository(session)
        self.audit_repo = AuditRepository(session)

    async def _resolve_allowed_member_ids(
        self, tenant: TenantContext
    ) -> list[uuid.UUID] | None:
        """Return allowed member UUIDs for non-admin roles, or None if admin."""
        if tenant.is_admin:
            return None

        if tenant.is_trainer:
            assigned = await self.member_repo.get_trainer_assigned_member_ids(
                gym_id=tenant.gym_id, user_id=tenant.user.id
            )
            return assigned

        # Member role: only own profile
        member = await self.member_repo.get_by_user_id(
            gym_id=tenant.gym_id, user_id=tenant.user.id
        )
        if member:
            return [member.id]
        return []

    @staticmethod
    def _to_read_model(
        sub: MemberSubscription,
        member_name: str | None = None,
        member_code: str | None = None,
        member_email: str | None = None,
        plan_name: str | None = None,
    ) -> MemberSubscriptionRead:
        today = date.today()
        days_rem: int | None = None
        if sub.status == SubscriptionStatus.ACTIVE.value:
            days_rem = (sub.end_date - today).days

        return MemberSubscriptionRead(
            id=sub.id,
            gym_id=sub.gym_id,
            member_id=sub.member_id,
            plan_id=sub.plan_id,
            start_date=sub.start_date,
            end_date=sub.end_date,
            price_paid=sub.price_paid,
            currency=sub.currency,
            status=sub.status,
            auto_renew=sub.auto_renew,
            notes=sub.notes,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
            member_name=member_name,
            member_code=member_code,
            member_email=member_email,
            plan_name=plan_name,
            days_remaining=days_rem,
        )

    async def list_subscriptions(
        self,
        tenant: TenantContext,
        page: int = 1,
        page_size: int = 20,
        member_id: uuid.UUID | None = None,
        plan_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        expiring_within_days: int | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[MemberSubscriptionRead]:
        allowed_ids = await self._resolve_allowed_member_ids(tenant)
        if allowed_ids is not None and not allowed_ids:
            return PaginatedResponse(
                items=[], total=0, page=page, page_size=page_size, total_pages=0
            )

        # If user is restricted to certain members, ensure member_id filter is within allowed
        if allowed_ids is not None and member_id and member_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested member subscriptions.",
            )

        offset = (page - 1) * page_size
        items, total = await self.sub_repo.list_paginated(
            gym_id=tenant.gym_id,
            offset=offset,
            limit=page_size,
            member_id=member_id,
            plan_id=plan_id,
            status=status_filter,
            expiring_within_days=expiring_within_days,
            search=search,
            allowed_member_ids=allowed_ids,
        )

        total_pages = math.ceil(total / page_size) if total > 0 else 0
        read_items = [
            self._to_read_model(
                sub=r[0],
                member_name=r[1],
                member_code=r[2],
                member_email=r[3],
                plan_name=r[4],
            )
            for r in items
        ]

        return PaginatedResponse(
            items=read_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_subscription(
        self, tenant: TenantContext, subscription_id: uuid.UUID
    ) -> MemberSubscriptionRead:
        detail = await self.sub_repo.get_with_details(tenant.gym_id, subscription_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found in this gym.",
            )

        sub, m_name, m_code, m_email, p_name = detail
        allowed_ids = await self._resolve_allowed_member_ids(tenant)
        if allowed_ids is not None and sub.member_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested subscription.",
            )

        return self._to_read_model(
            sub=sub,
            member_name=m_name,
            member_code=m_code,
            member_email=m_email,
            plan_name=p_name,
        )

    async def create_subscription(
        self,
        tenant: TenantContext,
        data: MemberSubscriptionCreate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberSubscriptionRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        # 1. Validate Member
        member = await self.member_repo.get_by_id(tenant.gym_id, data.member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this gym.",
            )

        # 2. Validate Plan
        plan = await self.plan_repo.get_by_id(tenant.gym_id, data.plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership plan not found in this gym.",
            )
        if not plan.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign an inactive membership plan.",
            )

        # 3. Determine Dates & Pricing
        start_d = data.start_date or date.today()
        end_d = data.end_date or (start_d + timedelta(days=plan.duration_days))

        if end_d < start_d:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subscription end date cannot be earlier than start date.",
            )

        price = data.price_paid if data.price_paid is not None else plan.price
        currency = data.currency.strip().upper() if data.currency else plan.currency

        # 4. Prevent unintended overlapping active subscriptions
        overlapping = await self.sub_repo.get_active_overlapping(
            gym_id=tenant.gym_id,
            member_id=member.id,
            start_date=start_d,
            end_date=end_d,
        )
        if overlapping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Member already has an active subscription overlapping with this period "
                    f"(ID: {overlapping[0].id}). Renew or cancel the existing subscription."
                ),
            )

        # 5. Persist Subscription
        sub = MemberSubscription(
            id=uuid.uuid4(),
            gym_id=tenant.gym_id,
            member_id=member.id,
            plan_id=plan.id,
            start_date=start_d,
            end_date=end_d,
            price_paid=price,
            currency=currency,
            status=SubscriptionStatus.ACTIVE.value,
            auto_renew=data.auto_renew,
            notes=data.notes.strip() if data.notes else None,
        )

        await self.sub_repo.create(sub)

        # Activate member if currently suspended or inactive
        if member.status in (MemberStatus.INACTIVE.value, MemberStatus.PENDING.value):
            member.status = MemberStatus.ACTIVE.value
            await self.member_repo.update(member)

        await self.session.commit()
        await self.session.refresh(sub)

        await self.audit_repo.log(
            action="subscription.create",
            entity_type="member_subscription",
            entity_id=str(sub.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "member_id": str(sub.member_id),
                "plan_id": str(sub.plan_id),
                "start_date": sub.start_date.isoformat(),
                "end_date": sub.end_date.isoformat(),
                "price_paid": str(sub.price_paid),
                "currency": sub.currency,
                "status": sub.status,
                "auto_renew": sub.auto_renew,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return self._to_read_model(
            sub=sub,
            member_name=member.full_name,
            member_code=member.member_code,
            member_email=member.email,
            plan_name=plan.name,
        )

    async def renew_subscription(
        self,
        tenant: TenantContext,
        subscription_id: uuid.UUID,
        data: MemberSubscriptionRenew,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberSubscriptionRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        curr_sub = await self.sub_repo.get_by_id(tenant.gym_id, subscription_id)
        if not curr_sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found in this gym.",
            )

        target_plan_id = data.plan_id or curr_sub.plan_id
        plan = await self.plan_repo.get_by_id(tenant.gym_id, target_plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target membership plan not found in this gym.",
            )

        today = date.today()
        # If current sub is active and not expired, next cycle starts day after current end_date
        if curr_sub.status == SubscriptionStatus.ACTIVE.value and curr_sub.end_date >= today:
            new_start_date = curr_sub.end_date + timedelta(days=1)
        else:
            new_start_date = today

        duration = data.duration_days or plan.duration_days
        new_end_date = new_start_date + timedelta(days=duration)
        price = data.price_paid if data.price_paid is not None else plan.price

        member = await self.member_repo.get_by_id(tenant.gym_id, curr_sub.member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated member not found in this gym.",
            )

        # Create new cycle subscription
        renewed_sub = MemberSubscription(
            id=uuid.uuid4(),
            gym_id=tenant.gym_id,
            member_id=curr_sub.member_id,
            plan_id=plan.id,
            start_date=new_start_date,
            end_date=new_end_date,
            price_paid=price,
            currency=plan.currency,
            status=SubscriptionStatus.ACTIVE.value,
            auto_renew=curr_sub.auto_renew,
            notes=data.notes.strip() if data.notes else f"Renewed from cycle {curr_sub.id}",
        )

        await self.sub_repo.create(renewed_sub)

        # Disable auto_renew on prior sub
        curr_sub.auto_renew = False
        await self.sub_repo.update(curr_sub)

        # Activate member if not active
        if member.status != MemberStatus.ACTIVE.value:
            member.status = MemberStatus.ACTIVE.value
            await self.member_repo.update(member)

        await self.session.commit()
        await self.session.refresh(renewed_sub)

        await self.audit_repo.log(
            action="subscription.renew",
            entity_type="member_subscription",
            entity_id=str(renewed_sub.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            new_values={
                "previous_subscription_id": str(curr_sub.id),
                "member_id": str(renewed_sub.member_id),
                "plan_id": str(renewed_sub.plan_id),
                "start_date": renewed_sub.start_date.isoformat(),
                "end_date": renewed_sub.end_date.isoformat(),
                "price_paid": str(renewed_sub.price_paid),
                "currency": renewed_sub.currency,
                "status": renewed_sub.status,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return self._to_read_model(
            sub=renewed_sub,
            member_name=member.full_name,
            member_code=member.member_code,
            member_email=member.email,
            plan_name=plan.name,
        )

    async def cancel_subscription(
        self,
        tenant: TenantContext,
        subscription_id: uuid.UUID,
        data: SubscriptionCancel,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberSubscriptionRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        detail = await self.sub_repo.get_with_details(tenant.gym_id, subscription_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found in this gym.",
            )

        sub, m_name, m_code, m_email, p_name = detail
        if sub.status == SubscriptionStatus.CANCELLED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subscription is already cancelled.",
            )

        prev_status = sub.status
        sub.status = SubscriptionStatus.CANCELLED.value
        sub.auto_renew = False

        c_text = f"Cancelled: {data.reason.strip()}" if data.reason else "Cancelled by admin"
        sub.notes = f"{sub.notes}\n{c_text}".strip() if sub.notes else c_text

        await self.sub_repo.update(sub)
        await self.session.commit()
        await self.session.refresh(sub)

        await self.audit_repo.log(
            action="subscription.cancel",
            entity_type="member_subscription",
            entity_id=str(sub.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values={"status": prev_status, "auto_renew": True},
            new_values={
                "status": sub.status,
                "auto_renew": sub.auto_renew,
                "reason": data.reason,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return self._to_read_model(
            sub=sub,
            member_name=m_name,
            member_code=m_code,
            member_email=m_email,
            plan_name=p_name,
        )

    async def update_subscription(
        self,
        tenant: TenantContext,
        subscription_id: uuid.UUID,
        data: MemberSubscriptionUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> MemberSubscriptionRead:
        if not tenant.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Gym Owner or Admin role required.",
            )

        detail = await self.sub_repo.get_with_details(tenant.gym_id, subscription_id)
        if not detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found in this gym.",
            )

        sub, m_name, m_code, m_email, p_name = detail

        prev_values = {
            "end_date": sub.end_date.isoformat(),
            "status": sub.status,
            "auto_renew": sub.auto_renew,
            "notes": sub.notes,
        }

        if data.end_date is not None:
            if data.end_date < sub.start_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Subscription end date cannot be earlier than start date.",
                )
            sub.end_date = data.end_date

        if data.auto_renew is not None:
            sub.auto_renew = data.auto_renew
        if data.notes is not None:
            sub.notes = data.notes.strip() if data.notes else None
        if data.status is not None:
            sub.status = data.status

        await self.sub_repo.update(sub)
        await self.session.commit()
        await self.session.refresh(sub)

        await self.audit_repo.log(
            action="subscription.update",
            entity_type="member_subscription",
            entity_id=str(sub.id),
            gym_id=tenant.gym_id,
            user_id=tenant.user.id,
            old_values=prev_values,
            new_values={
                "end_date": sub.end_date.isoformat(),
                "status": sub.status,
                "auto_renew": sub.auto_renew,
                "notes": sub.notes,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return self._to_read_model(
            sub=sub,
            member_name=m_name,
            member_code=m_code,
            member_email=m_email,
            plan_name=p_name,
        )
