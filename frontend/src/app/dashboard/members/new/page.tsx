"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { BranchRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { GymSelector } from "@/components/gym/gym-selector";
import {
  UserPlus,
  ArrowLeft,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle2,
  LogOut,
} from "lucide-react";

export default function RegisterMemberPage() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { activeGym, activeGymId, currentRole, clearActiveGym } = useGym();

  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [branchId, setBranchId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSignOut = async () => {
    clearActiveGym();
    await signOut();
    router.push("/login");
  };

  // Load branches
  useEffect(() => {
    if (!activeGymId) return;
    let isCancelled = false;

    apiClient.branches
      .list(activeGymId)
      .then((data) => {
        if (!isCancelled) {
          setBranches(data);
          const mainBranch = data.find((b) => b.is_main) || data[0];
          if (mainBranch && !branchId) {
            setBranchId(mainBranch.id);
          }
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activeGymId, branchId]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) {
      errs.fullName = "Full name is required (minimum 2 characters)";
    } else if (fullName.trim().length < 2) {
      errs.fullName = "Full name must be at least 2 characters";
    }

    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validate()) return;
    if (!activeGymId) {
      setErrorMessage("No active gym selected.");
      return;
    }

    setIsSubmitting(true);

    let emergencyContact: Record<string, unknown> | null = null;
    if (emergencyName.trim() || emergencyPhone.trim()) {
      emergencyContact = {
        name: emergencyName.trim(),
        phone: emergencyPhone.trim(),
        relationship: emergencyRelation.trim(),
      };
    }

    try {
      const createdMember = await apiClient.members.create(activeGymId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        member_code: memberCode.trim() ? memberCode.trim().toUpperCase() : null,
        branch_id: branchId || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        status,
        emergency_contact: emergencyContact,
        notes: notes.trim() || null,
      });

      setSuccessMessage(`Member "${createdMember.full_name}" registered successfully with code ${createdMember.member_code}!`);

      setTimeout(() => {
        router.push(`/dashboard/members/${createdMember.id}`);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage("Failed to register member. Please verify input and try again.");
      }
      setIsSubmitting(false);
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
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-4xl w-full mx-auto">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/members"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8] hover:text-[#B8FF3B] transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Member Directory</span>
            </Link>

            <span className="text-xs text-[#94A3B8] font-mono">
              Gym: {activeGym?.name || "Active Gym"}
            </span>
          </div>

          {/* Form Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-[#B8FF3B]" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
                Register New Member
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              Register walk-in or new members directly at the front desk without requiring a pre-existing app login.
            </p>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 text-[#B8FF3B] text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Personal & Contact Information */}
            <Card className="border-[#27313D] bg-[#121922] shadow-lg">
              <CardHeader className="border-b border-[#27313D]/40 pb-4">
                <CardTitle className="text-base font-bold text-[#F8FAFC]">
                  Personal & Contact Information
                </CardTitle>
                <CardDescription className="text-xs text-[#94A3B8]">
                  Primary identity and contact channels for this gym member.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <Input
                    label="Full Name *"
                    placeholder="e.g. Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    error={errors.fullName}
                    required
                  />

                  {/* Member Code */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Member Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MEM-VIP01 (or leave blank to auto-generate)"
                      value={memberCode}
                      onChange={(e) => setMemberCode(e.target.value)}
                      className="w-full rounded-xl bg-[#161F2B] border border-[#27313D] px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#B8FF3B] font-mono"
                    />
                    <p className="text-[10px] text-[#94A3B8]">
                      Leave empty to automatically generate a collision-safe code like MEM-A8F2K1.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="alex.morgan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    icon={<Mail className="h-4 w-4" />}
                  />

                  {/* Phone */}
                  <Input
                    label="Phone Number"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    icon={<Phone className="h-4 w-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Branch Assignment */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Assigned Branch
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161F2B] border border-[#27313D] text-sm text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                    >
                      <option value="">No specific branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.is_main ? "(Main)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161F2B] border border-[#27313D] text-sm text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161F2B] border border-[#27313D] text-sm text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Membership Status & Notes */}
            <Card className="border-[#27313D] bg-[#121922] shadow-lg">
              <CardHeader className="border-b border-[#27313D]/40 pb-4">
                <CardTitle className="text-base font-bold text-[#F8FAFC]">
                  Initial Status & Administrative Notes
                </CardTitle>
                <CardDescription className="text-xs text-[#94A3B8]">
                  Set initial enrollment status and front desk remarks.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Enrollment Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161F2B] border border-[#27313D] text-sm text-[#F8FAFC] focus:outline-none focus:border-[#B8FF3B]"
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="pending">Pending (Awaiting Payment / Contract)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Notes / Medical / Preferences
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter any initial remarks, locker assignments, injuries, or goals..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl bg-[#161F2B] border border-[#27313D] px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#B8FF3B]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 3. Emergency Contact */}
            <Card className="border-[#27313D] bg-[#121922] shadow-lg">
              <CardHeader className="border-b border-[#27313D]/40 pb-4">
                <CardTitle className="text-base font-bold text-[#F8FAFC]">
                  Emergency Contact (Optional)
                </CardTitle>
                <CardDescription className="text-xs text-[#94A3B8]">
                  Person to contact in the event of a gym medical incident.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Contact Name"
                    placeholder="e.g. Sarah Morgan"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                  />
                  <Input
                    label="Relationship"
                    placeholder="e.g. Spouse / Parent"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                  />
                  <Input
                    label="Emergency Phone"
                    placeholder="+1 (555) 999-0000"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    icon={<Phone className="h-4 w-4" />}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/dashboard/members">
                <Button variant="secondary" size="md" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
              >
                <UserPlus className="h-4 w-4" />
                <span>Complete Registration</span>
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
