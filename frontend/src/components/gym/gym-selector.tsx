"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useGym } from "@/hooks/use-gym";
import {
  Building2,
  ChevronDown,
  Check,
  PlusCircle,
  Loader2,
  Shield,
  Layers,
} from "lucide-react";

export function GymSelector() {
  const {
    accessibleGyms,
    activeGym,
    activeGymId,
    currentRole,
    isLoading,
    isSwitching,
    switchGym,
  } = useGym();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectGym = async (gymId: string) => {
    if (gymId === activeGymId) {
      setIsOpen(false);
      return;
    }
    await switchGym(gymId);
    setIsOpen(false);
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    const isOwnerOrAdmin = role === "owner" || role === "admin";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          isOwnerOrAdmin
            ? "bg-[#B8FF3B]/10 text-[#B8FF3B] border border-[#B8FF3B]/30"
            : "bg-[#1A232D] text-[#94A3B8] border border-[#27313D]"
        }`}
      >
        <Shield className="h-2.5 w-2.5" />
        {role}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121922] border border-[#27313D] text-xs text-[#94A3B8]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B8FF3B]" />
        <span>Loading gyms...</span>
      </div>
    );
  }

  if (accessibleGyms.length === 0) {
    return (
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121922] hover:bg-[#1A232D] border border-[#27313D] hover:border-[#B8FF3B]/40 transition text-xs font-medium text-[#F8FAFC]"
      >
        <PlusCircle className="h-3.5 w-3.5 text-[#B8FF3B]" />
        <span>Create Gym</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#121922] hover:bg-[#1A232D] border border-[#27313D] hover:border-[#B8FF3B]/40 transition text-left focus:outline-none focus:ring-2 focus:ring-[#B8FF3B]/50"
      >
        <div className="h-7 w-7 rounded-lg bg-[#1A232D] border border-[#27313D] flex items-center justify-center shrink-0">
          {isSwitching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B8FF3B]" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-[#B8FF3B]" />
          )}
        </div>

        <div className="flex flex-col min-w-0 max-w-[160px] sm:max-w-[200px]">
          <span className="text-xs font-bold text-[#F8FAFC] truncate">
            {activeGym?.name || "Select Gym"}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono truncate">
            {activeGym?.slug ? `@${activeGym.slug}` : "No active gym"}
          </span>
        </div>

        {getRoleBadge(currentRole)}

        <ChevronDown
          className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform duration-200 ml-1 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 rounded-2xl bg-[#121922] border border-[#27313D] shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-[#27313D]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Accessible Gyms ({accessibleGyms.length})
              </span>
              <Layers className="h-3.5 w-3.5 text-[#94A3B8]" />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-[#27313D]/40">
            {accessibleGyms.map((gym) => {
              const isCurrent = gym.id === activeGymId;
              return (
                <button
                  key={gym.id}
                  type="button"
                  onClick={() => handleSelectGym(gym.id)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#1A232D] transition ${
                    isCurrent ? "bg-[#1A232D]/70" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold truncate ${
                          isCurrent ? "text-[#B8FF3B]" : "text-[#F8FAFC]"
                        }`}
                      >
                        {gym.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-mono block truncate">
                      @{gym.slug}
                    </span>
                  </div>

                  {isCurrent && (
                    <div className="h-5 w-5 rounded-full bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-[#B8FF3B]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-[#27313D] mt-1">
            <Link
              href="/onboarding"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-[#1A232D] hover:bg-[#27313D] text-xs font-bold text-[#B8FF3B] transition"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Create New Gym</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
