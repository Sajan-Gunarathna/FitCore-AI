-- ==============================================================================
-- FitCore AI — Migration 000006: Trainer Management, Staff Profiles & Member Assignments
-- Canonical database migration managed by Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SUPPORT STAFF TRAINERS WITHOUT LOGIN (ALLOW NULL user_id)
--    Enables gym owners/admins to create staff trainer profiles before or without
--    requiring a verified Supabase Auth user account.
-- ------------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
    ALTER COLUMN user_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. EXTEND TRAINER PROFILES WITH CONTACT, BRANCH, AND CREDENTIAL FIELDS
-- ------------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
    ADD COLUMN IF NOT EXISTS branch_id UUID,
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS years_of_experience INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

-- Backfill full_name and email for existing trainer records from public.users
UPDATE public.trainer_profiles tp
SET full_name = COALESCE(u.full_name, 'Trainer ' || substring(tp.id::text, 1, 8)),
    email = u.email
FROM public.users u
WHERE tp.user_id = u.id AND (tp.full_name IS NULL OR tp.full_name = '');

-- ------------------------------------------------------------------------------
-- 3. HARDEN BRANCH REFERENCE WITH COMPOSITE FOREIGN KEY
--    Guarantees trainer branch_id strictly belongs to the exact same gym_id.
--    Uses column-specific action ON DELETE SET NULL (branch_id) to preserve gym_id
--    and uphold tenant isolation when a branch is deleted.
-- ------------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
    DROP CONSTRAINT IF EXISTS fk_trainer_branch_composite;

ALTER TABLE public.trainer_profiles
    ADD CONSTRAINT fk_trainer_branch_composite
        FOREIGN KEY (gym_id, branch_id)
        REFERENCES public.gym_branches(gym_id, id)
        ON DELETE SET NULL (branch_id);

-- ------------------------------------------------------------------------------
-- 4. CONDITIONAL UNIQUE CONSTRAINT ON (gym_id, user_id)
--    Allows multiple unlinked trainers (user_id IS NULL) in a gym, but ensures
--    an Auth user can only be linked to at most one trainer profile per gym.
-- ------------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
    DROP CONSTRAINT IF EXISTS uq_trainer_user_per_gym;

DROP INDEX IF EXISTS idx_uq_trainer_user_per_gym;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trainer_user_per_gym
    ON public.trainer_profiles (gym_id, user_id)
    WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES FOR SEARCH, BRANCH, AND STATUS FILTERING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trainers_gym_full_name ON public.trainer_profiles(gym_id, full_name);
CREATE INDEX IF NOT EXISTS idx_trainers_gym_branch ON public.trainer_profiles(gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_trainers_gym_status ON public.trainer_profiles(gym_id, is_active);
CREATE INDEX IF NOT EXISTS idx_trainers_gym_joined ON public.trainer_profiles(gym_id, joined_at);

-- ------------------------------------------------------------------------------
-- 6. HARDEN ROW-LEVEL SECURITY POLICIES FOR TRAINER PROFILES & ASSIGNMENTS
-- ------------------------------------------------------------------------------
-- Ensure RLS is active and forced
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_member_assignments FORCE ROW LEVEL SECURITY;

-- ── 6A. Clean Up All Prior Policies on trainer_profiles ──────────────────────
DROP POLICY IF EXISTS "trainer_profiles_select_policy" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_insert_policy" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_update_policy" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_delete_policy" ON public.trainer_profiles;
DROP POLICY IF EXISTS "gym_members_view_trainers" ON public.trainer_profiles;
DROP POLICY IF EXISTS "gym_admin_manage_trainers" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_view_own_profile" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_directory_select" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_self_select" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_admin_select" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_admin_insert" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_admin_update" ON public.trainer_profiles;
DROP POLICY IF EXISTS "trainer_profiles_admin_delete" ON public.trainer_profiles;

-- ── 6B. Hardened Policies for trainer_profiles ───────────────────────────────

-- 1. Active Directory: Restrict direct base table SELECT to authorized gym management
--    (Members and peer trainers cannot directly query trainer_profiles to prevent sensitive column exposure)
CREATE POLICY "trainer_profiles_directory_select" ON public.trainer_profiles
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND is_active = TRUE
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 2. Self Access: Trainers can view their own profile even if inactive
CREATE POLICY "trainer_profiles_self_select" ON public.trainer_profiles
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND user_id IS NOT NULL
        AND user_id = public.current_app_user_id()
        AND public.user_has_gym_role(gym_id, ARRAY['trainer', 'admin', 'owner'])
    );

-- 3. Admin Access: Gym Owners and Admins can view all trainers (active or inactive)
CREATE POLICY "trainer_profiles_admin_select" ON public.trainer_profiles
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 4. Admin Management: Only Gym Owners and Admins can create trainer profiles
CREATE POLICY "trainer_profiles_admin_insert" ON public.trainer_profiles
    FOR INSERT
    WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 5. Admin Management: Only Gym Owners and Admins can update trainer profiles
CREATE POLICY "trainer_profiles_admin_update" ON public.trainer_profiles
    FOR UPDATE
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    )
    WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 6. Admin Management: Only Gym Owners and Admins can delete trainer profiles
CREATE POLICY "trainer_profiles_admin_delete" ON public.trainer_profiles
    FOR DELETE
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- ── 6C. Clean Up All Prior Policies on trainer_member_assignments ────────────
DROP POLICY IF EXISTS "trainer_assignments_select_policy" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_insert_policy" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_update_policy" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_delete_policy" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "gym_staff_view_assignments" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "gym_admin_manage_assignments" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_admin_select" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_trainer_select" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_member_select" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_admin_insert" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_admin_update" ON public.trainer_member_assignments;
DROP POLICY IF EXISTS "trainer_assignments_admin_delete" ON public.trainer_member_assignments;

-- ── 6D. Hardened Policies for trainer_member_assignments ─────────────────────

-- 1. Admin Access: Gym Owners and Admins can view all member assignments
CREATE POLICY "trainer_assignments_admin_select" ON public.trainer_member_assignments
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 2. Trainer Access: Trainers can view ONLY their own member assignments
CREATE POLICY "trainer_assignments_trainer_select" ON public.trainer_member_assignments
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['trainer'])
        AND trainer_id IN (
            SELECT id FROM public.trainer_profiles
            WHERE gym_id = trainer_member_assignments.gym_id
              AND user_id = public.current_app_user_id()
        )
    );

-- 3. Member Access: Members can view ONLY their own coach assignment
CREATE POLICY "trainer_assignments_member_select" ON public.trainer_member_assignments
    FOR SELECT
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['member'])
        AND member_id IN (
            SELECT id FROM public.members
            WHERE gym_id = trainer_member_assignments.gym_id
              AND user_id = public.current_app_user_id()
        )
    );

-- 4. Admin Management: Only Gym Owners and Admins can create assignments
CREATE POLICY "trainer_assignments_admin_insert" ON public.trainer_member_assignments
    FOR INSERT
    WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 5. Admin Management: Only Gym Owners and Admins can update assignments (reassign/status)
CREATE POLICY "trainer_assignments_admin_update" ON public.trainer_member_assignments
    FOR UPDATE
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    )
    WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- 6. Admin Management: Only Gym Owners and Admins can delete assignments (unassign)
CREATE POLICY "trainer_assignments_admin_delete" ON public.trainer_member_assignments
    FOR DELETE
    USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- 7. SECURE MEMBER & TRAINER-FACING DIRECTORY VIEW
--    Projects only non-sensitive columns (excluding email, phone, hourly_rate)
--    to enforce column-level privacy for members and peer trainers.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.trainer_directory
WITH (security_barrier = true) AS
SELECT
    tp.id,
    tp.gym_id,
    tp.branch_id,
    tp.user_id,
    tp.full_name,
    tp.bio,
    tp.specializations,
    tp.certifications,
    tp.years_of_experience,
    tp.is_active,
    tp.joined_at,
    tp.created_at,
    tp.updated_at
FROM public.trainer_profiles tp
WHERE tp.is_active = TRUE
  AND tp.gym_id = public.current_app_gym_id()
  AND public.user_has_gym_role(tp.gym_id, ARRAY['owner', 'admin', 'trainer', 'member']);

-- ------------------------------------------------------------------------------
-- 8. EXPLICIT GRANTS AND SECURITY RESTRICTIONS
--    Explicitly define table and view grants rather than relying solely on defaults.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Revoke all direct privileges from public and anon
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON public.trainer_profiles FROM anon';
        EXECUTE 'REVOKE ALL ON public.trainer_member_assignments FROM anon';
        EXECUTE 'REVOKE ALL ON public.trainer_directory FROM anon';
    END IF;

    -- Grant table privileges to authenticated role (enforced by RLS)
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_profiles TO authenticated';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_member_assignments TO authenticated';
        EXECUTE 'GRANT SELECT ON public.trainer_directory TO authenticated';
    END IF;

    -- Grant full privileges to service_role (backend administrative operations)
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT ALL ON public.trainer_profiles TO service_role';
        EXECUTE 'GRANT ALL ON public.trainer_member_assignments TO service_role';
        EXECUTE 'GRANT ALL ON public.trainer_directory TO service_role';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 9. HARDEN SEARCH PATH ON SECURITY DEFINER HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.current_app_gym_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_app_user_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.user_has_gym_role(UUID, VARCHAR[]) SET search_path = public, pg_temp;

