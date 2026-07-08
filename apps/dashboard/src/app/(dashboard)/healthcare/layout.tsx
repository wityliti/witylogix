"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/page-header";

interface HealthcareLayoutProps {
  children: ReactNode;
}

export default function HealthcareLayout({ children }: HealthcareLayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/\(dashboard\)/healthcare", label: "Overview" },
    { href: "/\(dashboard\)/healthcare/patients", label: "Patients" },
    { href: "/\(dashboard\)/healthcare/records", label: "Records" },
  ];

  return (
    <div className={cn("flex-1 flex flex-col min-h-screen")}>
      <PageHeader
        title="Healthcare"
        subtitle="Patient management and clinical records"
      />

      {/* Tab Navigation */}
      <div className={cn("border-b border-wl-border-subtle bg-wl-bg-elevated")}>
        <div className={cn("px-6")}>
          <nav className={cn("flex gap-8")}>
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "py-4 px-0 text-sm font-medium",
                  "border-b-2 transition-colors",
                  pathname === tab.href
                    ? "border-wl-border-active text-wl-text-primary"
                    : "border-transparent text-wl-text-secondary hover:text-wl-text-primary hover:border-wl-border-hover",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto")}>{children}</div>
    </div>
  );
}
