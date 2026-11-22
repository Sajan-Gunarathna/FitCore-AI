"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmationRequired, setIsConfirmationRequired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      setErrorMessage("You must accept the terms of service and privacy policy.");
      return;
    }

    setIsLoading(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else if (result.confirmationRequired) {
      setIsConfirmationRequired(true);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  if (isConfirmationRequired) {
    return (
      <Card className="border-[#27313D] bg-[#121922]/90 backdrop-blur-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 flex items-center justify-center text-[#B8FF3B]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#F8FAFC]">
            Verification Link Sent
          </CardTitle>
          <CardDescription className="text-sm text-[#94A3B8]">
            We sent a confirmation email to{" "}
            <span className="font-semibold text-[#F8FAFC]">{email}</span>. Please click the link inside to verify your account and activate your dashboard.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-2">
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-[#27313D] bg-[#121922]/90 backdrop-blur-xl">
      <CardHeader className="space-y-2 text-left">
        <CardTitle className="text-2xl font-extrabold text-[#F8FAFC]">
          Create Account
        </CardTitle>
        <CardDescription className="text-sm text-[#94A3B8]">
          Start managing your gym facilities and memberships with FitCore AI.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="Alex Mercer"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            icon={<UserIcon className="h-4 w-4" />}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="alex@ironpulse.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              helperText="Must be at least 8 characters long"
              icon={<Lock className="h-4 w-4" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[34px] text-[#94A3B8] hover:text-[#F8FAFC] transition p-1"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <Input
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            icon={<Lock className="h-4 w-4" />}
          />

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="rounded border-[#27313D] bg-[#161F2B] text-[#B8FF3B] focus:ring-[#B8FF3B]/30 h-4 w-4 mt-0.5 cursor-pointer"
            />
            <span className="text-xs text-[#94A3B8] leading-snug">
              I agree to the FitCore AI{" "}
              <a href="#" className="text-[#B8FF3B] hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-[#B8FF3B] hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            isLoading={isLoading}
          >
            Create Gym Account
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4 border-t border-[#27313D] pt-6">
        <p className="text-xs text-center text-[#94A3B8]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#B8FF3B] hover:text-[#A3E635] transition underline-offset-4 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
