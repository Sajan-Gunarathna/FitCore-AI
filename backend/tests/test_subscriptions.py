"""Automated tests for Member Subscription Management API."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.member import Member, MemberStatus
from app.models.membership import (
    BillingFrequency,
    MembershipPlan,
    MemberSubscription,
    SubscriptionStatus,
)
from tests.conftest import auth_header


async def _seed_test_member_and_plan(
    session: AsyncSession, gym_id: uuid.UUID
) -> tuple[Member, MembershipPlan]:
    """Helper to seed a test member and active plan in a gym."""
    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name=f"Standard Monthly {uuid.uuid4().hex[:6]}",
        duration_days=30,
        price=Decimal("49.99"),
        currency="USD",
        billing_frequency=BillingFrequency.MONTHLY.value,
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code=f"MEM-{uuid.uuid4().hex[:6].upper()}",
        full_name="Subscriber Member",
        email="subscriber@example.com",
        status=MemberStatus.ACTIVE.value,
    )
    session.add_all([plan, member])
    await session.commit()
    return member, plan


@pytest.mark.asyncio
async def test_owner_assigns_subscription_success(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Gym owner can assign a plan to a member; auto-calculates end date and pricing."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "member_id": str(member.id),
        "plan_id": str(plan.id),
        "auto_renew": True,
        "notes": "First month trial promo",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["member_id"] == str(member.id)
    assert data["plan_id"] == str(plan.id)
    assert data["member_name"] == member.full_name
    assert data["plan_name"] == plan.name
    assert Decimal(str(data["price_paid"])) == plan.price
    assert data["currency"] == plan.currency
    assert data["status"] == SubscriptionStatus.ACTIVE.value
    assert data["auto_renew"] is True
    assert data["notes"] == "First month trial promo"

    # End date should match start_date + 30 days
    today = date.today()
    assert data["start_date"] == today.isoformat()
    assert data["end_date"] == (today + timedelta(days=30)).isoformat()

    # Verify audit log recorded
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.gym_id == gym_id,
            AuditLog.action == "subscription.create",
            AuditLog.entity_id == data["id"],
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None


@pytest.mark.asyncio
async def test_member_cannot_create_subscription(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Member role cannot assign or create subscriptions (403 Forbidden)."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "member_id": str(member.id),
        "plan_id": str(plan.id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cannot_assign_inactive_plan(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Attempting to assign an inactive plan returns 400 Bad Request."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)
    plan.is_active = False
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "member_id": str(member.id),
        "plan_id": str(plan.id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 400
    assert "inactive" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_prevent_overlapping_active_subscriptions(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Prevent accidental creation of overlapping active subscriptions for same member."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    # Seed existing active subscription
    today = date.today()
    sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today,
        end_date=today + timedelta(days=30),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
    )
    db_session.add(sub)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Try creating second active subscription for overlapping window
    payload = {
        "member_id": str(member.id),
        "plan_id": str(plan.id),
        "start_date": (today + timedelta(days=5)).isoformat(),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 400
    assert "already has an active subscription" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_renew_subscription_active_cycle(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Renewing an active subscription starts the new cycle the day after current end_date."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    today = date.today()
    curr_end_date = today + timedelta(days=15)
    current_sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=15),
        end_date=curr_end_date,
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
        auto_renew=True,
    )
    db_session.add(current_sub)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    renew_payload = {
        "notes": "Renewed early for next month",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions/{current_sub.id}/renew",
        headers=headers,
        json=renew_payload,
    )
    assert response.status_code == 200
    data = response.json()

    # Next cycle starts curr_end_date + 1 day
    expected_start = curr_end_date + timedelta(days=1)
    expected_end = expected_start + timedelta(days=plan.duration_days)

    assert data["start_date"] == expected_start.isoformat()
    assert data["end_date"] == expected_end.isoformat()
    assert data["status"] == SubscriptionStatus.ACTIVE.value
    assert data["notes"] == "Renewed early for next month"


@pytest.mark.asyncio
async def test_renew_subscription_expired_cycle(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Renewing an expired subscription starts the new cycle from today."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    today = date.today()
    expired_sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=40),
        end_date=today - timedelta(days=10),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.EXPIRED.value,
    )
    db_session.add(expired_sub)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/subscriptions/{expired_sub.id}/renew",
        headers=headers,
        json={},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["start_date"] == today.isoformat()
    assert data["end_date"] == (today + timedelta(days=plan.duration_days)).isoformat()


@pytest.mark.asyncio
async def test_cancel_subscription(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Owner cancels active subscription; sets status to cancelled and disables auto_renew."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    today = date.today()
    sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today,
        end_date=today + timedelta(days=30),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
        auto_renew=True,
    )
    db_session.add(sub)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    cancel_payload = {
        "reason": "Member relocated to another state",
    }

    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/subscriptions/{sub.id}/cancel",
        headers=headers,
        json=cancel_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == SubscriptionStatus.CANCELLED.value
    assert data["auto_renew"] is False
    assert "relocated" in data["notes"]


@pytest.mark.asyncio
async def test_update_subscription_dates_and_notes(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """Admin updates subscription end date and notes."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    today = date.today()
    sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today,
        end_date=today + timedelta(days=30),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
    )
    db_session.add(sub)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    new_end_date = today + timedelta(days=45)
    update_payload = {
        "end_date": new_end_date.isoformat(),
        "notes": "Granted 15 days complimentary extension",
    }

    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/subscriptions/{sub.id}",
        headers=headers,
        json=update_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["end_date"] == new_end_date.isoformat()
    assert "complimentary extension" in data["notes"]


@pytest.mark.asyncio
async def test_list_subscriptions_filtering_and_expiring_soon(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """List subscriptions with status, member search, and expiring-within-days filtering."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member, plan = await _seed_test_member_and_plan(db_session, gym_id)

    today = date.today()
    # 1. Expiring in 3 days
    s1 = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=27),
        end_date=today + timedelta(days=3),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
    )
    # 2. Expiring in 20 days
    s2 = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=10),
        end_date=today + timedelta(days=20),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
    )
    # 3. Already expired
    s3 = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=today - timedelta(days=60),
        end_date=today - timedelta(days=30),
        price_paid=plan.price,
        currency="USD",
        status=SubscriptionStatus.EXPIRED.value,
    )
    db_session.add_all([s1, s2, s3])
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Filter expiring within 7 days
    res_expiring = await client.get(
        f"/api/v1/gyms/{gym_id}/subscriptions?expiring_within_days=7",
        headers=headers,
    )
    assert res_expiring.status_code == 200
    expiring_items = res_expiring.json()["items"]
    assert len(expiring_items) == 1
    assert expiring_items[0]["id"] == str(s1.id)

    # Filter status=expired
    res_expired = await client.get(
        f"/api/v1/gyms/{gym_id}/subscriptions?status=expired",
        headers=headers,
    )
    assert res_expired.status_code == 200
    expired_items = res_expired.json()["items"]
    assert len(expired_items) == 1
    assert expired_items[0]["id"] == str(s3.id)


@pytest.mark.asyncio
async def test_cross_tenant_subscription_isolation(
    client: AsyncClient, seed_data: dict, db_session: AsyncSession
):
    """User from Gym Beta cannot view or modify Gym Alpha's subscriptions."""
    gym_a_id = seed_data["gym_alpha"].id
    gym_b_id = seed_data["gym_beta"].id
    stranger_token = seed_data["tokens"]["stranger"]

    member_a, plan_a = await _seed_test_member_and_plan(db_session, gym_a_id)

    today = date.today()
    sub_a = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_a_id,
        member_id=member_a.id,
        plan_id=plan_a.id,
        start_date=today,
        end_date=today + timedelta(days=30),
        price_paid=plan_a.price,
        currency="USD",
        status=SubscriptionStatus.ACTIVE.value,
    )
    db_session.add(sub_a)
    await db_session.commit()

    # Stranger claiming Gym Beta context queries Gym Alpha's sub_id -> 404
    headers_beta = {
        **auth_header(stranger_token),
        "X-Gym-ID": str(gym_b_id),
    }
    res_beta = await client.get(
        f"/api/v1/gyms/{gym_b_id}/subscriptions/{sub_a.id}",
        headers=headers_beta,
    )
    assert res_beta.status_code == 404

    # Stranger attempting to spoof Gym Alpha -> 403 Forbidden
    headers_spoof = {
        **auth_header(stranger_token),
        "X-Gym-ID": str(gym_a_id),
    }
    res_spoof = await client.get(
        f"/api/v1/gyms/{gym_a_id}/subscriptions/{sub_a.id}",
        headers=headers_spoof,
    )
    assert res_spoof.status_code == 403
