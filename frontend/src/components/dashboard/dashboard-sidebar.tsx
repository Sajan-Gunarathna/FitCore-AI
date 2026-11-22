"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  CreditCard,
  CalendarCheck,
  Building2,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: "Members",
      href: "/dashboard/members",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Trainers",
      href: "#",
      icon: <Dumbbell className="h-4 w-4" />,
      badge: "Soon",
      disabled: true,
    },
    {
      label: "Membership Plans",
      href: "/dashboard/membership-plans",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      label: "Subscriptions",
      href: "/dashboard/subscriptions",
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      label: "Branches",
      href: "/dashboard/branches",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      label: "Staff & Roles",
      href: "#",
      icon: <Shield className="h-4 w-4" />,
      badge: "Soon",
      disabled: true,
    },
    {
      label: "Settings",
      href: "#",
      icon: <Settings className="h-4 w-4" />,
      badge: "Soon",
      disabled: true,
    },
  ];

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between py-4">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-4 flex items-center justify-between">
          {!isCollapsed && <Logo size="sm" />}
          {isCollapsed && (
            <div className="mx-auto font-black text-[#B8FF3B] text-lg tracking-wider">
              FC
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1 px-2" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const isActive = isItemActive(item.href) && !item.disabled;

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold select-none text-[#94A3B8]/40 cursor-not-allowed"
                  title={`${item.label} (Coming Soon)`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1A232D] text-[#94A3B8] border border-[#27313D] shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8FF3B] ${
                  isActive
                    ? "bg-[#B8FF3B]/10 text-[#B8FF3B] border border-[#B8FF3B]/30 shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D]"
                }`}
                title={item.label}
              >
                <div className="shrink-0">{item.icon}</div>
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1A232D] text-[#94A3B8] border border-[#27313D] shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle for Desktop */}
      <div className="px-3 hidden lg:block">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#1A232D]/60 hover:bg-[#1A232D] text-[#94A3B8] hover:text-[#F8FAFC] text-xs transition border border-[#27313D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8FF3B]"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Trigger */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl bg-[#121922] border border-[#27313D] text-[#94A3B8] hover:text-[#F8FAFC] focus:outline-none shadow-lg focus-visible:ring-2 focus-visible:ring-[#B8FF3B]"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop & Pane */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-[#121922] border-r border-[#27313D] p-3 shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-4 border-b border-[#27313D]">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A232D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8FF3B]"
                aria-label="Close mobile navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navContent}</div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-[#27313D] bg-[#121922] shrink-0 sticky top-0 h-screen transition-all duration-300 z-30 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
