import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface DashboardStatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "neutral";
}

export function DashboardStatCard({
  title,
  value,
  icon,
  subtitle,
  badge,
  badgeVariant = "success",
}: DashboardStatCardProps) {
  const badgeStyles = {
    success: "bg-[#B8FF3B]/10 text-[#B8FF3B] border-[#B8FF3B]/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    neutral: "bg-[#1A232D] text-[#94A3B8] border-[#27313D]",
  };

  return (
    <Card className="border-[#27313D] bg-[#121922] hover:border-[#B8FF3B]/30 transition shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#B8FF3B]/5 rounded-full blur-2xl group-hover:bg-[#B8FF3B]/10 transition pointer-events-none" />
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            {title}
          </span>
          <div className="h-8 w-8 rounded-lg bg-[#1A232D] border border-[#27313D] flex items-center justify-center text-[#B8FF3B]">
            {icon}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            {value}
          </div>

          <div className="flex items-center justify-between text-xs">
            {subtitle && <span className="text-[#94A3B8]">{subtitle}</span>}
            {badge && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyles[badgeVariant]}`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
