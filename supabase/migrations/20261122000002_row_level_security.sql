-- ==============================================================================
-- FitCore AI — Migration 000002: Row Level Security (RLS) Policies
-- Canonical multi-tenant database policies managed by Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR TRANSACTION-SCOPED & SUPABASE AUTH CONTEXT
-- ------------------------------------------------------------------------------

-- Get current authenticated user ID (from PostgreSQL session config or Supabase auth.uid())
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::uuid,
        auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get current active tenant gym ID (must be explicitly set per request/transaction)
CREATE OR REPLACE FUNCTION public.current_app_gym_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_gym_id', true), '')::uuid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is platform super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_is_super BOOLEAN;
BEGIN
    SELECT is_super_admin INTO v_is_super
    FROM public.users
    WHERE id = public.current_app_user_id();
    
    RETURN COALESCE(v_is_super, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user has one of the allowed roles in the given gym
CREATE OR REPLACE FUNCTION public.user_has_gym_role(p_gym_id UUID, p_roles VARCHAR[])
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_super_admin() THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.gym_user_roles
        WHERE gym_id = p_gym_id
          AND user_id = public.current_app_user_id()
          AND role = ANY(p_roles)
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. USERS POLICIES
-- ------------------------------------------------------------------------------
-- Users can view their own profile, or gym colleagues, or super admin can view all
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        id = public.current_app_user_id()
        OR public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.gym_user_roles r1
            JOIN public.gym_user_roles r2 ON r1.gym_id = r2.gym_id
            WHERE r1.user_id = public.current_app_user_id()
              AND r2.user_id = public.users.id
              AND r1.is_active = TRUE AND r2.is_active = TRUE
        )
    );

CREATE POLICY "users_insert_self" ON public.users
    FOR INSERT WITH CHECK (
        id = public.current_app_user_id()
        OR public.is_super_admin()
    );

CREATE POLICY "users_update_self" ON public.users
    FOR UPDATE USING (
        id = public.current_app_user_id()
        OR public.is_super_admin()
    ) WITH CHECK (
        id = public.current_app_user_id()
        OR public.is_super_admin()
    );

-- ------------------------------------------------------------------------------
-- 2. GYMS POLICIES
-- ------------------------------------------------------------------------------
-- Members and staff can view gyms they belong to
CREATE POLICY "gyms_select_policy" ON public.gyms
    FOR SELECT USING (
        public.is_super_admin()
        OR id IN (
            SELECT gym_id FROM public.gym_user_roles
            WHERE user_id = public.current_app_user_id()
              AND is_active = TRUE
        )
    );

-- Any authenticated user can register a new gym
CREATE POLICY "gyms_insert_policy" ON public.gyms
    FOR INSERT WITH CHECK (
        public.current_app_user_id() IS NOT NULL
    );

-- Only gym owners or super admins can update/delete gym records
CREATE POLICY "gyms_update_policy" ON public.gyms
    FOR UPDATE USING (
        public.user_has_gym_role(id, ARRAY['owner'])
    ) WITH CHECK (
        public.user_has_gym_role(id, ARRAY['owner'])
    );

CREATE POLICY "gyms_delete_policy" ON public.gyms
    FOR DELETE USING (
        public.user_has_gym_role(id, ARRAY['owner'])
    );

-- ------------------------------------------------------------------------------
-- 3. GYM_BRANCHES POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "gym_branches_select_policy" ON public.gym_branches
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin', 'trainer', 'member'])
    );

CREATE POLICY "gym_branches_insert_policy" ON public.gym_branches
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "gym_branches_update_policy" ON public.gym_branches
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "gym_branches_delete_policy" ON public.gym_branches
    FOR DELETE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner'])
    );

-- ------------------------------------------------------------------------------
-- 4. GYM_USER_ROLES POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "gym_user_roles_select_policy" ON public.gym_user_roles
    FOR SELECT USING (
        public.is_super_admin()
        OR user_id = public.current_app_user_id()
        OR (
            gym_id = public.current_app_gym_id()
            AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin', 'trainer'])
        )
    );

CREATE POLICY "gym_user_roles_insert_policy" ON public.gym_user_roles
    FOR INSERT WITH CHECK (
        public.is_super_admin()
        OR (
            -- Atomic gym creation: gym creator can assign themselves owner
            role = 'owner' AND EXISTS (
                SELECT 1 FROM public.gyms g
                WHERE g.id = gym_user_roles.gym_id
                  AND g.created_by = public.current_app_user_id()
            )
        )
        OR (
            gym_id = public.current_app_gym_id()
            AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
            -- Only owners can assign another owner
            AND (role != 'owner' OR public.user_has_gym_role(gym_id, ARRAY['owner']))
        )
    );

CREATE POLICY "gym_user_roles_update_policy" ON public.gym_user_roles
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "gym_user_roles_delete_policy" ON public.gym_user_roles
    FOR DELETE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner'])
    );

-- ------------------------------------------------------------------------------
-- 5. MEMBERS POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "members_select_policy" ON public.members
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND (
            user_id = public.current_app_user_id()
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin', 'trainer'])
        )
    );

CREATE POLICY "members_insert_policy" ON public.members
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "members_update_policy" ON public.members
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND (
            user_id = public.current_app_user_id()
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND (
            user_id = public.current_app_user_id()
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    );

CREATE POLICY "members_delete_policy" ON public.members
    FOR DELETE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- 6. TRAINER_PROFILES POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "trainer_profiles_select_policy" ON public.trainer_profiles
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin', 'trainer', 'member'])
    );

CREATE POLICY "trainer_profiles_insert_policy" ON public.trainer_profiles
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "trainer_profiles_update_policy" ON public.trainer_profiles
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND (
            user_id = public.current_app_user_id()
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND (
            user_id = public.current_app_user_id()
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    );

-- ------------------------------------------------------------------------------
-- 7. TRAINER_MEMBER_ASSIGNMENTS POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "trainer_assignments_select_policy" ON public.trainer_member_assignments
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND (
            public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
            OR trainer_id IN (SELECT id FROM public.trainer_profiles WHERE user_id = public.current_app_user_id())
            OR member_id IN (SELECT id FROM public.members WHERE user_id = public.current_app_user_id())
        )
    );

CREATE POLICY "trainer_assignments_insert_policy" ON public.trainer_member_assignments
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "trainer_assignments_update_policy" ON public.trainer_member_assignments
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "trainer_assignments_delete_policy" ON public.trainer_member_assignments
    FOR DELETE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- 8. MEMBERSHIP_PLANS POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "membership_plans_select_policy" ON public.membership_plans
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND (
            is_active = TRUE
            OR public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    );

CREATE POLICY "membership_plans_insert_policy" ON public.membership_plans
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "membership_plans_update_policy" ON public.membership_plans
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "membership_plans_delete_policy" ON public.membership_plans
    FOR DELETE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner'])
    );

-- ------------------------------------------------------------------------------
-- 9. MEMBER_SUBSCRIPTIONS POLICIES (Tenant-Scoped)
-- ------------------------------------------------------------------------------
CREATE POLICY "member_subscriptions_select_policy" ON public.member_subscriptions
    FOR SELECT USING (
        gym_id = public.current_app_gym_id()
        AND (
            public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
            OR member_id IN (SELECT id FROM public.members WHERE user_id = public.current_app_user_id())
        )
    );

CREATE POLICY "member_subscriptions_insert_policy" ON public.member_subscriptions
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY "member_subscriptions_update_policy" ON public.member_subscriptions
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- 10. AUDIT_LOGS POLICIES (Tenant-Scoped, Append-Only)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT USING (
        public.is_super_admin()
        OR (
            gym_id = public.current_app_gym_id()
            AND public.user_has_gym_role(gym_id, ARRAY['owner', 'admin'])
        )
    );

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT WITH CHECK (
        gym_id = public.current_app_gym_id()
        OR public.is_super_admin()
    );
