"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const result = await updatePassword(password);
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-[#27313D] bg-[#121922]/90 backdrop-blur-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 flex items-center justify-center text-[#B8FF3B]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#F8FAFC]">
            Password Updated
          </CardTitle>
          <CardDescription className="text-sm text-[#94A3B8]">
            Your password has been successfully reset. Redirecting you to the dashboard...
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-2">
          <Link href="/dashboard" className="w-full">
            <Button variant="primary" className="w-full">
              Go to Dashboard
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
          Reset Password
        </CardTitle>
        <CardDescription className="text-sm text-[#94A3B8]">
          Choose a strong, secure new password for your account.
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
          <div className="relative">
            <Input
              label="New Password"
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
            label="Confirm New Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            icon={<Lock className="h-4 w-4" />}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            isLoading={isLoading}
          >
            Update Password
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-[#27313D] pt-6">
        <Link
          href="/login"
          className="text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition"
        >
          Cancel and Back to Login
        </Link>
      </CardFooter>
    </Card>
  );
}
