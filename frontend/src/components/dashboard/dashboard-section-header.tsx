import React from "react";

export interface DashboardSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function DashboardSectionHeader({
  title,
  subtitle,
  icon,
  action,
}: DashboardSectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && <div className="text-[#B8FF3B]">{icon}</div>}
          <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] tracking-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
