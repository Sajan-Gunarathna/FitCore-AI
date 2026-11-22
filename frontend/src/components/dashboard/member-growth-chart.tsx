import React from "react";
import type { RegistrationTrendPoint } from "@/lib/api/types";
import { TrendingUp, Users } from "lucide-react";

export interface MemberGrowthChartProps {
  trend: RegistrationTrendPoint[];
}

export function MemberGrowthChart({ trend }: MemberGrowthChartProps) {
  const maxCount = Math.max(...trend.map((t) => t.count), 5);
  const totalInTrend = trend.reduce((sum, t) => sum + t.count, 0);

  if (trend.length === 0 || totalInTrend === 0) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
        <div className="h-10 w-10 rounded-full bg-[#1A232D] flex items-center justify-center text-[#94A3B8]">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="text-xs text-[#94A3B8]">
          No new registrations recorded in the last 6 months.
        </p>
        <span className="text-[10px] text-[#94A3B8]/60 font-mono">
          Growth trend updates in real time as members register.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Metric */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94A3B8] flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[#B8FF3B]" />
          <span>New Registrations (Past 6 Months):</span>
        </span>
        <span className="font-bold text-[#F8FAFC]">{totalInTrend}</span>
      </div>

      {/* SVG Bar Chart */}
      <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-1">
        {trend.map((point, index) => {
          const heightPercent = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
          const displayHeight = Math.max(heightPercent, 4); // Minimum bar height

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative"
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-[#1A232D] border border-[#27313D] text-[10px] text-[#F8FAFC] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                {point.period}: <strong className="text-[#B8FF3B]">{point.count}</strong>
              </div>

              {/* Bar */}
              <div className="w-full max-w-[40px] bg-[#1A232D] rounded-t-lg overflow-hidden h-full flex items-end">
                <div
                  className="w-full bg-gradient-to-t from-[#8ECA29] to-[#B8FF3B] rounded-t-lg transition-all duration-500 group-hover:brightness-110 shadow-[0_0_12px_rgba(184,255,59,0.2)]"
                  style={{ height: `${displayHeight}%` }}
                />
              </div>

              {/* X-Axis Label */}
              <span className="text-[9px] text-[#94A3B8] font-medium truncate max-w-[50px] text-center">
                {point.period.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
