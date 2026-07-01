"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * POS Layout with Tab Navigation
 */

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: "/dashboard/pos", icon: "📊" },
    { label: "Transactions", href: "/dashboard/pos/transactions", icon: "📋" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard/pos") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Tab Navigation */}
      <div className="border-b border-wl-border-default bg-wl-bg-surface">
        <div className="flex items-center gap-1 px-6 pt-4">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2",
                isActive(tab.href)
                  ? "border-wl-primary-500 text-wl-primary-400"
                  : "border-transparent text-wl-text-secondary hover:text-wl-text-primary hover:border-wl-border-strong"
              )}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Page Content */}
      {children}
    </>
  );
}
