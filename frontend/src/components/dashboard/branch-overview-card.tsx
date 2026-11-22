import React from "react";
import Link from "next/link";
import type { BranchSummaryItem } from "@/lib/api/types";
import { Building2, Users, PlusCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BranchOverviewCardProps {
  branches: BranchSummaryItem[];
  onAddBranch?: () => void;
  canManage?: boolean;
}

export function BranchOverviewCard({
  branches,
  onAddBranch,
  canManage = false,
}: BranchOverviewCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#B8FF3B]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Branch Locations ({branches.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/branches"
            className="text-xs font-semibold text-[#94A3B8] hover:text-[#B8FF3B] transition flex items-center gap-1"
          >
            <span>Manage All</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>

          {canManage && onAddBranch && (
            <Button variant="outline" size="sm" onClick={onAddBranch}>
              <PlusCircle className="h-3.5 w-3.5 text-[#B8FF3B]" />
              <span>Add Branch</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="p-3.5 rounded-xl bg-[#161F2B] border border-[#27313D] hover:border-[#B8FF3B]/30 transition space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#F8FAFC] truncate">{branch.name}</div>
                <div className="text-[10px] text-[#94A3B8] font-mono">@{branch.slug}</div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                {branch.is_main && (
                  <span className="px-2 py-0.5 rounded-full bg-[#B8FF3B]/10 border border-[#B8FF3B]/30 text-[#B8FF3B] font-bold text-[9px] uppercase">
                    Main
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[9px] uppercase">
                  {branch.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#27313D]/40 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-[#B8FF3B]" />
                <span>Assigned Members:</span>
              </span>
              <strong className="text-[#F8FAFC] font-mono">{branch.member_count}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
