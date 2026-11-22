import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Hero Banner Skeleton */}
      <div className="h-36 rounded-2xl bg-[#121922] border border-[#27313D] p-6 space-y-4">
        <div className="h-6 w-48 bg-[#1A232D] rounded-lg" />
        <div className="h-8 w-64 bg-[#1A232D] rounded-lg" />
        <div className="h-4 w-96 bg-[#1A232D] rounded-lg" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-[#27313D] bg-[#121922] h-28">
            <CardContent className="p-4 space-y-3">
              <div className="h-4 w-20 bg-[#1A232D] rounded" />
              <div className="h-8 w-12 bg-[#1A232D] rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-[#121922] border border-[#27313D] p-5 space-y-4">
          <div className="h-5 w-40 bg-[#1A232D] rounded" />
          <div className="h-48 w-full bg-[#1A232D]/60 rounded-xl" />
        </div>
        <div className="h-72 rounded-2xl bg-[#121922] border border-[#27313D] p-5 space-y-4">
          <div className="h-5 w-40 bg-[#1A232D] rounded" />
          <div className="h-48 w-full bg-[#1A232D]/60 rounded-xl" />
        </div>
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 rounded-2xl bg-[#121922] border border-[#27313D] p-5 space-y-3">
          <div className="h-5 w-32 bg-[#1A232D] rounded" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-full bg-[#1A232D]/40 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="h-80 rounded-2xl bg-[#121922] border border-[#27313D] p-5 space-y-3">
          <div className="h-5 w-32 bg-[#1A232D] rounded" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-full bg-[#1A232D]/40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
