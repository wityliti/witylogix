"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Gauge, Clock, CheckSquare } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ELD LAYOUT — Tab navigation for Overview, HOS, DVIR
   ═══════════════════════════════════════════════════════════ */

export default function ELDLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/eld",
      label: "Overview",
      icon: <Gauge className="w-4 h-4" />,
      description: "Fleet-wide ELD status",
    },
    {
      href: "/eld/hos",
      label: "HOS",
      icon: <Clock className="w-4 h-4" />,
      description: "Hours of Service per driver",
    },
    {
      href: "/eld/dvir",
      label: "DVIR",
      icon: <CheckSquare className="w-4 h-4" />,
      description: "Vehicle inspections",
    },
  ];

  const getActiveTab = () => {
    if (pathname.includes("/hos")) return "/eld/hos";
    if (pathname.includes("/dvir")) return "/eld/dvir";
    return "/eld";
  };

  return (
    <div className="flex flex-col gap-6 min-h-screen bg-wl-bg-sunken">
      {/* Header */}
      <Header title="Electronic Logging Device" />

      {/* Tab navigation */}
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-4 border-b border-wl-border-default pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-wl-text-primary">Electronic Logging Device</h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Fleet compliance monitoring and hours of service tracking
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "px-4 py-3 rounded-lg transition-all flex items-center gap-2",
                    "text-sm font-medium border",
                    isActive
                      ? "bg-wl-primary-500/10 border-wl-primary-500/30 text-wl-primary-400"
                      : "border-wl-border-default text-wl-text-secondary hover:bg-wl-bg-elevated hover:text-wl-text-primary"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
