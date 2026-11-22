"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = getSafeRedirectUrl(searchParams.get("next"), "/dashboard");

  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    const result = await signIn(email.trim(), password);
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      router.push(nextUrl);
      router.refresh();
    }
  };

  return (
    <Card className="border-[#27313D] bg-[#121922]/90 backdrop-blur-xl">
      <CardHeader className="space-y-2 text-left">
        <CardTitle className="text-2xl font-extrabold text-[#F8FAFC]">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-sm text-[#94A3B8]">
          Log in with your FitCore AI account to access your gym dashboard.
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
            label="Email Address"
            type="email"
            placeholder="owner@yourgym.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
          />

          <div className="space-y-1.5">
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-[34px] text-[#94A3B8] hover:text-[#F8FAFC] transition p-1"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#27313D] bg-[#161F2B] text-[#B8FF3B] focus:ring-[#B8FF3B]/30 h-4 w-4 cursor-pointer"
              />
              <span className="text-xs text-[#94A3B8] font-medium">Remember me</span>
            </label>

            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#B8FF3B] hover:text-[#A3E635] transition"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            isLoading={isLoading}
          >
            Sign In to Dashboard
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4 border-t border-[#27313D] pt-6">
        <p className="text-xs text-center text-[#94A3B8]">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/register"
            className="font-bold text-[#B8FF3B] hover:text-[#A3E635] transition underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 rounded-2xl bg-[#121922] border border-[#27313D] text-center text-sm text-[#94A3B8]">
          Loading sign in form...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
