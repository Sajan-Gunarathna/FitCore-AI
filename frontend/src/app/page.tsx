"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Dumbbell, 
  Server, 
  CheckCircle2, 
  Layers, 
  Users, 
  ArrowUpRight,
  Lock,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  uptime_seconds?: number;
}

export default function Home() {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
        const res = await fetch(`${apiUrl}/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus(data);
        } else {
          setBackendStatus(null);
        }
      } catch {
        setBackendStatus(null);
      } finally {
        setIsChecking(false);
      }
    }
    checkHealth();
  }, []);

  return (
    <main className="min-h-screen bg-[#090D12] text-[#F8FAFC] flex flex-col selection:bg-[#B8FF3B] selection:text-[#090D12]">
      {/* Top Navbar */}
      <header className="border-b border-[#27313D] bg-[#121922]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161F2B] border border-[#27313D] text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus?.status === "healthy"
                    ? "bg-[#B8FF3B] animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-[#94A3B8]">FastAPI:</span>
              <span className="font-semibold text-[#F8FAFC]">
                {isChecking
                  ? "Checking..."
                  : backendStatus?.status === "healthy"
                  ? "Online (200 OK)"
                  : "Standby"}
              </span>
            </div>

            {user ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm">
                  Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-center">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#B8FF3B]/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#121922] border border-[#27313D] text-xs font-semibold text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#B8FF3B] animate-pulse" />
            <span>Commercial Multi-Tenant Gym Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#F8FAFC] leading-[1.1]">
            Next-Generation <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8FF3B] via-[#D4FF75] to-[#A3E635]">
              Gym Management SaaS
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-2xl">
            Engineered for fitness owners, multi-branch operations, and certified trainers.
            Built with transaction-scoped tenant isolation, PostgreSQL Row Level Security, and sub-second APIs.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link href={user ? "/dashboard" : "/register"}>
              <Button variant="primary" size="lg">
                {user ? "Open Gym Dashboard" : "Start Free Trial"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#94A3B8] hover:text-[#F8FAFC] px-5 py-3.5 rounded-xl bg-[#121922] border border-[#27313D] hover:border-[#94A3B8]/30 transition"
            >
              Interactive API Docs
              <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />
            </a>
          </div>
        </div>

        {/* Phase Status Banner */}
        <div className="mt-14 p-6 rounded-2xl bg-[#121922]/90 border border-[#27313D] backdrop-blur-sm grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Active Stage</div>
            <div className="text-lg font-bold text-[#B8FF3B] flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Phase 2 Active
            </div>
            <div className="text-xs text-[#94A3B8]">Gym Management Web App</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Backend Core</div>
            <div className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <Server className="h-5 w-5 text-[#B8FF3B]" />
              FastAPI + Asyncpg
            </div>
            <div className="text-xs text-[#94A3B8]">36/36 Verified Backend Tests</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Tenant Security</div>
            <div className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#B8FF3B]" />
              Supabase Auth + RLS
            </div>
            <div className="text-xs text-[#94A3B8]">FORCE RLS & Composite FKs</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Stack</div>
            <div className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#B8FF3B]" />
              Next.js 16 + React 19
            </div>
            <div className="text-xs text-[#94A3B8]">SSR Cookie Auth & Turbopack</div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#121922] border border-[#27313D] hover:border-[#B8FF3B]/30 transition space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/20 flex items-center justify-center text-[#B8FF3B]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[#F8FAFC] text-base">Multi-Tenant Isolation</h3>
            <p className="text-sm text-[#94A3B8] leading-normal">
              Every gym record is partitioned by <code className="text-xs text-[#B8FF3B] bg-[#161F2B] px-1.5 py-0.5 rounded border border-[#27313D]">gym_id</code>, enforced at both the API dependency layer and PostgreSQL engine level.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121922] border border-[#27313D] hover:border-[#B8FF3B]/30 transition space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/20 flex items-center justify-center text-[#B8FF3B]">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[#F8FAFC] text-base">5-Tier Role Matrix</h3>
            <p className="text-sm text-[#94A3B8] leading-normal">
              Fine-grained access control for Super Admins, Gym Owners, Gym Admins, Trainers, and Members. Supports multi-gym affiliation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121922] border border-[#27313D] hover:border-[#B8FF3B]/30 transition space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#B8FF3B]/10 border border-[#B8FF3B]/20 flex items-center justify-center text-[#B8FF3B]">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[#F8FAFC] text-base">Multi-Branch Architecture</h3>
            <p className="text-sm text-[#94A3B8] leading-normal">
              Manage multiple physical and virtual facilities under one gym organization with composite relational constraints.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#27313D] py-6 px-6 bg-[#090D12]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-[#B8FF3B]" />
            <span>&copy; 2026 FitCore AI Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-[#F8FAFC] transition">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-[#F8FAFC] transition">
              Register
            </Link>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="hover:text-[#F8FAFC] transition">
              API
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
