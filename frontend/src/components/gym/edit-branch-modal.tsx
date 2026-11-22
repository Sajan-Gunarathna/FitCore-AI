"use client";

import React, { useState, useEffect } from "react";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { BranchRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, MapPin, Phone, Mail, Edit3, AlertCircle, CheckCircle2 } from "lucide-react";

interface EditBranchModalProps {
  gymId: string;
  branch: BranchRead | null;
  isOpen: boolean;
  onClose: () => void;
  onBranchUpdated: (updated: BranchRead) => void;
}

export function EditBranchModal({
  gymId,
  branch,
  isOpen,
  onClose,
  onBranchUpdated,
}: EditBranchModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      queueMicrotask(() => {
        setName(branch.name || "");
        setAddress(branch.address || "");
        setPhone(branch.phone || "");
        setEmail(branch.email || "");
        setIsMain(Boolean(branch.is_main));
        setIsActive(Boolean(branch.is_active));
        setFieldErrors({});
        setError(null);
      });
    }
  }, [branch]);

  if (!isOpen || !branch) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Branch name must be at least 2 characters long.";
    } else if (name.length > 255) {
      errs.name = "Branch name cannot exceed 255 characters.";
    }

    if (phone && phone.length > 50) {
      errs.phone = "Phone number cannot exceed 50 characters.";
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errs.email = "Please enter a valid email address.";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      const updated = await apiClient.branches.update(gymId, branch.id, {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_main: isMain,
        is_active: isActive,
      });

      onBranchUpdated(updated);
      onClose();
    } catch (err) {
      if (isApiClientError(err)) {
        if (err.status === 422 && err.validationErrors) {
          const errs: Record<string, string> = {};
          err.validationErrors.forEach((v) => {
            const field = v.loc?.[v.loc.length - 1];
            if (field) errs[String(field)] = v.msg;
          });
          setFieldErrors(errs);
          setError("Please resolve field validation errors.");
        } else {
          setError(err.detail);
        }
      } else {
        setError("Failed to update branch. Please check connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-lg border-[#27313D] bg-[#121922] shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8FAFC] p-1 rounded-lg hover:bg-[#1A232D] transition"
        >
          <X className="h-4 w-4" />
        </button>

        <CardHeader>
          <div className="flex items-center gap-2 text-[#B8FF3B]">
            <Edit3 className="h-5 w-5" />
            <CardTitle className="text-xl">Edit Branch Details</CardTitle>
          </div>
          <CardDescription>
            Update location name, address, contact information, and primary status for &quot;{branch.name}&quot;.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Branch Name *"
              placeholder="e.g. Downtown Headquarters"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              error={fieldErrors.name}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Branch Slug (Identifier)
              </label>
              <input
                type="text"
                disabled
                value={`@${branch.slug}`}
                className="w-full rounded-xl bg-[#161F2B]/60 border border-[#27313D] px-4 py-2.5 text-sm text-[#94A3B8] cursor-not-allowed select-none"
              />
              <p className="text-[11px] text-[#94A3B8]/60 mt-1">
                Slugs are permanent routing identifiers bound to composite tenant foreign keys.
              </p>
            </div>

            <Input
              label="Physical Address (Optional)"
              placeholder="100 Fitness Boulevard, Suite 400"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              icon={<MapPin className="h-4 w-4" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Contact Phone"
                placeholder="+1 (555) 019-2834"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
                }}
                error={fieldErrors.phone}
                icon={<Phone className="h-4 w-4" />}
              />

              <Input
                label="Contact Email"
                placeholder="branch@fitcore.internal"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
                error={fieldErrors.email}
                icon={<Mail className="h-4 w-4" />}
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#161F2B] border border-[#27313D] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#F8FAFC] block">
                    Headquarters / Main Branch
                  </span>
                  <span className="text-[11px] text-[#94A3B8] block">
                    Designates this location as the primary operational facility for this gym.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isMain}
                  onChange={(e) => setIsMain(e.target.checked)}
                  className="h-4 w-4 rounded border-[#27313D] bg-[#121922] text-[#B8FF3B] focus:ring-[#B8FF3B]/30"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#161F2B] border border-[#27313D] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#F8FAFC] block">
                    Active Operational Status
                  </span>
                  <span className="text-[11px] text-[#94A3B8] block">
                    Inactive branches cannot accept new member enrollments.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#27313D] bg-[#121922] text-[#B8FF3B] focus:ring-[#B8FF3B]/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27313D]">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
