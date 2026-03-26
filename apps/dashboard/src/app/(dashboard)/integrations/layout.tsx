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
  Plug,
  Activity,
  Webhook,
  Key,
  Zap,
  GitBranch,
  BookOpen,
  ShoppingBag,
  Link2,
  Truck,
  CreditCard,
  Users,
  Building2,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";

interface IntegrationTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  group?: "main" | "categories" | "tools";
}

const INTEGRATION_TABS: IntegrationTab[] = [
  // Main tabs
  { href: "/integrations", label: "Health Center", icon: <Activity className="w-4 h-4" />, group: "main" },
  { href: "/integrations/catalog", label: "Catalog", icon: <ShoppingBag className="w-4 h-4" />, group: "main" },
  { href: "/integrations/connected", label: "Connected", icon: <Link2 className="w-4 h-4" />, group: "main" },
  // Category tabs
  { href: "/integrations/shipping", label: "Shipping", icon: <Truck className="w-4 h-4" />, group: "categories" },
  { href: "/integrations/payments", label: "Payments", icon: <CreditCard className="w-4 h-4" />, group: "categories" },
  { href: "/integrations/crm", label: "CRM", icon: <Users className="w-4 h-4" />, group: "categories" },
  { href: "/integrations/erp", label: "ERP", icon: <Building2 className="w-4 h-4" />, group: "categories" },
  { href: "/integrations/ecommerce", label: "eCommerce", icon: <ShoppingCart className="w-4 h-4" />, group: "categories" },
  { href: "/integrations/messaging", label: "Messaging", icon: <MessageSquare className="w-4 h-4" />, group: "categories" },
  // Tools tabs
  { href: "/integrations/providers", label: "Providers", icon: <Plug className="w-4 h-4" />, group: "tools" },
  { href: "/integrations/webhooks", label: "Webhooks", icon: <Webhook className="w-4 h-4" />, group: "tools" },
  { href: "/integrations/credentials", label: "Credentials", icon: <Key className="w-4 h-4" />, group: "tools" },
  { href: "/integrations/chaos", label: "Chaos Testing", icon: <Zap className="w-4 h-4" />, group: "tools" },
  { href: "/integrations/migration", label: "Migration", icon: <GitBranch className="w-4 h-4" />, group: "tools" },
  { href: "/integrations/docs", label: "Docs", icon: <BookOpen className="w-4 h-4" />, group: "tools" },
];

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

  const mainTabs = INTEGRATION_TABS.filter((t) => t.group === "main");
  const categoryTabs = INTEGRATION_TABS.filter((t) => t.group === "categories");
  const toolsTabs = INTEGRATION_TABS.filter((t) => t.group === "tools");

  return (
    <>
      <Header
        title="Integrations"
        subtitle="Manage your third-party integrations and connections"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
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

        {/* Tab Navigation — grouped */}
        <div className="flex items-center gap-1 mb-8 border-b border-white/[0.06] overflow-x-auto scrollbar-none">
          {/* Main */}
          {mainTabs.map((tab) => {
            const isActive =
              (tab.href === "/integrations" && pathname === "/integrations") ||
              (tab.href !== "/integrations" && (pathname === tab.href || pathname.startsWith(tab.href + "/")));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium",
                  isActive
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-white/35 hover:text-white/60"
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-white/[0.08] mx-1.5 shrink-0" />

          {/* Categories */}
          {categoryTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium",
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-white/35 hover:text-white/60"
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-white/[0.08] mx-1.5 shrink-0" />

          {/* Tools */}
          {toolsTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium",
                  isActive
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-white/35 hover:text-white/60"
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
