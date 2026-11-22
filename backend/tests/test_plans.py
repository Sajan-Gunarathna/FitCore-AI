"""Automated tests for Membership Plans API."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.membership import BillingFrequency, MembershipPlan
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_owner_creates_plan_success(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Gym owner can create a membership plan with full pricing and duration."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "name": "Gold Annual Membership",
        "description": "Full access to all facilities and classes",
        "duration_days": 365,
        "price": "499.99",
        "currency": "USD",
        "billing_frequency": "yearly",
        "is_active": True,
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/membership-plans",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Gold Annual Membership"
    assert data["duration_days"] == 365
    assert Decimal(str(data["price"])) == Decimal("499.99")
    assert data["currency"] == "USD"
    assert data["billing_frequency"] == "yearly"
    assert data["is_active"] is True

    # Verify audit log was recorded
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.gym_id == gym_id,
            AuditLog.action == "plan.create",
            AuditLog.entity_id == data["id"],
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None


@pytest.mark.asyncio
async def test_admin_creates_plan_success(
    client: AsyncClient, seed_data: dict
):
    """Gym admin can create a membership plan."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "name": "Monthly Standard",
        "duration_days": 30,
        "price": "49.00",
        "currency": "USD",
        "billing_frequency": "monthly",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/membership-plans",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Monthly Standard"


@pytest.mark.asyncio
async def test_member_cannot_create_plan(
    client: AsyncClient, seed_data: dict
):
    """Regular member role cannot create plans (403 Forbidden)."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "name": "Unauthorized Plan",
        "duration_days": 30,
        "price": "10.00",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/membership-plans",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_plan_name_rejected(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Duplicate plan name in the same gym returns 409 Conflict."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    # Seed existing plan
    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Unique Plan",
        duration_days=30,
        price=Decimal("50.00"),
        currency="USD",
        billing_frequency=BillingFrequency.MONTHLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "name": "unique plan",  # case insensitive match
        "duration_days": 60,
        "price": "90.00",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/membership-plans",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_get_plan_by_id(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Retrieve membership plan by ID."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Quarterly Fit",
        duration_days=90,
        price=Decimal("120.00"),
        currency="USD",
        billing_frequency=BillingFrequency.QUARTERLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.commit()

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/membership-plans/{plan.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(plan.id)
    assert data["name"] == "Quarterly Fit"


@pytest.mark.asyncio
async def test_update_plan_details(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Admin updates plan price and duration; historical subscription integrity preserved."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Legacy Plan",
        duration_days=30,
        price=Decimal("30.00"),
        currency="USD",
        billing_frequency=BillingFrequency.MONTHLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    update_payload = {
        "name": "Updated Plan Name",
        "price": "45.00",
        "duration_days": 35,
    }

    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/membership-plans/{plan.id}",
        headers=headers,
        json=update_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Plan Name"
    assert Decimal(str(data["price"])) == Decimal("45.00")
    assert data["duration_days"] == 35


@pytest.mark.asyncio
async def test_update_plan_status(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Admin can deactivate and reactivate a plan."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Deactivation Test Plan",
        duration_days=30,
        price=Decimal("40.00"),
        currency="USD",
        billing_frequency=BillingFrequency.MONTHLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.commit()

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_id),
    }

    # Deactivate
    res_deact = await client.patch(
        f"/api/v1/gyms/{gym_id}/membership-plans/{plan.id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    # Reactivate
    res_act = await client.patch(
        f"/api/v1/gyms/{gym_id}/membership-plans/{plan.id}/status",
        headers=headers,
        json={"is_active": True},
    )
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] is True


@pytest.mark.asyncio
async def test_list_plans_with_filter_and_search(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """List plans with pagination, search, and active status filtering."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    p1 = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Basic Active",
        duration_days=30,
        price=Decimal("20.00"),
        currency="USD",
        is_active=True,
    )
    p2 = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Basic Inactive",
        duration_days=30,
        price=Decimal("20.00"),
        currency="USD",
        is_active=False,
    )
    p3 = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Premium Active",
        duration_days=365,
        price=Decimal("200.00"),
        currency="USD",
        is_active=True,
    )
    db_session.add_all([p1, p2, p3])
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Filter active only
    res_active = await client.get(
        f"/api/v1/gyms/{gym_id}/membership-plans?is_active=true",
        headers=headers,
    )
    assert res_active.status_code == 200
    active_items = res_active.json()["items"]
    assert len(active_items) == 2
    assert all(item["is_active"] for item in active_items)

    # Search
    res_search = await client.get(
        f"/api/v1/gyms/{gym_id}/membership-plans?search=Premium",
        headers=headers,
    )
    assert res_search.status_code == 200
    search_items = res_search.json()["items"]
    assert len(search_items) == 1
    assert search_items[0]["name"] == "Premium Active"


@pytest.mark.asyncio
async def test_cross_tenant_plan_isolation(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """User from Gym Beta cannot access or mutate plans belonging to Gym Alpha."""
    gym_a_id = seed_data["gym_alpha"].id
    gym_b_id = seed_data["gym_beta"].id
    stranger_token = seed_data["tokens"]["stranger"]

    # Plan in Gym Alpha
    plan_a = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_a_id,
        name="Alpha Secret Plan",
        duration_days=30,
        price=Decimal("99.00"),
        currency="USD",
        is_active=True,
    )
    db_session.add(plan_a)
    await db_session.commit()

    # Stranger (Gym Beta owner) tries to query Gym Alpha's plan while claiming Gym Alpha
    headers_spoof = {
        **auth_header(stranger_token),
        "X-Gym-ID": str(gym_a_id),
    }
    res_spoof = await client.get(
        f"/api/v1/gyms/{gym_a_id}/membership-plans/{plan_a.id}",
        headers=headers_spoof,
    )
    assert res_spoof.status_code == 403

    # Stranger in their legitimate Gym Beta context cannot access Gym Alpha's plan ID
    headers_beta = {
        **auth_header(stranger_token),
        "X-Gym-ID": str(gym_b_id),
    }
    res_beta = await client.get(
        f"/api/v1/gyms/{gym_b_id}/membership-plans/{plan_a.id}",
        headers=headers_beta,
    )
    assert res_beta.status_code == 404
