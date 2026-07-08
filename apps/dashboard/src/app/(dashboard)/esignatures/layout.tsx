"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/page-header";

interface ESignaturesLayoutProps {
  children: ReactNode;
}

export default function ESignaturesLayout({
  children,
}: ESignaturesLayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/\(dashboard\)/esignatures", label: "Overview" },
    { href: "/\(dashboard\)/esignatures/envelopes", label: "Envelopes" },
    { href: "/\(dashboard\)/esignatures/templates", label: "Templates" },
  ];

  return (
    <div className={cn("flex-1 flex flex-col min-h-screen")}>
      <PageHeader
        title="E-Signatures"
        subtitle="Manage digital document signing and envelopes"
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
