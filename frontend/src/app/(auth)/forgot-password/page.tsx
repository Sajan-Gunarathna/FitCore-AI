"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your account email address.");
      return;
    }

    setIsLoading(true);
    const result = await resetPassword(email.trim());
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="border-[#27313D] bg-[#121922]/90 backdrop-blur-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 flex items-center justify-center text-[#B8FF3B]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#F8FAFC]">
            Reset Link Sent
          </CardTitle>
          <CardDescription className="text-sm text-[#94A3B8]">
            We sent instructions to{" "}
            <span className="font-semibold text-[#F8FAFC]">{email}</span>. Please check your inbox and click the reset link to choose a new password.
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
          Forgot Password
        </CardTitle>
        <CardDescription className="text-sm text-[#94A3B8]">
          Enter your registered email address and we will send you a password reset link.
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
            label="Account Email Address"
            type="email"
            placeholder="owner@yourgym.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            isLoading={isLoading}
          >
            Send Password Reset Link
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-[#27313D] pt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
