"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ShippingLayoutProps {
  children: ReactNode;
}

export default function ShippingLayout({ children }: ShippingLayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { name: "Labels", href: "/shipping/labels", id: "labels" },
    { name: "Tracking", href: "/shipping/tracking", id: "tracking" },
    { name: "Rates", href: "/shipping/rates", id: "rates" },
    { name: "Settings", href: "/shipping/settings", id: "settings" },
  ];

  const activeTab = tabs.find((tab) => pathname.includes(tab.id))?.id || "labels";

  return (
    <div className={cn("w-full h-full flex flex-col", "bg-wl-bg-root")}>
      {/* Tab Navigation */}
      <div
        className={cn(
          "border-b border-wl-border-default",
          "bg-wl-bg-elevated",
          "px-6 py-0"
        )}
      >
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "px-0 py-4 text-sm font-medium",
                "border-b-2 transition-colors duration-fast ease-default",
                activeTab === tab.id
                  ? "border-wl-primary-500 text-wl-text-primary"
                  : "border-transparent text-wl-text-secondary hover:text-wl-text-primary"
              )}
            >
              {tab.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto", "bg-wl-bg-root")}>
        {children}
      </div>
    </div>
  );
}
