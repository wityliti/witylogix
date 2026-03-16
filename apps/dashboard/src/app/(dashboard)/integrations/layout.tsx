"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ShoppingBag,
  Plug,
  FileText,
} from "lucide-react";

interface IntegrationTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const INTEGRATION_TABS: IntegrationTab[] = [
  {
    href: "/integrations/overview",
    label: "Marketplace",
    icon: <ShoppingBag className="w-4 h-4" />,
    description: "Browse and connect integrations",
  },
  {
    href: "/integrations/connected",
    label: "Connected",
    icon: <Plug className="w-4 h-4" />,
    description: "Manage active connections",
  },
  {
    href: "/integrations/logs",
    label: "Logs",
    icon: <FileText className="w-4 h-4" />,
    description: "View integration activity",
  },
];

/**
 * Get breadcrumb segment label
 */
function getBreadcrumbLabel(pathname: string): string {
  const match = pathname.match(/\/integrations\/([^\/]+)/);
  if (!match) return "Integrations";

  const segment = match[1];
  const tabLabel = INTEGRATION_TABS.find((tab) =>
    tab.href.includes(segment)
  )?.label;

  return tabLabel || segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentTab = getBreadcrumbLabel(pathname);

  return (
    <>
      <Header
        title="Integrations"
        subtitle="Manage your third-party integrations and connections"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-8">
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/integrations">Integrations</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem isCurrentPage>
            {currentTab}
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-wl-neutral-700 overflow-x-auto">
          {INTEGRATION_TABS.map((tab) => {
            const isActive =
              pathname === tab.href ||
              pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap text-sm font-medium",
                  isActive
                    ? "border-wl-primary-500 text-wl-primary-400"
                    : "border-transparent text-wl-text-secondary hover:text-wl-text-primary"
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Page Content */}
        {children}
      </div>
    </>
  );
}
