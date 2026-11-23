"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { BranchRead, TrainerRead, TrainerStatsResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import { AddTrainerModal } from "@/components/trainer/add-trainer-modal";
import {
  Dumbbell,
  Plus,
  Search,
  Users,
  Award,
  DollarSign,
  Building2,
  Mail,
  Phone,
  AlertCircle,
  LogOut,
  ChevronRight,
  Shield,
} from "lucide-react";

function TrainersDirectoryContent() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { activeGymId, currentRole, clearActiveGym } = useGym();

  const [trainers, setTrainers] = useState<TrainerRead[]>([]);
  const [stats, setStats] = useState<TrainerStatsResponse | null>(null);
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Add Trainer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  const loadBranches = useCallback(async () => {
    if (!activeGymId) return;
    try {
      const res = await apiClient.branches.list(activeGymId);
      setBranches(res || []);
    } catch {
      // Non-fatal
    }
  }, [activeGymId]);

  const loadStats = useCallback(async () => {
    if (!activeGymId || !isOwnerOrAdmin) return;
    try {
      const res = await apiClient.trainers.getStats(activeGymId);
      setStats(res);
    } catch {
      // Non-fatal
    }
  }, [activeGymId, isOwnerOrAdmin]);

  const loadTrainers = useCallback(async () => {
    if (!activeGymId) return;
    setIsLoading(true);
    setError(null);

    try {
      const isAct =
        statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;

      const res = await apiClient.trainers.list(activeGymId, {
        search: search.trim() || undefined,
        branchId: branchFilter || undefined,
        isActive: isAct,
        pageSize: 100,
      });

      setTrainers(res.items);
      setTotalCount(res.total);
    } catch (err) {
      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to load trainers.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGymId, search, branchFilter, statusFilter]);

  useEffect(() => {
    if (activeGymId) {
      queueMicrotask(() => {
        loadBranches();
        loadStats();
        loadTrainers();
      });
    }
  }, [activeGymId, loadBranches, loadStats, loadTrainers]);

  const handleTrainerCreated = (newTrainer: TrainerRead) => {
    setTrainers((prev) => [newTrainer, ...prev]);
    setTotalCount((c) => c + 1);
    loadStats();
  };

  if (currentRole === "member") {
    return (
      <div className="flex h-screen bg-[#090D12] text-[#F8FAFC]">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400 mb-4 border border-amber-500/20">
            <Shield className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-sm text-[#94A3B8] max-w-md">
            Trainer management is reserved for gym staff and administrators.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-6 bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635]"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#090D12] text-[#F8FAFC]">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#121922]/80 backdrop-blur-md border-b border-[#27313D]">
          <div className="flex items-center gap-4">
            <GymSelector />
            <div className="h-4 w-px bg-[#27313D]" />
            <h1 className="text-lg font-semibold tracking-tight text-[#F8FAFC]">
              Trainer Management
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-[#F8FAFC]">
                {profile?.full_name || user?.email}
              </span>
              <span className="text-[10px] text-[#94A3B8] capitalize">
                {currentRole || "Staff"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D] transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#F8FAFC]">Trainers & Coaches</h2>
              <p className="text-sm text-[#94A3B8] mt-1">
                Manage your gym&apos;s coaching roster, view certifications, and assign athletes.
              </p>
            </div>

            {isOwnerOrAdmin && (
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Add Trainer
              </Button>
            )}
          </div>

          {/* KPI Summary Cards (Owner / Admin Only) */}
          {isOwnerOrAdmin && stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-[#27313D] bg-[#121922] shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase font-semibold text-[#94A3B8]">Total Coaches</p>
                    <p className="text-2xl font-bold text-[#F8FAFC] mt-1">
                      {stats?.total_trainers ?? totalCount}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#B8FF3B]/10 text-[#B8FF3B]">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#27313D] bg-[#121922] shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase font-semibold text-[#94A3B8]">Active Roster</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {stats?.active_trainers ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Award className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#27313D] bg-[#121922] shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase font-semibold text-[#94A3B8]">Assigned Members</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                      {stats?.total_assigned_members ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                    <Users className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#27313D] bg-[#121922] shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase font-semibold text-[#94A3B8]">Avg Hourly Rate</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">
                      ${Number(stats?.average_hourly_rate ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-center gap-3 bg-[#121922] p-3 rounded-xl border border-[#27313D]">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Search coaches by name, email, phone, or bio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#1A232D] border-[#27313D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50 text-sm h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-xs h-9 focus:outline-none focus:border-[#B8FF3B]"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="px-3 py-1.5 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-xs h-9 focus:outline-none focus:border-[#B8FF3B]"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTrainers}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-56 rounded-2xl bg-[#121922] border border-[#27313D] p-5 animate-pulse space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[#1A232D]" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 bg-[#1A232D] rounded" />
                      <div className="h-3 w-20 bg-[#1A232D] rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-[#1A232D] rounded" />
                  <div className="h-3 w-3/4 bg-[#1A232D] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && trainers.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-[#121922] border border-[#27313D] space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#B8FF3B]/10 text-[#B8FF3B] flex items-center justify-center">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC]">No Trainers Found</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                {search || branchFilter || statusFilter !== "all"
                  ? "No trainers match the selected filters. Try broadening your criteria."
                  : "Get started by adding your first coach or fitness trainer."}
              </p>
              {isOwnerOrAdmin && !search && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Trainer
                </Button>
              )}
            </div>
          )}

          {/* Trainers Grid */}
          {!isLoading && trainers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainers.map((t) => {
                const initials = t.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <Card
                    key={t.id}
                    className="border-[#27313D] bg-[#121922] hover:border-[#B8FF3B]/50 transition-all duration-200 shadow-md group flex flex-col justify-between"
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#1A232D] to-[#27313D] border border-[#27313D] text-[#B8FF3B] font-bold text-sm flex items-center justify-center shadow-inner">
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/trainers/${t.id}`}
                              className="font-bold text-[#F8FAFC] text-sm group-hover:text-[#B8FF3B] transition-colors line-clamp-1"
                            >
                              {t.full_name}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] mt-0.5">
                              <Building2 className="h-3 w-3 text-[#94A3B8]/70" />
                              <span>{t.branch_name || "Main Gym"}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.is_active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                          }`}
                        >
                          {t.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1 text-xs text-[#94A3B8]">
                        {t.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3.5 w-3.5 text-[#94A3B8]/60 shrink-0" />
                            <span className="truncate">{t.email}</span>
                          </div>
                        )}
                        {t.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-[#94A3B8]/60 shrink-0" />
                            <span>{t.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Specializations Badges */}
                      {t.specializations && t.specializations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {t.specializations.slice(0, 3).map((spec, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1A232D] text-[#F8FAFC] border border-[#27313D]"
                            >
                              {spec}
                            </span>
                          ))}
                          {t.specializations.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
                              +{t.specializations.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stats Footer Row */}
                      <div className="pt-3 border-t border-[#27313D]/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[#94A3B8] text-[10px] uppercase font-semibold block">
                            Assigned
                          </span>
                          <span className="font-bold text-[#F8FAFC] flex items-center gap-1">
                            <Users className="h-3 w-3 text-blue-400" />
                            {t.assigned_member_count} members
                          </span>
                        </div>

                        {isOwnerOrAdmin && (
                          <div className="text-right">
                            <span className="text-[#94A3B8] text-[10px] uppercase font-semibold block">
                              Rate
                            </span>
                            <span className="font-bold text-amber-400">
                              ${Number(t.hourly_rate).toFixed(2)}/hr
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <div className="px-5 py-2.5 bg-[#161F2B]/60 border-t border-[#27313D]/40 rounded-b-xl flex items-center justify-between">
                      <span className="text-[11px] text-[#94A3B8]">
                        {t.years_of_experience} yrs exp
                      </span>
                      <Link
                        href={`/dashboard/trainers/${t.id}`}
                        className="text-xs font-semibold text-[#B8FF3B] hover:underline flex items-center gap-1"
                      >
                        Profile & Roster
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add Trainer Modal */}
      {activeGymId && (
        <AddTrainerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          gymId={activeGymId}
          branches={branches}
          onTrainerCreated={handleTrainerCreated}
        />
      )}
    </div>
  );
}

export default function TrainersDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#090D12] text-[#F8FAFC]">
          <div className="h-6 w-6 border-2 border-[#B8FF3B] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrainersDirectoryContent />
    </Suspense>
  );
}
