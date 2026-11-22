"""Automated tests for Secure Dashboard Summary and Real Analytics API."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import Member, MemberStatus
from app.models.membership import (
    BillingFrequency,
    MembershipPlan,
    MemberSubscription,
    SubscriptionStatus,
)
from app.models.trainer import TrainerProfile
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_get_dashboard_summary_owner_empty_gym(client: AsyncClient, seed_data: dict):
    """Gym owner can fetch dashboard summary; returns correct 0-values for empty data."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["gym_id"] == str(gym_id)
    assert data["gym_name"] == seed_data["gym_alpha"].name

    kpis = data["kpis"]
    assert kpis["total_members"] == 0
    assert kpis["active_members"] == 0
    assert kpis["active_subscriptions"] == 0
    assert kpis["expiring_subscriptions"] == 0
    assert kpis["total_trainers"] == 0
    assert kpis["total_branches"] == 1  # Alpha Main branch from seed

    assert data["recent_members"] == []
    assert data["upcoming_expirations"] == []
    assert len(data["registration_trend"]) >= 1
    assert len(data["branches"]) == 1
    assert data["branches"][0]["name"] == "Alpha Downtown"


@pytest.mark.asyncio
async def test_get_dashboard_summary_admin_allowed(client: AsyncClient, seed_data: dict):
    """Gym admin can access dashboard summary for their authorized gym."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["kpis"]["total_branches"] == 1


@pytest.mark.asyncio
async def test_get_dashboard_summary_with_real_records(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Dashboard correctly aggregates members, trainers, subscriptions, and expirations."""
    gym_id = seed_data["gym_alpha"].id
    owner_token = seed_data["tokens"]["owner"]

    # 1. Create a user and member
    member_user = User(
        id=uuid.uuid4(),
        email="john.doe@example.com",
        full_name="John Doe",
    )
    db_session.add(member_user)
    await db_session.flush()

    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=member_user.id,
        full_name="John Doe",
        email="john.doe@example.com",
        branch_id=seed_data["branch_alpha"].id,
        member_code="MEM-001",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(member)

    # 2. Create Trainer Profile
    trainer_user = User(
        id=uuid.uuid4(),
        email="coach.mike@example.com",
        full_name="Coach Mike",
    )
    db_session.add(trainer_user)
    await db_session.flush()

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        bio="Crossfit Level 3 Trainer",
        hourly_rate=Decimal("75.00"),
        is_active=True,
    )
    db_session.add(trainer)

    # 3. Create Plan and Subscriptions (one expiring in 3 days)
    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Unlimited Monthly",
        duration_days=30,
        price=Decimal("99.00"),
        billing_frequency=BillingFrequency.MONTHLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.flush()

    today = date.today()
    expiring_sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=27),
        end_date=today + timedelta(days=3),  # Expiring within 7 days
        price_paid=Decimal("99.00"),
        status=SubscriptionStatus.ACTIVE.value,
    )
    db_session.add(expiring_sub)

    await db_session.commit()

    # Query summary
    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()

    kpis = data["kpis"]
    assert kpis["total_members"] == 1
    assert kpis["active_members"] == 1
    assert kpis["active_subscriptions"] == 1
    assert kpis["expiring_subscriptions"] == 1
    assert kpis["total_trainers"] == 1
    assert kpis["total_branches"] == 1

    # Check recent member
    assert len(data["recent_members"]) == 1
    assert data["recent_members"][0]["member_code"] == "MEM-001"
    assert data["recent_members"][0]["full_name"] == "John Doe"

    # Check upcoming expiration
    assert len(data["upcoming_expirations"]) == 1
    assert data["upcoming_expirations"][0]["plan_name"] == "Unlimited Monthly"
    assert data["upcoming_expirations"][0]["end_date"] == (today + timedelta(days=3)).isoformat()


@pytest.mark.asyncio
async def test_get_dashboard_summary_cross_tenant_forbidden(client: AsyncClient, seed_data: dict):
    """Gym Alpha owner cannot access Gym Beta's dashboard summary."""
    owner_token = seed_data["tokens"]["owner"]  # Belongs to Gym Alpha
    gym_beta_id = seed_data["gym_beta"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_beta_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_beta_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_dashboard_summary_member_role_forbidden(client: AsyncClient, seed_data: dict):
    """Users with only member role cannot access executive dashboard summary."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 403
    assert "insufficient permissions" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_dashboard_summary_header_path_mismatch_400(client: AsyncClient, seed_data: dict):
    """P0 Desynchronization Guard: Mismatched X-Gym-ID header and URL path returns 400."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_beta_id),  # Mismatch!
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/dashboard/summary",
        headers=headers,
    )
    assert response.status_code == 400
    assert "desynchronization detected" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_dashboard_summary_unauthenticated_401(client: AsyncClient, seed_data: dict):
    """Unauthenticated request is rejected with 401."""
    gym_id = seed_data["gym_alpha"].id
    response = await client.get(f"/api/v1/gyms/{gym_id}/dashboard/summary")
    assert response.status_code == 401
