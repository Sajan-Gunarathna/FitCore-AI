/**
 * FitCore AI — API Client Types & Interfaces
 * Matches backend FastAPI Pydantic v2 schemas.
 */

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail: string | ApiErrorDetail[];
}

export interface GymBase {
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
}

export type GymCreate = GymBase;

export interface GymUpdate {
  name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  is_active?: boolean | null;
}

export interface GymRead extends GymBase {
  id: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BranchBase {
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_main?: boolean;
}

export type BranchCreate = BranchBase;

export interface BranchUpdate {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_main?: boolean | null;
  is_active?: boolean | null;
}

export interface BranchRead extends BranchBase {
  id: string;
  gym_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GymDetailRead extends GymRead {
  current_user_roles: string[];
  branches: BranchRead[];
}

export interface RoleAssignmentCreate {
  user_id: string;
  role: "owner" | "admin" | "trainer" | "member";
}

export interface GymUserRoleRead {
  id: string;
  gym_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  assigned_by?: string | null;
  assigned_at: string;
}

export interface GymMembershipSummary {
  gym_id: string;
  gym_name: string;
  gym_slug: string;
  role: "owner" | "admin" | "trainer" | "member";
  is_active: boolean;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  gyms: GymMembershipSummary[];
}

export interface DashboardKpis {
  total_members: number;
  active_members: number;
  active_subscriptions: number;
  expiring_subscriptions: number;
  total_trainers: number;
  total_branches: number;
}

export interface RecentMemberSummary {
  id: string;
  member_code: string;
  full_name: string | null;
  email: string;
  status: string;
  joined_at: string;
}

export interface UpcomingExpirationSummary {
  id: string;
  member_id: string;
  member_code: string;
  full_name: string | null;
  email: string;
  plan_name: string;
  end_date: string;
  status: string;
}

export interface RegistrationTrendPoint {
  period: string;
  count: number;
}

export interface StatusDistributionPoint {
  status: string;
  count: number;
}

export interface BranchSummaryItem {
  id: string;
  name: string;
  slug: string;
  is_main: boolean;
  is_active: boolean;
  member_count: number;
}

export interface DashboardSummaryResponse {
  gym_id: string;
  gym_name: string;
  kpis: {
    total_members: number;
    active_members: number;
    active_subscriptions: number;
    expiring_subscriptions: number;
    total_trainers: number;
    total_branches: number;
  };
  recent_members: RecentMemberSummary[];
  upcoming_expirations: UpcomingExpirationSummary[];
  registration_trend: RegistrationTrendPoint[];
  status_distribution: StatusDistributionPoint[];
  branches: BranchSummaryItem[];
}

// ── Generic Pagination ────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Member Schemas ────────────────────────────────────────────────────────────
export interface MemberSubscriptionSummary {
  id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  price_paid?: number | string | null;
  currency?: string;
  auto_renew?: boolean;
  notes?: string | null;
  days_remaining?: number | null;
}

export interface MemberTrainerSummary {
  trainer_id: string;
  trainer_name: string;
  assigned_at: string;
  status: string;
}

export interface MemberBase {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  branch_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact?: Record<string, unknown> | null;
  status?: string;
  notes?: string | null;
}

export interface MemberCreateInput extends MemberBase {
  member_code?: string | null;
  user_id?: string | null;
}

export interface MemberUpdateInput {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  branch_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface MemberStatusUpdateInput {
  status: "active" | "inactive" | "suspended" | "pending";
  reason?: string | null;
}

export interface MemberRead extends MemberBase {
  id: string;
  gym_id: string;
  user_id?: string | null;
  member_code: string;
  branch_name?: string | null;
  status: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface MemberDetailRead extends MemberRead {
  subscriptions: MemberSubscriptionSummary[];
  assigned_trainers: MemberTrainerSummary[];
}

export interface MemberListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  branchId?: string;
}

// ── Membership Plan Schemas ───────────────────────────────────────────────────
export interface MembershipPlanBase {
  name: string;
  description?: string | null;
  duration_days: number;
  price: number | string;
  currency: string;
  billing_frequency: "one_time" | "monthly" | "quarterly" | "yearly" | string;
  is_active: boolean;
}

export interface MembershipPlanCreateInput {
  name: string;
  description?: string | null;
  duration_days: number;
  price: number | string;
  currency?: string;
  billing_frequency?: "one_time" | "monthly" | "quarterly" | "yearly" | string;
  is_active?: boolean;
}

export interface MembershipPlanUpdateInput {
  name?: string;
  description?: string | null;
  duration_days?: number;
  price?: number | string;
  currency?: string;
  billing_frequency?: "one_time" | "monthly" | "quarterly" | "yearly" | string;
  is_active?: boolean;
}

export interface MembershipPlanRead extends MembershipPlanBase {
  id: string;
  gym_id: string;
  created_at: string;
  updated_at: string;
}

export interface PlanListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

// ── Member Subscription Schemas ───────────────────────────────────────────────
export interface MemberSubscriptionBase {
  member_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  price_paid: number | string;
  currency: string;
  status: "active" | "expired" | "cancelled" | "trial" | string;
  auto_renew: boolean;
  notes?: string | null;
}

export interface SubscriptionCreateInput {
  member_id: string;
  plan_id: string;
  start_date?: string | null;
  end_date?: string | null;
  price_paid?: number | string | null;
  currency?: string | null;
  auto_renew?: boolean;
  notes?: string | null;
}

export interface SubscriptionUpdateInput {
  end_date?: string | null;
  auto_renew?: boolean | null;
  notes?: string | null;
  status?: string | null;
}

export interface SubscriptionRenewInput {
  plan_id?: string | null;
  duration_days?: number | null;
  price_paid?: number | string | null;
  notes?: string | null;
}

export interface SubscriptionCancelInput {
  reason?: string | null;
}

export interface SubscriptionRead extends MemberSubscriptionBase {
  id: string;
  gym_id: string;
  created_at: string;
  updated_at: string;
  member_name?: string | null;
  member_code?: string | null;
  member_email?: string | null;
  plan_name?: string | null;
  days_remaining?: number | null;
}

export interface SubscriptionListParams {
  page?: number;
  pageSize?: number;
  memberId?: string;
  planId?: string;
  status?: string;
  expiringWithinDays?: number;
  search?: string;
}
