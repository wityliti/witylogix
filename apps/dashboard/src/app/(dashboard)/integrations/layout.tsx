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
  Activity,
  Webhook,
  Key,
  Zap,
  GitBranch,
  BookOpen,
} from "lucide-react";

interface IntegrationTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const INTEGRATION_TABS: IntegrationTab[] = [
  {
    href: "/integrations",
    label: "Health Center",
    icon: <Activity className="w-4 h-4" />,
    description: "Overall health and status",
  },
  {
    href: "/integrations/providers",
    label: "Providers",
    icon: <Plug className="w-4 h-4" />,
    description: "Provider metrics and configuration",
  },
  {
    href: "/integrations/webhooks",
    label: "Webhooks",
    icon: <Webhook className="w-4 h-4" />,
    description: "Webhook monitoring and DLQ",
  },
  {
    href: "/integrations/credentials",
    label: "Credentials",
    icon: <Key className="w-4 h-4" />,
    description: "Credential management and rotation",
  },
  {
    href: "/integrations/chaos",
    label: "Chaos Testing",
    icon: <Zap className="w-4 h-4" />,
    description: "Failure injection testing",
  },
  {
    href: "/integrations/migration",
    label: "Migration",
    icon: <GitBranch className="w-4 h-4" />,
    description: "Provider migration tools",
  },
  {
    href: "/integrations/docs",
    label: "Docs",
    icon: <BookOpen className="w-4 h-4" />,
    description: "API documentation",
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
