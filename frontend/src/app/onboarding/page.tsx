"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useGym } from "@/hooks/use-gym";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { GymDetailRead } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import {
  Building2,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Phone,
  Mail,
  Sparkles,
  RefreshCw,
  Edit2,
  ShieldCheck,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { switchGym, refreshGyms } = useGym();

  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: Gym Form
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [gymDescription, setGymDescription] = useState("");
  const [isGymSlugManual, setIsGymSlugManual] = useState(false);

  // Step 2: First Branch Form
  const [branchName, setBranchName] = useState("Downtown Headquarters");
  const [branchSlug, setBranchSlug] = useState("headquarters");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchEmail, setBranchEmail] = useState("");
  const [isBranchSlugManual, setIsBranchSlugManual] = useState(false);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Loading & Partial recovery state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdGym, setCreatedGym] = useState<GymDetailRead | null>(null);
  const [branchFailed, setBranchFailed] = useState(false);

  // Handle Gym Name Change -> Auto-slugify
  const handleGymNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGymName(val);
    if (!isGymSlugManual) {
      setGymSlug(slugify(val));
    }
    if (fieldErrors.gymName) {
      setFieldErrors((prev) => ({ ...prev, gymName: "" }));
    }
  };

  const handleGymSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsGymSlugManual(true);
    setGymSlug(slugify(e.target.value));
    if (fieldErrors.gymSlug) {
      setFieldErrors((prev) => ({ ...prev, gymSlug: "" }));
    }
  };

  // Handle Branch Name Change -> Auto-slugify
  const handleBranchNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBranchName(val);
    if (!isBranchSlugManual) {
      const slug = slugify(val);
      setBranchSlug(slug === "main" ? "main-branch" : slug || "headquarters");
    }
    if (fieldErrors.branchName) {
      setFieldErrors((prev) => ({ ...prev, branchName: "" }));
    }
  };

  const handleBranchSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsBranchSlugManual(true);
    setBranchSlug(slugify(e.target.value));
    if (fieldErrors.branchSlug) {
      setFieldErrors((prev) => ({ ...prev, branchSlug: "" }));
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!gymName.trim() || gymName.trim().length < 2) {
      errors.gymName = "Gym name must be at least 2 characters long.";
    } else if (gymName.length > 255) {
      errors.gymName = "Gym name cannot exceed 255 characters.";
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!gymSlug.trim() || gymSlug.length < 3) {
      errors.gymSlug = "Slug must be at least 3 characters.";
    } else if (gymSlug.length > 100) {
      errors.gymSlug = "Slug cannot exceed 100 characters.";
    } else if (!slugRegex.test(gymSlug)) {
      errors.gymSlug = "Slug can only contain lowercase letters, numbers, and hyphens.";
    }

    if (gymDescription.length > 2000) {
      errors.gymDescription = "Description cannot exceed 2000 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!branchName.trim() || branchName.trim().length < 2) {
      errors.branchName = "Branch name must be at least 2 characters long.";
    } else if (branchName.length > 255) {
      errors.branchName = "Branch name cannot exceed 255 characters.";
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!branchSlug.trim() || branchSlug.length < 2) {
      errors.branchSlug = "Branch slug must be at least 2 characters.";
    } else if (branchSlug.length > 100) {
      errors.branchSlug = "Branch slug cannot exceed 100 characters.";
    } else if (!slugRegex.test(branchSlug)) {
      errors.branchSlug = "Branch slug can only contain lowercase letters, numbers, and hyphens.";
    }

    if (branchPhone && branchPhone.length > 50) {
      errors.branchPhone = "Phone number cannot exceed 50 characters.";
    }

    if (branchEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(branchEmail)) {
        errors.branchEmail = "Please enter a valid email address.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep1 = () => {
    if (validateStep1()) {
      setGlobalError(null);
      setCurrentStep(2);
    }
  };

  const handleNextStep2 = () => {
    if (validateStep2()) {
      setGlobalError(null);
      setCurrentStep(3);
    }
  };

  // Final Submission with Partial Failure Recovery
  const handleLaunchGym = async () => {
    setIsSubmitting(true);
    setGlobalError(null);

    let gym = createdGym;

    try {
      // 1. Create Gym if not already created
      if (!gym) {
        gym = await apiClient.gyms.create({
          name: gymName.trim(),
          slug: gymSlug.trim(),
          description: gymDescription.trim() || undefined,
        });
        setCreatedGym(gym);
      }

      // 2. Create custom branch if specified and not 'main' (which backend automatically provides)
      if (branchSlug.trim() && branchSlug.trim() !== "main") {
        try {
          await apiClient.branches.create(gym.id, {
            name: branchName.trim(),
            slug: branchSlug.trim(),
            address: branchAddress.trim() || undefined,
            phone: branchPhone.trim() || undefined,
            email: branchEmail.trim() || undefined,
            is_main: true,
          });
          setBranchFailed(false);
        } catch (branchErr) {
          // Partial failure: Gym succeeded, but branch failed
          setBranchFailed(true);
          const msg =
            branchErr instanceof ApiClientError
              ? branchErr.detail
              : "Failed to configure initial branch.";
          setGlobalError(
            `Gym "${gym.name}" was registered successfully, but branch creation encountered an error: ${msg}. You can retry branch creation or proceed to the dashboard.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Success: Refresh tenant state & profile
      await refreshGyms(gym.id);
      await refreshProfile();
      await switchGym(gym.id);

      setCurrentStep(4);
    } catch (err) {
      if (isApiClientError(err)) {
        if (err.status === 401) {
          setGlobalError(
            "Your login session has expired. Please refresh the page or sign in again to complete gym onboarding."
          );
        } else if (err.status === 409) {
          setGlobalError(
            `The slug "@${gymSlug}" is already in use by another gym. Please choose a different slug (e.g., "${gymSlug}-fitness" or "${gymSlug}-center").`
          );
        } else if (err.status === 422 && err.validationErrors) {
          const errs: Record<string, string> = {};
          err.validationErrors.forEach((v) => {
            const field = v.loc?.[v.loc.length - 1];
            if (field) errs[String(field)] = v.msg;
          });
          setFieldErrors(errs);
          setGlobalError("Please check the form fields for validation errors.");
        } else {
          setGlobalError(err.detail);
        }
      } else if (err instanceof Error) {
        setGlobalError(`Error: ${err.message}`);
      } else {
        setGlobalError("An unexpected network error occurred. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Partial Recovery: Retry only branch creation
  const handleRetryBranch = async () => {
    if (!createdGym) return;
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      await apiClient.branches.create(createdGym.id, {
        name: branchName.trim(),
        slug: branchSlug.trim(),
        address: branchAddress.trim() || undefined,
        phone: branchPhone.trim() || undefined,
        email: branchEmail.trim() || undefined,
        is_main: true,
      });

      setBranchFailed(false);
      await refreshGyms(createdGym.id);
      await refreshProfile();
      await switchGym(createdGym.id);
      setCurrentStep(4);
    } catch (branchErr) {
      const msg = isApiClientError(branchErr)
        ? branchErr.detail
        : branchErr instanceof Error
        ? branchErr.message
        : "Branch creation failed on retry.";
      setGlobalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip branch and proceed with default Main branch
  const handleProceedWithDefaultBranch = async () => {
    if (!createdGym) return;
    setIsSubmitting(true);
    await refreshGyms(createdGym.id);
    await refreshProfile();
    await switchGym(createdGym.id);
    setCurrentStep(4);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#090D12] text-[#F8FAFC] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[#27313D] bg-[#121922]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition flex items-center gap-1.5"
          >
            <span>Exit to Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-10 w-full flex-1 flex flex-col justify-center">
        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#27313D] -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-[#B8FF3B] -translate-y-1/2 transition-all duration-300 z-0"
              style={{
                width:
                  currentStep === 1
                    ? "0%"
                    : currentStep === 2
                    ? "33%"
                    : currentStep === 3
                    ? "66%"
                    : "100%",
              }}
            />

            {[
              { num: 1, label: "Gym Info" },
              { num: 2, label: "First Branch" },
              { num: 3, label: "Review" },
              { num: 4, label: "Launch" },
            ].map((step) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;

              return (
                <div key={step.num} className="flex flex-col items-center relative z-10">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isPassed
                        ? "bg-[#B8FF3B] text-[#090D12]"
                        : isCurrent
                        ? "bg-[#121922] text-[#B8FF3B] border-2 border-[#B8FF3B] shadow-[0_0_15px_rgba(184,255,59,0.3)]"
                        : "bg-[#161F2B] text-[#94A3B8] border border-[#27313D]"
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 hidden sm:block ${
                      isCurrent
                        ? "text-[#B8FF3B] font-bold"
                        : isPassed
                        ? "text-[#F8FAFC]"
                        : "text-[#94A3B8]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Onboarding Alert</span>
              <p className="leading-relaxed">{globalError}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Gym Information */}
        {currentStep === 1 && (
          <Card className="border-[#27313D] bg-[#121922]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#B8FF3B]">
                <Building2 className="h-5 w-5" />
                <CardTitle className="text-xl">Step 1 — Register Your Gym</CardTitle>
              </div>
              <CardDescription>
                Define your organization profile and public URL identifier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                label="Gym Name *"
                placeholder="e.g. Iron Forge Fitness"
                value={gymName}
                onChange={handleGymNameChange}
                error={fieldErrors.gymName}
                helperText="The public trading name of your fitness organization."
              />

              <Input
                label="Gym Slug / Identifier *"
                placeholder="iron-forge-fitness"
                value={gymSlug}
                onChange={handleGymSlugChange}
                error={fieldErrors.gymSlug}
                helperText="Lowercase letters, numbers, and hyphens. Used in API routing."
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell members about your facilities, specialties, and training ethos..."
                  value={gymDescription}
                  onChange={(e) => setGymDescription(e.target.value)}
                  className="w-full rounded-xl bg-[#161F2B] border border-[#27313D] focus:border-[#B8FF3B] focus:ring-2 focus:ring-[#B8FF3B]/30 px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 transition focus:outline-none"
                />
                {fieldErrors.gymDescription && (
                  <p className="text-xs text-red-400 font-medium">
                    {fieldErrors.gymDescription}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" size="md" onClick={handleNextStep1}>
                  <span>Continue to Branch Setup</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: First Branch Setup */}
        {currentStep === 2 && (
          <Card className="border-[#27313D] bg-[#121922]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#B8FF3B]">
                <MapPin className="h-5 w-5" />
                <CardTitle className="text-xl">Step 2 — Initial Branch Location</CardTitle>
              </div>
              <CardDescription>
                Set up your primary physical club or headquarters location.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                label="Branch Name *"
                placeholder="e.g. Downtown Headquarters"
                value={branchName}
                onChange={handleBranchNameChange}
                error={fieldErrors.branchName}
                helperText="Name identifying this physical location."
              />

              <Input
                label="Branch Slug *"
                placeholder="headquarters"
                value={branchSlug}
                onChange={handleBranchSlugChange}
                error={fieldErrors.branchSlug}
                helperText="Unique branch slug within your gym organization."
              />

              <Input
                label="Physical Address (Optional)"
                placeholder="100 Fitness Boulevard, Suite 400"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                icon={<MapPin className="h-4 w-4" />}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone (Optional)"
                  placeholder="+1 (555) 019-2834"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  error={fieldErrors.branchPhone}
                  icon={<Phone className="h-4 w-4" />}
                />

                <Input
                  label="Contact Email (Optional)"
                  placeholder="contact@ironforge.com"
                  value={branchEmail}
                  onChange={(e) => setBranchEmail(e.target.value)}
                  error={fieldErrors.branchEmail}
                  icon={<Mail className="h-4 w-4" />}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setGlobalError(null);
                    setCurrentStep(1);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Gym Info</span>
                </Button>

                <Button variant="primary" size="md" onClick={handleNextStep2}>
                  <span>Review & Confirmation</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Review & Confirmation */}
        {currentStep === 3 && (
          <Card className="border-[#27313D] bg-[#121922]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#B8FF3B]">
                <ShieldCheck className="h-5 w-5" />
                <CardTitle className="text-xl">Step 3 — Review Organization Details</CardTitle>
              </div>
              <CardDescription>
                Confirm your configuration before provisioning tenant databases and security roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Gym Summary Card */}
              <div className="p-4 rounded-xl bg-[#161F2B] border border-[#27313D] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#B8FF3B]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                      Gym Profile
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    disabled={isSubmitting || createdGym !== null}
                    className="text-xs font-semibold text-[#B8FF3B] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#94A3B8] block">Gym Name:</span>
                    <span className="font-bold text-[#F8FAFC] text-sm">{gymName}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Slug:</span>
                    <span className="font-mono text-[#B8FF3B]">@{gymSlug}</span>
                  </div>
                  {gymDescription && (
                    <div className="sm:col-span-2">
                      <span className="text-[#94A3B8] block">Description:</span>
                      <span className="text-[#F8FAFC]">{gymDescription}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[#94A3B8] block">Owner:</span>
                    <span className="text-[#F8FAFC] font-medium">{user?.email}</span>
                  </div>
                </div>
              </div>

              {/* Branch Summary Card */}
              <div className="p-4 rounded-xl bg-[#161F2B] border border-[#27313D] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#B8FF3B]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                      Initial Branch
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={isSubmitting}
                    className="text-xs font-semibold text-[#B8FF3B] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#94A3B8] block">Branch Name:</span>
                    <span className="font-bold text-[#F8FAFC]">{branchName}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Branch Slug:</span>
                    <span className="font-mono text-[#F8FAFC]">@{branchSlug}</span>
                  </div>
                  {branchAddress && (
                    <div>
                      <span className="text-[#94A3B8] block">Address:</span>
                      <span className="text-[#F8FAFC]">{branchAddress}</span>
                    </div>
                  )}
                  {branchPhone && (
                    <div>
                      <span className="text-[#94A3B8] block">Phone:</span>
                      <span className="text-[#F8FAFC]">{branchPhone}</span>
                    </div>
                  )}
                  {branchEmail && (
                    <div>
                      <span className="text-[#94A3B8] block">Email:</span>
                      <span className="text-[#F8FAFC]">{branchEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Partial Failure Recovery Options */}
              {branchFailed && createdGym && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
                  <div className="font-bold text-amber-400 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span>Recovery Action Available</span>
                  </div>
                  <p className="text-[#94A3B8]">
                    Your gym organization &quot;{createdGym.name}&quot; has already been created in PostgreSQL with
                    owner privileges. You can retry creating this custom branch or proceed immediately with the default branch.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isSubmitting}
                      onClick={handleRetryBranch}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry Branch Creation</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleProceedWithDefaultBranch}
                    >
                      <span>Proceed to Dashboard</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Controls */}
              {!branchFailed && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={isSubmitting}
                    onClick={() => setCurrentStep(2)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Branch</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="md"
                    isLoading={isSubmitting}
                    onClick={handleLaunchGym}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Confirm & Launch Gym</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Success & Activation */}
        {currentStep === 4 && (
          <Card className="border-[#B8FF3B]/40 bg-[#121922] shadow-[0_0_50px_rgba(184,255,59,0.1)] text-center">
            <CardContent className="pt-10 pb-10 space-y-6">
              <div className="h-16 w-16 mx-auto rounded-full bg-[#B8FF3B]/10 border-2 border-[#B8FF3B] flex items-center justify-center text-[#B8FF3B] shadow-[0_0_30px_rgba(184,255,59,0.3)] animate-in zoom-in-50">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#B8FF3B]">
                  Provisioning Complete
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
                  Welcome to {gymName}!
                </h2>
                <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
                  Your multi-tenant gym environment has been created. You have been assigned the{" "}
                  <strong className="text-[#F8FAFC]">Owner</strong> role, and your branch has been
                  activated.
                </p>
              </div>

              <div className="p-4 max-w-md mx-auto rounded-xl bg-[#161F2B] border border-[#27313D] text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Active Tenant:</span>
                  <span className="font-bold text-[#F8FAFC]">{gymName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Slug:</span>
                  <span className="font-mono text-[#B8FF3B]">@{gymSlug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Initial Branch:</span>
                  <span className="font-medium text-[#F8FAFC]">{branchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Role:</span>
                  <span className="font-bold text-[#B8FF3B] uppercase">Owner</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    router.push("/dashboard");
                    router.refresh();
                  }}
                  className="w-full sm:w-auto"
                >
                  <span>Go to Gym Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    // Reset to step 1 for creating another gym
                    setCreatedGym(null);
                    setGymName("");
                    setGymSlug("");
                    setGymDescription("");
                    setIsGymSlugManual(false);
                    setBranchName("Downtown Headquarters");
                    setBranchSlug("headquarters");
                    setBranchAddress("");
                    setBranchPhone("");
                    setBranchEmail("");
                    setIsBranchSlugManual(false);
                    setGlobalError(null);
                    setCurrentStep(1);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Create Another Gym</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
