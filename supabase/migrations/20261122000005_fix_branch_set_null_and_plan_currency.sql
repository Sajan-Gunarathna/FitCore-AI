-- ==============================================================================
-- FitCore AI — Migration 000005: Fix Branch FK Set Null & Add Currency Support
-- Canonical database migration managed by Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX COMPOSITE FOREIGN KEY ON MEMBERS
--    Replace default composite ON DELETE SET NULL (which attempts to NULL both
--    gym_id and branch_id, failing NOT NULL on gym_id) with PostgreSQL's
--    column-specific action: ON DELETE SET NULL (branch_id).
-- ------------------------------------------------------------------------------
ALTER TABLE public.members
    DROP CONSTRAINT IF EXISTS fk_member_branch_composite;

ALTER TABLE public.members
    ADD CONSTRAINT fk_member_branch_composite
        FOREIGN KEY (gym_id, branch_id)
        REFERENCES public.gym_branches(gym_id, id)
        ON DELETE SET NULL (branch_id);

-- ------------------------------------------------------------------------------
-- 2. ADD CURRENCY COLUMN TO MEMBERSHIP_PLANS
-- ------------------------------------------------------------------------------
ALTER TABLE public.membership_plans
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';

-- ------------------------------------------------------------------------------
-- 3. ADD CURRENCY AND NOTES TO MEMBER_SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.member_subscriptions
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES FOR SUBSCRIPTION LOOKUPS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_end_date ON public.member_subscriptions(gym_id, end_date);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON public.member_subscriptions(gym_id, status);
