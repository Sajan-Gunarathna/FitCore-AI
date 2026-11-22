-- ==============================================================================
-- FitCore AI — Migration 000001: Core Multi-Tenant Database Schema
-- Canonical database migration managed by Supabase CLI
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. USERS (Application User Profiles mapped to Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON public.users(is_super_admin) WHERE is_super_admin = TRUE;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. GYMS (Tenant Root Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_gym_slug_format CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_gyms_slug ON public.gyms(slug);
CREATE INDEX IF NOT EXISTS idx_gyms_created_by ON public.gyms(created_by);
CREATE INDEX IF NOT EXISTS idx_gyms_is_active ON public.gyms(is_active);

CREATE TRIGGER trg_gyms_updated_at
    BEFORE UPDATE ON public.gyms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. GYM_BRANCHES (Multi-location support per gym)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_gym_branch_slug UNIQUE (gym_id, slug),
    CONSTRAINT chk_branch_slug_format CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) >= 2)
);

CREATE INDEX IF NOT EXISTS idx_gym_branches_gym_id ON public.gym_branches(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_branches_is_main ON public.gym_branches(gym_id, is_main);

CREATE TRIGGER trg_gym_branches_updated_at
    BEFORE UPDATE ON public.gym_branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. GYM_USER_ROLES (Multi-tenant membership & RBAC assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_gym_user_role UNIQUE (gym_id, user_id, role),
    CONSTRAINT chk_gym_user_role_type CHECK (role IN ('owner', 'admin', 'trainer', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_gym_user_roles_lookup ON public.gym_user_roles(gym_id, user_id);
CREATE INDEX IF NOT EXISTS idx_gym_user_roles_user ON public.gym_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_user_roles_role ON public.gym_user_roles(gym_id, role);

CREATE TRIGGER trg_gym_user_roles_updated_at
    BEFORE UPDATE ON public.gym_user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. MEMBERS (Gym Member Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.gym_branches(id) ON DELETE SET NULL,
    member_code VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    emergency_contact JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_member_user_per_gym UNIQUE (gym_id, user_id),
    CONSTRAINT uq_member_code_per_gym UNIQUE (gym_id, member_code),
    CONSTRAINT chk_member_gender CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    CONSTRAINT chk_member_status CHECK (status IN ('active', 'inactive', 'suspended', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_members_gym_id ON public.members(gym_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_branch_id ON public.members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(gym_id, status);

CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. TRAINER_PROFILES (Trainer details & rates per gym)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bio TEXT,
    specializations TEXT[] NOT NULL DEFAULT '{}'::text[],
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_trainer_user_per_gym UNIQUE (gym_id, user_id),
    CONSTRAINT chk_trainer_hourly_rate CHECK (hourly_rate >= 0.00)
);

CREATE INDEX IF NOT EXISTS idx_trainers_gym_id ON public.trainer_profiles(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON public.trainer_profiles(user_id);

CREATE TRIGGER trg_trainer_profiles_updated_at
    BEFORE UPDATE ON public.trainer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. TRAINER_MEMBER_ASSIGNMENTS (Coaching assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_member_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_trainer_member_assignment UNIQUE (gym_id, trainer_id, member_id),
    CONSTRAINT chk_assignment_status CHECK (status IN ('active', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_gym ON public.trainer_member_assignments(gym_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_trainer ON public.trainer_member_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_member ON public.trainer_member_assignments(member_id);

CREATE TRIGGER trg_trainer_member_assignments_updated_at
    BEFORE UPDATE ON public.trainer_member_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. MEMBERSHIP_PLANS (Gym subscription packages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    billing_frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_gym_plan_name UNIQUE (gym_id, name),
    CONSTRAINT chk_plan_duration CHECK (duration_days > 0),
    CONSTRAINT chk_plan_price CHECK (price >= 0.00),
    CONSTRAINT chk_plan_billing_frequency CHECK (billing_frequency IN ('one_time', 'monthly', 'quarterly', 'yearly'))
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_gym_id ON public.membership_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_active ON public.membership_plans(gym_id, is_active);

CREATE TRIGGER trg_membership_plans_updated_at
    BEFORE UPDATE ON public.membership_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. MEMBER_SUBSCRIPTIONS (Member purchases of plans)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_paid NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_sub_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_sub_price CHECK (price_paid >= 0.00),
    CONSTRAINT chk_sub_status CHECK (status IN ('active', 'expired', 'cancelled', 'trial'))
);

CREATE INDEX IF NOT EXISTS idx_member_subscriptions_gym ON public.member_subscriptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_member ON public.member_subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_plan ON public.member_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON public.member_subscriptions(gym_id, status);

CREATE TRIGGER trg_member_subscriptions_updated_at
    BEFORE UPDATE ON public.member_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. AUDIT_LOGS (Security & operational event log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_gym_id ON public.audit_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
