/**
 * Finance Section Layout — Shared layout for all finance pages
 */

"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface FinanceLayoutProps {
  children: ReactNode;
}

export default function FinanceLayout({ children }: FinanceLayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/finance", label: "Dashboard" },
    { href: "/finance/invoices", label: "Invoices" },
    { href: "/finance/reconciliation", label: "Reconciliation" },
    { href: "/finance/cod", label: "COD Reconciliation" },
  ];

  const isActive = (href: string) => {
    if (href === "/finance") {
      return pathname === "/finance" || pathname === "/(dashboard)/finance";
    }
    return pathname.includes(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wl-bg-primary to-wl-bg-secondary">
      {/* Tab Navigation */}
      <div className="sticky top-[var(--wl-header-height)] z-30 bg-wl-bg-elevated border-b border-wl-border-subtle">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-4 py-4 text-sm font-medium border-b-2 transition-colors duration-fast",
                  isActive(tab.href)
                    ? "border-wl-primary-400 text-wl-primary-400"
                    : "border-transparent text-wl-text-secondary hover:text-wl-text-primary",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
