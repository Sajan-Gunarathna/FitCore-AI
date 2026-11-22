-- ==============================================================================
-- FitCore AI — Migration 000004: Walk-in Members Support & Member Profile Details
-- Canonical database migration managed by Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD COMPOSITE UNIQUE CONSTRAINT ON GYM_BRANCHES (gym_id, id)
-- ------------------------------------------------------------------------------
ALTER TABLE public.gym_branches
    ADD CONSTRAINT uq_gym_branches_gym_id_id UNIQUE (gym_id, id);

-- ------------------------------------------------------------------------------
-- 2. SUPPORT WALK-IN MEMBERS (ALLOW NULL user_id)
--    Enables front-desk staff to register members who do not yet have a
--    Supabase Auth account.
-- ------------------------------------------------------------------------------
ALTER TABLE public.members
    ALTER COLUMN user_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. ADD PROFILE AND CONTACT FIELDS DIRECTLY ON MEMBERS TABLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill full_name and email for existing member records from public.users
UPDATE public.members m
SET full_name = COALESCE(u.full_name, 'Member ' || m.member_code),
    email = u.email
FROM public.users u
WHERE m.user_id = u.id AND (m.full_name IS NULL OR m.full_name = '');

-- ------------------------------------------------------------------------------
-- 4. HARDEN BRANCH REFERENCE WITH COMPOSITE FOREIGN KEY
--    Guarantees member branch_id strictly belongs to the exact same gym_id.
-- ------------------------------------------------------------------------------
ALTER TABLE public.members
    DROP CONSTRAINT IF EXISTS members_branch_id_fkey;

ALTER TABLE public.members
    ADD CONSTRAINT fk_member_branch_composite
        FOREIGN KEY (gym_id, branch_id)
        REFERENCES public.gym_branches(gym_id, id)
        ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES FOR SEARCH AND FILTERING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_full_name ON public.members(gym_id, full_name);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(gym_id, email);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(gym_id, phone);
CREATE INDEX IF NOT EXISTS idx_members_branch ON public.members(gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_members_joined_at ON public.members(gym_id, joined_at);
