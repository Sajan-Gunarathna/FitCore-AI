import React from "react";
import type { UpcomingExpirationSummary } from "@/lib/api/types";
import { Clock } from "lucide-react";

export interface UpcomingExpirationsProps {
  expirations: UpcomingExpirationSummary[];
}

export function UpcomingExpirations({ expirations }: UpcomingExpirationsProps) {
  if (expirations.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <div className="h-10 w-10 mx-auto rounded-full bg-[#1A232D] flex items-center justify-center text-[#94A3B8]">
          <Clock className="h-5 w-5" />
        </div>
        <p className="text-xs text-[#94A3B8]">
          No subscriptions expiring in the next 14 days.
        </p>
        <span className="text-[10px] text-[#94A3B8]/60">
          Members nearing expiration will be tracked here for renewal.
        </span>
      </div>
    );
  }

  const getDaysLeft = (endDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 0) return { label: "Expires Today", isUrgent: true };
    if (diffDays === 1) return { label: "Expires Tomorrow", isUrgent: true };
    return {
      label: `In ${diffDays} days`,
      isUrgent: diffDays <= 3,
    };
  };

  return (
    <div className="space-y-3">
      {expirations.map((exp) => {
        const countdown = getDaysLeft(exp.end_date);

        return (
          <div
            key={exp.id}
            className="p-3 rounded-xl bg-[#161F2B] border border-[#27313D] hover:border-[#B8FF3B]/30 transition flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#F8FAFC] truncate">
                  {exp.full_name || exp.email}
                </span>
                <span className="font-mono text-[10px] text-[#B8FF3B]">
                  {exp.member_code}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                Plan: <strong className="text-[#F8FAFC]">{exp.plan_name}</strong>
              </div>
            </div>

            <div className="shrink-0 text-right space-y-1">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  countdown.isUrgent
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {countdown.label}
              </span>
              <div className="text-[10px] text-[#94A3B8] font-mono">
                {exp.end_date}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
