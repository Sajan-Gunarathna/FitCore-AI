"""Dashboard service providing secure, aggregated tenant analytics."""

import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch
from app.models.gym import Gym
from app.models.member import Member, MemberStatus
from app.models.membership import MembershipPlan, MemberSubscription, SubscriptionStatus
from app.models.trainer import TrainerProfile
from app.schemas.dashboard import (
    BranchSummaryItem,
    DashboardKpis,
    DashboardSummaryResponse,
    RecentMemberSummary,
    RegistrationTrendPoint,
    StatusDistributionPoint,
    UpcomingExpirationSummary,
)


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_gym_summary(self, gym_id: uuid.UUID) -> DashboardSummaryResponse:
        # 1. Verify gym existence
        gym_res = await self.session.execute(
            select(Gym).where(Gym.id == gym_id)
        )
        gym = gym_res.scalar_one_or_none()
        if not gym:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gym not found.",
            )

        today = date.today()
        seven_days_later = today + timedelta(days=7)

        # 2. Aggregated KPI Counts
        # Total Members
        total_members_query = select(func.count(Member.id)).where(
            Member.gym_id == gym_id
        )
        total_members = (await self.session.execute(total_members_query)).scalar() or 0

        # Active Members
        active_members_query = select(func.count(Member.id)).where(
            Member.gym_id == gym_id,
            Member.status == MemberStatus.ACTIVE.value,
        )
        active_members = (await self.session.execute(active_members_query)).scalar() or 0

        # Active Subscriptions (status == 'active', start_date <= today, and end_date >= today)
        active_sub_query = select(func.count(MemberSubscription.id)).where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.status == SubscriptionStatus.ACTIVE.value,
            MemberSubscription.start_date <= today,
            MemberSubscription.end_date >= today,
        )
        active_subscriptions = (await self.session.execute(active_sub_query)).scalar() or 0

        # Expiring Subscriptions (status == 'active', start_date <= today,
        # and end_date between today and today + 7 days)
        expiring_sub_query = select(func.count(MemberSubscription.id)).where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.status == SubscriptionStatus.ACTIVE.value,
            MemberSubscription.start_date <= today,
            MemberSubscription.end_date >= today,
            MemberSubscription.end_date <= seven_days_later,
        )
        expiring_subscriptions = (await self.session.execute(expiring_sub_query)).scalar() or 0

        # Total Trainers (is_active == True)
        trainers_query = select(func.count(TrainerProfile.id)).where(
            TrainerProfile.gym_id == gym_id,
            TrainerProfile.is_active.is_(True),
        )
        total_trainers = (await self.session.execute(trainers_query)).scalar() or 0

        # Total Branches (is_active == True)
        branches_query = select(func.count(GymBranch.id)).where(
            GymBranch.gym_id == gym_id,
            GymBranch.is_active.is_(True),
        )
        total_branches = (await self.session.execute(branches_query)).scalar() or 0

        kpis = DashboardKpis(
            total_members=total_members,
            active_members=active_members,
            active_subscriptions=active_subscriptions,
            expiring_subscriptions=expiring_subscriptions,
            total_trainers=total_trainers,
            total_branches=total_branches,
        )

        # 3. Recent 5 Members
        recent_members_query = (
            select(
                Member.id,
                Member.member_code,
                Member.status,
                Member.joined_at,
                Member.full_name,
                Member.email,
            )
            .where(Member.gym_id == gym_id)
            .order_by(Member.joined_at.desc())
            .limit(5)
        )
        recent_rows = (await self.session.execute(recent_members_query)).all()
        recent_members = [
            RecentMemberSummary(
                id=r.id,
                member_code=r.member_code,
                status=r.status,
                joined_at=r.joined_at,
                full_name=r.full_name,
                email=r.email or "",
            )
            for r in recent_rows
        ]

        # 4. Upcoming Expirations (Next 14 days, limit 5)
        fourteen_days_later = today + timedelta(days=14)
        expirations_query = (
            select(
                MemberSubscription.id,
                MemberSubscription.member_id,
                Member.member_code,
                Member.full_name,
                Member.email,
                MembershipPlan.name.label("plan_name"),
                MemberSubscription.end_date,
                MemberSubscription.status,
            )
            .join(
                Member,
                (MemberSubscription.member_id == Member.id)
                & (MemberSubscription.gym_id == Member.gym_id),
            )
            .join(
                MembershipPlan,
                (MemberSubscription.plan_id == MembershipPlan.id)
                & (MemberSubscription.gym_id == MembershipPlan.gym_id),
            )
            .where(
                MemberSubscription.gym_id == gym_id,
                MemberSubscription.status == SubscriptionStatus.ACTIVE.value,
                MemberSubscription.start_date <= today,
                MemberSubscription.end_date >= today,
                MemberSubscription.end_date <= fourteen_days_later,
            )
            .order_by(MemberSubscription.end_date.asc())
            .limit(5)
        )
        exp_rows = (await self.session.execute(expirations_query)).all()
        upcoming_expirations = [
            UpcomingExpirationSummary(
                id=r.id,
                member_id=r.member_id,
                member_code=r.member_code,
                full_name=r.full_name,
                email=r.email or "",
                plan_name=r.plan_name,
                end_date=r.end_date,
                status=r.status,
            )
            for r in exp_rows
        ]

        # 5. Member Registration Trend (Past 6 months)
        # Compute monthly buckets
        now = datetime.now(UTC)
        six_months_ago = now - timedelta(days=180)

        trend_query = select(Member.joined_at).where(
            Member.gym_id == gym_id,
            Member.joined_at >= six_months_ago,
        )
        trend_dates = (await self.session.execute(trend_query)).scalars().all()

        month_counts: dict[str, int] = defaultdict(int)
        for dt in trend_dates:
            period_str = dt.strftime("%b %Y")
            month_counts[period_str] += 1

        # Build consecutive last 6 month labels
        registration_trend: list[RegistrationTrendPoint] = []
        for i in range(5, -1, -1):
            # calculate month target
            # approx 30 days per step backwards
            ref_dt = now - timedelta(days=i * 30)
            p_str = ref_dt.strftime("%b %Y")
            # Avoid duplicate periods if steps align
            if not any(pt.period == p_str for pt in registration_trend):
                registration_trend.append(
                    RegistrationTrendPoint(
                        period=p_str, count=month_counts.get(p_str, 0)
                    )
                )

        # 6. Status Distribution
        status_query = (
            select(Member.status, func.count(Member.id))
            .where(Member.gym_id == gym_id)
            .group_by(Member.status)
        )
        status_rows = (await self.session.execute(status_query)).all()
        status_distribution = [
            StatusDistributionPoint(status=row[0], count=row[1])
            for row in status_rows
        ]
        # If no members, provide standard statuses with 0 count
        if not status_distribution:
            status_distribution = [
                StatusDistributionPoint(status="active", count=0),
                StatusDistributionPoint(status="inactive", count=0),
            ]

        # 7. Branch Overview with Member Counts
        branch_overview_query = (
            select(
                GymBranch.id,
                GymBranch.name,
                GymBranch.slug,
                GymBranch.is_main,
                GymBranch.is_active,
                func.count(Member.id).label("member_count"),
            )
            .outerjoin(
                Member,
                (GymBranch.id == Member.branch_id)
                & (GymBranch.gym_id == Member.gym_id),
            )
            .where(GymBranch.gym_id == gym_id)
            .group_by(
                GymBranch.id,
                GymBranch.name,
                GymBranch.slug,
                GymBranch.is_main,
                GymBranch.is_active,
            )
            .order_by(GymBranch.is_main.desc(), GymBranch.name.asc())
        )
        branch_rows = (await self.session.execute(branch_overview_query)).all()
        branches = [
            BranchSummaryItem(
                id=b.id,
                name=b.name,
                slug=b.slug,
                is_main=b.is_main,
                is_active=b.is_active,
                member_count=b.member_count,
            )
            for b in branch_rows
        ]

        return DashboardSummaryResponse(
            gym_id=gym.id,
            gym_name=gym.name,
            kpis=kpis,
            recent_members=recent_members,
            upcoming_expirations=upcoming_expirations,
            registration_trend=registration_trend,
            status_distribution=status_distribution,
            branches=branches,
        )
