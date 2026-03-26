"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: "/fleet", exact: true },
    { label: "Vehicles", href: "/fleet/vehicles" },
    { label: "Maintenance", href: "/fleet/maintenance" },
    { label: "Fuel", href: "/fleet/fuel" },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-wl-border-subtle sticky top-0 z-40 bg-wl-bg-base">
        <div className="px-6 flex gap-0">
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                  isActive
                    ? "border-wl-primary-500 text-wl-primary-500"
                    : "border-transparent text-wl-text-secondary hover:text-wl-text-primary"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
