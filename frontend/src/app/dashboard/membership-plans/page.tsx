"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { MembershipPlanRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  CreditCard,
  Plus,
  Search,
  Edit,
  Clock,
  AlertCircle,
  X,
  LogOut,
} from "lucide-react";

function MembershipPlansContent() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { activeGymId, currentRole, clearActiveGym } = useGym();

  const [plans, setPlans] = useState<MembershipPlanRead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDuration, setCreateDuration] = useState("30");
  const [createPrice, setCreatePrice] = useState("49.99");
  const [createCurrency, setCreateCurrency] = useState("USD");
  const [createFrequency, setCreateFrequency] = useState("monthly");
  const [createIsActive, setCreateIsActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanRead | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDuration, setEditDuration] = useState("30");
  const [editPrice, setEditPrice] = useState("49.99");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editFrequency, setEditFrequency] = useState("monthly");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Toggle
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  const loadPlans = useCallback(async () => {
    if (!activeGymId) return;
    setIsLoading(true);
    setError(null);

    try {
      const isAct =
        activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined;
      const res = await apiClient.plans.list(activeGymId, {
        search: search.trim() || undefined,
        isActive: isAct,
        pageSize: 100,
      });
      setPlans(res.items);
      setTotalCount(res.total);
    } catch (err) {
      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to load membership plans.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGymId, activeFilter, search]);

  useEffect(() => {
    queueMicrotask(() => {
      loadPlans();
    });
  }, [loadPlans]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      await apiClient.plans.create(activeGymId, {
        name: createName.trim(),
        description: createDescription.trim() || null,
        duration_days: parseInt(createDuration, 10),
        price: parseFloat(createPrice),
        currency: createCurrency.trim().toUpperCase(),
        billing_frequency: createFrequency,
        is_active: createIsActive,
      });

      setIsCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateDuration("30");
      setCreatePrice("49.99");
      loadPlans();
    } catch (err) {
      if (isApiClientError(err)) {
        setCreateError(err.detail);
      } else {
        setCreateError("Failed to create plan. Please verify inputs.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (plan: MembershipPlanRead) => {
    setSelectedPlan(plan);
    setEditName(plan.name);
    setEditDescription(plan.description || "");
    setEditDuration(plan.duration_days.toString());
    setEditPrice(plan.price.toString());
    setEditCurrency(plan.currency);
    setEditFrequency(plan.billing_frequency);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !selectedPlan) return;

    setIsUpdating(true);
    setEditError(null);

    try {
      await apiClient.plans.update(activeGymId, selectedPlan.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        duration_days: parseInt(editDuration, 10),
        price: parseFloat(editPrice),
        currency: editCurrency.trim().toUpperCase(),
        billing_frequency: editFrequency,
      });

      setIsEditOpen(false);
      setSelectedPlan(null);
      loadPlans();
    } catch (err) {
      if (isApiClientError(err)) {
        setEditError(err.detail);
      } else {
        setEditError("Failed to update plan. Please verify inputs.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (plan: MembershipPlanRead) => {
    if (!activeGymId || !isOwnerOrAdmin) return;
    setToggleLoadingId(plan.id);

    try {
      await apiClient.plans.updateStatus(activeGymId, plan.id, !plan.is_active);
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err) {
      if (isApiClientError(err)) {
        alert(err.detail);
      } else {
        alert("Failed to change plan status.");
      }
    } finally {
      setToggleLoadingId(null);
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
            <span className="text-xs font-semibold text-[#B8FF3B]">Membership Plans</span>
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
                <CreditCard className="h-6 w-6 text-[#B8FF3B]" />
                <span>Membership Plans</span>
                <span className="text-xs font-mono font-normal text-[#94A3B8]">
                  ({totalCount})
                </span>
              </h1>
              <p className="text-xs text-[#94A3B8] mt-1">
                Configure gym pricing packages, billing terms, and active plans for member subscriptions.
              </p>
            </div>

            {isOwnerOrAdmin && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold text-xs h-9 px-4 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Plan
              </Button>
            )}
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121922] border border-[#27313D] p-3 rounded-xl shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Search plans by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] placeholder:text-[#94A3B8]/60 focus-visible:ring-[#B8FF3B]"
              />
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto">
              {(["all", "active", "inactive"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    activeFilter === filter
                      ? "bg-[#B8FF3B] text-[#0B0F15] font-semibold"
                      : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A222D]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Plan Cards Grid */}
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <CreditCard className="h-8 w-8 text-[#B8FF3B] animate-pulse mx-auto" />
              <p className="text-xs text-[#94A3B8]">Loading membership plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#121922] border border-[#27313D] rounded-xl">
              <CreditCard className="h-10 w-10 text-[#94A3B8]/40 mx-auto" />
              <p className="text-sm font-semibold text-[#F8FAFC]">No membership plans found</p>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                {search || activeFilter !== "all"
                  ? "Try clearing filters to see existing plans."
                  : "Create your first membership plan to start assigning subscriptions to members."}
              </p>
              {isOwnerOrAdmin && (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs h-8 px-3 font-semibold mt-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create First Plan
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                    plan.is_active
                      ? "border-[#27313D] bg-[#121922] hover:border-[#B8FF3B]/50"
                      : "border-[#27313D]/40 bg-[#121922]/50 opacity-75"
                  }`}
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Status & Frequency Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          plan.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                        }`}
                      >
                        {plan.is_active ? "Active" : "Inactive"}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#1A222D] text-[#94A3B8] border border-[#27313D]">
                        {plan.billing_frequency.replace("_", " ")}
                      </span>
                    </div>

                    {/* Plan Name & Price */}
                    <div>
                      <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight truncate">
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing Display */}
                    <div className="pt-2 border-t border-[#27313D]/60 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#F8FAFC]">
                        {plan.currency === "USD" ? "$" : `${plan.currency} `}
                        {Number(plan.price).toFixed(2)}
                      </span>
                      <span className="text-xs text-[#94A3B8]">
                        / {plan.duration_days} days
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                      <Clock className="h-3.5 w-3.5 text-[#B8FF3B]" />
                      <span>Duration: {plan.duration_days} calendar days</span>
                    </div>

                    {/* Actions Footer */}
                    {isOwnerOrAdmin && (
                      <div className="pt-3 border-t border-[#27313D]/40 flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(plan)}
                          className="h-7 text-xs border-[#27313D] bg-transparent text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A222D]"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={toggleLoadingId === plan.id}
                          onClick={() => handleToggleStatus(plan)}
                          className={`h-7 text-xs ${
                            plan.is_active
                              ? "text-red-400 hover:text-red-300 hover:bg-red-950/20"
                              : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20"
                          }`}
                        >
                          {toggleLoadingId === plan.id
                            ? "Updating..."
                            : plan.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* CREATE PLAN MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Create Membership Plan</h2>
            </div>

            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Plan Name *</label>
                <Input
                  required
                  placeholder="e.g., Gold Annual Membership"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Access privileges, inclusions, locker access..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Duration (Days) *</label>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Billing Frequency</label>
                  <select
                    value={createFrequency}
                    onChange={(e) => setCreateFrequency(e.target.value)}
                    className="w-full h-9 bg-[#0B0F15] border border-[#27313D] rounded-lg px-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Currency *</label>
                  <Input
                    required
                    maxLength={10}
                    placeholder="USD"
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={createIsActive}
                  onChange={(e) => setCreateIsActive(e.target.checked)}
                  className="rounded border-[#27313D] text-[#B8FF3B] focus:ring-[#B8FF3B]"
                />
                <label htmlFor="create-active" className="text-xs text-[#F8FAFC] font-medium cursor-pointer">
                  Activate immediately upon creation
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27313D]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isCreating ? "Creating..." : "Create Plan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {isEditOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Edit Membership Plan</h2>
            </div>

            {editError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Plan Name *</label>
                <Input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Duration (Days) *</label>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Billing Frequency</label>
                  <select
                    value={editFrequency}
                    onChange={(e) => setEditFrequency(e.target.value)}
                    className="w-full h-9 bg-[#0B0F15] border border-[#27313D] rounded-lg px-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Currency *</label>
                  <Input
                    required
                    maxLength={10}
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs uppercase"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#94A3B8] italic">
                Note: Updating plan pricing will only apply to new subscription cycles. Existing active member subscriptions preserve their contracted pricing and terms.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27313D]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembershipPlansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B0F15] text-[#F8FAFC]">
          <p className="text-xs text-[#94A3B8]">Loading plans...</p>
        </div>
      }
    >
      <MembershipPlansContent />
    </Suspense>
  );
}
