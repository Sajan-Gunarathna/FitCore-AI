-- ==============================================================================
-- FitCore AI — Migration 000003: Composite Foreign Keys & RLS Hardening
-- Canonical database migration managed by Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD COMPOSITE UNIQUE CONSTRAINTS ON TENANT PARENT TABLES
--    Allows child tables to reference (gym_id, id) pairs directly.
-- ------------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
    ADD CONSTRAINT uq_trainer_profiles_gym_id_id UNIQUE (gym_id, id);

ALTER TABLE public.members
    ADD CONSTRAINT uq_members_gym_id_id UNIQUE (gym_id, id);

ALTER TABLE public.membership_plans
    ADD CONSTRAINT uq_membership_plans_gym_id_id UNIQUE (gym_id, id);

-- ------------------------------------------------------------------------------
-- 2. HARDEN TRAINER_MEMBER_ASSIGNMENTS WITH COMPOSITE FOREIGN KEYS
--    Enforces that trainer and member belong to the exact same gym_id.
-- ------------------------------------------------------------------------------
-- Drop single-column foreign keys if they exist
ALTER TABLE public.trainer_member_assignments
    DROP CONSTRAINT IF EXISTS trainer_member_assignments_trainer_id_fkey,
    DROP CONSTRAINT IF EXISTS trainer_member_assignments_member_id_fkey;

-- Add composite foreign keys
ALTER TABLE public.trainer_member_assignments
    ADD CONSTRAINT fk_assignment_trainer_composite
        FOREIGN KEY (gym_id, trainer_id)
        REFERENCES public.trainer_profiles(gym_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT fk_assignment_member_composite
        FOREIGN KEY (gym_id, member_id)
        REFERENCES public.members(gym_id, id)
        ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. HARDEN MEMBER_SUBSCRIPTIONS WITH COMPOSITE FOREIGN KEYS
--    Enforces that member and plan belong to the exact same gym_id.
-- ------------------------------------------------------------------------------
-- Drop single-column foreign keys if they exist
ALTER TABLE public.member_subscriptions
    DROP CONSTRAINT IF EXISTS member_subscriptions_member_id_fkey,
    DROP CONSTRAINT IF EXISTS member_subscriptions_plan_id_fkey;

-- Add composite foreign keys
ALTER TABLE public.member_subscriptions
    ADD CONSTRAINT fk_subscription_member_composite
        FOREIGN KEY (gym_id, member_id)
        REFERENCES public.members(gym_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT fk_subscription_plan_composite
        FOREIGN KEY (gym_id, plan_id)
        REFERENCES public.membership_plans(gym_id, id)
        ON DELETE RESTRICT;

-- ------------------------------------------------------------------------------
-- 4. HARDEN GYM_USER_ROLES RLS POLICIES (PREVENT ADMIN PRIVILEGE ESCALATION)
-- ------------------------------------------------------------------------------

-- Replace UPDATE policy:
-- 1. Owners and Super Admins can update any role record in their gym.
-- 2. Admins can ONLY update records that are NOT 'owner', and CANNOT set role to 'owner'.
DROP POLICY IF EXISTS "gym_user_roles_update_policy" ON public.gym_user_roles;

CREATE POLICY "gym_user_roles_update_policy" ON public.gym_user_roles
    FOR UPDATE USING (
        gym_id = public.current_app_gym_id()
        AND (
            public.user_has_gym_role(gym_id, ARRAY['owner'])
            OR (
                public.user_has_gym_role(gym_id, ARRAY['admin'])
                AND role != 'owner'
            )
        )
    ) WITH CHECK (
        gym_id = public.current_app_gym_id()
        AND (
            public.user_has_gym_role(gym_id, ARRAY['owner'])
            OR (
                public.user_has_gym_role(gym_id, ARRAY['admin'])
                AND role != 'owner'
            )
        )
    );

-- Replace INSERT policy:
-- Admins cannot insert an 'owner' role; only existing owners or gym creators can.
DROP POLICY IF EXISTS "gym_user_roles_insert_policy" ON public.gym_user_roles;

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
            AND (
                -- Owners can insert any role
                public.user_has_gym_role(gym_id, ARRAY['owner'])
                OR (
                    -- Admins can insert non-owner roles only
                    public.user_has_gym_role(gym_id, ARRAY['admin'])
                    AND role != 'owner'
                )
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 5. FORCE ROW LEVEL SECURITY
--    Ensures RLS applies even to table owners (though superusers still bypass)
-- ------------------------------------------------------------------------------
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gyms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_branches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_member_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.member_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
