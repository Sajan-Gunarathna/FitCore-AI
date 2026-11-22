import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface DashboardChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function DashboardChartCard({
  title,
  description,
  icon,
  children,
  action,
}: DashboardChartCardProps) {
  return (
    <Card className="border-[#27313D] bg-[#121922] shadow-lg flex flex-col h-full">
      <CardHeader className="pb-3 border-b border-[#27313D]/40">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {icon && <div className="text-[#B8FF3B]">{icon}</div>}
              <CardTitle className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                {title}
              </CardTitle>
            </div>
            {description && (
              <CardDescription className="text-xs text-[#94A3B8]">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
        {children}
      </CardContent>
    </Card>
  );
}
