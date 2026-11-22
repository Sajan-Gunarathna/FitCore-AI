"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { BranchRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import { AddBranchModal } from "@/components/gym/add-branch-modal";
import { EditBranchModal } from "@/components/gym/edit-branch-modal";
import {
  Building2,
  PlusCircle,
  Search,
  MapPin,
  Phone,
  Mail,
  Edit,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";

export default function BranchesPage() {
  const { user, profile } = useAuth();
  const { activeGym, activeGymId, currentRole } = useGym();

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "main" | "active" | "inactive">("all");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRead | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Tenant Guard & Stale Request Prevention
  const requestIdRef = useRef<number>(0);
  const activeGymIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBranches = useCallback(async (gymId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentRequestId = ++requestIdRef.current;
    activeGymIdRef.current = gymId;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.branches.list(gymId);

      // Discard stale responses if gym changed or another request fired
      if (
        currentRequestId !== requestIdRef.current ||
        gymId !== activeGymIdRef.current
      ) {
        return;
      }

      setBranches(data);
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return; // Request was aborted cleanly
      }

      if (
        currentRequestId !== requestIdRef.current ||
        gymId !== activeGymIdRef.current
      ) {
        return;
      }

      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to load gym branches. Please check your connection.");
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Sync branches when active gym changes
  useEffect(() => {
    queueMicrotask(() => {
      if (activeGymId) {
        setBranches([]);
        setSuccessMessage(null);
        fetchBranches(activeGymId);
      } else {
        setBranches([]);
        setIsLoading(false);
      }
    });
  }, [activeGymId, fetchBranches]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleBranchAdded = (newBranch: BranchRead) => {
    setSuccessMessage(`Branch "${newBranch.name}" registered successfully.`);
    if (activeGymId) {
      fetchBranches(activeGymId);
    }
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleBranchUpdated = (updatedBranch: BranchRead) => {
    setSuccessMessage(`Branch "${updatedBranch.name}" updated successfully.`);
    if (activeGymId) {
      fetchBranches(activeGymId);
    }
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const openEditModal = (branch: BranchRead) => {
    setEditingBranch(branch);
    setIsEditOpen(true);
  };

  // Filtered Branch List
  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (branch.email && branch.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (branch.phone && branch.phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterType === "main") return branch.is_main;
    if (filterType === "active") return branch.is_active;
    if (filterType === "inactive") return !branch.is_active;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F8FAFC] flex">
      {/* Sidebar Navigation */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-[#27313D] bg-[#121922]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <GymSelector />
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#1A232D] border border-[#27313D] flex items-center justify-center font-bold text-[#B8FF3B] text-xs">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : "U"}
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-[#F8FAFC] leading-none">
                  {profile?.full_name || user?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                  {currentRole?.toUpperCase() || "STAFF"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header & Primary Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#27313D]">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B8FF3B]">
                <Building2 className="h-4 w-4" />
                <span>Facility Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight mt-1">
                Branches & Locations
              </h1>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
                Manage physical clubs, satellite training studios, and headquarters facilities for{" "}
                <strong className="text-[#F8FAFC]">{activeGym?.name || "your gym"}</strong>.
              </p>
            </div>

            {isOwnerOrAdmin && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsAddOpen(true)}
                className="shrink-0 shadow-[0_0_20px_rgba(184,255,59,0.2)]"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Branch</span>
              </Button>
            )}
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 flex items-center gap-3 text-xs text-[#B8FF3B] animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-400 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              {activeGymId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchBranches(activeGymId)}
                  className="shrink-0 text-xs text-red-300 border-red-500/40 hover:bg-red-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </Button>
              )}
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search branches by name, slug, address, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl bg-[#121922] border border-[#27313D] pl-10 pr-4 py-2 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#B8FF3B] focus:ring-1 focus:ring-[#B8FF3B]/30 transition"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#121922] border border-[#27313D] shrink-0 self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterType === "all"
                    ? "bg-[#1A232D] text-[#B8FF3B] font-bold shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                All ({branches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("main")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterType === "main"
                    ? "bg-[#1A232D] text-[#B8FF3B] font-bold shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                Headquarters
              </button>
              <button
                type="button"
                onClick={() => setFilterType("active")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterType === "active"
                    ? "bg-[#1A232D] text-[#B8FF3B] font-bold shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setFilterType("inactive")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterType === "inactive"
                    ? "bg-[#1A232D] text-[#B8FF3B] font-bold shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#27313D] bg-[#121922] p-6 space-y-4 animate-pulse"
                >
                  <div className="flex justify-between items-start">
                    <div className="h-5 w-32 bg-[#1A232D] rounded" />
                    <div className="h-5 w-16 bg-[#1A232D] rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-48 bg-[#1A232D] rounded" />
                    <div className="h-3 w-40 bg-[#1A232D] rounded" />
                  </div>
                  <div className="pt-4 border-t border-[#27313D] flex justify-between">
                    <div className="h-4 w-24 bg-[#1A232D] rounded" />
                    <div className="h-7 w-16 bg-[#1A232D] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State: No Branches in Gym */}
          {!isLoading && branches.length === 0 && (
            <div className="rounded-2xl border border-[#27313D] bg-[#121922]/50 p-12 text-center space-y-4 max-w-lg mx-auto">
              <div className="h-14 w-14 rounded-full bg-[#1A232D] border border-[#27313D] text-[#B8FF3B] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(184,255,59,0.15)]">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#F8FAFC]">No Branches Configured</h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Every gym requires at least one primary location to enroll members and deliver personal training sessions.
                </p>
              </div>
              {isOwnerOrAdmin && (
                <Button variant="primary" size="md" onClick={() => setIsAddOpen(true)}>
                  <PlusCircle className="h-4 w-4" />
                  <span>Add First Branch</span>
                </Button>
              )}
            </div>
          )}

          {/* Empty Search Filter State */}
          {!isLoading && branches.length > 0 && filteredBranches.length === 0 && (
            <div className="rounded-2xl border border-[#27313D] bg-[#121922]/50 p-10 text-center space-y-3 max-w-md mx-auto">
              <Search className="h-8 w-8 text-[#94A3B8] mx-auto opacity-40" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#F8FAFC]">No Matching Branches Found</h3>
                <p className="text-xs text-[#94A3B8]">
                  No facility matches your search &quot;{searchTerm}&quot; or the active filter.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Branch Directory Grid */}
          {!isLoading && filteredBranches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBranches.map((branch) => {
                return (
                  <Card
                    key={branch.id}
                    className={`border transition duration-200 relative flex flex-col justify-between overflow-hidden ${
                      branch.is_main
                        ? "border-[#B8FF3B]/40 bg-[#121922] shadow-[0_0_30px_rgba(184,255,59,0.06)]"
                        : "border-[#27313D] bg-[#121922] hover:border-[#3E4F63]"
                    }`}
                  >
                    {branch.is_main && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-[#B8FF3B]/20 to-transparent px-3 py-1 rounded-bl-xl border-b border-l border-[#B8FF3B]/30 flex items-center gap-1.5 text-[10px] font-bold text-[#B8FF3B] uppercase tracking-wider">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Headquarters</span>
                      </div>
                    )}

                    <CardContent className="p-5 space-y-4">
                      {/* Title & Badges */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <Building2
                            className={`h-4 w-4 shrink-0 ${
                              branch.is_main ? "text-[#B8FF3B]" : "text-[#94A3B8]"
                            }`}
                          />
                          <h3 className="font-bold text-base text-[#F8FAFC] truncate">
                            {branch.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-[#B8FF3B] text-[11px]">
                            @{branch.slug}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                              branch.is_active
                                ? "bg-[#B8FF3B]/10 text-[#B8FF3B] border-[#B8FF3B]/30"
                                : "bg-red-500/10 text-red-400 border-red-500/30"
                            }`}
                          >
                            {branch.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      {/* Contact & Location Meta */}
                      <div className="space-y-2 text-xs text-[#94A3B8] border-t border-[#1E2835] pt-3">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] mt-0.5" />
                          <span className="line-clamp-2">
                            {branch.address || <em className="text-[#94A3B8]/50">No address recorded</em>}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                          <span>{branch.phone || <em className="text-[#94A3B8]/50">No phone listed</em>}</span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                          <span className="truncate">
                            {branch.email || <em className="text-[#94A3B8]/50">No email listed</em>}
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-[#1E2835] flex items-center justify-between text-[11px] text-[#94A3B8]/70">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Added {new Date(branch.created_at).toLocaleDateString()}</span>
                        </div>

                        {isOwnerOrAdmin && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(branch)}
                            className="h-8 text-xs font-semibold px-2.5"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add Branch Modal */}
      {activeGymId && (
        <AddBranchModal
          gymId={activeGymId}
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onBranchAdded={handleBranchAdded}
        />
      )}

      {/* Edit Branch Modal */}
      {activeGymId && editingBranch && (
        <EditBranchModal
          gymId={activeGymId}
          branch={editingBranch}
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setEditingBranch(null);
          }}
          onBranchUpdated={handleBranchUpdated}
        />
      )}
    </div>
  );
}
