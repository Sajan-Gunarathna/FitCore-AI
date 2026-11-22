"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  MemberRead,
  MembershipPlanRead,
  SubscriptionRead,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  CalendarCheck,
  Plus,
  Search,
  RefreshCw,
  Ban,
  AlertCircle,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

function SubscriptionsContent() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { activeGymId, currentRole, clearActiveGym } = useGym();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expiringFilter, setExpiringFilter] = useState<number | undefined>(undefined);

  // Assign Plan Modal
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isLoadingAssignData, setIsLoadingAssignData] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<MemberRead[]>([]);
  const [availablePlans, setAvailablePlans] = useState<MembershipPlanRead[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customPrice, setCustomPrice] = useState("");
  const [customCurrency, setCustomCurrency] = useState("USD");
  const [autoRenew, setAutoRenew] = useState(false);
  const [assignNotes, setAssignNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Renew Modal
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<SubscriptionRead | null>(null);
  const [renewPlanId, setRenewPlanId] = useState("");
  const [renewDuration, setRenewDuration] = useState("");
  const [renewPrice, setRenewPrice] = useState("");
  const [renewNotes, setRenewNotes] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  // Cancel Modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SubscriptionRead | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  const loadSubscriptions = useCallback(async () => {
    if (!activeGymId) return;
    setIsLoading(true);
    setError(null);

    try {
      const st = statusFilter === "all" ? undefined : statusFilter;
      const res = await apiClient.subscriptions.list(activeGymId, {
        page: currentPage,
        pageSize: 15,
        search: search.trim() || undefined,
        status: st,
        expiringWithinDays: expiringFilter,
      });

      setSubscriptions(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.detail);
      } else {
        setError("Failed to load member subscriptions.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGymId, currentPage, search, statusFilter, expiringFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      loadSubscriptions();
    });
  }, [loadSubscriptions]);

  // Reset assign modal state if gym changes
  useEffect(() => {
    queueMicrotask(() => {
      setIsAssignOpen(false);
      setAvailableMembers([]);
      setAvailablePlans([]);
      setSelectedMemberId("");
      setSelectedPlanId("");
      setAssignError(null);
    });
  }, [activeGymId]);

  // Load members and plans for Assign Modal
  const fetchAssignData = useCallback(async () => {
    if (!activeGymId) return;
    setIsLoadingAssignData(true);
    setAssignError(null);

    try {
      const [membersRes, plansRes] = await Promise.all([
        apiClient.members.list(activeGymId, { pageSize: 100 }),
        apiClient.plans.list(activeGymId, { isActive: true, pageSize: 100 }),
      ]);
      const members = membersRes.items || [];
      const activePlans = (plansRes.items || []).filter((p) => p.is_active !== false);

      setAvailableMembers(members);
      setAvailablePlans(activePlans);

      if (members.length > 0) {
        setSelectedMemberId(members[0].id);
      } else {
        setSelectedMemberId("");
      }

      if (activePlans.length > 0) {
        setSelectedPlanId(activePlans[0].id);
        setCustomPrice(activePlans[0].price.toString());
        setCustomCurrency(activePlans[0].currency || "USD");
      } else {
        setSelectedPlanId("");
        setCustomPrice("");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAssignError(err.detail);
      } else {
        setAssignError("Failed to fetch available members or plans.");
      }
      setAvailableMembers([]);
      setAvailablePlans([]);
      setSelectedMemberId("");
      setSelectedPlanId("");
    } finally {
      setIsLoadingAssignData(false);
    }
  }, [activeGymId]);

  const openAssignModal = async () => {
    if (!activeGymId) return;
    setAssignError(null);
    setIsAssignOpen(true);
    await fetchAssignData();
  };

  const handlePlanSelectionChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = availablePlans.find((p) => p.id === planId);
    if (plan) {
      setCustomPrice(plan.price.toString());
      setCustomCurrency(plan.currency);
    }
  };

  const handleAssignSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !selectedMemberId || !selectedPlanId) return;

    setIsAssigning(true);
    setAssignError(null);

    try {
      await apiClient.subscriptions.create(activeGymId, {
        member_id: selectedMemberId,
        plan_id: selectedPlanId,
        start_date: startDate,
        price_paid: customPrice ? parseFloat(customPrice) : undefined,
        currency: customCurrency.trim().toUpperCase(),
        auto_renew: autoRenew,
        notes: assignNotes.trim() || null,
      });

      setIsAssignOpen(false);
      setAssignNotes("");
      loadSubscriptions();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAssignError(err.detail);
      } else {
        setAssignError("Failed to assign subscription. Check active overlapping subscriptions.");
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const openRenewModal = (sub: SubscriptionRead) => {
    setRenewTarget(sub);
    setRenewPlanId(sub.plan_id);
    setRenewDuration("");
    setRenewPrice(sub.price_paid.toString());
    setRenewNotes("");
    setRenewError(null);
    setIsRenewOpen(true);
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !renewTarget) return;

    setIsRenewing(true);
    setRenewError(null);

    try {
      await apiClient.subscriptions.renew(activeGymId, renewTarget.id, {
        plan_id: renewPlanId || undefined,
        duration_days: renewDuration ? parseInt(renewDuration, 10) : undefined,
        price_paid: renewPrice ? parseFloat(renewPrice) : undefined,
        notes: renewNotes.trim() || undefined,
      });

      setIsRenewOpen(false);
      setRenewTarget(null);
      loadSubscriptions();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setRenewError(err.detail);
      } else {
        setRenewError("Failed to renew subscription.");
      }
    } finally {
      setIsRenewing(false);
    }
  };

  const openCancelModal = (sub: SubscriptionRead) => {
    setCancelTarget(sub);
    setCancelReason("");
    setCancelError(null);
    setIsCancelOpen(true);
  };

  const handleCancelSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !cancelTarget) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      await apiClient.subscriptions.cancel(activeGymId, cancelTarget.id, {
        reason: cancelReason.trim() || undefined,
      });

      setIsCancelOpen(false);
      setCancelTarget(null);
      loadSubscriptions();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCancelError(err.detail);
      } else {
        setCancelError("Failed to cancel subscription.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "expired":
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
      case "cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "trial":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0F15] text-[#F8FAFC]">
      <DashboardSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-[#27313D] bg-[#121922] px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Dashboard
            </span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-xs font-semibold text-[#B8FF3B]">Subscriptions</span>
          </div>

          <div className="flex items-center gap-3">
            <GymSelector />
            <div className="h-4 w-px bg-[#27313D]" />
            <span className="text-xs text-[#94A3B8] hidden md:inline">
              {profile?.full_name || user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="h-8 border-[#27313D] bg-transparent text-[#94A3B8] hover:bg-[#1A222D] hover:text-[#F8FAFC]"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2">
                <CalendarCheck className="h-6 w-6 text-[#B8FF3B]" />
                <span>Member Subscriptions</span>
              </h1>
              <p className="text-xs text-[#94A3B8] mt-1">
                Monitor active memberships, upcoming billing cycles, expiration dates, and renewals.
              </p>
            </div>

            {isOwnerOrAdmin && (
              <Button
                onClick={openAssignModal}
                className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold text-xs h-9 px-4 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Assign Plan
              </Button>
            )}
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#121922] border border-[#27313D] p-3 rounded-xl shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Search member name, code, email, or plan..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 text-xs bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] placeholder:text-[#94A3B8]/60 focus-visible:ring-[#B8FF3B]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#0B0F15] p-1 rounded-lg border border-[#27313D]">
                {(["all", "active", "expired", "cancelled"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setExpiringFilter(undefined);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                      statusFilter === st && expiringFilter === undefined
                        ? "bg-[#B8FF3B] text-[#0B0F15] font-semibold"
                        : "text-[#94A3B8] hover:text-[#F8FAFC]"
                    }`}
                  >
                    {st}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setStatusFilter("active");
                    setExpiringFilter(7);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    expiringFilter === 7
                      ? "bg-amber-400 text-[#0B0F15] font-semibold"
                      : "text-amber-400/80 hover:text-amber-300"
                  }`}
                >
                  Expiring in 7d
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subscriptions Table */}
          <div className="bg-[#121922] border border-[#27313D] rounded-xl shadow-lg overflow-hidden">
            {isLoading ? (
              <div className="py-20 text-center space-y-3">
                <CalendarCheck className="h-8 w-8 text-[#B8FF3B] animate-pulse mx-auto" />
                <p className="text-xs text-[#94A3B8]">Loading subscriptions...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <CalendarCheck className="h-10 w-10 text-[#94A3B8]/40 mx-auto" />
                <p className="text-sm font-semibold text-[#F8FAFC]">No subscriptions found</p>
                <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                  {search || statusFilter !== "all" || expiringFilter !== undefined
                    ? "Try adjusting search or status filters."
                    : "Assign a membership plan to a gym member to track active subscription periods."}
                </p>
                {isOwnerOrAdmin && (
                  <Button
                    onClick={openAssignModal}
                    className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs h-8 px-3 font-semibold mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Assign First Subscription
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#27313D] bg-[#1A222D]/60 text-[#94A3B8] uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Contracted Price</th>
                      <th className="py-3 px-4">Validity Range</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4">Status</th>
                      {isOwnerOrAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27313D]/40">
                    {subscriptions.map((sub) => {
                      const isExpiringSoon =
                        sub.status === "active" &&
                        sub.days_remaining !== null &&
                        sub.days_remaining !== undefined &&
                        sub.days_remaining <= 7 &&
                        sub.days_remaining >= 0;

                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-[#1A222D]/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Link
                              href={`/dashboard/members/${sub.member_id}`}
                              className="font-bold text-[#F8FAFC] hover:text-[#B8FF3B] hover:underline"
                            >
                              {sub.member_name || "Unknown Member"}
                            </Link>
                            <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                              {sub.member_code} {sub.member_email && `• ${sub.member_email}`}
                            </p>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-[#F8FAFC]">
                              {sub.plan_name || "Custom Plan"}
                            </span>
                            {sub.auto_renew && (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                Auto-Renew
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-[#F8FAFC]">
                            {sub.currency === "USD" ? "$" : `${sub.currency} `}
                            {Number(sub.price_paid).toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-[#94A3B8]">
                            <span>{new Date(sub.start_date).toLocaleDateString()}</span>
                            <span className="mx-1">→</span>
                            <span className="text-[#F8FAFC] font-medium">
                              {new Date(sub.end_date).toLocaleDateString()}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {sub.status === "active" ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isExpiringSoon
                                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {sub.days_remaining !== null && sub.days_remaining !== undefined
                                  ? `${sub.days_remaining}d remaining`
                                  : "Active"}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] text-[10px]">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                sub.status
                              )}`}
                            >
                              {sub.status}
                            </span>
                          </td>

                          {isOwnerOrAdmin && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRenewModal(sub)}
                                  className="h-7 text-xs text-[#B8FF3B] hover:text-[#B8FF3B] hover:bg-[#B8FF3B]/10 px-2"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                  Renew
                                </Button>

                                {sub.status === "active" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openCancelModal(sub)}
                                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 px-2"
                                  >
                                    <Ban className="h-3.5 w-3.5 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[#27313D] text-xs text-[#94A3B8]">
                <span>
                  Showing page {currentPage} of {totalPages} ({totalCount} total)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="h-8 border-[#27313D] bg-transparent text-[#94A3B8] hover:bg-[#1A222D]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="h-8 border-[#27313D] bg-transparent text-[#94A3B8] hover:bg-[#1A222D]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ASSIGN PLAN MODAL */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsAssignOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Assign Plan to Member</h2>
            </div>

            {assignError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs flex items-center justify-between gap-2">
                <span>{assignError}</span>
                <button
                  type="button"
                  onClick={fetchAssignData}
                  className="text-[#B8FF3B] hover:underline font-semibold shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleAssignSubscription} className="space-y-4 text-xs">
              <div>
                <label htmlFor="select-subscription-member" className="block text-[#94A3B8] font-semibold mb-1">
                  Select Member *
                </label>
                {isLoadingAssignData ? (
                  <div className="flex items-center gap-2 p-3 bg-[#0B0F15] border border-[#27313D] rounded-lg text-xs text-[#94A3B8]">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[#B8FF3B] border-t-transparent animate-spin" />
                    <span>Loading members...</span>
                  </div>
                ) : availableMembers.length === 0 ? (
                  <div className="p-3 bg-[#0B0F15] border border-amber-500/30 rounded-lg space-y-2 text-xs">
                    <p className="text-[#94A3B8]">
                      No registered members found in this gym. Register a member first.
                    </p>
                    <Link
                      href="/dashboard/members/new"
                      onClick={() => setIsAssignOpen(false)}
                      className="inline-flex items-center gap-1.5 text-[#B8FF3B] hover:text-[#A3E635] font-semibold transition"
                    >
                      <span>Register a Member</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <select
                    id="select-subscription-member"
                    required
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full h-9 bg-[#0B0F15] border border-[#27313D] rounded-lg px-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                  >
                    <option value="" disabled>-- Select a Member --</option>
                    {availableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.member_code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="select-subscription-plan" className="block text-[#94A3B8] font-semibold mb-1">
                  Select Membership Plan *
                </label>
                {isLoadingAssignData ? (
                  <div className="flex items-center gap-2 p-3 bg-[#0B0F15] border border-[#27313D] rounded-lg text-xs text-[#94A3B8]">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[#B8FF3B] border-t-transparent animate-spin" />
                    <span>Loading active membership plans...</span>
                  </div>
                ) : availablePlans.length === 0 ? (
                  <div className="p-3 bg-[#0B0F15] border border-amber-500/30 rounded-lg space-y-2 text-xs">
                    <p className="text-[#94A3B8]">
                      No active membership plans found. Create a membership plan first.
                    </p>
                    <Link
                      href="/dashboard/membership-plans"
                      onClick={() => setIsAssignOpen(false)}
                      className="inline-flex items-center gap-1.5 text-[#B8FF3B] hover:text-[#A3E635] font-semibold transition"
                    >
                      <span>Create a Membership Plan</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <select
                    id="select-subscription-plan"
                    required
                    value={selectedPlanId}
                    onChange={(e) => handlePlanSelectionChange(e.target.value)}
                    className="w-full h-9 bg-[#0B0F15] border border-[#27313D] rounded-lg px-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                  >
                    <option value="" disabled>-- Select a Membership Plan --</option>
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currency || "USD"} {Number(p.price).toFixed(2)} / {p.duration_days} days)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Start Date *</label>
                  <Input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Contracted Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment receipt, promo codes, or remarks..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assign-auto-renew"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="rounded border-[#27313D] text-[#B8FF3B] focus:ring-[#B8FF3B]"
                />
                <label htmlFor="assign-auto-renew" className="text-xs text-[#F8FAFC] font-medium cursor-pointer">
                  Auto-renew preference flag (marked for renewal upon period end)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27313D]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isAssigning ||
                    isLoadingAssignData ||
                    !selectedMemberId ||
                    !selectedPlanId ||
                    availablePlans.length === 0 ||
                    availableMembers.length === 0
                  }
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigning ? "Assigning..." : "Assign Subscription"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW SUBSCRIPTION MODAL */}
      {isRenewOpen && renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsRenewOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Renew Subscription</h2>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Renewing <span className="font-semibold text-[#F8FAFC]">{renewTarget.plan_name}</span> for{" "}
              <span className="font-semibold text-[#F8FAFC]">{renewTarget.member_name}</span>.
            </p>

            {renewError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {renewError}
              </div>
            )}

            <form onSubmit={handleRenewSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Custom Renewal Price</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={renewPrice}
                  onChange={(e) => setRenewPrice(e.target.value)}
                  className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Custom Duration (Days)</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Defaults to standard plan duration"
                  value={renewDuration}
                  onChange={(e) => setRenewDuration(e.target.value)}
                  className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks on this renewal cycle..."
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27313D]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRenewOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isRenewing}
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isRenewing ? "Renewing..." : "Confirm Renewal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL SUBSCRIPTION MODAL */}
      {isCancelOpen && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsCancelOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-400" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Cancel Subscription</h2>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Are you sure you want to cancel the subscription of{" "}
              <span className="font-semibold text-[#F8FAFC]">{cancelTarget.member_name}</span>?
              This will disable auto-renew and mark the status as cancelled.
            </p>

            {cancelError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Cancellation Reason</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g., Member request, relocation, medical reason..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27313D]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCancelOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isCancelling}
                  className="h-8 text-xs bg-red-600 text-white hover:bg-red-500 font-semibold"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B0F15] text-[#F8FAFC]">
          <p className="text-xs text-[#94A3B8]">Loading subscriptions...</p>
        </div>
      }
    >
      <SubscriptionsContent />
    </Suspense>
  );
}
