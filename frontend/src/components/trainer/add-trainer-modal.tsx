"use client";

import React, { useState } from "react";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { BranchRead, TrainerRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Dumbbell, AlertCircle } from "lucide-react";

interface AddTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gymId: string;
  branches: BranchRead[];
  onTrainerCreated: (trainer: TrainerRead) => void;
}

export function AddTrainerModal({
  isOpen,
  onClose,
  gymId,
  branches,
  onTrainerCreated,
}: AddTrainerModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [certifications, setCertifications] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("50.00");
  const [bio, setBio] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Trainer full name is required.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const specArray = specializations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const certArray = certifications
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const created = await apiClient.trainers.create(gymId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        branch_id: branchId.trim() || null,
        specializations: specArray,
        certifications: certArray,
        years_of_experience: parseInt(yearsOfExperience, 10) || 0,
        hourly_rate: hourlyRate.trim() || "0.00",
        bio: bio.trim() || null,
        is_active: isActive,
      });

      onTrainerCreated(created);
      onClose();
    } catch (err) {
      if (isApiClientError(err)) {
        setError(err.detail);
      } else {
        setError("Failed to create trainer profile.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#121922] border border-[#27313D] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#27313D] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#B8FF3B]/10 text-[#B8FF3B]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F8FAFC]">Add New Trainer</h2>
              <p className="text-xs text-[#94A3B8]">Register a coach or fitness specialist for your gym</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              required
              className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@gym.com"
                className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                Phone Number
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0123"
                className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                Primary Branch
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm focus:outline-none focus:border-[#B8FF3B]"
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
                Years of Experience
              </label>
              <Input
                type="number"
                min="0"
                max="60"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
                Hourly Rate ($)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="50.00"
                className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC]"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#F8FAFC]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-[#27313D] text-[#B8FF3B] focus:ring-[#B8FF3B] bg-[#1A232D] h-4 w-4"
                />
                Active Coach Status
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
              Specializations (comma-separated)
            </label>
            <Input
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              placeholder="e.g. Strength Training, HIIT, Mobility, Powerlifting"
              className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
              Certifications (comma-separated)
            </label>
            <Input
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="e.g. NASM-CPT, CSCS, ACE, CPR/AED"
              className="border-[#27313D] bg-[#1A232D] text-[#F8FAFC] placeholder:text-[#94A3B8]/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] uppercase mb-1">
              Professional Biography
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief background, coaching philosophy, and athletic achievements..."
              className="w-full px-3 py-2 rounded-lg bg-[#1A232D] border border-[#27313D] text-[#F8FAFC] text-sm focus:outline-none focus:border-[#B8FF3B] placeholder:text-[#94A3B8]/50 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#27313D] flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-[#27313D] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#B8FF3B] text-[#0B0F15] hover:bg-[#A3E635] font-semibold"
            >
              {isLoading ? "Creating..." : "Save Trainer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
