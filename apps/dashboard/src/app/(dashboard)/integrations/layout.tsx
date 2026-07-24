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

type TabGroup = "main" | "categories" | "tools";

interface IntegrationTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: TabGroup;
}

const INTEGRATION_TABS: IntegrationTab[] = [
  // Main tabs
  {
    href: "/integrations",
    label: "Health Center",
    icon: <Activity className="w-4 h-4" />,
    group: "main",
  },
  {
    href: "/integrations/catalog",
    label: "Catalog",
    icon: <ShoppingBag className="w-4 h-4" />,
    group: "main",
  },
  {
    href: "/integrations/connected",
    label: "Connected",
    icon: <Link2 className="w-4 h-4" />,
    group: "main",
  },
  // Category tabs
  {
    href: "/integrations/shipping",
    label: "Shipping",
    icon: <Truck className="w-4 h-4" />,
    group: "categories",
  },
  {
    href: "/integrations/payments",
    label: "Payments",
    icon: <CreditCard className="w-4 h-4" />,
    group: "categories",
  },
  {
    href: "/integrations/crm",
    label: "CRM",
    icon: <Users className="w-4 h-4" />,
    group: "categories",
  },
  {
    href: "/integrations/erp",
    label: "ERP",
    icon: <Building2 className="w-4 h-4" />,
    group: "categories",
  },
  {
    href: "/integrations/ecommerce",
    label: "eCommerce",
    icon: <ShoppingCart className="w-4 h-4" />,
    group: "categories",
  },
  {
    href: "/integrations/messaging",
    label: "Messaging",
    icon: <MessageSquare className="w-4 h-4" />,
    group: "categories",
  },
  // Tools tabs
  {
    href: "/integrations/providers",
    label: "Providers",
    icon: <Plug className="w-4 h-4" />,
    group: "tools",
  },
  {
    href: "/integrations/webhooks",
    label: "Webhooks",
    icon: <Webhook className="w-4 h-4" />,
    group: "tools",
  },
  {
    href: "/integrations/credentials",
    label: "Credentials",
    icon: <Key className="w-4 h-4" />,
    group: "tools",
  },
  {
    href: "/integrations/chaos",
    label: "Chaos Testing",
    icon: <Zap className="w-4 h-4" />,
    group: "tools",
  },
  {
    href: "/integrations/migration",
    label: "Migration",
    icon: <GitBranch className="w-4 h-4" />,
    group: "tools",
  },
  {
    href: "/integrations/docs",
    label: "Docs",
    icon: <BookOpen className="w-4 h-4" />,
    group: "tools",
  },
];

const GROUP_LABEL: Record<TabGroup, string> = {
  main: "Overview",
  categories: "By category",
  tools: "Tools",
};

function getBreadcrumbLabel(pathname: string): string {
  const match = pathname.match(/\/integrations\/([^/]+)/);
  if (!match) return "Integrations";

  const segment = match[1];
  const tabLabel = INTEGRATION_TABS.find((tab) =>
    tab.href.includes(segment),
  )?.label;

  return tabLabel || segment.charAt(0).toUpperCase() + segment.slice(1);
}

function isTabActive(tab: IntegrationTab, pathname: string): boolean {
  if (tab.href === "/integrations") {
    return pathname === "/integrations";
  }
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
}

interface TabLinkProps {
  tab: IntegrationTab;
  active: boolean;
}

function TabLink({ tab, active }: TabLinkProps) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors whitespace-nowrap text-sm font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-wl-bg-root rounded-t-sm",
        active
          ? "border-wl-primary-500 text-wl-primary-400"
          : "border-transparent text-wl-text-tertiary hover:text-wl-text-secondary",
      )}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );
}

interface TabGroupProps {
  group: TabGroup;
  tabs: IntegrationTab[];
  pathname: string;
}

function TabGroupSection({ group, tabs, pathname }: TabGroupProps) {
  return (
    <div
      className="flex items-center gap-1 shrink-0"
      role="group"
      aria-label={GROUP_LABEL[group]}
    >
      <span
        className="hidden md:inline-flex items-center px-2 text-[10px] font-semibold uppercase tracking-wider text-wl-text-tertiary select-none"
        aria-hidden="true"
      >
        {GROUP_LABEL[group]}
      </span>
      {tabs.map((tab) => (
        <TabLink key={tab.href} tab={tab} active={isTabActive(tab, pathname)} />
      ))}
    </div>
  );
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
      <Header title="Integrations" />

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
          <BreadcrumbItem isCurrentPage>{currentTab}</BreadcrumbItem>
        </Breadcrumb>

        {/* Tab Navigation — grouped, single accent */}
        <nav
          aria-label="Integrations sections"
          className="flex items-center gap-1 mb-8 border-b border-wl-border-subtle overflow-x-auto scrollbar-none"
        >
          <TabGroupSection group="main" tabs={mainTabs} pathname={pathname} />
          <div
            className="w-px h-5 bg-wl-border-subtle mx-1.5 shrink-0"
            aria-hidden="true"
          />
          <TabGroupSection
            group="categories"
            tabs={categoryTabs}
            pathname={pathname}
          />
          <div
            className="w-px h-5 bg-wl-border-subtle mx-1.5 shrink-0"
            aria-hidden="true"
          />
          <TabGroupSection group="tools" tabs={toolsTabs} pathname={pathname} />
        </nav>

        {/* Page Content */}
        {children}
      </div>
    </>
  );
}
