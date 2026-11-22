"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { DashboardSummaryResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GymSelector } from "@/components/gym/gym-selector";
import { AddBranchModal } from "@/components/gym/add-branch-modal";

// Modular Dashboard Components
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { MemberGrowthChart } from "@/components/dashboard/member-growth-chart";
import { MembershipDistributionChart } from "@/components/dashboard/membership-distribution-chart";
import { RecentMembersTable } from "@/components/dashboard/recent-members-table";
import { UpcomingExpirations } from "@/components/dashboard/upcoming-expirations";
import { BranchOverviewCard } from "@/components/dashboard/branch-overview-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";

import {
  Building2,
  Users,
  UserCheck,
  CreditCard,
  AlertTriangle,
  Dumbbell,
  Layers,
  LogOut,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  ArrowRight,
  Shield,
  Loader2,
  Lock,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, isLoading: isAuthLoading, signOut } = useAuth();
  const {
    accessibleGyms,
    activeGym,
    activeGymId,
    currentRole,
    isLoading: isGymLoading,
    isSwitching,
    clearActiveGym,
  } = useGym();

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);

  // References for race-condition and out-of-order request prevention
  const activeGymIdRef = useRef<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const handleSignOut = async () => {
    // Abort inflight queries & purge client caches
    abortControllerRef.current?.abort();
    clearActiveGym();
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const fetchDashboardSummary = useCallback(
    async (gymId: string) => {
      // 1. Cancel previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 2. Generation token & active gym reference
      const currentRequestId = ++requestIdRef.current;
      activeGymIdRef.current = gymId;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 3. Clear existing summary so Gym A data is never displayed under Gym B
      setSummary(null);
      setIsLoadingSummary(true);
      setSummaryError(null);

      try {
        const data = await apiClient.dashboard.getSummary(gymId, controller.signal);

        // 4. Guard against out-of-order responses or stale gym transitions
        if (
          currentRequestId !== requestIdRef.current ||
          gymId !== activeGymIdRef.current
        ) {
          return;
        }

        setSummary(data);
      } catch (err) {
        if (controller.signal.aborted) {
          return; // Request was aborted due to tenant switch; ignore
        }
        if (
          currentRequestId !== requestIdRef.current ||
          gymId !== activeGymIdRef.current
        ) {
          return;
        }

        const msg =
          err instanceof ApiClientError
            ? err.detail
            : "Failed to connect to dashboard analytics service.";
        setSummaryError(msg);
      } finally {
        if (
          currentRequestId === requestIdRef.current &&
          gymId === activeGymIdRef.current
        ) {
          setIsLoadingSummary(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (activeGymId && isOwnerOrAdmin) {
      queueMicrotask(() => {
        fetchDashboardSummary(activeGymId);
      });
    } else {
      queueMicrotask(() => {
        setSummary(null);
        setIsLoadingSummary(false);
      });
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [activeGymId, isOwnerOrAdmin, fetchDashboardSummary]);

  const handleBranchAdded = () => {
    if (activeGymId) {
      fetchDashboardSummary(activeGymId);
    }
  };

  if (isAuthLoading || (isGymLoading && !activeGym)) {
    return (
      <div className="min-h-screen bg-[#090D12] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#B8FF3B] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#94A3B8]">
            Authenticating tenant session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D12] text-[#F8FAFC] flex">
      {/* Collapsible Sidebar (Desktop) and Drawer (Mobile) */}
      <DashboardSidebar onAddBranchClick={() => setIsAddBranchOpen(true)} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="border-b border-[#27313D] bg-[#121922]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Breadcrumb & Gym Selector */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-[#94A3B8]">
                <span>FitCore AI</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#27313D]" />
                <span className="font-semibold text-[#F8FAFC]">Dashboard</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#27313D]" />
                <span className="text-[#B8FF3B] font-medium">Overview</span>
              </div>

              <div className="shrink-0">
                <GymSelector />
              </div>
            </div>

            {/* User Session & Sign Out */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A232D] border border-[#27313D] text-xs">
                <span className="h-2 w-2 rounded-full bg-[#B8FF3B]" />
                <span className="text-[#94A3B8]">User:</span>
                <span className="font-semibold text-[#F8FAFC] truncate max-w-[140px]">
                  {profile?.full_name || user?.email || "Authenticated"}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
          {/* State A: User has zero gyms registered */}
          {accessibleGyms.length === 0 ? (
            <Card className="border-[#27313D] bg-[#121922] shadow-2xl p-6 sm:p-10 text-center">
              <div className="max-w-md mx-auto space-y-6">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-[#1A232D] border border-[#27313D] flex items-center justify-center text-[#B8FF3B]">
                  <Building2 className="h-8 w-8" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#B8FF3B]">
                    No Gym Organizations Registered
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
                    Create Your First Gym
                  </h1>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">
                    FitCore AI is a multi-tenant platform. To view analytics, manage branches, trainers,
                    and memberships, launch the onboarding wizard.
                  </p>
                </div>

                <div className="pt-2">
                  <Link href="/onboarding">
                    <Button variant="primary" size="lg" className="w-full sm:w-auto">
                      <PlusCircle className="h-4 w-4" />
                      <span>Launch Gym Onboarding Wizard</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : !isOwnerOrAdmin ? (
            /* State B: Role-Restricted View for Members / Trainers */
            <Card className="border-[#27313D] bg-[#121922] p-8 text-center shadow-xl">
              <CardContent className="max-w-md mx-auto space-y-4">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-[#1A232D] border border-[#27313D] flex items-center justify-center text-[#B8FF3B]">
                  <Shield className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#F8FAFC]">
                    Restricted Role Access
                  </h2>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    The executive gym owner analytics dashboard is reserved for Gym Owners and Administrators.
                    Your active role in <strong className="text-[#F8FAFC]">{activeGym?.name}</strong> is{" "}
                    <span className="font-bold uppercase text-[#B8FF3B]">{currentRole}</span>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#161F2B] border border-[#27313D] text-left text-xs text-[#94A3B8]">
                  <span className="font-semibold text-[#F8FAFC] block mb-1">
                    Multi-Tenant RBAC Active:
                  </span>
                  Backend endpoint <code>/api/v1/gyms/{`{gym_id}`}/dashboard/summary</code> strictly enforces
                  authorization and rejects unauthorized access with HTTP 403 Forbidden.
                </div>
              </CardContent>
            </Card>
          ) : (
            /* State C: Active Gym Owner / Admin Executive Dashboard */
            <>
              {/* Active Gym Hero Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-[#121922] via-[#16212D] to-[#121922] border border-[#27313D] relative overflow-hidden shadow-[0_0_40px_rgba(184,255,59,0.04)]">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#B8FF3B]/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 text-[#B8FF3B] text-xs font-bold uppercase tracking-wider">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>Active Tenant</span>
                      </span>

                      {currentRole && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1A232D] border border-[#27313D] text-xs font-semibold uppercase text-[#F8FAFC]">
                          <Shield className="h-3 w-3 text-[#B8FF3B]" />
                          Role: {currentRole}
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight flex items-center gap-2">
                      <span>{activeGym?.name || summary?.gym_name || "Active Gym"}</span>
                      {(isSwitching || isLoadingSummary) && (
                        <Loader2 className="h-5 w-5 animate-spin text-[#B8FF3B]" />
                      )}
                    </h1>

                    <p className="text-xs sm:text-sm text-[#94A3B8] font-mono">
                      Slug: @{activeGym?.slug} &bull; Tenant ID: {activeGym?.id}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Link href="/dashboard/members/new">
                      <Button variant="primary" size="md">
                        <Users className="h-4 w-4" />
                        <span>Register Member</span>
                      </Button>
                    </Link>

                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setIsAddBranchOpen(true)}
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Add Branch</span>
                    </Button>

                    <Link href="/onboarding">
                      <Button variant="secondary" size="md">
                        <Building2 className="h-4 w-4" />
                        <span>New Gym</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Loading Skeleton */}
              {isLoadingSummary && !summary && <DashboardSkeleton />}

              {/* Error State */}
              {summaryError && !isLoadingSummary && (
                <DashboardErrorState
                  error={summaryError}
                  onRetry={() => {
                    if (activeGymId) fetchDashboardSummary(activeGymId);
                  }}
                  isRetrying={isLoadingSummary}
                />
              )}

              {/* Summary Dashboard Display */}
              {summary && !isLoadingSummary && (
                <>
                  {/* KPI Stat Cards (6 Real Metrics) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <DashboardStatCard
                      title="Total Members"
                      value={summary.kpis.total_members}
                      icon={<Users className="h-4 w-4" />}
                      subtitle="Enrolled"
                    />

                    <DashboardStatCard
                      title="Active Members"
                      value={summary.kpis.active_members}
                      icon={<UserCheck className="h-4 w-4" />}
                      subtitle="Active Status"
                      badge={
                        summary.kpis.total_members > 0
                          ? `${Math.round(
                              (summary.kpis.active_members /
                                summary.kpis.total_members) *
                                100
                            )}%`
                          : undefined
                      }
                      badgeVariant="success"
                    />

                    <DashboardStatCard
                      title="Active Subscriptions"
                      value={summary.kpis.active_subscriptions}
                      icon={<CreditCard className="h-4 w-4" />}
                      subtitle="Valid Plans"
                    />

                    <DashboardStatCard
                      title="Expiring (7d)"
                      value={summary.kpis.expiring_subscriptions}
                      icon={<AlertTriangle className="h-4 w-4" />}
                      subtitle="Renewal Due"
                      badgeVariant={
                        summary.kpis.expiring_subscriptions > 0
                          ? "warning"
                          : "neutral"
                      }
                      badge={
                        summary.kpis.expiring_subscriptions > 0
                          ? "Action"
                          : undefined
                      }
                    />

                    <DashboardStatCard
                      title="Total Trainers"
                      value={summary.kpis.total_trainers}
                      icon={<Dumbbell className="h-4 w-4" />}
                      subtitle="Coaching Staff"
                    />

                    <DashboardStatCard
                      title="Branches"
                      value={summary.kpis.total_branches}
                      icon={<Layers className="h-4 w-4" />}
                      subtitle="Physical Locations"
                    />
                  </div>

                  {/* Empty Data Banner if 0 members */}
                  {summary.kpis.total_members === 0 && (
                    <DashboardEmptyState gymName={summary.gym_name} />
                  )}

                  {/* Visual Analytics Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DashboardChartCard
                      title="Member Registration Trend"
                      description="Monthly member acquisition over the past 6 months"
                      icon={<Sparkles className="h-4 w-4" />}
                    >
                      <MemberGrowthChart trend={summary.registration_trend} />
                    </DashboardChartCard>

                    <DashboardChartCard
                      title="Membership Status Distribution"
                      description="Breakdown of active, inactive, suspended, and pending members"
                      icon={<ShieldCheck className="h-4 w-4" />}
                    >
                      <MembershipDistributionChart
                        distribution={summary.status_distribution}
                        totalMembers={summary.kpis.total_members}
                      />
                    </DashboardChartCard>
                  </div>

                  {/* Data Tables: Recent Members & Upcoming Expirations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-[#27313D] bg-[#121922] shadow-lg flex flex-col">
                      <CardHeader className="pb-3 border-b border-[#27313D]/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-[#B8FF3B]" />
                            <CardTitle className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                              Recent Member Registrations
                            </CardTitle>
                          </div>
                          <span className="text-[10px] text-[#94A3B8] font-mono">
                            Latest 5
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-5 flex-1">
                        <RecentMembersTable members={summary.recent_members} />
                      </CardContent>
                    </Card>

                    <Card className="border-[#27313D] bg-[#121922] shadow-lg flex flex-col">
                      <CardHeader className="pb-3 border-b border-[#27313D]/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <CardTitle className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                              Upcoming Expirations (Next 14 Days)
                            </CardTitle>
                          </div>
                          <span className="text-[10px] text-[#94A3B8] font-mono">
                            Expiring soon
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-5 flex-1">
                        <UpcomingExpirations expirations={summary.upcoming_expirations} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Branch Overview Section */}
                  <BranchOverviewCard
                    branches={summary.branches}
                    onAddBranch={() => setIsAddBranchOpen(true)}
                    canManage={isOwnerOrAdmin}
                  />

                  {/* Tenant Security & Boundary Isolation Inspector */}
                  <Card className="border-[#27313D] bg-[#121922]">
                    <CardHeader>
                      <div className="flex items-center gap-2 text-[#B8FF3B]">
                        <Lock className="h-4 w-4" />
                        <CardTitle className="text-base font-bold text-[#F8FAFC]">
                          Multi-Tenant Boundary & Security Context
                        </CardTitle>
                      </div>
                      <CardDescription>
                        Tenant isolation guarantees operating across client, API gateway, and database layers
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#27313D]/40">
                        <span className="text-[#94A3B8]">Client Injected Header:</span>
                        <span className="font-mono text-[#F8FAFC]">
                          X-Gym-ID: {activeGymId || "None"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#27313D]/40">
                        <span className="text-[#94A3B8]">FastAPI Authoritative Resolution:</span>
                        <span className="text-emerald-400 font-semibold">
                          Enforced via deps.py (Path authoritative; desync rejected with 400)
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#27313D]/40">
                        <span className="text-[#94A3B8]">PostgreSQL Database Isolation:</span>
                        <span className="font-mono text-emerald-400">
                          Transaction-scoped session variable app.current_gym_id & RLS
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#94A3B8]">User Role in Active Gym:</span>
                        <span className="text-[#B8FF3B] font-bold uppercase">
                          {currentRole || "None"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Add Branch Modal */}
      {activeGymId && (
        <AddBranchModal
          gymId={activeGymId}
          isOpen={isAddBranchOpen}
          onClose={() => setIsAddBranchOpen(false)}
          onBranchAdded={handleBranchAdded}
        />
      )}
    </div>
  );
}
