"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { BranchRead, MemberRead, PaginatedResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  Users,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  LogOut,
  AlertCircle,
  Eye,
} from "lucide-react";

export default function MemberDirectoryPage() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const {
    activeGym,
    activeGymId,
    currentRole,
    clearActiveGym,
  } = useGym();

  const [membersData, setMembersData] = useState<PaginatedResponse<MemberRead> | null>(null);
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const activeGymIdRef = useRef<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    if (searchTerm === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  const handleSignOut = async () => {
    abortControllerRef.current?.abort();
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  // Fetch branches for filter dropdown
  useEffect(() => {
    if (!activeGymId) return;
    let isCancelled = false;

    apiClient.branches
      .list(activeGymId)
      .then((data) => {
        if (!isCancelled) setBranches(data);
      })
      .catch(() => {
        // Non-fatal
      });

    return () => {
      isCancelled = true;
    };
  }, [activeGymId]);

  // Fetch paginated member directory
  const fetchMembers = useCallback(
    async (gymId: string) => {
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
        const response = await apiClient.members.list(
          gymId,
          {
            page,
            pageSize,
            search: debouncedSearch,
            status: statusFilter,
            branchId: branchFilter,
          },
          controller.signal
        );

        if (
          currentRequestId !== requestIdRef.current ||
          gymId !== activeGymIdRef.current
        ) {
          return;
        }

        setMembersData(response);
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return; // Request was aborted; do not show error or update state
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
          setError("Failed to load members. Please try again.");
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [page, pageSize, debouncedSearch, statusFilter, branchFilter]
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (activeGymId) {
      queueMicrotask(() => {
        fetchMembers(activeGymId);
      });
    }
  }, [activeGymId, fetchMembers]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-[#B8FF3B]/10 text-[#B8FF3B] border-[#B8FF3B]/30";
      case "inactive":
        return "bg-[#1A232D] text-[#94A3B8] border-[#27313D]";
      case "suspended":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "pending":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-[#94A3B8] hover:text-red-400"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header & Quick Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-[#B8FF3B]" />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
                  Member Directory
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#94A3B8]">
                View, search, and manage registered members in {activeGym?.name || "your gym"}.
              </p>
            </div>

            <Link href="/dashboard/members/new">
              <Button variant="primary" size="md">
                <UserPlus className="h-4 w-4" />
                <span>Register Member</span>
              </Button>
            </Link>
          </div>

          {/* Filters & Search Toolbar */}
          <Card className="border-[#27313D] bg-[#121922] p-4 shadow-md">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, phone, or member code..."
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#B8FF3B] focus:ring-1 focus:ring-[#B8FF3B]/30"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>

                {/* Branch Filter */}
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.is_main ? "(Main)" : ""}
                    </option>
                  ))}
                </select>

                {(searchTerm || statusFilter || branchFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("");
                      setBranchFilter("");
                      setPage(1);
                    }}
                    className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeGymId && fetchMembers(activeGymId)}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Members Table */}
          <Card className="border-[#27313D] bg-[#121922] shadow-xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-4">
                <div className="h-6 w-48 bg-[#1A232D] rounded animate-pulse" />
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-[#161F2B] rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : !membersData || membersData.items.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="h-12 w-12 mx-auto rounded-full bg-[#1A232D] flex items-center justify-center text-[#94A3B8]">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  {searchTerm || statusFilter || branchFilter
                    ? "No members match your criteria"
                    : "No members registered yet"}
                </h3>
                <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                  {searchTerm || statusFilter || branchFilter
                    ? "Try adjusting your search query or removing status and branch filters."
                    : "Start registering members via walk-in or online account links to build your community."}
                </p>
                {!searchTerm && !statusFilter && !branchFilter && (
                  <div className="pt-2">
                    <Link href="/dashboard/members/new">
                      <Button variant="primary" size="sm">
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Register First Member</span>
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#27313D] bg-[#161F2B]/60 text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider">
                        <th className="py-3 px-4 font-medium">Member</th>
                        <th className="py-3 px-4 font-medium">Code</th>
                        <th className="py-3 px-4 font-medium">Branch</th>
                        <th className="py-3 px-4 font-medium">Contact</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Joined</th>
                        <th className="py-3 px-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27313D]/40">
                      {membersData.items.map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-[#1A232D]/40 transition group cursor-pointer"
                          onClick={() => router.push(`/dashboard/members/${member.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#F8FAFC] group-hover:text-[#B8FF3B] transition">
                              {member.full_name}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {member.gender ? member.gender.toUpperCase() : "UNSPECIFIED"}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#B8FF3B] text-xs font-semibold">
                            {member.member_code}
                          </td>
                          <td className="py-3 px-4 text-[#94A3B8] text-xs">
                            {member.branch_name || "Main Branch"}
                          </td>
                          <td className="py-3 px-4 space-y-0.5">
                            {member.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[150px]">{member.email}</span>
                              </div>
                            )}
                            {member.phone && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                            {!member.email && !member.phone && (
                              <span className="text-[11px] text-[#94A3B8]/60">No contact info</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                member.status
                              )}`}
                            >
                              {member.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#94A3B8] text-xs whitespace-nowrap">
                            {new Date(member.joined_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/dashboard/members/${member.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#B8FF3B] transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-[#27313D] flex items-center justify-between text-xs text-[#94A3B8]">
                  <div>
                    Showing{" "}
                    <span className="text-[#F8FAFC] font-semibold">
                      {(page - 1) * pageSize + 1}
                    </span>{" "}
                    to{" "}
                    <span className="text-[#F8FAFC] font-semibold">
                      {Math.min(page * pageSize, membersData.total)}
                    </span>{" "}
                    of{" "}
                    <span className="text-[#F8FAFC] font-semibold">
                      {membersData.total}
                    </span>{" "}
                    members
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </Button>
                    <span className="text-xs px-2 font-mono">
                      Page {page} of {membersData.total_pages || 1}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= membersData.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
