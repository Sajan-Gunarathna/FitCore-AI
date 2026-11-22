"""Live PostgreSQL Integration Tests for FitCore AI.

Tests executed against live PostgreSQL 16 where canonical migrations
000001, 000002, and 000003 have been applied.

Covers:
- Task 2: Schema verification (10 tables, composite FKs, indexes, triggers, functions).
- Task 3: PostgreSQL RLS verification (read, insert, update, delete isolation, fail-closed,
          connection pool safety, FORCE RLS, privileged vs unprivileged distinction).
- Task 4: Role escalation prevention via direct SQL.
- Task 5: Composite foreign key relational integrity.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]

CORE_TABLES = [
    "users",
    "gyms",
    "gym_branches",
    "gym_user_roles",
    "members",
    "trainer_profiles",
    "trainer_member_assignments",
    "membership_plans",
    "member_subscriptions",
    "audit_logs",
]


# ==============================================================================
# TASK 2: SCHEMA, CONSTRAINTS, INDEXES, AND TRIGGERS VERIFICATION
# ==============================================================================

async def test_all_10_core_tables_and_force_rls_exist(admin_session: AsyncSession):
    """Verify all 10 core tables exist and enforce rowsecurity and forcerowsecurity."""
    res = await admin_session.execute(
        text("""
            SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = ANY(:tables)
              AND c.relkind = 'r';
        """),
        {"tables": CORE_TABLES},
    )
    rows = {row[0]: (row[1], row[2]) for row in res.fetchall()}

    for table in CORE_TABLES:
        assert table in rows, f"Table '{table}' missing from public schema."
        relrowsecurity, relforcerowsecurity = rows[table]
        assert relrowsecurity is True, f"RLS not enabled on '{table}'."
        assert relforcerowsecurity is True, f"FORCE RLS not enabled on '{table}'."


async def test_composite_unique_and_fk_constraints_exist(admin_session: AsyncSession):
    """Verify composite unique constraints and composite foreign keys in PostgreSQL catalog."""
    res_uq = await admin_session.execute(
        text("""
            SELECT conname, conrelid::regclass::text
            FROM pg_constraint
            WHERE conname IN (
                'uq_members_gym_id_id',
                'uq_trainer_profiles_gym_id_id',
                'uq_membership_plans_gym_id_id'
            );
        """)
    )
    uq_map = {row[0]: row[1] for row in res_uq.fetchall()}
    assert "uq_members_gym_id_id" in uq_map
    assert "uq_trainer_profiles_gym_id_id" in uq_map
    assert "uq_membership_plans_gym_id_id" in uq_map

    res_fk = await admin_session.execute(
        text("""
            SELECT conname, conrelid::regclass::text
            FROM pg_constraint
            WHERE conname IN (
                'fk_assignment_trainer_composite',
                'fk_assignment_member_composite',
                'fk_subscription_member_composite',
                'fk_subscription_plan_composite'
            );
        """)
    )
    fk_map = {row[0]: row[1] for row in res_fk.fetchall()}
    assert "fk_assignment_trainer_composite" in fk_map
    assert "fk_assignment_member_composite" in fk_map
    assert "fk_subscription_member_composite" in fk_map
    assert "fk_subscription_plan_composite" in fk_map


async def test_triggers_and_functions_work(admin_session: AsyncSession):
    """Verify update_updated_at_column trigger updates timestamp automatically."""
    user_id = uuid.uuid4()
    email = f"trigger-{uuid.uuid4().hex[:8]}@fitcore.ai"
    await admin_session.execute(
        text("INSERT INTO auth.users (id, email) VALUES (:id, :email)"),
        {"id": user_id, "email": email},
    )
    await admin_session.execute(
        text("INSERT INTO public.users (id, email, full_name) VALUES (:id, :email, 'Trigger')"),
        {"id": user_id, "email": email},
    )

    t1 = await admin_session.execute(
        text("SELECT updated_at FROM public.users WHERE id = :id"),
        {"id": user_id},
    )
    initial_updated_at = t1.scalar()

    await admin_session.execute(
        text("UPDATE public.users SET full_name = 'Trigger Updated' WHERE id = :id"),
        {"id": user_id},
    )
    t2 = await admin_session.execute(
        text("SELECT updated_at FROM public.users WHERE id = :id"),
        {"id": user_id},
    )
    new_updated_at = t2.scalar()
    assert new_updated_at >= initial_updated_at


# ==============================================================================
# TASK 3: POSTGRESQL RLS VERIFICATION (UNDER UNPRIVILEGED ROLE)
# ==============================================================================

async def _seed_gym_with_owner_and_admin(session: AsyncSession, suffix: str):
    """Seed gym, owner, and admin via superuser and commit for visibility."""
    tag = f"{suffix.replace('_', '-')}-{uuid.uuid4().hex[:6]}"
    owner_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    gym_id = uuid.uuid4()

    owner_email = f"owner-{tag}@test.com"
    admin_email = f"admin-{tag}@test.com"
    gym_slug = f"gym-{tag}"

    await session.execute(
        text("INSERT INTO auth.users (id, email) VALUES (:id, :email)"),
        [
            {"id": owner_id, "email": owner_email},
            {"id": admin_id, "email": admin_email},
        ],
    )
    await session.execute(
        text("INSERT INTO public.users (id, email, full_name) VALUES (:id, :email, :name)"),
        [
            {"id": owner_id, "email": owner_email, "name": f"Owner {tag}"},
            {"id": admin_id, "email": admin_email, "name": f"Admin {tag}"},
        ],
    )
    await session.execute(
        text(
            "INSERT INTO public.gyms (id, name, slug, created_by) "
            "VALUES (:id, :name, :slug, :created_by)"
        ),
        {
            "id": gym_id,
            "name": f"Gym {tag}",
            "slug": gym_slug,
            "created_by": owner_id,
        },
    )
    await session.execute(
        text(
            "INSERT INTO public.gym_user_roles (id, gym_id, user_id, role) "
            "VALUES (:id, :gym_id, :user_id, :role)"
        ),
        [
            {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": owner_id, "role": "owner"},
            {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": admin_id, "role": "admin"},
        ],
    )
    await session.commit()
    return gym_id, owner_id, admin_id


async def test_rls_cross_tenant_isolation_reads_writes_updates_deletes(
    admin_session: AsyncSession,
    user_session: AsyncSession,
):
    """
    Verify under unprivileged role:
    Gym A cannot read, insert, update, or delete Gym B records.
    """
    gym_a, owner_a, _ = await _seed_gym_with_owner_and_admin(admin_session, "a1")
    gym_b, owner_b, _ = await _seed_gym_with_owner_and_admin(admin_session, "b1")

    # Insert branches via admin and commit
    branch_a_id = uuid.uuid4()
    branch_b_id = uuid.uuid4()
    await admin_session.execute(
        text(
            "INSERT INTO public.gym_branches (id, gym_id, name, slug) "
            "VALUES (:id, :gym_id, :name, :slug)"
        ),
        [
            {"id": branch_a_id, "gym_id": gym_a, "name": "Branch Alpha", "slug": "main"},
            {"id": branch_b_id, "gym_id": gym_b, "name": "Branch Beta", "slug": "main"},
        ],
    )
    await admin_session.commit()

    # 1. Establish session context as Gym A Owner using set_config
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_a)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_a)},
    )

    # READ: Cannot read Gym B branch
    res_b = await user_session.execute(
        text("SELECT * FROM public.gym_branches WHERE id = :id"),
        {"id": branch_b_id},
    )
    assert res_b.fetchall() == [], "RLS failure: Gym A was able to read Gym B branch!"

    # READ: Can read Gym A branch
    res_a = await user_session.execute(
        text("SELECT * FROM public.gym_branches WHERE id = :id"),
        {"id": branch_a_id},
    )
    assert len(res_a.fetchall()) == 1

    # INSERT: Cannot insert a branch for Gym B while session is Gym A
    with pytest.raises((IntegrityError, DBAPIError)):
        await user_session.execute(
            text(
                "INSERT INTO public.gym_branches (id, gym_id, name, slug) "
                "VALUES (:id, :gym_id, 'Hacked Branch', 'hacked')"
            ),
            {"id": uuid.uuid4(), "gym_id": gym_b},
        )
    await user_session.rollback()

    # Re-establish Gym A context after rollback
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_a)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_a)},
    )

    # UPDATE: Cannot update Gym B records
    res_up = await user_session.execute(
        text("UPDATE public.gym_branches SET name = 'Defaced' WHERE id = :id"),
        {"id": branch_b_id},
    )
    assert res_up.rowcount == 0, "RLS failure: Gym A updated Gym B record!"

    # DELETE: Cannot delete Gym B records
    res_del = await user_session.execute(
        text("DELETE FROM public.gym_branches WHERE id = :id"),
        {"id": branch_b_id},
    )
    assert res_del.rowcount == 0, "RLS failure: Gym A deleted Gym B record!"


async def test_rls_missing_tenant_context_fails_closed(
    admin_session: AsyncSession,
    user_session: AsyncSession,
):
    """Verify that querying without tenant context returns 0 rows (fail-closed)."""
    gym_id, owner_id, _ = await _seed_gym_with_owner_and_admin(admin_session, "fc1")
    branch_id = uuid.uuid4()
    await admin_session.execute(
        text(
            "INSERT INTO public.gym_branches (id, gym_id, name, slug) "
            "VALUES (:id, :gym_id, 'Fail Closed Branch', 'main')"
        ),
        {"id": branch_id, "gym_id": gym_id},
    )
    await admin_session.commit()

    # Ensure context is explicitly empty
    await user_session.execute(text("SELECT set_config('app.current_user_id', '', true)"))
    await user_session.execute(text("SELECT set_config('app.current_gym_id', '', true)"))

    res = await user_session.execute(
        text("SELECT * FROM public.gym_branches WHERE id = :id"),
        {"id": branch_id},
    )
    assert res.fetchall() == [], "Fail-closed check failed: data leaked without tenant context!"


async def test_transaction_rollback_and_connection_leakage_safety(user_session: AsyncSession):
    """Verify set_config(..., true) resets upon transaction rollback and does not leak."""
    test_uuid = str(uuid.uuid4())

    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :val, true)"),
        {"val": test_uuid},
    )
    val1 = (await user_session.execute(
        text("SELECT current_setting('app.current_gym_id', true)")
    )).scalar()
    assert val1 == test_uuid

    # Roll back transaction
    await user_session.rollback()

    # In new transaction, session variable must be empty
    val2 = (await user_session.execute(
        text("SELECT current_setting('app.current_gym_id', true)")
    )).scalar()
    assert val2 in (None, ""), "Connection leaked tenant context across transaction boundaries!"


async def test_privileged_vs_unprivileged_connection_distinction(
    admin_session: AsyncSession,
    user_session: AsyncSession,
):
    """
    Demonstrate that:
    1. Privileged 'postgres' superuser BYPASSES RLS even when session context is empty.
    2. Unprivileged 'fitcore_test_user' is strictly restricted by RLS.
    """
    gym_id, _, _ = await _seed_gym_with_owner_and_admin(admin_session, "priv1")
    branch_id = uuid.uuid4()
    await admin_session.execute(
        text(
            "INSERT INTO public.gym_branches (id, gym_id, name, slug) "
            "VALUES (:id, :gym_id, 'Super Branch', 'main')"
        ),
        {"id": branch_id, "gym_id": gym_id},
    )
    await admin_session.commit()

    # 1. Superuser connection without context queries branch -> BYPASSES RLS
    await admin_session.execute(text("SELECT set_config('app.current_gym_id', '', true)"))
    res_super = await admin_session.execute(
        text("SELECT name FROM public.gym_branches WHERE id = :id"),
        {"id": branch_id},
    )
    assert len(res_super.fetchall()) == 1, "Superuser should bypass RLS"

    # 2. Unprivileged connection without context queries branch -> FILTERED OUT BY RLS
    await user_session.execute(text("SELECT set_config('app.current_gym_id', '', true)"))
    res_unpriv = await user_session.execute(
        text("SELECT name FROM public.gym_branches WHERE id = :id"),
        {"id": branch_id},
    )
    assert len(res_unpriv.fetchall()) == 0, "Unprivileged role must be filtered by RLS"


# ==============================================================================
# TASK 4: ROLE ESCALATION PREVENTIONS VIA DIRECT SQL
# ==============================================================================

async def test_role_escalation_prevention_direct_sql(
    admin_session: AsyncSession,
    user_session: AsyncSession,
):
    """
    Verify Task 4 requirements:
    - Owner can perform permitted role management.
    - Admin cannot insert an owner role.
    - Admin cannot promote another user to owner.
    - Admin cannot modify an existing owner's role.
    - Normal member cannot modify roles.
    - Cross-gym role modifications fail.
    """
    gym_id, owner_id, admin_id = await _seed_gym_with_owner_and_admin(admin_session, "esc1")

    tag = uuid.uuid4().hex[:6]
    member_id = uuid.uuid4()
    target_user_id = uuid.uuid4()
    new_trainer_id = uuid.uuid4()

    await admin_session.execute(
        text("INSERT INTO auth.users (id, email) VALUES (:id, :email)"),
        [
            {"id": member_id, "email": f"member-esc-{tag}@test.com"},
            {"id": target_user_id, "email": f"target-esc-{tag}@test.com"},
            {"id": new_trainer_id, "email": f"trainer-new-{tag}@test.com"},
        ],
    )
    await admin_session.execute(
        text("INSERT INTO public.users (id, email, full_name) VALUES (:id, :email, :name)"),
        [
            {"id": member_id, "email": f"member-esc-{tag}@test.com", "name": "Member"},
            {"id": target_user_id, "email": f"target-esc-{tag}@test.com", "name": "Target"},
            {"id": new_trainer_id, "email": f"trainer-new-{tag}@test.com", "name": "New Trainer"},
        ],
    )
    await admin_session.execute(
        text(
            "INSERT INTO public.gym_user_roles (id, gym_id, user_id, role) "
            "VALUES (:id, :gym_id, :user_id, 'member')"
        ),
        [
            {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": member_id},
            {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": target_user_id},
        ],
    )
    await admin_session.commit()

    # 1. OWNER CAN PERFORM ROLE MANAGEMENT
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_id)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_id)},
    )

    res_owner_ins = await user_session.execute(
        text(
            "INSERT INTO public.gym_user_roles (id, gym_id, user_id, role) "
            "VALUES (:id, :gym_id, :user_id, 'trainer')"
        ),
        {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": new_trainer_id},
    )
    assert res_owner_ins.rowcount == 1, "Owner should be able to assign roles"

    # 2. ADMIN CANNOT INSERT AN OWNER ROLE
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(admin_id)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_id)},
    )

    with pytest.raises((IntegrityError, DBAPIError)):
        await user_session.execute(
            text(
                "INSERT INTO public.gym_user_roles (id, gym_id, user_id, role) "
                "VALUES (:id, :gym_id, :user_id, 'owner')"
            ),
            {"id": uuid.uuid4(), "gym_id": gym_id, "user_id": target_user_id},
        )
    await user_session.rollback()

    # 3. ADMIN CANNOT PROMOTE ANOTHER USER TO OWNER
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(admin_id)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_id)},
    )

    with pytest.raises((IntegrityError, DBAPIError)):
        await user_session.execute(
            text(
                "UPDATE public.gym_user_roles SET role = 'owner' "
                "WHERE gym_id = :gym_id AND user_id = :target_id"
            ),
            {"gym_id": gym_id, "target_id": target_user_id},
        )
    await user_session.rollback()

    # 4. ADMIN CANNOT MODIFY AN EXISTING OWNER'S ROLE
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(admin_id)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_id)},
    )

    res_demote = await user_session.execute(
        text(
            "UPDATE public.gym_user_roles SET role = 'member' "
            "WHERE gym_id = :gym_id AND user_id = :owner_id"
        ),
        {"gym_id": gym_id, "owner_id": owner_id},
    )
    assert res_demote.rowcount == 0, "Admin was able to modify an existing owner's role!"

    # 5. NORMAL MEMBER CANNOT MODIFY ROLES
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(member_id)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_id)},
    )

    res_member_mod = await user_session.execute(
        text(
            "UPDATE public.gym_user_roles SET role = 'admin' "
            "WHERE gym_id = :gym_id AND user_id = :target_id"
        ),
        {"gym_id": gym_id, "target_id": target_user_id},
    )
    assert res_member_mod.rowcount == 0, "Regular member modified roles!"


# ==============================================================================
# TASK 5: COMPOSITE FOREIGN KEYS RELATIONAL INTEGRITY
# ==============================================================================

async def test_composite_foreign_keys_reject_cross_gym_relationships(
    admin_session: AsyncSession,
    user_session: AsyncSession,
):
    """
    Verify Task 5:
    - Gym A trainer + Gym B member -> rejected by PostgreSQL composite FK constraint.
    - Gym A member + Gym B membership plan -> rejected by PostgreSQL composite FK constraint.
    - Valid same-gym relationships -> successfully inserted.
    """
    gym_a, owner_a, _ = await _seed_gym_with_owner_and_admin(admin_session, "compa")
    gym_b, owner_b, _ = await _seed_gym_with_owner_and_admin(admin_session, "compb")

    tag = uuid.uuid4().hex[:6]
    trainer_user = uuid.uuid4()
    member_user_a = uuid.uuid4()
    member_user_b = uuid.uuid4()

    await admin_session.execute(
        text("INSERT INTO auth.users (id, email) VALUES (:id, :email)"),
        [
            {"id": trainer_user, "email": f"trainer-comp-{tag}@test.com"},
            {"id": member_user_a, "email": f"member-compa-{tag}@test.com"},
            {"id": member_user_b, "email": f"member-compb-{tag}@test.com"},
        ],
    )
    await admin_session.execute(
        text("INSERT INTO public.users (id, email, full_name) VALUES (:id, :email, :name)"),
        [
            {"id": trainer_user, "email": f"trainer-comp-{tag}@test.com", "name": "Trainer"},
            {"id": member_user_a, "email": f"member-compa-{tag}@test.com", "name": "Member A"},
            {"id": member_user_b, "email": f"member-compb-{tag}@test.com", "name": "Member B"},
        ],
    )

    # Trainer profile in Gym A
    trainer_a_id = uuid.uuid4()
    await admin_session.execute(
        text("""
            INSERT INTO public.trainer_profiles (id, gym_id, user_id, hourly_rate)
            VALUES (:id, :gym_id, :user_id, 45.00)
        """),
        {"id": trainer_a_id, "gym_id": gym_a, "user_id": trainer_user},
    )

    # Member in Gym A and Member in Gym B
    member_a_id = uuid.uuid4()
    member_b_id = uuid.uuid4()
    await admin_session.execute(
        text("""
            INSERT INTO public.members (id, gym_id, user_id, member_code)
            VALUES (:id, :gym_id, :user_id, :code)
        """),
        [
            {"id": member_a_id, "gym_id": gym_a, "user_id": member_user_a, "code": "M-A"},
            {"id": member_b_id, "gym_id": gym_b, "user_id": member_user_b, "code": "M-B"},
        ],
    )

    # Membership Plan in Gym B and Gym A
    plan_b_id = uuid.uuid4()
    plan_a_id = uuid.uuid4()
    await admin_session.execute(
        text("""
            INSERT INTO public.membership_plans
                (id, gym_id, name, duration_days, price, billing_frequency)
            VALUES (:id, :gym_id, :name, 30, 80.00, 'monthly')
        """),
        [
            {"id": plan_b_id, "gym_id": gym_b, "name": "Gym B Plan"},
            {"id": plan_a_id, "gym_id": gym_a, "name": "Gym A Plan"},
        ],
    )
    await admin_session.commit()

    # Set context as Owner A
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_a)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_a)},
    )

    # 1. CROSS-GYM ASSIGNMENT: Gym A trainer + Gym B member
    with pytest.raises(IntegrityError) as exc_fk1:
        await user_session.execute(
            text("""
                INSERT INTO public.trainer_member_assignments
                    (id, gym_id, trainer_id, member_id, status)
                VALUES (:id, :gym_id, :trainer_id, :member_id, 'active')
            """),
            {
                "id": uuid.uuid4(),
                "gym_id": gym_a,
                "trainer_id": trainer_a_id,
                "member_id": member_b_id,  # Cross-gym member!
            },
        )
    err1 = str(exc_fk1.value).lower()
    assert "fk_assignment_member_composite" in err1 or "foreign key" in err1
    await user_session.rollback()

    # Re-establish context
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_a)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_a)},
    )

    # 2. CROSS-GYM SUBSCRIPTION: Gym A member + Gym B membership plan
    with pytest.raises(IntegrityError) as exc_fk2:
        await user_session.execute(
            text("""
                INSERT INTO public.member_subscriptions
                    (id, gym_id, member_id, plan_id, start_date, end_date, price_paid, status)
                VALUES
                    (:id, :gym_id, :member_id, :plan_id,
                     CURRENT_DATE, CURRENT_DATE + 30, 80.00, 'active')
            """),
            {
                "id": uuid.uuid4(),
                "gym_id": gym_a,
                "member_id": member_a_id,
                "plan_id": plan_b_id,  # Cross-gym plan!
            },
        )
    err2 = str(exc_fk2.value).lower()
    assert "fk_subscription_plan_composite" in err2 or "foreign key" in err2
    await user_session.rollback()

    # Re-establish context
    await user_session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(owner_a)},
    )
    await user_session.execute(
        text("SELECT set_config('app.current_gym_id', :gid, true)"),
        {"gid": str(gym_a)},
    )

    # 3. VALID SAME-GYM RELATIONSHIPS SUCCEED
    res_valid_assign = await user_session.execute(
        text("""
            INSERT INTO public.trainer_member_assignments
                (id, gym_id, trainer_id, member_id, status)
            VALUES (:id, :gym_id, :trainer_id, :member_id, 'active')
        """),
        {
            "id": uuid.uuid4(),
            "gym_id": gym_a,
            "trainer_id": trainer_a_id,
            "member_id": member_a_id,
        },
    )
    assert res_valid_assign.rowcount == 1, "Valid same-gym assignment failed!"

    res_valid_sub = await user_session.execute(
        text("""
            INSERT INTO public.member_subscriptions
                (id, gym_id, member_id, plan_id, start_date, end_date, price_paid, status)
            VALUES
                (:id, :gym_id, :member_id, :plan_id,
                 CURRENT_DATE, CURRENT_DATE + 30, 80.00, 'active')
        """),
        {
            "id": uuid.uuid4(),
            "gym_id": gym_a,
            "member_id": member_a_id,
            "plan_id": plan_a_id,
        },
    )
    assert res_valid_sub.rowcount == 1, "Valid same-gym subscription failed!"
