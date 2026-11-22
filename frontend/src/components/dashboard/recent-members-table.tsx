import React from "react";
import Link from "next/link";
import type { RecentMemberSummary } from "@/lib/api/types";
import { Users, ChevronRight } from "lucide-react";

export interface RecentMembersTableProps {
  members: RecentMemberSummary[];
}

export function RecentMembersTable({ members }: RecentMembersTableProps) {
  if (members.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <div className="h-10 w-10 mx-auto rounded-full bg-[#1A232D] flex items-center justify-center text-[#94A3B8]">
          <Users className="h-5 w-5" />
        </div>
        <p className="text-xs text-[#94A3B8]">No members registered yet.</p>
        <span className="text-[10px] text-[#94A3B8]/60">
          New member registrations will appear here automatically.
        </span>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-[#B8FF3B]/10 text-[#B8FF3B] border-[#B8FF3B]/30";
      case "inactive":
        return "bg-[#1A232D] text-[#94A3B8] border-[#27313D]";
      case "suspended":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "pending":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#27313D] text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider">
            <th className="pb-2.5 font-medium">Member</th>
            <th className="pb-2.5 font-medium">Code</th>
            <th className="pb-2.5 font-medium">Status</th>
            <th className="pb-2.5 font-medium text-right">Joined</th>
            <th className="pb-2.5 font-medium text-right sr-only">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27313D]/40">
          {members.map((member) => (
            <tr
              key={member.id}
              className="hover:bg-[#1A232D]/40 transition group cursor-pointer"
            >
              <td className="py-3 pr-2">
                <Link
                  href={`/dashboard/members/${member.id}`}
                  className="block group-hover:text-[#B8FF3B] transition"
                >
                  <div className="font-bold text-[#F8FAFC] group-hover:text-[#B8FF3B]">
                    {member.full_name || "Gym Member"}
                  </div>
                  <div className="text-[10px] text-[#94A3B8] truncate max-w-[140px]">
                    {member.email}
                  </div>
                </Link>
              </td>
              <td className="py-3 px-2 font-mono text-[#B8FF3B] text-[11px]">
                <Link href={`/dashboard/members/${member.id}`}>
                  {member.member_code}
                </Link>
              </td>
              <td className="py-3 px-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(
                    member.status
                  )}`}
                >
                  {member.status}
                </span>
              </td>
              <td className="py-3 pl-2 text-right text-[#94A3B8] text-[11px] whitespace-nowrap">
                {new Date(member.joined_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td className="py-3 pl-2 text-right">
                <Link
                  href={`/dashboard/members/${member.id}`}
                  className="text-[#94A3B8] hover:text-[#B8FF3B] inline-flex items-center"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
