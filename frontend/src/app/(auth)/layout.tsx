import React from "react";
import { Logo } from "@/components/ui/logo";
import { ShieldCheck, Zap, Users } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex bg-[#090D12]">
      {/* Left side: Premium Branding & Testimonial Column (hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-[#121922] border-r border-[#27313D] overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#B8FF3B]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Top: Logo */}
        <div className="relative z-10">
          <Logo size="lg" />
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A232D] border border-[#27313D] text-xs font-semibold text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#B8FF3B] animate-pulse" />
            <span>Commercial Multi-Tenant Gym Management</span>
          </div>
        </div>

        {/* Center: High Impact Fitness SaaS Pitch */}
        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#F8FAFC] leading-[1.15]">
            Powering Next-Gen{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8FF3B] to-[#A3E635]">
              Fitness Facilities
            </span>
          </h1>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            From single-studio operations to enterprise multi-branch gyms.
            Engineered with transaction-scoped tenant isolation and enterprise-grade security.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-[#1A232D]/70 border border-[#27313D] space-y-1">
              <div className="flex items-center gap-2 text-[#B8FF3B]">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold text-[#F8FAFC]">Row Level Security</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                PostgreSQL RLS with strict tenant isolation
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#1A232D]/70 border border-[#27313D] space-y-1">
              <div className="flex items-center gap-2 text-[#B8FF3B]">
                <Zap className="h-5 w-5" />
                <span className="text-sm font-bold text-[#F8FAFC]">Multi-Branch Support</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Manage gyms, locations, and trainers in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Social Proof Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-[#27313D] pt-6 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#B8FF3B]" />
            <span>Trusted by owners, admins & trainers worldwide</span>
          </div>
          <span>v0.2.0 Phase 2</span>
        </div>
      </div>

      {/* Right side: Auth Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Logo size="md" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
