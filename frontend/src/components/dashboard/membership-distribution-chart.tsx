import React from "react";
import type { StatusDistributionPoint } from "@/lib/api/types";
import { PieChart } from "lucide-react";

export interface MembershipDistributionChartProps {
  distribution: StatusDistributionPoint[];
  totalMembers: number;
}

export function MembershipDistributionChart({
  distribution,
  totalMembers,
}: MembershipDistributionChartProps) {
  if (totalMembers === 0) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
        <div className="h-10 w-10 rounded-full bg-[#1A232D] flex items-center justify-center text-[#94A3B8]">
          <PieChart className="h-5 w-5" />
        </div>
        <p className="text-xs text-[#94A3B8]">
          No membership status data to visualize.
        </p>
        <span className="text-[10px] text-[#94A3B8]/60 font-mono">
          Status ratios will display once members are enrolled.
        </span>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return {
          bar: "bg-[#B8FF3B]",
          text: "text-[#B8FF3B]",
          pill: "bg-[#B8FF3B]/10 border-[#B8FF3B]/30",
        };
      case "inactive":
        return {
          bar: "bg-[#94A3B8]",
          text: "text-[#94A3B8]",
          pill: "bg-[#1A232D] border-[#27313D]",
        };
      case "suspended":
        return {
          bar: "bg-red-400",
          text: "text-red-400",
          pill: "bg-red-500/10 border-red-500/30",
        };
      case "pending":
        return {
          bar: "bg-amber-400",
          text: "text-amber-400",
          pill: "bg-amber-500/10 border-amber-500/30",
        };
      default:
        return {
          bar: "bg-blue-400",
          text: "text-blue-400",
          pill: "bg-blue-500/10 border-blue-500/30",
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Stacked Progress Bar */}
      <div className="h-3 w-full rounded-full bg-[#161F2B] overflow-hidden flex">
        {distribution.map((item, idx) => {
          const percent = totalMembers > 0 ? (item.count / totalMembers) * 100 : 0;
          if (percent === 0) return null;
          const colors = getStatusColor(item.status);

          return (
            <div
              key={idx}
              className={`${colors.bar} h-full transition-all duration-500`}
              style={{ width: `${percent}%` }}
              title={`${item.status}: ${item.count} (${percent.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Status Breakdown Legend & Counts */}
      <div className="space-y-2.5 pt-1">
        {distribution.map((item, idx) => {
          const percent = totalMembers > 0 ? (item.count / totalMembers) * 100 : 0;
          const colors = getStatusColor(item.status);

          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${colors.bar}`} />
                <span className="font-semibold text-[#F8FAFC] capitalize">
                  {item.status}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-[#94A3B8]">{percent.toFixed(0)}%</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors.pill} ${colors.text}`}
                >
                  {item.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
