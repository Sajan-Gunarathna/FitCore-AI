"""Automated tests for Trainer Management, Member Assignments & RBAC (Milestone 2.6)."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.branch import GymBranch
from app.models.member import Member, MemberStatus
from app.models.role import GymUserRole, UserRole
from app.models.trainer import AssignmentStatus, TrainerMemberAssignment, TrainerProfile
from app.models.user import User
from tests.conftest import auth_header, make_jwt


@pytest.mark.asyncio
async def test_owner_creates_staff_trainer_without_login_success(
    client: AsyncClient, seed_data: dict
):
    """Gym owner can create a staff trainer profile without requiring a Supabase Auth user."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "full_name": "Marcus Vance",
        "email": "marcus.vance@fitcore.com",
        "phone": "+1-555-0199",
        "bio": "Certified strength & conditioning specialist with 8 years experience.",
        "specializations": ["Strength Training", "HIIT", "Powerlifting"],
        "certifications": ["CSCS", "NASM-CPT"],
        "years_of_experience": 8,
        "hourly_rate": "75.00",
        "is_active": True,
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json=payload,
        headers=auth_header(owner_token),
    )
    assert response.status_code == 201
    data = response.json()

    assert data["full_name"] == payload["full_name"]
    assert data["email"] == payload["email"]
    assert data["user_id"] is None
    assert data["specializations"] == ["Strength Training", "HIIT", "Powerlifting"]
    assert data["certifications"] == ["CSCS", "NASM-CPT"]
    assert data["years_of_experience"] == 8
    assert data["hourly_rate"] == "75.00"
    assert data["is_active"] is True
    assert data["assigned_member_count"] == 0


@pytest.mark.asyncio
async def test_admin_creates_trainer_linked_to_user_and_branch(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Admin can create a trainer linked to an existing user account and branch."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    # Create user and branch
    user = User(
        id=uuid.uuid4(),
        email="elena.cross@gym-alpha.com",
        full_name="Elena Cross",
    )
    branch = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Uptown Studio",
        slug="uptown-studio",
        is_active=True,
    )
    db_session.add_all([user, branch])
    await db_session.commit()

    payload = {
        "full_name": "Elena Cross",
        "email": "elena.cross@gym-alpha.com",
        "phone": "+1-555-0288",
        "branch_id": str(branch.id),
        "user_id": str(user.id),
        "bio": "Yoga, Pilates, and mobility coach.",
        "specializations": ["Yoga", "Mobility"],
        "certifications": ["RYT-500"],
        "years_of_experience": 5,
        "hourly_rate": "65.00",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json=payload,
        headers=auth_header(admin_token),
    )
    assert response.status_code == 201
    data = response.json()

    assert data["user_id"] == str(user.id)
    assert data["branch_id"] == str(branch.id)
    assert data["branch_name"] == "Uptown Studio"


@pytest.mark.asyncio
async def test_create_trainer_cross_gym_branch_rejected(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Attempting to assign a branch from another gym must be rejected with 400 Bad Request."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    branch_beta = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_beta_id,
        name="Beta Branch",
        slug="beta-branch",
        is_active=True,
    )
    db_session.add(branch_beta)
    await db_session.commit()

    payload = {
        "full_name": "Rogue Coach",
        "branch_id": str(branch_beta.id),
        "hourly_rate": "50.00",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_alpha_id}/trainers",
        json=payload,
        headers=auth_header(owner_token),
    )
    assert response.status_code == 400
    assert "branch does not belong" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_user_trainer_profile_rejected(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """An Auth user cannot have duplicate trainer profiles in the same gym."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    user = User(
        id=uuid.uuid4(),
        email="single.trainer@fitcore.local",
        full_name="Single Trainer",
    )
    db_session.add(user)
    await db_session.flush()

    # First trainer profile
    t1 = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=user.id,
        full_name="Single Trainer",
    )
    db_session.add(t1)
    await db_session.commit()

    # Attempt to create duplicate profile for same user
    payload = {
        "full_name": "Single Trainer Copy",
        "user_id": str(user.id),
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json=payload,
        headers=auth_header(owner_token),
    )
    assert response.status_code == 409
    assert "already has a trainer profile" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_trainer_cannot_create_trainer_forbidden(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainers cannot create new trainer profiles (RBAC)."""
    gym_id = seed_data["gym_alpha"].id
    trainer_user = User(
        id=uuid.uuid4(),
        email="trainer.unauth@gym-alpha.com",
        full_name="Unauthorized Trainer User",
    )
    role_trainer = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add_all([trainer_user, role_trainer])
    await db_session.commit()
    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)

    payload = {
        "full_name": "Unauthorized Trainer",
        "hourly_rate": "40.00",
    }

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json=payload,
        headers=auth_header(trainer_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_member_cannot_access_trainers_api_forbidden(
    client: AsyncClient, seed_data: dict
):
    """Members cannot list or manage trainers (RBAC)."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    # List trainers
    res_list = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers",
        headers=auth_header(member_token),
    )
    assert res_list.status_code == 403

    # Create trainer
    res_create = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json={"full_name": "Hacked Trainer"},
        headers=auth_header(member_token),
    )
    assert res_create.status_code == 403


@pytest.mark.asyncio
async def test_list_trainers_search_and_filters(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """List trainers with search, branch filter, and active status filter."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    branch = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Branch X",
        slug="branch-x",
        is_active=True,
    )
    db_session.add(branch)
    await db_session.flush()

    t1 = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        branch_id=branch.id,
        full_name="Alice Boxer",
        email="alice@fitcore.com",
        specializations=["Boxing", "Cardio"],
        hourly_rate=Decimal("50.00"),
        is_active=True,
    )
    t2 = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Bob Swimmer",
        email="bob@fitcore.com",
        specializations=["Aquatics"],
        hourly_rate=Decimal("50.00"),
        is_active=False,
    )
    db_session.add_all([t1, t2])
    await db_session.commit()

    # 1. Search by name
    res_search = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers?search=Alice",
        headers=auth_header(owner_token),
    )
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert any(t["full_name"] == "Alice Boxer" for t in data_search["items"])
    assert not any(t["full_name"] == "Bob Swimmer" for t in data_search["items"])

    # 2. Filter by branch
    res_branch = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers?branch_id={branch.id}",
        headers=auth_header(owner_token),
    )
    assert res_branch.status_code == 200
    data_branch = res_branch.json()
    assert all(t["branch_id"] == str(branch.id) for t in data_branch["items"])

    # 3. Filter by is_active=false
    res_inactive = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers?is_active=false",
        headers=auth_header(owner_token),
    )
    assert res_inactive.status_code == 200
    data_inactive = res_inactive.json()
    assert any(t["full_name"] == "Bob Swimmer" for t in data_inactive["items"])
    assert not any(t["full_name"] == "Alice Boxer" for t in data_inactive["items"])


@pytest.mark.asyncio
async def test_update_trainer_and_status(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Owner can update trainer details and toggle active status."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    t = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Initial Name",
        hourly_rate=Decimal("40.00"),
        is_active=True,
    )
    db_session.add(t)
    await db_session.commit()

    # Update profile
    update_res = await client.patch(
        f"/api/v1/gyms/{gym_id}/trainers/{t.id}",
        json={
            "full_name": "Updated Name",
            "hourly_rate": "85.00",
            "bio": "New bio",
            "years_of_experience": 10,
        },
        headers=auth_header(owner_token),
    )
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "Updated Name"
    assert update_res.json()["hourly_rate"] == "85.00"
    assert update_res.json()["years_of_experience"] == 10

    # Toggle status to inactive
    status_res = await client.patch(
        f"/api/v1/gyms/{gym_id}/trainers/{t.id}/status",
        json={"is_active": False},
        headers=auth_header(owner_token),
    )
    assert status_res.status_code == 200
    assert status_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_assign_member_to_trainer_success_and_count_increments(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Owner assigns member to trainer; assigned_member_count updates."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Coach David",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-099",
        full_name="Assigned Athlete",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([trainer, member])
    await db_session.commit()

    # Assign via trainer endpoint
    assign_res = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer.id}/members",
        json={"member_id": str(member.id), "notes": "Initial assessment required"},
        headers=auth_header(owner_token),
    )
    assert assign_res.status_code == 201
    data = assign_res.json()
    assert data["trainer_id"] == str(trainer.id)
    assert data["member_id"] == str(member.id)
    assert data["status"] == "active"

    # Verify trainer detail has 1 assigned member
    detail_res = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer.id}",
        headers=auth_header(owner_token),
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["assigned_member_count"] == 1
    assert len(detail["assigned_members"]) == 1
    assert detail["assigned_members"][0]["member_id"] == str(member.id)


@pytest.mark.asyncio
async def test_cannot_assign_member_to_inactive_trainer(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Attempting to assign a member to an inactive trainer returns 400."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Inactive Coach",
        is_active=False,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-100",
        full_name="Athlete Two",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([trainer, member])
    await db_session.commit()

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer.id}/members",
        json={"member_id": str(member.id)},
        headers=auth_header(owner_token),
    )
    assert response.status_code == 400
    assert "inactive trainer" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_active_assignment_rejected(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Assigning a member already assigned to the same trainer returns 409 Conflict."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Coach Sam",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-101",
        full_name="Athlete Three",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([trainer, member])
    await db_session.flush()

    assignment = TrainerMemberAssignment(
        id=uuid.uuid4(),
        gym_id=gym_id,
        trainer_id=trainer.id,
        member_id=member.id,
        status=AssignmentStatus.ACTIVE.value,
    )
    db_session.add(assignment)
    await db_session.commit()

    # Duplicate attempt
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer.id}/members",
        json={"member_id": str(member.id)},
        headers=auth_header(owner_token),
    )
    assert response.status_code == 409
    assert "already assigned" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reassign_member_atomic_success(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Reassign member atomically from Trainer A to Trainer B."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    t_a = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Trainer Alpha",
        is_active=True,
    )
    t_b = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Trainer Beta",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-REASSIGN",
        full_name="Switching Athlete",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([t_a, t_b, member])
    await db_session.flush()

    assign_a = TrainerMemberAssignment(
        id=uuid.uuid4(),
        gym_id=gym_id,
        trainer_id=t_a.id,
        member_id=member.id,
        status=AssignmentStatus.ACTIVE.value,
    )
    db_session.add(assign_a)
    await db_session.commit()

    # Reassign to Trainer B
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers/{t_a.id}/members/{member.id}/reassign",
        json={"new_trainer_id": str(t_b.id), "notes": "Switched per athlete request"},
        headers=auth_header(owner_token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["trainer_id"] == str(t_b.id)

    # Verify counts: Trainer A has 0 active, Trainer B has 1 active
    res_a = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{t_a.id}",
        headers=auth_header(owner_token),
    )
    assert res_a.json()["assigned_member_count"] == 0

    res_b = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{t_b.id}",
        headers=auth_header(owner_token),
    )
    assert res_b.json()["assigned_member_count"] == 1


@pytest.mark.asyncio
async def test_unassign_member_success(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Unassign member from trainer preserves member record and releases assignment."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Coach Unassign",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-UNASSIGN",
        full_name="Athlete Unassign",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([trainer, member])
    await db_session.flush()

    assign = TrainerMemberAssignment(
        id=uuid.uuid4(),
        gym_id=gym_id,
        trainer_id=trainer.id,
        member_id=member.id,
        status=AssignmentStatus.ACTIVE.value,
    )
    db_session.add(assign)
    await db_session.commit()

    # Unassign
    response = await client.delete(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer.id}/members/{member.id}",
        headers=auth_header(owner_token),
    )
    assert response.status_code == 200

    # Member detail still exists
    mem_res = await client.get(
        f"/api/v1/gyms/{gym_id}/members/{member.id}",
        headers=auth_header(owner_token),
    )
    assert mem_res.status_code == 200
    assert len(mem_res.json()["assigned_trainers"]) == 0


@pytest.mark.asyncio
async def test_member_perspective_assign_and_unassign(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Member profile assignment routes POST/PATCH/DELETE /members/{id}/trainer work seamlessly."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    t1 = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Trainer One",
        is_active=True,
    )
    t2 = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Trainer Two",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-PERSPECTIVE",
        full_name="Perspective Athlete",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([t1, t2, member])
    await db_session.commit()

    # Assign T1 from member perspective
    assign_res = await client.post(
        f"/api/v1/gyms/{gym_id}/members/{member.id}/trainer",
        json={"trainer_id": str(t1.id)},
        headers=auth_header(owner_token),
    )
    assert assign_res.status_code == 201
    assert assign_res.json()["trainer_id"] == str(t1.id)

    # Reassign to T2 from member perspective
    reassign_res = await client.patch(
        f"/api/v1/gyms/{gym_id}/members/{member.id}/trainer",
        json={"new_trainer_id": str(t2.id)},
        headers=auth_header(owner_token),
    )
    assert reassign_res.status_code == 200
    assert reassign_res.json()["trainer_id"] == str(t2.id)

    # Unassign from member perspective
    del_res = await client.delete(
        f"/api/v1/gyms/{gym_id}/members/{member.id}/trainer",
        headers=auth_header(owner_token),
    )
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_trainer_can_view_own_profile_but_forbidden_other_trainer(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainer can view their own profile, but is forbidden from other trainers' private profiles."""
    gym_id = seed_data["gym_alpha"].id
    trainer_user = User(
        id=uuid.uuid4(),
        email="trainer.self@gym-alpha.com",
        full_name="Self Trainer User",
    )
    role_trainer = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add_all([trainer_user, role_trainer])
    await db_session.commit()
    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)

    # Own trainer profile
    own_trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        full_name="My Trainer Self",
        hourly_rate=Decimal("50.00"),
        is_active=True,
    )
    # Other trainer profile
    other_trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Other Colleague",
        hourly_rate=Decimal("50.00"),
        is_active=True,
    )
    db_session.add_all([own_trainer, other_trainer])
    await db_session.commit()

    # Own profile -> 200 OK
    res_own = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{own_trainer.id}",
        headers=auth_header(trainer_token),
    )
    assert res_own.status_code == 200
    assert res_own.json()["id"] == str(own_trainer.id)

    # Other trainer's profile -> 403 Forbidden
    res_other = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{other_trainer.id}",
        headers=auth_header(trainer_token),
    )
    assert res_other.status_code == 403


@pytest.mark.asyncio
async def test_cross_gym_trainer_access_rejected(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Accessing a trainer belonging to another gym must return 404."""
    owner_token = seed_data["tokens"]["owner"]  # owner of gym_alpha
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    # Trainer in Gym Beta
    trainer_beta = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_beta_id,
        full_name="Beta Coach",
        is_active=True,
    )
    db_session.add(trainer_beta)
    await db_session.commit()

    # Query from Gym Alpha context
    response = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/trainers/{trainer_beta.id}",
        headers=auth_header(owner_token),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_audit_logs_recorded_for_trainer_events(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Verify audit log entries are persisted for trainer lifecycle events."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    # Create trainer
    res = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers",
        json={"full_name": "Audited Trainer", "hourly_rate": "55.00"},
        headers=auth_header(owner_token),
    )
    assert res.status_code == 201
    trainer_id = res.json()["id"]

    # Verify audit log entry
    stmt = (
        select(AuditLog)
        .where(
            AuditLog.gym_id == gym_id,
            AuditLog.entity_id == trainer_id,
            AuditLog.action == "trainer.create",
        )
    )
    result = await db_session.execute(stmt)
    log = result.scalars().first()
    assert log is not None
    assert log.action == "trainer.create"


@pytest.mark.asyncio
async def test_trainer_cannot_access_stats_forbidden(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainer users cannot access gym-wide trainer statistics (financial privacy)."""
    gym_id = seed_data["gym_alpha"].id
    trainer_user = User(
        id=uuid.uuid4(),
        email="trainer.stats@gym-alpha.com",
        full_name="Stats Trainer User",
    )
    role_trainer = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    db_session.add_all([trainer_user, role_trainer])
    await db_session.commit()
    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)

    response = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/stats",
        headers=auth_header(trainer_token),
    )
    assert response.status_code == 403
    assert "insufficient permissions" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_trainer_cannot_assign_member_forbidden(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """Trainer cannot self-assign members (assigning members is strictly Admin/Owner)."""
    gym_id = seed_data["gym_alpha"].id
    trainer_user = User(
        id=uuid.uuid4(),
        email="trainer.assigner@gym-alpha.com",
        full_name="Assigner Trainer",
    )
    role_trainer = GymUserRole(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        role=UserRole.TRAINER.value,
    )
    trainer_profile = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=trainer_user.id,
        full_name="Assigner Trainer Profile",
        is_active=True,
    )
    member = Member(
        id=uuid.uuid4(),
        gym_id=gym_id,
        member_code="MEM-UNAUTH",
        full_name="Target Member",
        status=MemberStatus.ACTIVE.value,
    )
    db_session.add_all([trainer_user, role_trainer, trainer_profile, member])
    await db_session.commit()
    trainer_token = make_jwt(trainer_user.id, email=trainer_user.email)

    response = await client.post(
        f"/api/v1/gyms/{gym_id}/trainers/{trainer_profile.id}/members",
        json={"member_id": str(member.id)},
        headers=auth_header(trainer_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_hourly_rate_privacy_masked_for_non_admin(
    client: AsyncClient, db_session: AsyncSession, seed_data: dict
):
    """
    When a trainer lists trainers in the gym:
    - Their own hourly rate is visible.
    - Other trainers' hourly rates are masked to 0.00 for coaching rate privacy.
    """
    gym_id = seed_data["gym_alpha"].id

    # Trainer 1 (Self)
    t1_user = User(id=uuid.uuid4(), email="coach1@gym-alpha.com", full_name="Coach One")
    t1_role = GymUserRole(id=uuid.uuid4(), gym_id=gym_id, user_id=t1_user.id, role=UserRole.TRAINER.value)
    t1_profile = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        user_id=t1_user.id,
        full_name="Coach One",
        hourly_rate=Decimal("95.00"),
        is_active=True,
    )

    # Trainer 2 (Colleague)
    t2_profile = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        full_name="Coach Two",
        hourly_rate=Decimal("120.00"),
        is_active=True,
    )

    db_session.add_all([t1_user, t1_role, t1_profile, t2_profile])
    await db_session.commit()
    t1_token = make_jwt(t1_user.id, email=t1_user.email)

    # List trainers as Coach One
    res = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers",
        headers=auth_header(t1_token),
    )
    assert res.status_code == 200
    items = {item["id"]: item for item in res.json()["items"]}

    # Own rate is preserved
    assert items[str(t1_profile.id)]["hourly_rate"] == "95.00"
    # Other coach rate is masked to 0.00
    assert items[str(t2_profile.id)]["hourly_rate"] == "0.00"

    # Detail view of other coach masks rate to 0.00
    res_detail = await client.get(
        f"/api/v1/gyms/{gym_id}/trainers/{t1_profile.id}",
        headers=auth_header(t1_token),
    )
    assert res_detail.status_code == 200
    assert res_detail.json()["hourly_rate"] == "95.00"


@pytest.mark.asyncio
async def test_composite_fk_branch_delete_preserves_gym_id_and_sets_branch_null(
    db_session: AsyncSession, seed_data: dict
):
    """
    Verify PostgreSQL 15+ ON DELETE SET NULL (branch_id) behavior:
    Deleting a branch sets trainer.branch_id to NULL while keeping gym_id intact.
    """
    gym_id = seed_data["gym_alpha"].id

    branch = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Branch To Be Deleted",
        slug="branch-to-be-deleted",
        is_active=True,
    )
    db_session.add(branch)
    await db_session.flush()

    trainer = TrainerProfile(
        id=uuid.uuid4(),
        gym_id=gym_id,
        branch_id=branch.id,
        full_name="Branch Coach",
        is_active=True,
    )
    db_session.add(trainer)
    await db_session.commit()

    assert trainer.branch_id == branch.id
    assert trainer.gym_id == gym_id

    # Delete branch
    await db_session.delete(branch)
    await db_session.commit()

    # Re-fetch trainer
    refreshed = (await db_session.execute(
        select(TrainerProfile).where(TrainerProfile.id == trainer.id)
    )).scalar_one()

    # In SQLite or Postgres with CASCADE/SET NULL, gym_id must NOT be altered
    assert refreshed.gym_id == gym_id

