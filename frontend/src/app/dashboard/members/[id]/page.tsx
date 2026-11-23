"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type {
  BranchRead,
  MemberDetailRead,
  MembershipPlanRead,
  MemberSubscriptionSummary,
  TrainerRead,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  ArrowLeft,
  Mail,
  Phone,
  Dumbbell,
  CreditCard,
  Edit,
  ShieldAlert,
  AlertCircle,
  X,
  FileText,
  LogOut,
  Plus,
  RefreshCw,
  Ban,
  Clock,
  ArrowRight,
  UserMinus,
} from "lucide-react";

function MemberProfileContent() {
  const router = useRouter();
  const routeParams = useParams();
  const memberId =
    typeof routeParams?.id === "string"
      ? routeParams.id
      : Array.isArray(routeParams?.id)
      ? routeParams.id[0]
      : "";

  const { user, profile, signOut } = useAuth();
  const { activeGymId, currentRole, clearActiveGym } = useGym();

  const [member, setMember] = useState<MemberDetailRead | null>(null);
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Member Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"active" | "inactive" | "suspended" | "pending">("active");
  const [statusReason, setStatusReason] = useState("");
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Assign Subscription Modal
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<MembershipPlanRead[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignPrice, setAssignPrice] = useState("");
  const [assignCurrency, setAssignCurrency] = useState("USD");
  const [assignAutoRenew, setAssignAutoRenew] = useState(false);
  const [assignNotes, setAssignNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Renew Subscription Modal
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<MemberSubscriptionSummary | null>(null);
  const [renewPrice, setRenewPrice] = useState("");
  const [renewDuration, setRenewDuration] = useState("");
  const [renewNotes, setRenewNotes] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  // Cancel Subscription Modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MemberSubscriptionSummary | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Trainer Assignment State (Milestone 2.6)
  const [gymTrainers, setGymTrainers] = useState<TrainerRead[]>([]);
  const [isAssignTrainerModalOpen, setIsAssignTrainerModalOpen] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [trainerNotes, setTrainerNotes] = useState("");
  const [isAssigningTrainer, setIsAssigningTrainer] = useState(false);
  const [assignTrainerError, setAssignTrainerError] = useState<string | null>(null);

  // Reassign Trainer State
  const [isReassignTrainerModalOpen, setIsReassignTrainerModalOpen] = useState(false);
  const [reassignNewTrainerId, setReassignNewTrainerId] = useState("");
  const [reassignTrainerNotes, setReassignTrainerNotes] = useState("");
  const [isReassigningTrainer, setIsReassigningTrainer] = useState(false);
  const [reassignTrainerError, setReassignTrainerError] = useState<string | null>(null);

  // Unassign Trainer State
  const [isUnassignTrainerModalOpen, setIsUnassignTrainerModalOpen] = useState(false);
  const [isUnassigningTrainer, setIsUnassigningTrainer] = useState(false);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  const loadMemberDetail = useCallback(async () => {
    if (!activeGymId || !memberId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.members.get(activeGymId, memberId);
      setMember(data);
      // Pre-fill edit fields
      setEditFullName(data.full_name);
      setEditEmail(data.email || "");
      setEditPhone(data.phone || "");
      setEditBranchId(data.branch_id || "");
      setEditGender(data.gender || "");
      setEditNotes(data.notes || "");
      setNewStatus(data.status as "active" | "inactive" | "suspended" | "pending");
    } catch (err) {
      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to load member profile.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGymId, memberId]);

  const loadBranches = useCallback(async () => {
    if (!activeGymId) return;
    try {
      const gymDetail = await apiClient.gyms.get(activeGymId);
      setBranches(gymDetail.branches || []);
    } catch {
      // Non-critical, ignore branch lookup failure
    }
  }, [activeGymId]);

  useEffect(() => {
    queueMicrotask(() => {
      loadMemberDetail();
      loadBranches();
    });
  }, [loadMemberDetail, loadBranches]);

  const fetchGymTrainers = useCallback(async () => {
    if (!activeGymId) return;
    try {
      const res = await apiClient.trainers.list(activeGymId, { isActive: true, pageSize: 50 });
      const items = res.items || [];
      setGymTrainers(items);
      if (items.length > 0) {
        setSelectedTrainerId(items[0].id);
        setReassignNewTrainerId(items[0].id);
      }
    } catch {
      // Non-fatal
    }
  }, [activeGymId]);

  const handleOpenAssignTrainer = async () => {
    await fetchGymTrainers();
    setTrainerNotes("");
    setAssignTrainerError(null);
    setIsAssignTrainerModalOpen(true);
  };

  const handleAssignTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !memberId || !selectedTrainerId) return;
    setIsAssigningTrainer(true);
    setAssignTrainerError(null);
    try {
      await apiClient.members.assignTrainer(activeGymId, memberId, {
        trainer_id: selectedTrainerId,
        notes: trainerNotes.trim() || null,
      });
      setIsAssignTrainerModalOpen(false);
      await loadMemberDetail();
    } catch (err) {
      if (isApiClientError(err)) {
        setAssignTrainerError(err.detail);
      } else {
        setAssignTrainerError("Failed to assign coach.");
      }
    } finally {
      setIsAssigningTrainer(false);
    }
  };

  const handleOpenReassignTrainer = async () => {
    await fetchGymTrainers();
    setReassignTrainerNotes("");
    setReassignTrainerError(null);
    setIsReassignTrainerModalOpen(true);
  };

  const handleReassignTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !memberId || !reassignNewTrainerId) return;
    setIsReassigningTrainer(true);
    setReassignTrainerError(null);
    try {
      await apiClient.members.reassignTrainer(activeGymId, memberId, {
        new_trainer_id: reassignNewTrainerId,
        notes: reassignTrainerNotes.trim() || null,
      });
      setIsReassignTrainerModalOpen(false);
      await loadMemberDetail();
    } catch (err) {
      if (isApiClientError(err)) {
        setReassignTrainerError(err.detail);
      } else {
        setReassignTrainerError("Failed to reassign coach.");
      }
    } finally {
      setIsReassigningTrainer(false);
    }
  };

  const handleUnassignTrainer = async () => {
    if (!activeGymId || !memberId) return;
    setIsUnassigningTrainer(true);
    try {
      await apiClient.members.unassignTrainer(activeGymId, memberId);
      setIsUnassignTrainerModalOpen(false);
      await loadMemberDetail();
    } catch {
      // Non-fatal
    } finally {
      setIsUnassigningTrainer(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !memberId) return;

    setIsUpdating(true);
    setEditError(null);

    try {
      const updated = await apiClient.members.update(activeGymId, memberId, {
        full_name: editFullName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        branch_id: editBranchId || null,
        gender: editGender || null,
        notes: editNotes.trim() || null,
      });

      setMember((prev) => (prev ? { ...prev, ...updated } : null));
      setIsEditModalOpen(false);
    } catch (err) {
      if (isApiClientError(err)) {
        setEditError(err.detail);
      } else {
        setEditError("Failed to update member profile.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !memberId) return;

    setIsStatusUpdating(true);
    setStatusError(null);

    try {
      const updated = await apiClient.members.updateStatus(activeGymId, memberId, {
        status: newStatus,
        reason: statusReason.trim() || null,
      });

      setMember((prev) => (prev ? { ...prev, status: updated.status } : null));
      setIsStatusModalOpen(false);
      setStatusReason("");
    } catch (err) {
      if (isApiClientError(err)) {
        setStatusError(err.detail);
      } else {
        setStatusError("Failed to update status.");
      }
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Reset assign modal state if gym changes
  useEffect(() => {
    queueMicrotask(() => {
      setIsAssignOpen(false);
      setAvailablePlans([]);
      setSelectedPlanId("");
      setAssignError(null);
    });
  }, [activeGymId]);

  // Subscription Actions
  const fetchActivePlans = useCallback(async () => {
    if (!activeGymId) return;
    setIsLoadingPlans(true);
    setAssignError(null);

    try {
      const res = await apiClient.plans.list(activeGymId, { isActive: true, pageSize: 50 });
      const activeOnly = (res.items || []).filter((p) => p.is_active !== false);
      setAvailablePlans(activeOnly);

      if (activeOnly.length > 0) {
        setSelectedPlanId(activeOnly[0].id);
        setAssignPrice(activeOnly[0].price.toString());
        setAssignCurrency(activeOnly[0].currency || "USD");
      } else {
        setSelectedPlanId("");
        setAssignPrice("");
      }
    } catch (err) {
      if (isApiClientError(err)) {
        setAssignError(err.detail);
      } else {
        setAssignError("Failed to load active membership plans.");
      }
      setAvailablePlans([]);
      setSelectedPlanId("");
    } finally {
      setIsLoadingPlans(false);
    }
  }, [activeGymId]);

  const openAssignSubscriptionModal = async () => {
    if (!activeGymId) return;
    setAssignError(null);
    setIsAssignOpen(true);
    await fetchActivePlans();
  };

  const handlePlanSelection = (pId: string) => {
    setSelectedPlanId(pId);
    const p = availablePlans.find((item) => item.id === pId);
    if (p) {
      setAssignPrice(p.price.toString());
      setAssignCurrency(p.currency || "USD");
    } else {
      setAssignPrice("");
    }
  };

  const handleAssignSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !memberId || !selectedPlanId) return;

    setIsAssigning(true);
    setAssignError(null);

    try {
      await apiClient.subscriptions.create(activeGymId, {
        member_id: memberId,
        plan_id: selectedPlanId,
        start_date: assignStartDate,
        price_paid: assignPrice ? parseFloat(assignPrice) : undefined,
        currency: assignCurrency.trim().toUpperCase(),
        auto_renew: assignAutoRenew,
        notes: assignNotes.trim() || null,
      });

      setIsAssignOpen(false);
      setAssignNotes("");
      loadMemberDetail();
    } catch (err) {
      if (isApiClientError(err)) {
        setAssignError(err.detail);
      } else {
        setAssignError("Failed to assign subscription. Member may already have an active plan.");
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const openRenewSubscriptionModal = (sub: MemberSubscriptionSummary) => {
    setRenewTarget(sub);
    setRenewPrice(sub.price_paid ? sub.price_paid.toString() : "");
    setRenewDuration("");
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
        price_paid: renewPrice ? parseFloat(renewPrice) : undefined,
        duration_days: renewDuration ? parseInt(renewDuration, 10) : undefined,
        notes: renewNotes.trim() || undefined,
      });

      setIsRenewOpen(false);
      setRenewTarget(null);
      loadMemberDetail();
    } catch (err) {
      if (isApiClientError(err)) {
        setRenewError(err.detail);
      } else {
        setRenewError("Failed to renew subscription.");
      }
    } finally {
      setIsRenewing(false);
    }
  };

  const openCancelSubscriptionModal = (sub: MemberSubscriptionSummary) => {
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
      loadMemberDetail();
    } catch (err) {
      if (isApiClientError(err)) {
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
      case "inactive":
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
      case "suspended":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "pending":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "trial":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  const activeSub = member?.subscriptions.find((s) => s.status === "active");

  return (
    <div className="flex h-screen bg-[#0B0F15] text-[#F8FAFC]">
      <DashboardSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-[#27313D] bg-[#121922] px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/members"
              className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1 -ml-1 rounded-lg hover:bg-[#1A222D]"
              title="Back to Members Directory"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-4 w-px bg-[#27313D]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Members
            </span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-xs font-semibold text-[#B8FF3B] truncate max-w-[200px]">
              {member?.full_name || "Member Profile"}
            </span>
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
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="h-8 w-8 border-2 border-[#B8FF3B] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#94A3B8]">Loading member profile...</p>
            </div>
          ) : !member ? (
            <div className="py-20 text-center space-y-3 bg-[#121922] border border-[#27313D] rounded-xl">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
              <h2 className="text-base font-bold text-[#F8FAFC]">Member Not Found</h2>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                The requested member profile could not be retrieved. They may have been moved or you may lack tenant permissions.
              </p>
              <Link href="/dashboard/members">
                <Button className="mt-2 bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs h-8">
                  Back to Directory
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Profile Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#121922] border border-[#27313D] p-5 sm:p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#1A222D] to-[#121922] border border-[#27313D] flex items-center justify-center text-xl font-black text-[#B8FF3B] shadow-inner shrink-0">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                        {member.full_name}
                      </h1>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                          member.status
                        )}`}
                      >
                        {member.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8] mt-1 font-mono">
                      <span>Code: <span className="text-[#F8FAFC] font-semibold">{member.member_code}</span></span>
                      <span>•</span>
                      <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                      {member.branch_name && (
                        <>
                          <span>•</span>
                          <span className="text-[#B8FF3B]">{member.branch_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditModalOpen(true)}
                      className="h-8 text-xs border-[#27313D] bg-transparent text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A222D]"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit Details
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsStatusModalOpen(true)}
                      className="h-8 text-xs border-[#27313D] bg-transparent text-amber-400 hover:text-amber-300 hover:bg-amber-950/20"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                      Status
                    </Button>
                  </div>
                )}
              </div>

              {/* 3-Column Profile Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Contact Information */}
                <Card className="border-[#27313D] bg-[#121922] shadow-md">
                  <CardHeader className="pb-3 border-b border-[#27313D]/40">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8] flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-[#B8FF3B]" />
                      <span>Contact Info</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div>
                      <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Email</p>
                      <p className="text-[#F8FAFC] font-medium truncate mt-0.5">
                        {member.email || "No email provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Phone</p>
                      <p className="text-[#F8FAFC] font-medium mt-0.5">
                        {member.phone || "No phone provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Gender</p>
                      <p className="text-[#F8FAFC] font-medium capitalize mt-0.5">
                        {member.gender || "Unspecified"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Emergency Contact */}
                <Card className="border-[#27313D] bg-[#121922] shadow-md">
                  <CardHeader className="pb-3 border-b border-[#27313D]/40">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8] flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-amber-400" />
                      <span>Emergency Contact</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    {member.emergency_contact && typeof member.emergency_contact === "object" ? (
                      <>
                        <div>
                          <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Contact Person</p>
                          <p className="text-[#F8FAFC] font-medium mt-0.5">
                            {String(member.emergency_contact.name || "None")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Emergency Phone</p>
                          <p className="text-[#F8FAFC] font-mono mt-0.5">
                            {String(member.emergency_contact.phone || "Not provided")}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-[#94A3B8] italic py-4">No emergency contact registered.</p>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Branch & Remarks */}
                <Card className="border-[#27313D] bg-[#121922] shadow-md">
                  <CardHeader className="pb-3 border-b border-[#27313D]/40">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8] flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-blue-400" />
                      <span>Branch & Remarks</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div>
                      <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Assigned Branch</p>
                      <p className="text-[#F8FAFC] font-medium mt-0.5">
                        {member.branch_name || "Main Location"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-[10px] uppercase font-semibold">Notes</p>
                      <p className="text-[#F8FAFC] mt-0.5 whitespace-pre-wrap">
                        {member.notes || "No notes registered."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ACTIVE SUBSCRIPTION & HISTORY CARD */}
              <Card className="border-[#27313D] bg-[#121922] shadow-lg">
                <CardHeader className="border-b border-[#27313D]/40 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-[#B8FF3B]" />
                      <CardTitle className="text-base font-bold text-[#F8FAFC]">
                        Membership Subscriptions
                      </CardTitle>
                    </div>

                    {isOwnerOrAdmin && (
                      <Button
                        size="sm"
                        onClick={openAssignSubscriptionModal}
                        className="h-7 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Assign Plan
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  {/* Highlighted Active Subscription */}
                  {activeSub ? (
                    <div className="p-4 rounded-xl bg-[#161F2B] border border-[#B8FF3B]/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#F8FAFC]">
                              {activeSub.plan_name}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Active
                            </span>
                            {activeSub.auto_renew && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                Auto-Renew
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#94A3B8] mt-1 font-mono">
                            Valid: {new Date(activeSub.start_date).toLocaleDateString()} →{" "}
                            <span className="text-[#F8FAFC] font-semibold">
                              {new Date(activeSub.end_date).toLocaleDateString()}
                            </span>
                          </p>
                        </div>

                        {/* Days remaining badge & Actions */}
                        <div className="flex items-center gap-2">
                          {activeSub.days_remaining !== null && activeSub.days_remaining !== undefined && (
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                activeSub.days_remaining <= 7
                                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5 inline mr-1" />
                              {activeSub.days_remaining} days left
                            </span>
                          )}

                          {isOwnerOrAdmin && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRenewSubscriptionModal(activeSub)}
                                className="h-7 text-xs border-[#27313D] text-[#B8FF3B] hover:bg-[#B8FF3B]/10 px-2.5"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Renew
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCancelSubscriptionModal(activeSub)}
                                className="h-7 text-xs border-red-900/60 text-red-400 hover:bg-red-950/20 px-2.5"
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing & notes */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8] pt-2 border-t border-[#27313D]/40">
                        {activeSub.price_paid !== undefined && activeSub.price_paid !== null && (
                          <span>
                            Contracted Price:{" "}
                            <span className="text-[#F8FAFC] font-bold font-mono">
                              {activeSub.currency || "USD"} {Number(activeSub.price_paid).toFixed(2)}
                            </span>
                          </span>
                        )}
                        {activeSub.notes && (
                          <span>
                            Notes: <span className="text-[#F8FAFC]">{activeSub.notes}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center space-y-2 border border-dashed border-[#27313D] rounded-xl bg-[#161F2B]/40">
                      <CreditCard className="h-7 w-7 text-[#94A3B8]/40 mx-auto" />
                      <p className="text-xs text-[#94A3B8]">No active membership subscription.</p>
                      {isOwnerOrAdmin && (
                        <Button
                          onClick={openAssignSubscriptionModal}
                          className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs h-7 px-3 font-semibold mt-1"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Assign Membership Plan
                        </Button>
                      )}
                    </div>
                  )}

                  {/* History Section */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
                      Subscription History ({member.subscriptions.length})
                    </h4>

                    {member.subscriptions.length === 0 ? (
                      <p className="text-xs text-[#94A3B8] italic">No historical records.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#27313D] text-[10px] uppercase tracking-wider text-[#94A3B8]">
                              <th className="py-2 px-3">Plan</th>
                              <th className="py-2 px-3">Validity Period</th>
                              <th className="py-2 px-3">Price Paid</th>
                              <th className="py-2 px-3">Status</th>
                              {isOwnerOrAdmin && <th className="py-2 px-3 text-right">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#27313D]/40">
                            {member.subscriptions.map((s) => (
                              <tr key={s.id} className="hover:bg-[#1A222D]/40">
                                <td className="py-2.5 px-3 font-medium text-[#F8FAFC]">
                                  {s.plan_name}
                                </td>
                                <td className="py-2.5 px-3 text-[#94A3B8]">
                                  {new Date(s.start_date).toLocaleDateString()} →{" "}
                                  {new Date(s.end_date).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[#F8FAFC]">
                                  {s.price_paid ? `${s.currency || "USD"} ${Number(s.price_paid).toFixed(2)}` : "—"}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                      s.status
                                    )}`}
                                  >
                                    {s.status}
                                  </span>
                                </td>
                                {isOwnerOrAdmin && (
                                  <td className="py-2.5 px-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openRenewSubscriptionModal(s)}
                                      className="h-6 text-[11px] text-[#B8FF3B] hover:text-[#B8FF3B] px-2"
                                    >
                                      Renew
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Trainers Card (Milestone 2.6) */}
              <Card className="border-[#27313D] bg-[#121922] shadow-lg">
                <CardHeader className="border-b border-[#27313D]/40 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 text-[#B8FF3B]" />
                      <CardTitle className="text-base font-bold text-[#F8FAFC]">
                        Personal Coaching & Trainer Assignment
                      </CardTitle>
                    </div>

                    {isOwnerOrAdmin && member.assigned_trainers.length === 0 && (
                      <Button
                        size="sm"
                        onClick={handleOpenAssignTrainer}
                        className="h-7 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Assign Coach
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5">
                  {member.assigned_trainers.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <Dumbbell className="h-8 w-8 text-[#94A3B8]/40 mx-auto" />
                      <p className="text-xs text-[#94A3B8]">No personal coach currently assigned to this member.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#27313D]/40">
                      {member.assigned_trainers.map((trainer) => (
                        <div key={trainer.trainer_id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[#F8FAFC] text-sm">{trainer.trainer_name}</p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                  trainer.status
                                )}`}
                              >
                                {trainer.status}
                              </span>
                            </div>
                            <p className="text-[#94A3B8] text-[11px] mt-0.5">
                              Assigned on: {new Date(trainer.assigned_at).toLocaleDateString()}
                            </p>
                          </div>

                          {isOwnerOrAdmin && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenReassignTrainer}
                                className="h-7 text-xs border-[#27313D] text-amber-400 hover:bg-amber-500/10 px-2.5"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Change Coach
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsUnassignTrainerModalOpen(true)}
                                className="h-7 text-xs border-[#27313D] text-rose-400 hover:bg-rose-500/10 px-2.5"
                              >
                                <UserMinus className="h-3 w-3 mr-1" />
                                Unassign
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* ASSIGN SUBSCRIPTION MODAL */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsAssignOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Assign Plan to Member</h2>
            </div>

            {assignError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs flex items-center justify-between gap-2">
                <span>{assignError}</span>
                <button
                  type="button"
                  onClick={fetchActivePlans}
                  className="text-[#B8FF3B] hover:underline font-semibold shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleAssignSubscription} className="space-y-4 text-xs">
              <div>
                <label htmlFor="select-membership-plan" className="block text-[#94A3B8] font-semibold mb-1">
                  Select Membership Plan *
                </label>

                {isLoadingPlans ? (
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
                    id="select-membership-plan"
                    required
                    value={selectedPlanId}
                    onChange={(e) => handlePlanSelection(e.target.value)}
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
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1">Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={assignPrice}
                    onChange={(e) => setAssignPrice(e.target.value)}
                    className="bg-[#0B0F15] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Payment reference, discounts, or terms..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full bg-[#0B0F15] border border-[#27313D] rounded-lg p-2 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#B8FF3B]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="profile-assign-autorenew"
                  checked={assignAutoRenew}
                  onChange={(e) => setAssignAutoRenew(e.target.checked)}
                  className="rounded border-[#27313D] text-[#B8FF3B] focus:ring-[#B8FF3B]"
                />
                <label htmlFor="profile-assign-autorenew" className="text-xs text-[#F8FAFC] font-medium cursor-pointer">
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
                  disabled={isAssigning || isLoadingPlans || !selectedPlanId || availablePlans.length === 0}
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
              Renewing <span className="font-semibold text-[#F8FAFC]">{renewTarget.plan_name}</span> for another cycle.
            </p>

            {renewError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {renewError}
              </div>
            )}

            <form onSubmit={handleRenewSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Renewal Price</label>
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
                  placeholder="Remarks on this renewal..."
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
              <h2 className="text-lg font-bold text-[#F8FAFC]">Cancel Active Subscription</h2>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Are you sure you want to cancel the active subscription for{" "}
              <span className="font-semibold text-[#F8FAFC]">{renewTarget?.plan_name || "this plan"}</span>?
            </p>

            {cancelError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">Reason for Cancellation</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Reason for terminating this plan..."
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

      {/* ASSIGN TRAINER MODAL (Milestone 2.6) */}
      {isAssignTrainerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsAssignTrainerModalOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-[#B8FF3B]" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Assign Coach to Member</h2>
            </div>

            {assignTrainerError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {assignTrainerError}
              </div>
            )}

            <form onSubmit={handleAssignTrainer} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">
                  Select Coach / Trainer *
                </label>
                <select
                  value={selectedTrainerId}
                  onChange={(e) => setSelectedTrainerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                >
                  {gymTrainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.branch_name || "Main Location"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">
                  Coaching Goals & Notes
                </label>
                <textarea
                  rows={3}
                  value={trainerNotes}
                  onChange={(e) => setTrainerNotes(e.target.value)}
                  placeholder="e.g. Focus on injury rehabilitation and progressive overload..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsAssignTrainerModalOpen(false)}
                  disabled={isAssigningTrainer}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={isAssigningTrainer}
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isAssigningTrainer ? "Assigning..." : "Confirm Coach"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN TRAINER MODAL (Milestone 2.6) */}
      {isReassignTrainerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsReassignTrainerModalOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-[#F8FAFC]">Change Assigned Coach</h2>
            </div>

            {reassignTrainerError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {reassignTrainerError}
              </div>
            )}

            <form onSubmit={handleReassignTrainer} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">
                  Select New Coach *
                </label>
                <select
                  value={reassignNewTrainerId}
                  onChange={(e) => setReassignNewTrainerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                >
                  {gymTrainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.branch_name || "Main Location"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1">
                  Reassignment Reason / Notes
                </label>
                <textarea
                  rows={3}
                  value={reassignTrainerNotes}
                  onChange={(e) => setReassignTrainerNotes(e.target.value)}
                  placeholder="Reason for change in coach assignment..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsReassignTrainerModalOpen(false)}
                  disabled={isReassigningTrainer}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={isReassigningTrainer}
                  className="h-8 text-xs bg-amber-400 text-[#0B0F15] hover:bg-amber-300 font-semibold"
                >
                  {isReassigningTrainer ? "Updating..." : "Transfer Coach"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNASSIGN TRAINER MODAL (Milestone 2.6) */}
      {isUnassignTrainerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#121922] border border-[#27313D] rounded-xl shadow-2xl p-6 relative space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <UserMinus className="h-5 w-5" />
              <h2 className="text-base font-bold text-[#F8FAFC]">Confirm Unassignment</h2>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Are you sure you want to remove the assigned coach for this member? The member will become unassigned.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsUnassignTrainerModalOpen(false)}
                disabled={isUnassigningTrainer}
                className="h-8 text-xs border-[#27313D] text-[#94A3B8]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={handleUnassignTrainer}
                disabled={isUnassigningTrainer}
                className="h-8 text-xs bg-rose-500 text-white hover:bg-rose-600 font-semibold"
              >
                {isUnassigningTrainer ? "Removing..." : "Remove Coach"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121922] border border-[#27313D] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#27313D]/40 pb-3">
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <Edit className="h-4 w-4 text-[#B8FF3B]" />
                <span>Edit Member Profile</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Full Name *
                </label>
                <Input
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="bg-[#161F2B] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="bg-[#161F2B] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="bg-[#161F2B] border-[#27313D] text-[#F8FAFC] h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Branch Location
                  </label>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                  >
                    <option value="">No Branch Assigned</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                  >
                    <option value="">Unspecified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl bg-[#161F2B] border border-[#27313D] px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27313D]/40">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
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

      {/* STATUS CHANGE MODAL */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121922] border border-[#27313D] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#27313D]/40 pb-3">
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <span>Update Member Status</span>
              </h3>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {statusError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {statusError}
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(
                      e.target.value as "active" | "inactive" | "suspended" | "pending"
                    )
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#161F2B] border border-[#27313D] text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                >
                  <option value="active">Active (Good Standing)</option>
                  <option value="inactive">Inactive (Voluntary Leave)</option>
                  <option value="suspended">Suspended (Disciplinary / Overdue)</option>
                  <option value="pending">Pending (Awaiting Documents)</option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Audit Reason (Recommended)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Non-payment, medical pause, membership upgrade..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-xl bg-[#161F2B] border border-[#27313D] px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27313D]/40">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="h-8 text-xs border-[#27313D] text-[#94A3B8] hover:bg-[#1A222D]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={isStatusUpdating}
                  className="h-8 text-xs bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isStatusUpdating ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MemberProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F15] text-[#F8FAFC] flex items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="h-10 w-10 border-2 border-[#B8FF3B] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#94A3B8]">Loading member profile...</p>
          </div>
        </div>
      }
    >
      <MemberProfileContent />
    </Suspense>
  );
}
