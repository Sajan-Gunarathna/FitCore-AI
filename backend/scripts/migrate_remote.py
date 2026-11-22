"""Apply canonical Supabase migrations in order to the database.

Usage:
    python backend/scripts/migrate_remote.py
"""

import asyncio
import os
import sys
from pathlib import Path

import asyncpg

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings

MIGRATION_DIR = Path(__file__).resolve().parent.parent.parent / "supabase" / "migrations"
EXPECTED_PROJECT_REF = "uourezmxheahgkdgohqh"
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


async def run_migrations():
    # Convert SQLAlchemy database URL to standard postgresql asyncpg URL
    raw_url = str(settings.database_url)
    if "+asyncpg" in raw_url:
        pg_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
    else:
        pg_url = raw_url

    # Safeguard 1: Confirm target project reference matches audited target
    if EXPECTED_PROJECT_REF not in pg_url:
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Target database URL does not match audited "
            f"project reference '{EXPECTED_PROJECT_REF}'."
        )

    print(f"[SAFEGUARD 1] Target verified: Project ref '{EXPECTED_PROJECT_REF}'")
    print("Connecting to database...")
    conn = await asyncpg.connect(pg_url)

    try:
        # Check initial auth user count before migrations
        initial_auth_count = await conn.fetchval("SELECT count(*) FROM auth.users;")
        print(f"[SAFEGUARD 4] Preserving auth users: Found {initial_auth_count} account(s).")

        # Create schema migrations table if not exists to track applied migrations
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS public._schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
            );
        """)

        applied_rows = await conn.fetch("SELECT version FROM public._schema_migrations;")
        applied = {r["version"] for r in applied_rows}

        migration_files = sorted(MIGRATION_DIR.glob("*.sql"))
        print(f"Found {len(migration_files)} canonical migration files in {MIGRATION_DIR}")

        # Safeguard 3 & 5: Sequentially execute canonical migrations, stop on any failure
        for mf in migration_files:
            version = mf.stem
            if version in applied:
                print(f"  [ALREADY APPLIED] {mf.name}")
                continue

            print(f"  [APPLYING] {mf.name}...")
            sql = mf.read_text(encoding="utf-8")

            # Execute within transaction — rolls back cleanly if any error occurs
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO public._schema_migrations (version) VALUES ($1);",
                    version,
                )
            print(f"  [SUCCESS] {mf.name}")

        # Post-migration Verification
        print("\n==================================================")
        print("POST-MIGRATION VERIFICATION AUDIT")
        print("==================================================")

        # 1. Verify all 10 core tables exist
        tables_res = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name;"
        )
        existing_tables = {r["table_name"] for r in tables_res}
        missing_tables = [t for t in CORE_TABLES if t not in existing_tables]
        if missing_tables:
            raise RuntimeError(f"VERIFICATION FAILED: Missing core tables: {missing_tables}")
        print(f"[OK] All {len(CORE_TABLES)} core tables exist in public schema.")

        # 2. Verify RLS and FORCE RLS on all 10 tables
        rls_rows = await conn.fetch("""
            SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = ANY($1)
              AND c.relkind = 'r';
        """, CORE_TABLES)
        rls_map = {r["relname"]: (r["relrowsecurity"], r["relforcerowsecurity"]) for r in rls_rows}
        for table in CORE_TABLES:
            row_sec, force_sec = rls_map.get(table, (False, False))
            assert row_sec is True, f"RLS not enabled on table '{table}'"
            assert force_sec is True, f"FORCE RLS not enabled on table '{table}'"
        print(f"[OK] All {len(CORE_TABLES)} core tables enforce RLS and FORCE ROW LEVEL SECURITY.")

        # 3. Verify Composite Foreign Keys
        fks = await conn.fetch("""
            SELECT conname FROM pg_constraint
            WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
        """)
        existing_fks = {r["conname"] for r in fks}
        expected_fks = [
            "fk_assignment_trainer_composite",
            "fk_assignment_member_composite",
            "fk_subscription_member_composite",
            "fk_subscription_plan_composite",
            "fk_member_branch_composite",
        ]
        for fk in expected_fks:
            assert fk in existing_fks, f"Missing composite foreign key '{fk}'"
        print(f"[OK] All composite foreign keys verified: {expected_fks}")

        # 4. Verify Walk-in members column & profile fields
        user_id_null = await conn.fetchval("""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'user_id';
        """)
        assert user_id_null == "YES", "members.user_id must be nullable for walk-in members"
        print("[OK] Walk-in member support verified (members.user_id is nullable).")

        # 5. Verify Currency columns
        plan_curr = await conn.fetchval("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'membership_plans'
              AND column_name = 'currency';
        """)
        assert plan_curr == "currency", "membership_plans.currency column missing"
        sub_curr = await conn.fetchval("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'member_subscriptions'
              AND column_name = 'currency';
        """)
        assert sub_curr == "currency", "member_subscriptions.currency column missing"
        print("[OK] Multi-currency schema verified on membership_plans and member_subscriptions.")

        # 6. Verify Auth users preservation
        post_auth_count = await conn.fetchval("SELECT count(*) FROM auth.users;")
        assert post_auth_count == initial_auth_count, "Auth users count changed during migrations"
        print(f"[OK] Auth users preserved: {post_auth_count} account(s) intact.")

        print("\nAll database migrations applied and verified successfully!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
