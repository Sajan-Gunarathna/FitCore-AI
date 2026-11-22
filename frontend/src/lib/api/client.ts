/**
 * FitCore AI — Tenant-Aware API Client
 *
 * Provides typed, authenticated, and tenant-scoped HTTP communication with the
 * FastAPI backend (/api/v1). Automatically handles:
 * - Supabase JWT bearer token resolution
 * - Tenant context injection (X-Gym-ID header)
 * - Header/Path tenant synchronization protection (prevents P0 desynchronization)
 * - Normalized ApiClientError with structured validation error parsing
 */

import { createClient } from "@/lib/supabase/client";
import type {
  ApiErrorDetail,
  ApiErrorResponse,
  BranchCreate,
  BranchRead,
  DashboardSummaryResponse,
  GymCreate,
  GymDetailRead,
  GymRead,
  GymUserRoleRead,
  MemberCreateInput,
  MemberDetailRead,
  MemberListParams,
  MemberRead,
  MemberStatusUpdateInput,
  MemberUpdateInput,
  MembershipPlanCreateInput,
  MembershipPlanRead,
  MembershipPlanUpdateInput,
  PaginatedResponse,
  PlanListParams,
  RoleAssignmentCreate,
  SubscriptionCancelInput,
  SubscriptionCreateInput,
  SubscriptionListParams,
  SubscriptionRead,
  SubscriptionRenewInput,
  SubscriptionUpdateInput,
  UserProfileResponse,
} from "./types";

export class ApiClientError extends Error {
  public status: number;
  public statusText: string;
  public detail: string;
  public validationErrors?: ApiErrorDetail[];

  constructor(
    status: number,
    statusText: string,
    detail: string,
    validationErrors?: ApiErrorDetail[]
  ) {
    super(detail || `API request failed with status ${status}: ${statusText}`);
    this.name = "ApiClientError";
    this.status = status;
    this.statusText = statusText;
    this.detail = detail;
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export function isApiClientError(err: unknown): err is ApiClientError {
  return (
    err instanceof ApiClientError ||
    (typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "detail" in err)
  );
}

interface RequestOptions extends RequestInit {
  gymId?: string | null;
  skipTenantHeader?: boolean;
  _isRetry?: boolean;
}

export class FitCoreApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000/api/v1"
    ).replace(/\/+$/, "");
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at - now < 120) {
        const { data: refreshData, error } =
          await supabase.auth.refreshSession();
        if (!error && refreshData.session?.access_token) {
          return refreshData.session.access_token;
        }
      }
      return session.access_token;
    } catch {
      return null;
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      gymId,
      skipTenantHeader,
      headers: customHeaders,
      _isRetry,
      ...fetchOptions
    } = options;
    const url = `${this.baseUrl}${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;

    const headers = new Headers(customHeaders);
    if (
      !headers.has("Content-Type") &&
      !(fetchOptions.body instanceof FormData)
    ) {
      headers.set("Content-Type", "application/json");
    }

    // Attach Bearer token
    const token = await this.getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Tenant Header & Path Synchronization
    // Check if endpoint contains /gyms/{gym_id}
    const gymPathMatch = endpoint.match(/\/gyms\/([a-f0-9-]+)/i);
    const pathGymId = gymPathMatch ? gymPathMatch[1] : null;

    if (pathGymId) {
      // Path parameter is authoritative. Guarantee X-Gym-ID matches path to prevent P0 desync.
      headers.set("X-Gym-ID", pathGymId);
    } else if (gymId && !skipTenantHeader) {
      // Inject X-Gym-ID header for tenant-scoped non-path endpoints
      headers.set("X-Gym-ID", gymId);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } catch (fetchErr) {
      // Windows 11 Chrome IPv6/localhost fallback: try 127.0.0.1 if localhost fails
      if (url.includes("://localhost:")) {
        try {
          const fallbackUrl = url.replace("://localhost:", "://127.0.0.1:");
          response = await fetch(fallbackUrl, {
            ...fetchOptions,
            headers,
          });
          this.baseUrl = this.baseUrl.replace(
            "://localhost:",
            "://127.0.0.1:"
          );
        } catch {
          throw new ApiClientError(
            0,
            "Network Error",
            `Network error: unable to reach API backend at ${this.baseUrl}. Please verify the FastAPI backend server is running. (${
              fetchErr instanceof Error ? fetchErr.message : "Connection failed"
            })`
          );
        }
      } else {
        throw new ApiClientError(
          0,
          "Network Error",
          `Network error: unable to reach API backend at ${this.baseUrl}. Please verify the FastAPI backend server is running. (${
            fetchErr instanceof Error ? fetchErr.message : "Connection failed"
          })`
        );
      }
    }

    // Automatic token refresh and retry on 401
    if (response.status === 401 && !_isRetry) {
      try {
        const supabase = createClient();
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          return this.request<T>(endpoint, {
            ...options,
            _isRetry: true,
          });
        }
      } catch {
        // Fall through to error throwing
      }
    }

    if (!response.ok) {
      let detail = `Request failed with status ${response.status} (${response.statusText})`;
      let validationErrors: ApiErrorDetail[] | undefined = undefined;

      try {
        const errorData: ApiErrorResponse = await response.json();
        if (typeof errorData.detail === "string") {
          detail = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          validationErrors = errorData.detail;
          detail = errorData.detail.map((d) => d.msg).join("; ");
        }
      } catch {
        // Non-JSON response or read error
      }

      throw new ApiClientError(
        response.status,
        response.statusText,
        detail,
        validationErrors
      );
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  // ── Auth Endpoints ──────────────────────────────────────────────────────────
  public auth = {
    getProfile: async (): Promise<UserProfileResponse> => {
      return this.request<UserProfileResponse>("/auth/me");
    },
  };

  // ── Gym Endpoints ───────────────────────────────────────────────────────────
  public gyms = {
    list: async (): Promise<GymRead[]> => {
      return this.request<GymRead[]>("/gyms");
    },

    create: async (data: GymCreate): Promise<GymDetailRead> => {
      return this.request<GymDetailRead>("/gyms", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    get: async (gymId: string): Promise<GymDetailRead> => {
      return this.request<GymDetailRead>(`/gyms/${gymId}`, {
        gymId,
      });
    },
  };

  // ── Branch Endpoints ────────────────────────────────────────────────────────
  public branches = {
    list: async (gymId: string): Promise<BranchRead[]> => {
      return this.request<BranchRead[]>(`/gyms/${gymId}/branches`, {
        gymId,
      });
    },

    create: async (gymId: string, data: BranchCreate): Promise<BranchRead> => {
      return this.request<BranchRead>(`/gyms/${gymId}/branches`, {
        method: "POST",
        gymId,
        body: JSON.stringify(data),
      });
    },
  };

  // ── Role Management Endpoints ───────────────────────────────────────────────
  public roles = {
    list: async (gymId: string): Promise<GymUserRoleRead[]> => {
      return this.request<GymUserRoleRead[]>(`/gyms/${gymId}/users`, {
        gymId,
      });
    },

    assign: async (
      gymId: string,
      data: RoleAssignmentCreate
    ): Promise<GymUserRoleRead> => {
      return this.request<GymUserRoleRead>(`/gyms/${gymId}/users`, {
        method: "POST",
        gymId,
        body: JSON.stringify(data),
      });
    },
  };

  // ── Dashboard & Real Analytics Endpoints ────────────────────────────────────
  public dashboard = {
    getSummary: async (
      gymId: string,
      signal?: AbortSignal
    ): Promise<DashboardSummaryResponse> => {
      return this.request<DashboardSummaryResponse>(
        `/gyms/${gymId}/dashboard/summary`,
        {
          gymId,
          signal,
        }
      );
    },
  };

  // ── Member Endpoints ────────────────────────────────────────────────────────
  public members = {
    list: async (
      gymId: string,
      params: MemberListParams = {},
      signal?: AbortSignal
    ): Promise<PaginatedResponse<MemberRead>> => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set("page", params.page.toString());
      if (params.pageSize) {
        queryParams.set("page_size", params.pageSize.toString());
      }
      if (params.search && params.search.trim()) {
        queryParams.set("search", params.search.trim());
      }
      if (params.status && params.status.trim()) {
        queryParams.set("status", params.status.trim());
      }
      if (params.branchId && params.branchId.trim()) {
        queryParams.set("branch_id", params.branchId.trim());
      }

      const queryStr = queryParams.toString();
      const endpoint = `/gyms/${gymId}/members${queryStr ? `?${queryStr}` : ""}`;

      return this.request<PaginatedResponse<MemberRead>>(endpoint, {
        gymId,
        signal,
      });
    },

    create: async (
      gymId: string,
      data: MemberCreateInput
    ): Promise<MemberRead> => {
      return this.request<MemberRead>(`/gyms/${gymId}/members`, {
        method: "POST",
        gymId,
        body: JSON.stringify(data),
      });
    },

    get: async (
      gymId: string,
      memberId: string,
      signal?: AbortSignal
    ): Promise<MemberDetailRead> => {
      return this.request<MemberDetailRead>(
        `/gyms/${gymId}/members/${memberId}`,
        {
          gymId,
          signal,
        }
      );
    },

    update: async (
      gymId: string,
      memberId: string,
      data: MemberUpdateInput
    ): Promise<MemberRead> => {
      return this.request<MemberRead>(`/gyms/${gymId}/members/${memberId}`, {
        method: "PATCH",
        gymId,
        body: JSON.stringify(data),
      });
    },

    updateStatus: async (
      gymId: string,
      memberId: string,
      data: MemberStatusUpdateInput
    ): Promise<MemberRead> => {
      return this.request<MemberRead>(
        `/gyms/${gymId}/members/${memberId}/status`,
        {
          method: "PATCH",
          gymId,
          body: JSON.stringify(data),
        }
      );
    },
  };

  public plans = {
    list: async (
      gymId: string,
      params: PlanListParams = {},
      signal?: AbortSignal
    ): Promise<PaginatedResponse<MembershipPlanRead>> => {
      const qp = new URLSearchParams();
      if (params.page) qp.set("page", params.page.toString());
      if (params.pageSize) qp.set("page_size", params.pageSize.toString());
      if (params.search) qp.set("search", params.search);
      if (params.isActive !== undefined) qp.set("is_active", String(params.isActive));
      const qs = qp.toString();
      return this.request<PaginatedResponse<MembershipPlanRead>>(
        `/gyms/${gymId}/membership-plans${qs ? `?${qs}` : ""}`,
        { gymId, signal }
      );
    },

    create: async (
      gymId: string,
      data: MembershipPlanCreateInput
    ): Promise<MembershipPlanRead> => {
      return this.request<MembershipPlanRead>(`/gyms/${gymId}/membership-plans`, {
        method: "POST",
        gymId,
        body: JSON.stringify(data),
      });
    },

    get: async (
      gymId: string,
      planId: string,
      signal?: AbortSignal
    ): Promise<MembershipPlanRead> => {
      return this.request<MembershipPlanRead>(
        `/gyms/${gymId}/membership-plans/${planId}`,
        { gymId, signal }
      );
    },

    update: async (
      gymId: string,
      planId: string,
      data: MembershipPlanUpdateInput
    ): Promise<MembershipPlanRead> => {
      return this.request<MembershipPlanRead>(
        `/gyms/${gymId}/membership-plans/${planId}`,
        {
          method: "PATCH",
          gymId,
          body: JSON.stringify(data),
        }
      );
    },

    updateStatus: async (
      gymId: string,
      planId: string,
      isActive: boolean
    ): Promise<MembershipPlanRead> => {
      return this.request<MembershipPlanRead>(
        `/gyms/${gymId}/membership-plans/${planId}/status`,
        {
          method: "PATCH",
          gymId,
          body: JSON.stringify({ is_active: isActive }),
        }
      );
    },
  };

  public subscriptions = {
    list: async (
      gymId: string,
      params: SubscriptionListParams = {},
      signal?: AbortSignal
    ): Promise<PaginatedResponse<SubscriptionRead>> => {
      const qp = new URLSearchParams();
      if (params.page) qp.set("page", params.page.toString());
      if (params.pageSize) qp.set("page_size", params.pageSize.toString());
      if (params.memberId) qp.set("member_id", params.memberId);
      if (params.planId) qp.set("plan_id", params.planId);
      if (params.status) qp.set("status", params.status);
      if (params.expiringWithinDays !== undefined) {
        qp.set("expiring_within_days", params.expiringWithinDays.toString());
      }
      if (params.search) qp.set("search", params.search);
      const qs = qp.toString();
      return this.request<PaginatedResponse<SubscriptionRead>>(
        `/gyms/${gymId}/subscriptions${qs ? `?${qs}` : ""}`,
        { gymId, signal }
      );
    },

    create: async (
      gymId: string,
      data: SubscriptionCreateInput
    ): Promise<SubscriptionRead> => {
      return this.request<SubscriptionRead>(`/gyms/${gymId}/subscriptions`, {
        method: "POST",
        gymId,
        body: JSON.stringify(data),
      });
    },

    get: async (
      gymId: string,
      subscriptionId: string,
      signal?: AbortSignal
    ): Promise<SubscriptionRead> => {
      return this.request<SubscriptionRead>(
        `/gyms/${gymId}/subscriptions/${subscriptionId}`,
        { gymId, signal }
      );
    },

    update: async (
      gymId: string,
      subscriptionId: string,
      data: SubscriptionUpdateInput
    ): Promise<SubscriptionRead> => {
      return this.request<SubscriptionRead>(
        `/gyms/${gymId}/subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          gymId,
          body: JSON.stringify(data),
        }
      );
    },

    renew: async (
      gymId: string,
      subscriptionId: string,
      data: SubscriptionRenewInput
    ): Promise<SubscriptionRead> => {
      return this.request<SubscriptionRead>(
        `/gyms/${gymId}/subscriptions/${subscriptionId}/renew`,
        {
          method: "POST",
          gymId,
          body: JSON.stringify(data),
        }
      );
    },

    cancel: async (
      gymId: string,
      subscriptionId: string,
      data: SubscriptionCancelInput
    ): Promise<SubscriptionRead> => {
      return this.request<SubscriptionRead>(
        `/gyms/${gymId}/subscriptions/${subscriptionId}/cancel`,
        {
          method: "PATCH",
          gymId,
          body: JSON.stringify(data),
        }
      );
    },
  };
}

// Default singleton instance
export const apiClient = new FitCoreApiClient();
