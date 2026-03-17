"use client";

import { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   FREIGHT SECTION LAYOUT — Tab navigation wrapper
   ═══════════════════════════════════════════════════════════ */

interface FreightLayoutProps {
  children: ReactNode;
}

const FREIGHT_TABS = [
  { href: "/freight", label: "Overview", icon: "📊" },
  { href: "/freight/loads", label: "Loads", icon: "📦" },
  { href: "/freight/rates", label: "Rates", icon: "💰" },
  { href: "/freight/compliance", label: "Compliance", icon: "✓" },
];

export default function FreightLayout({ children }: FreightLayoutProps) {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/freight";
  const isActive = (href: string) => {
    if (href === "/freight") return currentPath === "/freight";
    return currentPath.startsWith(href);
  };

  return (
    <>
      <Header
        title="Freight Management"
        subtitle="Manage loads, rates, and carrier compliance"
      />

      {/* Tab Navigation */}
      <div className="sticky top-0 z-40 bg-wl-bg-surface border-b border-wl-border-default">
        <div className="flex gap-0">
          {FREIGHT_TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all",
                isActive(tab.href)
                  ? "border-wl-primary-500 text-wl-primary-500"
                  : "border-transparent text-wl-text-secondary hover:text-wl-text-primary"
              )}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {children}
    </>
  );
}
