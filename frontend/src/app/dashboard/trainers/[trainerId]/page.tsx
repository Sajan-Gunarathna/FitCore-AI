"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type {
  BranchRead,
  MemberRead,
  TrainerDetailRead,
  TrainerRead,
  TrainerAssignedMemberSummary,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  ArrowLeft,
  Users,
  Award,
  DollarSign,
  Building2,
  Mail,
  Phone,
  Calendar,
  Edit,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  UserCheck,
  UserMinus,
  CheckCircle2,
  LogOut,
} from "lucide-react";

function TrainerDetailContent() {
  const router = useRouter();
  const routeParams = useParams();
  const trainerId =
    typeof routeParams?.trainerId === "string"
      ? routeParams.trainerId
      : Array.isArray(routeParams?.trainerId)
      ? routeParams.trainerId[0]
      : "";

  const { user, profile, signOut } = useAuth();
  const { activeGymId, currentRole, clearActiveGym } = useGym();

  const [trainer, setTrainer] = useState<TrainerDetailRead | null>(null);
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [otherTrainers, setOtherTrainers] = useState<TrainerRead[]>([]);
  const [gymMembers, setGymMembers] = useState<MemberRead[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Trainer Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [editSpecializations, setEditSpecializations] = useState("");
  const [editCertifications, setEditCertifications] = useState("");
  const [editExperience, setEditExperience] = useState("0");
  const [editHourlyRate, setEditHourlyRate] = useState("0.00");
  const [editBio, setEditBio] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Toggle
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Assign Member Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Reassign Modal
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTargetMember, setReassignTargetMember] = useState<TrainerAssignedMemberSummary | null>(null);
  const [newTrainerId, setNewTrainerId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Unassign Modal
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [unassignTargetMember, setUnassignTargetMember] = useState<TrainerAssignedMemberSummary | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const isOwnerOrAdmin =
    currentRole === "owner" ||
    currentRole === "admin" ||
    Boolean(profile?.is_super_admin);

  const isSelfTrainer =
    currentRole === "trainer" &&
    trainer?.user_id &&
    trainer.user_id === user?.id;

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  const loadTrainer = useCallback(async () => {
    if (!activeGymId || !trainerId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.trainers.get(activeGymId, trainerId);
      setTrainer(data);
    } catch (err) {
      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to load trainer profile.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGymId, trainerId]);

  const loadSupportingData = useCallback(async () => {
    if (!activeGymId) return;
    try {
      const [branchesRes, trainersRes] = await Promise.all([
        apiClient.branches.list(activeGymId),
        apiClient.trainers.list(activeGymId, { isActive: true, pageSize: 50 }),
      ]);
      setBranches(branchesRes || []);
      setOtherTrainers((trainersRes.items || []).filter((t) => t.id !== trainerId));
    } catch {
      // Non-fatal
    }
  }, [activeGymId, trainerId]);

  useEffect(() => {
    if (activeGymId && trainerId) {
      queueMicrotask(() => {
        loadTrainer();
        loadSupportingData();
      });
    }
  }, [activeGymId, trainerId, loadTrainer, loadSupportingData]);

  // Open Edit Modal with populated data
  const handleOpenEdit = () => {
    if (!trainer) return;
    setEditFullName(trainer.full_name);
    setEditEmail(trainer.email || "");
    setEditPhone(trainer.phone || "");
    setEditBranchId(trainer.branch_id || "");
    setEditSpecializations((trainer.specializations || []).join(", "));
    setEditCertifications((trainer.certifications || []).join(", "));
    setEditExperience(String(trainer.years_of_experience || 0));
    setEditHourlyRate(String(trainer.hourly_rate || "0.00"));
    setEditBio(trainer.bio || "");
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !trainerId) return;

    setIsUpdating(true);
    setEditError(null);

    const specArray = editSpecializations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const certArray = editCertifications
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const updated = await apiClient.trainers.update(activeGymId, trainerId, {
        full_name: editFullName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        branch_id: editBranchId.trim() || null,
        specializations: specArray,
        certifications: certArray,
        years_of_experience: parseInt(editExperience, 10) || 0,
        hourly_rate: editHourlyRate.trim() || "0.00",
        bio: editBio.trim() || null,
      });

      setTrainer((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              assigned_members: prev.assigned_members,
            }
          : null
      );
      setIsEditModalOpen(false);
    } catch (err) {
      if (isApiClientError(err)) {
        setEditError(err.detail);
      } else {
        setEditError("Failed to update profile.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!activeGymId || !trainer) return;
    setIsTogglingStatus(true);
    try {
      const updated = await apiClient.trainers.updateStatus(
        activeGymId,
        trainer.id,
        !trainer.is_active
      );
      setTrainer((prev) => (prev ? { ...prev, is_active: updated.is_active } : null));
    } catch {
      // Non-fatal alert
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Open Assign Member Modal & fetch candidate members
  const handleOpenAssignModal = async () => {
    if (!activeGymId) return;
    setIsAssignModalOpen(true);
    setSelectedMemberId("");
    setAssignNotes("");
    setAssignError(null);

    try {
      const membersRes = await apiClient.members.list(activeGymId, {
        pageSize: 100,
        status: "active",
      });
      setGymMembers(membersRes.items || []);
      if (membersRes.items && membersRes.items.length > 0) {
        setSelectedMemberId(membersRes.items[0].id);
      }
    } catch {
      // Non-fatal
    }
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !trainerId || !selectedMemberId) return;

    setIsAssigning(true);
    setAssignError(null);

    try {
      await apiClient.trainers.assignMember(activeGymId, trainerId, {
        member_id: selectedMemberId,
        notes: assignNotes.trim() || null,
      });

      setIsAssignModalOpen(false);
      await loadTrainer();
    } catch (err) {
      if (isApiClientError(err)) {
        setAssignError(err.detail);
      } else {
        setAssignError("Failed to assign member to coach.");
      }
    } finally {
      setIsAssigning(false);
    }
  };

  // Reassign Member
  const handleOpenReassignModal = (memberItem: TrainerAssignedMemberSummary) => {
    setReassignTargetMember(memberItem);
    setNewTrainerId(otherTrainers[0]?.id || "");
    setReassignNotes("");
    setReassignError(null);
    setIsReassignModalOpen(true);
  };

  const handleReassignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !trainerId || !reassignTargetMember || !newTrainerId) return;

    setIsReassigning(true);
    setReassignError(null);

    try {
      await apiClient.trainers.reassignMember(
        activeGymId,
        trainerId,
        reassignTargetMember.member_id,
        {
          new_trainer_id: newTrainerId,
          notes: reassignNotes.trim() || null,
        }
      );

      setIsReassignModalOpen(false);
      await loadTrainer();
    } catch (err) {
      if (isApiClientError(err)) {
        setReassignError(err.detail);
      } else {
        setReassignError("Failed to reassign member.");
      }
    } finally {
      setIsReassigning(false);
    }
  };

  // Unassign Member
  const handleOpenUnassignModal = (memberItem: TrainerAssignedMemberSummary) => {
    setUnassignTargetMember(memberItem);
    setIsUnassignModalOpen(true);
  };

  const handleUnassignMember = async () => {
    if (!activeGymId || !trainerId || !unassignTargetMember) return;
    setIsUnassigning(true);

    try {
      await apiClient.trainers.unassignMember(
        activeGymId,
        trainerId,
        unassignTargetMember.member_id
      );

      setIsUnassignModalOpen(false);
      await loadTrainer();
    } catch {
      // Non-fatal
    } finally {
      setIsUnassigning(false);
    }
  };

  const initials = trainer?.full_name
    ? trainer.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "TR";

  return (
    <div className="flex h-screen bg-[#090D12] text-[#F8FAFC]">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#121922]/80 backdrop-blur-md border-b border-[#27313D]">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/trainers"
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <GymSelector />
            <div className="h-4 w-px bg-[#27313D]" />
            <h1 className="text-lg font-semibold tracking-tight text-[#F8FAFC]">
              Coach Profile
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

        {/* Content Body */}
        <main className="flex-1 p-6 space-y-6 max-w-6xl w-full mx-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTrainer}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="h-72 rounded-2xl bg-[#121922] border border-[#27313D] p-6 animate-pulse space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-[#1A232D]" />
              <div className="h-6 w-48 bg-[#1A232D] rounded" />
              <div className="h-4 w-32 bg-[#1A232D] rounded" />
            </div>
          )}

          {!isLoading && trainer && (
            <>
              {/* Profile Header Hero */}
              <div className="p-6 rounded-2xl bg-[#121922] border border-[#27313D] shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#1A232D] to-[#27313D] border-2 border-[#B8FF3B]/30 text-[#B8FF3B] font-black text-2xl flex items-center justify-center shadow-lg">
                    {initials}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">
                        {trainer.full_name}
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          trainer.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
                        }`}
                      >
                        {trainer.is_active ? "Active Coach" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8] pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#B8FF3B]" />
                        <span>{trainer.branch_name || "Main Gym Facility"}</span>
                      </div>
                      {trainer.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-[#94A3B8]" />
                          <span>{trainer.email}</span>
                        </div>
                      )}
                      {trainer.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[#94A3B8]" />
                          <span>{trainer.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#94A3B8]" />
                        <span>Joined {new Date(trainer.joined_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Management Action Buttons */}
                {isOwnerOrAdmin && (
                  <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEdit}
                      className="border-[#27313D] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D] text-xs h-9"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit Profile
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleStatus}
                      disabled={isTogglingStatus}
                      className={`text-xs h-9 border-[#27313D] ${
                        trainer.is_active
                          ? "text-rose-400 hover:bg-rose-500/10"
                          : "text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                    >
                      {trainer.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-[#27313D] bg-[#121922]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase font-semibold text-[#94A3B8]">Active Roster</p>
                      <p className="text-2xl font-bold text-blue-400 mt-1">
                        {trainer.assigned_member_count} Members
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                {(isOwnerOrAdmin || isSelfTrainer) && (
                  <Card className="border-[#27313D] bg-[#121922]">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase font-semibold text-[#94A3B8]">Hourly Rate</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">
                          ${Number(trainer.hourly_rate).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-[#27313D] bg-[#121922]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase font-semibold text-[#94A3B8]">Experience</p>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {trainer.years_of_experience} Years
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Award className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#27313D] bg-[#121922]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase font-semibold text-[#94A3B8]">Credentials</p>
                      <p className="text-2xl font-bold text-[#B8FF3B] mt-1">
                        {trainer.certifications?.length || 0} Certs
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#B8FF3B]/10 text-[#B8FF3B]">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bio & Credentials Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-[#27313D] bg-[#121922]">
                  <CardHeader className="pb-3 border-b border-[#27313D]/40">
                    <CardTitle className="text-sm font-bold text-[#F8FAFC]">
                      About & Coaching Philosophy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs text-[#94A3B8] leading-relaxed">
                    {trainer.bio || (
                      <span className="italic">No biography recorded for this trainer.</span>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-[#27313D] bg-[#121922]">
                  <CardHeader className="pb-3 border-b border-[#27313D]/40">
                    <CardTitle className="text-sm font-bold text-[#F8FAFC]">
                      Specializations & Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-[#94A3B8] mb-1.5">
                        Specializations
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {trainer.specializations && trainer.specializations.length > 0 ? (
                          trainer.specializations.map((spec, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1A232D] text-[#F8FAFC] border border-[#27313D]"
                            >
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#94A3B8] italic">None listed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-semibold text-[#94A3B8] mb-1.5">
                        Certifications
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {trainer.certifications && trainer.certifications.length > 0 ? (
                          trainer.certifications.map((cert, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#B8FF3B]/10 text-[#B8FF3B] border border-[#B8FF3B]/20"
                            >
                              {cert}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#94A3B8] italic">None recorded</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Assigned Members Section */}
              <Card className="border-[#27313D] bg-[#121922] shadow-lg">
                <CardHeader className="border-b border-[#27313D]/40 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#B8FF3B]" />
                      <CardTitle className="text-base font-bold text-[#F8FAFC]">
                        Assigned Athletes ({trainer.assigned_members?.length || 0})
                      </CardTitle>
                    </div>

                    {isOwnerOrAdmin && trainer.is_active && (
                      <Button
                        size="sm"
                        onClick={handleOpenAssignModal}
                        className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] text-xs font-semibold h-8"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Assign Member
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {(!trainer.assigned_members || trainer.assigned_members.length === 0) ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-[#F8FAFC]">No Members Currently Assigned</p>
                      <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                        This coach currently has no active member assignments.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1A232D]/70 text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#27313D]">
                          <tr>
                            <th className="px-5 py-3">Member</th>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Branch</th>
                            <th className="px-4 py-3">Assigned Date</th>
                            <th className="px-4 py-3">Notes</th>
                            {isOwnerOrAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#27313D]/40">
                          {trainer.assigned_members.map((m) => (
                            <tr
                              key={m.assignment_id}
                              className="hover:bg-[#1A232D]/40 transition-colors"
                            >
                              <td className="px-5 py-3.5">
                                <Link
                                  href={`/dashboard/members/${m.member_id}`}
                                  className="font-bold text-[#F8FAFC] hover:text-[#B8FF3B] transition-colors"
                                >
                                  {m.full_name}
                                </Link>
                                {m.email && (
                                  <p className="text-[11px] text-[#94A3B8]">{m.email}</p>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-xs text-[#F8FAFC]">
                                {m.member_code}
                              </td>
                              <td className="px-4 py-3.5 text-[#94A3B8]">
                                {m.branch_name || "Main Location"}
                              </td>
                              <td className="px-4 py-3.5 text-[#94A3B8]">
                                {new Date(m.assigned_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3.5 text-[#94A3B8] max-w-xs truncate">
                                {m.notes || "—"}
                              </td>
                              {isOwnerOrAdmin && (
                                <td className="px-5 py-3.5 text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenReassignModal(m)}
                                    title="Reassign to another coach"
                                    className="h-7 px-2 text-[11px] border-[#27313D] text-amber-400 hover:bg-amber-500/10"
                                  >
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Reassign
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenUnassignModal(m)}
                                    title="Remove assignment"
                                    className="h-7 px-2 text-[11px] border-[#27313D] text-rose-400 hover:bg-rose-500/10"
                                  >
                                    <UserMinus className="h-3 w-3 mr-1" />
                                    Unassign
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* Edit Trainer Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#121922] border border-[#27313D] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#27313D] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F8FAFC]">Edit Coach Details</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTrainer} className="flex-1 overflow-y-auto p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Full Name
                </label>
                <Input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                    Phone
                  </label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                    Branch
                  </label>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm"
                  >
                    <option value="">All Branches / Main</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                    Experience (Years)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Hourly Rate ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editHourlyRate}
                  onChange={(e) => setEditHourlyRate(e.target.value)}
                  className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Specializations (comma-separated)
                </label>
                <Input
                  value={editSpecializations}
                  onChange={(e) => setEditSpecializations(e.target.value)}
                  className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Certifications (comma-separated)
                </label>
                <Input
                  value={editCertifications}
                  onChange={(e) => setEditCertifications(e.target.value)}
                  className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm resize-none"
                />
              </div>

              <div className="pt-4 border-t border-[#27313D] flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                  className="border-[#27313D] text-[#94A3B8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Member Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#121922] border border-[#27313D] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27313D]">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#B8FF3B]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Assign Athlete to Coach</h3>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-[#94A3B8]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignMember} className="space-y-4">
              {assignError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {assignError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Select Active Member
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm"
                >
                  {gymMembers.map((gm) => (
                    <option key={gm.id} value={gm.id}>
                      {gm.full_name} ({gm.member_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Coaching Goals & Notes
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Strength specialization, 3x per week schedule..."
                  className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#27313D] flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isAssigning}
                  className="border-[#27313D] text-[#94A3B8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAssigning}
                  className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
                >
                  {isAssigning ? "Assigning..." : "Confirm Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Member Modal */}
      {isReassignModalOpen && reassignTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#121922] border border-[#27313D] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27313D]">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Reassign Member</h3>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-[#94A3B8]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Transfer athlete <strong className="text-[#F8FAFC]">{reassignTargetMember.full_name}</strong> to another coach.
            </p>

            <form onSubmit={handleReassignMember} className="space-y-4">
              {reassignError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {reassignError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Target Coach
                </label>
                <select
                  value={newTrainerId}
                  onChange={(e) => setNewTrainerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm"
                >
                  {otherTrainers.map((ot) => (
                    <option key={ot.id} value={ot.id}>
                      {ot.full_name} ({ot.branch_name || "Main"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                  Reassignment Remarks
                </label>
                <textarea
                  rows={3}
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="Reason for coach reassignment..."
                  className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#27313D] flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReassignModalOpen(false)}
                  disabled={isReassigning}
                  className="border-[#27313D] text-[#94A3B8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReassigning}
                  className="bg-amber-400 text-[#0B0F15] hover:bg-amber-300 font-semibold"
                >
                  {isReassigning ? "Transferring..." : "Transfer Athlete"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal */}
      {isUnassignModalOpen && unassignTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-[#121922] border border-[#27313D] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <UserMinus className="h-5 w-5" />
              <h3 className="text-base font-bold text-[#F8FAFC]">Confirm Unassignment</h3>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Are you sure you want to unassign <strong className="text-[#F8FAFC]">{unassignTargetMember.full_name}</strong> from this coach?
              The member profile and history will be preserved.
            </p>

            <div className="pt-3 border-t border-[#27313D] flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUnassignModalOpen(false)}
                disabled={isUnassigning}
                className="border-[#27313D] text-[#94A3B8]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUnassignMember}
                disabled={isUnassigning}
                className="bg-rose-500 text-white hover:bg-rose-600 font-semibold"
              >
                {isUnassigning ? "Unassigning..." : "Unassign Member"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainerDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#090D12] text-[#F8FAFC]">
          <div className="h-6 w-6 border-2 border-[#B8FF3B] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrainerDetailContent />
    </Suspense>
  );
}
