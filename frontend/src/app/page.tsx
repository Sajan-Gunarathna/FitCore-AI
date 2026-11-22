"use client";

import { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  Dumbbell, 
  Server, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  Users, 
  ArrowUpRight,
  Code2,
  Lock,
  ChevronRight
} from "lucide-react";

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  uptime_seconds?: number;
}

export default function Home() {
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                FitCore AI
              </span>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                SaaS v0.1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
              <span className={`h-2 w-2 rounded-full ${backendStatus?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-zinc-400">API Health:</span>
              <span className="font-medium text-zinc-200">
                {isChecking ? "Checking..." : backendStatus?.status === 'healthy' ? "Online (200 OK)" : "Standby"}
              </span>
            </div>

            <a 
              href="http://localhost:8000/docs" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 transition"
            >
              Swagger Docs
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-center">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Commercial Multi-Tenant Gym Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
            Next-Generation <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
              AI-Powered Gym Management
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            Commercial SaaS designed for multi-tenant gyms, automated AI workout/diet synthesis,
            hardened Row-Level Security, and sub-second analytics.
          </p>
        </div>

        {/* Phase Status Banner */}
        <div className="mt-12 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Stage</div>
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Phase 0 Complete
            </div>
            <div className="text-xs text-zinc-500">Foundation & Scaffold Verified</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Backend Core</div>
            <div className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-400" />
              FastAPI + Asyncpg
            </div>
            <div className="text-xs text-zinc-500">SQLAlchemy 2.0 & Pydantic v2</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tenant Security</div>
            <div className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Lock className="h-5 w-5 text-violet-400" />
              Supabase Auth & RLS
            </div>
            <div className="text-xs text-zinc-500">JWT verification & gym_id scope</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cross-Platform</div>
            <div className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-sky-400" />
              Web + Mobile
            </div>
            <div className="text-xs text-zinc-500">Next.js 15 & React Native Expo</div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition space-y-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-zinc-100 text-base">Multi-Tenant Isolation</h3>
            <p className="text-sm text-zinc-400 leading-normal">
              Strict multi-tenant architecture. Every gym record is bounded by <code className="text-xs text-indigo-300 bg-zinc-800 px-1 py-0.5 rounded">gym_id</code>,
              enforced at both application and database RLS levels.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition space-y-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-zinc-100 text-base">5 Tier Role Matrix</h3>
            <p className="text-sm text-zinc-400 leading-normal">
              Granular permission scopes for Super Admins, Gym Owners, Gym Admins, Trainers, and Gym Members.
              Supports multi-gym affiliation per account.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition space-y-3">
            <div className="h-10 w-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-zinc-100 text-base">AI Engine Integration</h3>
            <p className="text-sm text-zinc-400 leading-normal">
              Built for Phase 3 automated workout routine generation, macro & diet formulation,
              biometric progress analysis (BMI, BMR, TDEE, Body Fat).
            </p>
          </div>
        </div>

        {/* System Architecture Details Card */}
        <div className="mt-8 p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-200">Canonical Migrations</div>
              <div className="text-xs text-zinc-500">Supabase CLI managed in <code className="text-zinc-400">supabase/migrations</code></div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>Ready for Phase 1 Core Backend implementation</span>
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 px-6 text-center text-xs text-zinc-500 bg-zinc-950">
        FitCore AI Commercial SaaS · Architecture Foundation · Phase 0 Complete
      </footer>
    </main>
  );
}
