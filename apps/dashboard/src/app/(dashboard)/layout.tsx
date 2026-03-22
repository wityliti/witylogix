"use client";

import { ReactNode, useState, Suspense } from "react";
import { cn } from "@/lib/utils";
import { NavSidebar } from "@/components/navigation/sidebar";
import { Breadcrumb } from "@/components/navigation/breadcrumb";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("flex min-h-screen wl-dashboard-bg")}>
      {/* Sidebar */}
      <NavSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 min-h-screen",
          "flex flex-col"
        )}
        style={{
          marginLeft: collapsed ? "var(--wl-sidebar-collapsed)" : "var(--wl-sidebar-width)",
          transition: `margin-left var(--wl-duration-base) var(--wl-ease-default)`,
        }}
      >
        {/* Top Bar */}
        <header
          className={cn(
            "bg-[#0f0f14]/90 backdrop-blur-md border-b border-white/[0.06]",
            "h-[var(--wl-header-height)]",
            "flex items-center justify-between",
            "px-6",
            "sticky top-0 z-40",
            "shadow-[0_1px_0_0_rgba(255,255,255,0.04)]"
          )}
        >
          <Breadcrumb />

          {/* Right side - User menu placeholder */}
          <div className="flex items-center gap-4">
            <button
              className={cn(
                "p-2 rounded-md",
                "text-wl-text-secondary hover:text-wl-text-primary",
                "hover:bg-wl-bg-overlay",
                "transition-colors duration-fast ease-default"
              )}
              title="Notifications"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>

            <button
              className={cn(
                "p-2 rounded-md",
                "text-wl-text-secondary hover:text-wl-text-primary",
                "hover:bg-wl-bg-overlay",
                "transition-colors duration-fast ease-default"
              )}
              title="User menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className={cn("flex-1 overflow-y-auto")}>
          <Suspense fallback={<div className="p-6">Loading...</div>}>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
