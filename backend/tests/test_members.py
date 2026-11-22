"""Automated tests for Complete Member Management API."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import GymBranch
from app.models.member import Member, MemberStatus
from app.models.membership import (
    BillingFrequency,
    MembershipPlan,
    MemberSubscription,
    SubscriptionStatus,
)
from app.models.role import GymUserRole, UserRole
from app.models.trainer import (
    AssignmentStatus,
    TrainerMemberAssignment,
    TrainerProfile,
)
from app.models.user import User
from tests.conftest import auth_header, make_jwt


@pytest.mark.asyncio
async def test_owner_creates_walk_in_member_success(
    client: AsyncClient, seed_data: dict
):
    """Gym owner can register a walk-in member without user_id; auto-generates code."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "full_name": "John Walk-In",
        "email": "john.walkin@example.com",
        "phone": "+1-555-123-4567",
        "gender": "male",
        "status": "active",
        "notes": "Walk-in registration via front desk",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/members",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["full_name"] == "John Walk-In"
    assert data["email"] == "john.walkin@example.com"
    assert data["user_id"] is None
    assert data["member_code"].startswith("MEM-")
    assert len(data["member_code"]) == 10  # MEM- + 6 chars
    assert data["status"] == "active"
    assert data["notes"] == "Walk-in registration via front desk"


@pytest.mark.asyncio
async def test_admin_creates_member_with_branch_and_code(
    client: AsyncClient, seed_data: dict
):
    """Gym admin can register a member with custom member code and branch."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id
    branch_id = seed_data["branch_alpha"].id

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "full_name": "Jane Member",
        "email": "jane.member@example.com",
        "phone": "+1-555-987-6543",
        "member_code": "MEM-VIP001",
        "branch_id": str(branch_id),
        "gender": "female",
        "status": "active",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/members",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["full_name"] == "Jane Member"
    assert data["member_code"] == "MEM-VIP001"
    assert data["branch_id"] == str(branch_id)
    assert data["branch_name"] == seed_data["branch_alpha"].name


@pytest.mark.asyncio
async def test_trainer_cannot_create_member_forbidden(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """User with trainer role only cannot create new members."""
    gym_id = seed_data["gym_alpha"].id
    trainer_user = User(
        id=uuid.uuid4(), email="trainer@gym-alpha.com", full_name="Gym Trainer"
    )
    db_session.add(trainer_user)
    trainer_role = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add(trainer_role)
    await db_session.commit()

    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)
    headers = {
        **auth_header(trainer_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/members",
        headers=headers,
        json={"full_name": "Unauthorized Member"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_member_cannot_create_member_forbidden(
    client: AsyncClient, seed_data: dict
):
    """User with member role only cannot create new members."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/members",
        headers=headers,
        json={"full_name": "Unauthorized Member"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_member_code_rejected_conflict(
    client: AsyncClient, seed_data: dict
):
    """Registering a member with an existing member code returns 409 Conflict."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "full_name": "First Code User",
        "member_code": "MEM-DUP001",
    }
    resp1 = await client.post(
        f"/api/v1/gyms/{gym_id}/members", headers=headers, json=payload
    )
    assert resp1.status_code == 201

    # Second creation with identical code
    payload2 = {
        "full_name": "Second Code User",
        "member_code": "MEM-DUP001",
    }
    resp2 = await client.post(
        f"/api/v1/gyms/{gym_id}/members", headers=headers, json=payload2
    )
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_user_membership_rejected_conflict(
    client: AsyncClient, seed_data: dict
):
    """Linking the same user_id to more than one member record in a gym returns 409."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id
    user_id = seed_data["member"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    payload = {
        "full_name": "Linked User",
        "user_id": str(user_id),
    }
    resp1 = await client.post(
        f"/api/v1/gyms/{gym_id}/members", headers=headers, json=payload
    )
    assert resp1.status_code == 201

    # Attempt to register member for same user_id in the same gym
    resp2 = await client.post(
        f"/api/v1/gyms/{gym_id}/members", headers=headers, json=payload
    )
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_cross_gym_branch_assignment_rejected(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Assigning branch belonging to gym_beta when creating in gym_alpha is rejected with 400."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    # Create a branch in gym_beta
    beta_branch = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_beta_id,
        name="Beta Branch",
        slug="beta-branch",
        is_main=True,
        is_active=True,
    )
    db_session.add(beta_branch)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_alpha_id),
    }

    payload = {
        "full_name": "Cross Branch Member",
        "branch_id": str(beta_branch.id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_alpha_id}/members",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 400
    assert "branch does not belong to this gym" in response.json()["detail"]


@pytest.mark.asyncio
async def test_member_list_pagination(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Member directory supports pagination parameters and calculates total_pages."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    # Seed 5 members
    for i in range(5):
        m = Member(
            id=uuid.uuid4(),
            gym_id=gym_id,
            member_code=f"MEM-PAG00{i}",
            full_name=f"Paged Member {i}",
            email=f"paged{i}@example.com",
            status=MemberStatus.ACTIVE.value,
        )
        db_session.add(m)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Page 1, size 2
    resp1 = await client.get(
        f"/api/v1/gyms/{gym_id}/members?page=1&page_size=2",
        headers=headers,
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1["items"]) == 2
    assert data1["total"] == 5
    assert data1["page"] == 1
    assert data1["page_size"] == 2
    assert data1["total_pages"] == 3

    # Page 3, size 2 (1 item)
    resp3 = await client.get(
        f"/api/v1/gyms/{gym_id}/members?page=3&page_size=2",
        headers=headers,
    )
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert len(data3["items"]) == 1


@pytest.mark.asyncio
async def test_member_search_filter(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Member search matches name, email, phone, or member code."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    m1 = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-SRCH1",
        full_name="Alice Wonder",
        email="alice@wonderland.com",
        phone="+1234567890",
        status=MemberStatus.ACTIVE.value,
    )
    m2 = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-SRCH2",
        full_name="Bob Builder",
        email="bob@builder.com",
        phone="+9876543210",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([m1, m2])
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Search by name substring
    resp_name = await client.get(
        f"/api/v1/gyms/{gym_id}/members?search=Alice",
        headers=headers,
    )
    assert resp_name.status_code == 200
    items = resp_name.json()["items"]
    assert len(items) == 1
    assert items[0]["full_name"] == "Alice Wonder"

    # Search by member code
    resp_code = await client.get(
        f"/api/v1/gyms/{gym_id}/members?search=SRCH2",
        headers=headers,
    )
    assert resp_code.status_code == 200
    assert resp_code.json()["items"][0]["full_name"] == "Bob Builder"

    # Search by phone
    resp_phone = await client.get(
        f"/api/v1/gyms/{gym_id}/members?search=12345",
        headers=headers,
    )
    assert resp_phone.status_code == 200
    assert resp_phone.json()["items"][0]["full_name"] == "Alice Wonder"


@pytest.mark.asyncio
async def test_member_status_and_branch_filters(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Filtering by member status and branch UUID works correctly."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id
    branch_alpha_id = seed_data["branch_alpha"].id

    # Create second branch
    branch_uptown = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Alpha Uptown",
        slug="uptown",
        is_main=False,
        is_active=True,
    )
    db_session.add(branch_uptown)

    m1 = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        branch_id=branch_alpha_id,
        member_code="MEM-ACT01",
        full_name="Active Downtown",
        status=MemberStatus.ACTIVE.value,
    )
    m2 = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        branch_id=branch_uptown.id,
        member_code="MEM-INA01",
        full_name="Inactive Uptown",
        status=MemberStatus.INACTIVE.value,
    )
    db_session.add_all([m1, m2])
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    # Filter by status: inactive
    resp_status = await client.get(
        f"/api/v1/gyms/{gym_id}/members?status=inactive",
        headers=headers,
    )
    assert resp_status.status_code == 200
    assert len(resp_status.json()["items"]) == 1
    assert resp_status.json()["items"][0]["full_name"] == "Inactive Uptown"

    # Filter by branch_id: downtown
    resp_branch = await client.get(
        f"/api/v1/gyms/{gym_id}/members?branch_id={branch_alpha_id}",
        headers=headers,
    )
    assert resp_branch.status_code == 200
    items = resp_branch.json()["items"]
    assert any(i["full_name"] == "Active Downtown" for i in items)
    assert not any(i["full_name"] == "Inactive Uptown" for i in items)


@pytest.mark.asyncio
async def test_get_member_detail_owner_allowed(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Gym owner can fetch full member detail with subscriptions and assigned trainers."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    # 1. Member
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-DET001",
        full_name="Detailed Member",
        email="detailed@example.com",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(member)

    # 2. Membership Plan & Subscription
    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Pro Annual",
        duration_days=365,
        price=Decimal("599.00"),
        billing_frequency=BillingFrequency.YEARLY.value,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.flush()

    sub = MemberSubscription(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_id=member.id,
        plan_id=plan.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        price_paid=Decimal("599.00"),
        status=SubscriptionStatus.ACTIVE.value,
        auto_renew=True,
    )
    db_session.add(sub)

    # 3. Trainer & Assignment
    trainer_user = User(
        id=uuid.uuid4(), email="coach@gym-alpha.com", full_name="Coach Mike"
    )
    db_session.add(trainer_user)
    trainer_prof = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        is_active=True,
    )
    db_session.add(trainer_prof)
    await db_session.flush()

    assignment = TrainerMemberAssignment(
        id=uuid.uuid4(),
        gym_id=gym_id,
        trainer_id=trainer_prof.id,
        member_id=member.id,
        status=AssignmentStatus.ACTIVE.value,
    )
    db_session.add(assignment)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{member.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["id"] == str(member.id)
    assert data["full_name"] == "Detailed Member"
    assert len(data["subscriptions"]) == 1
    assert data["subscriptions"][0]["plan_name"] == "Pro Annual"
    assert len(data["assigned_trainers"]) == 1
    assert data["assigned_trainers"][0]["trainer_name"] == "Coach Mike"


@pytest.mark.asyncio
async def test_get_member_nonexistent_returns_404(
    client: AsyncClient, seed_data: dict
):
    """Requesting nonexistent member ID returns 404 Not Found."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id
    random_id = uuid.uuid4()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{random_id}",
        headers=headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_trainer_only_sees_assigned_members(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainer only sees members assigned to them when querying member list."""
    gym_id = seed_data["gym_alpha"].id

    # Create trainer
    trainer_user = User(
        id=uuid.uuid4(), email="pt@gym-alpha.com", full_name="Personal Trainer"
    )
    db_session.add(trainer_user)
    trainer_role = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add(trainer_role)
    trainer_prof = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        is_active=True,
    )
    db_session.add(trainer_prof)
    await db_session.flush()

    # Create 2 members, assign only 1 to trainer
    m_assigned = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-ASN01",
        full_name="Assigned Member",
        status=MemberStatus.ACTIVE.value,
    )
    m_unassigned = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-UNASN",
        full_name="Unassigned Member",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([m_assigned, m_unassigned])
    await db_session.flush()

    assignment = TrainerMemberAssignment(
        id=uuid.uuid4(),
        gym_id=gym_id,
        trainer_id=trainer_prof.id,
        member_id=m_assigned.id,
        status=AssignmentStatus.ACTIVE.value,
    )
    db_session.add(assignment)
    await db_session.commit()

    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)
    headers = {
        **auth_header(trainer_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/members",
        headers=headers,
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["full_name"] == "Assigned Member"


@pytest.mark.asyncio
async def test_trainer_cannot_view_unassigned_member_403(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainer requesting details of an unassigned member receives 403 Forbidden."""
    gym_id = seed_data["gym_alpha"].id

    trainer_user = User(
        id=uuid.uuid4(), email="pt2@gym-alpha.com", full_name="Trainer Two"
    )
    db_session.add(trainer_user)
    trainer_role = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add(trainer_role)
    trainer_prof = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        is_active=True,
    )
    db_session.add(trainer_prof)

    m_unassigned = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-UNASN2",
        full_name="Unassigned Member Two",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(m_unassigned)
    await db_session.commit()

    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)
    headers = {
        **auth_header(trainer_token),
        "X-Gym-ID": str(gym_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{m_unassigned.id}",
        headers=headers,
    )
    assert response.status_code == 403
    assert "not assigned" in response.json()["detail"]


@pytest.mark.asyncio
async def test_member_view_own_and_other_profile_rbac(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Member can view their own profile, but receives 403 trying to view another member."""
    gym_id = seed_data["gym_alpha"].id
    member_user = seed_data["member"]
    member_token = seed_data["tokens"]["member"]

    # Member's own record
    own_member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=member_user.id,
        member_code="MEM-OWN001",
        full_name="Own Member Record",
        status=MemberStatus.ACTIVE.value,
    )
    # Another member's record
    other_member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-OTH001",
        full_name="Other Member Record",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([own_member, other_member])
    await db_session.commit()

    headers = {
        **auth_header(member_token),
        "X-Gym-ID": str(gym_id),
    }

    # Own profile: 200 OK
    resp_own = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{own_member.id}",
        headers=headers,
    )
    assert resp_own.status_code == 200
    assert resp_own.json()["full_name"] == "Own Member Record"

    # Other profile: 403 Forbidden
    resp_other = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{other_member.id}",
        headers=headers,
    )
    assert resp_other.status_code == 403


@pytest.mark.asyncio
async def test_update_member_profile_success(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Admin can update member personal and contact details."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-UPD01",
        full_name="Original Name",
        email="orig@example.com",
        phone="+1-000-000-0000",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(member)
    await db_session.commit()

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_id),
    }

    update_payload = {
        "full_name": "Updated Name",
        "phone": "+1-111-222-3333",
        "notes": "VIP client with special preferences",
    }

    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/members/{member.id}",
        headers=headers,
        json=update_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["phone"] == "+1-111-222-3333"
    assert data["notes"] == "VIP client with special preferences"
    assert data["email"] == "orig@example.com"  # unchanged


@pytest.mark.asyncio
async def test_update_member_status_with_reason(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Owner can update member status with reason recorded in audit trail."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-STAT01",
        full_name="Status Member",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(member)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_id),
    }

    status_payload = {
        "status": "suspended",
        "reason": "Temporary suspension due to payment delinquency",
    }

    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/members/{member.id}/status",
        headers=headers,
        json=status_payload,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "suspended"


@pytest.mark.asyncio
async def test_cross_gym_member_access_forbidden(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """User in Gym Alpha accessing Gym Beta member endpoint gets 403 Forbidden."""
    owner_token = seed_data["tokens"]["owner"]  # Owner of Gym Alpha only
    gym_beta_id = seed_data["gym_beta"].id

    member_beta = Member(
        id=uuid.uuid4(),
        gym_id=gym_beta_id,
        member_code="MEM-BETA01",
        full_name="Beta Member",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add(member_beta)
    await db_session.commit()

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_beta_id),
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_beta_id}/members/{member_beta.id}",
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_header_path_mismatch_rejected_400(
    client: AsyncClient, seed_data: dict
):
    """Header and URL path mismatch is strictly rejected with 400 Bad Request."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    headers = {
        **auth_header(owner_token),
        "X-Gym-ID": str(gym_beta_id),  # Mismatched header
    }

    response = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/members",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Tenant desynchronization detected" in response.json()["detail"]


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected_401(
    client: AsyncClient, seed_data: dict
):
    """Unauthenticated request to member endpoints is rejected with 401."""
    gym_id = seed_data["gym_alpha"].id

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/members",
    )
    assert response.status_code == 401
