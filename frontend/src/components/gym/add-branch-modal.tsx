"use client";

import React, { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { BranchRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, MapPin, Phone, Mail, PlusCircle, AlertCircle } from "lucide-react";

interface AddBranchModalProps {
  gymId: string;
  isOpen: boolean;
  onClose: () => void;
  onBranchAdded: (branch: BranchRead) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddBranchModal({
  gymId,
  isOpen,
  onClose,
  onBranchAdded,
}: AddBranchModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isSlugManual, setIsSlugManual] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSlugManual) {
      setSlug(slugify(val));
    }
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: "" }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManual(true);
    setSlug(slugify(e.target.value));
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: "" }));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Branch name must be at least 2 characters long.";
    } else if (name.length > 255) {
      errs.name = "Branch name cannot exceed 255 characters.";
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slug.trim() || slug.length < 2) {
      errs.slug = "Slug must be at least 2 characters.";
    } else if (slug.length > 100) {
      errs.slug = "Slug cannot exceed 100 characters.";
    } else if (!slugRegex.test(slug)) {
      errs.slug = "Slug can only contain lowercase letters, numbers, and hyphens.";
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
      const created = await apiClient.branches.create(gymId, {
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        is_main: isMain,
      });

      onBranchAdded(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setError(
            `A branch with slug "${slug}" already exists in this gym. Please choose a different slug.`
          );
        } else if (err.status === 422 && err.validationErrors) {
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
        setError("Failed to create branch. Please check connection.");
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
          <X className="h-5 w-5" />
        </button>

        <CardHeader>
          <div className="flex items-center gap-2 text-[#B8FF3B]">
            <PlusCircle className="h-5 w-5" />
            <CardTitle className="text-lg">Add New Gym Branch</CardTitle>
          </div>
          <CardDescription>
            Register an additional physical location or training facility under this gym.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Branch Name *"
              placeholder="e.g. Uptown Training Center"
              value={name}
              onChange={handleNameChange}
              error={fieldErrors.name}
            />

            <Input
              label="Branch Slug *"
              placeholder="uptown-training-center"
              value={slug}
              onChange={handleSlugChange}
              error={fieldErrors.slug}
              helperText="Lowercase alphanumeric + hyphens. Unique per gym."
            />

            <Input
              label="Address (Optional)"
              placeholder="450 North Boulevard"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              icon={<MapPin className="h-4 w-4" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Phone (Optional)"
                placeholder="+1 555-0129"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldErrors.phone}
                icon={<Phone className="h-4 w-4" />}
              />

              <Input
                label="Email (Optional)"
                placeholder="uptown@gym.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                icon={<Mail className="h-4 w-4" />}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isMain}
                onChange={(e) => setIsMain(e.target.checked)}
                className="h-4 w-4 rounded bg-[#161F2B] border-[#27313D] text-[#B8FF3B] focus:ring-[#B8FF3B]/30"
              />
              <span className="text-xs text-[#F8FAFC]">
                Set as Main Branch (demotes current main branch)
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isLoading}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
              >
                <span>Create Branch</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
