import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, ArrowRight, Sparkles } from "lucide-react";

export interface DashboardEmptyStateProps {
  gymName: string;
}

export function DashboardEmptyState({ gymName }: DashboardEmptyStateProps) {
  return (
    <Card className="border-[#27313D] bg-[#121922] p-8 text-center shadow-xl">
      <CardContent className="max-w-md mx-auto space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-[#1A232D] border border-[#27313D] flex items-center justify-center text-[#B8FF3B]">
          <Users className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#F8FAFC]">
            No Member Data in {gymName}
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Your gym organization and branches are active. As members and subscriptions are registered in Milestone 2.4, real-time analytics and growth trends will populate here automatically.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding">
            <Button variant="secondary" size="sm">
              <Sparkles className="h-3.5 w-3.5 text-[#B8FF3B]" />
              <span>Configure Organization</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" disabled>
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member (Milestone 2.4)</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
