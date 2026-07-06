"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LoadingSkeleton,
  TableSkeleton,
} from "@/components/ui/loading-skeleton";
import { useApiList, useApiQuery } from "@/hooks/use-api";
import {
  BarChart3,
  Users,
  ShoppingCart,
  TrendingUp,
  Search,
  MoreVertical,
  ActivitySquare,
  Server,
  Database,
  Zap,
  CheckCircle2,
  Plus,
  ShieldCheck,
} from "lucide-react";

// Types
interface Store {
  id: string;
  name: string;
  domain: string;
  planTier: "free" | "starter" | "growth" | "enterprise";
  owner: string;
  ordersThisMonth: number;
  revenue: number;
  status: "active" | "suspended" | "trial";
  lastActive: string;
  totalUsers: number;
}

interface SystemService {
  name: string;
  status: "healthy" | "degraded" | "critical";
  uptime24h: number;
  responseTime: number;
}

interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  uptimeSeconds: number;
}

interface SystemData {
  data: {
    services: SystemService[];
    metrics: SystemMetrics;
  };
}

// Plan → Badge variant
const getPlanVariant = (
  plan: string,
): "default" | "info" | "warning" | "success" | "primary" => {
  switch (plan) {
    case "free":
      return "default";
    case "starter":
      return "info";
    case "growth":
      return "warning";
    case "enterprise":
      return "success";
    default:
      return "primary";
  }
};

// Key Metrics Cards — colours use WL design tokens + Tailwind semantic classes
const MetricsBar = ({ stores }: { stores: Store[] }) => {
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === "active").length;
  const totalOrders = stores.reduce((sum, s) => sum + s.ordersThisMonth, 0);
  const totalRevenue = stores.reduce((sum, s) => sum + s.revenue, 0);
  const activeSubscriptions = stores.filter(
    (s) => s.planTier !== "free",
  ).length;

  const metrics = [
    {
      label: "Total Stores",
      value: totalStores.toString(),
      icon: ShoppingCart,
      iconClass: "text-indigo-400",
      bgClass: "bg-indigo-400/10",
    },
    {
      label: "Active Stores",
      value: activeStores.toString(),
      icon: CheckCircle2,
      iconClass: "text-wl-success-500",
      bgClass: "bg-wl-success-500/10",
    },
    {
      label: "Orders (30d)",
      value: totalOrders.toLocaleString(),
      icon: BarChart3,
      iconClass: "text-wl-warning-500",
      bgClass: "bg-wl-warning-500/10",
    },
    {
      label: "Revenue",
      value: `$${(totalRevenue / 1000).toFixed(0)}K`,
      icon: TrendingUp,
      iconClass: "text-violet-400",
      bgClass: "bg-violet-400/10",
    },
    {
      label: "Paid Plans",
      value: activeSubscriptions.toString(),
      icon: Zap,
      iconClass: "text-wl-info-500",
      bgClass: "bg-wl-info-500/10",
    },
  ];

  return (
    <div className="grid gap-4 mb-6 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <Card
            key={idx}
            className="bg-wl-bg-surface border border-wl-border-default"
            style={{ animation: `fadeInUp 0.4s ease-out ${idx * 50}ms both` }}
          >
            <CardContent className="p-4 flex gap-3 items-start">
              <div
                className={cn(
                  "p-2 rounded-md flex items-center justify-center flex-shrink-0",
                  metric.bgClass,
                )}
              >
                <Icon className={cn("w-5 h-5", metric.iconClass)} />
              </div>
              <div className="flex-1">
                <p className="text-wl-text-tertiary text-xs font-semibold m-0 uppercase tracking-wider">
                  {metric.label}
                </p>
                <p className="text-wl-text-primary text-lg font-bold m-0 mt-1">
                  {metric.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// System Health — wired to real GET /api/v4/admin/system
const SystemHealth = () => {
  const { data, loading } = useApiQuery<SystemData>("/api/v4/admin/system");

  if (loading) {
    return (
      <Card className="bg-wl-bg-surface border border-wl-border-default mb-6 animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 bg-wl-bg-elevated rounded w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-md bg-wl-bg-elevated flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-wl-bg-elevated rounded w-1/2" />
                  <div className="h-4 bg-wl-bg-elevated rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const services = data?.data?.services ?? [];
  const sys = data?.data?.metrics;

  const displayItems = [
    ...services.map((s) => ({
      label: s.name,
      value:
        s.status === "healthy"
          ? `${s.uptime24h}% uptime (${s.responseTime}ms)`
          : s.status,
      status:
        s.status === "healthy" ? ("healthy" as const) : ("warning" as const),
      icon:
        s.name === "PostgreSQL"
          ? Database
          : s.name === "Redis Cache"
            ? Zap
            : Server,
    })),
    ...(sys
      ? [
          {
            label: "Memory",
            value: `${sys.memoryUsage}% used`,
            status:
              sys.memoryUsage > 90
                ? ("warning" as const)
                : ("healthy" as const),
            icon: ActivitySquare,
          },
        ]
      : []),
  ];

  return (
    <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5 text-wl-text-tertiary" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {displayItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex gap-3 items-start">
                <div
                  className={cn(
                    "p-2 rounded-md flex items-center justify-center flex-shrink-0",
                    item.status === "healthy"
                      ? "bg-wl-success-500/10"
                      : "bg-wl-warning-500/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px]",
                      item.status === "healthy"
                        ? "text-wl-success-500"
                        : "text-wl-warning-500",
                    )}
                  />
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary m-0 mb-0.5 font-semibold uppercase">
                    {item.label}
                  </p>
                  <p className="text-wl-text-primary font-semibold m-0 text-sm">
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Actions
const QuickActions = () => {
  return (
    <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-wl-text-tertiary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 flex-wrap">
          <Button variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Store
          </Button>
          <Link href="/admin/users">
            <Button variant="secondary" size="sm">
              <Users className="w-3.5 h-3.5 mr-1" />
              Manage Users
            </Button>
          </Link>
          <Link href="/activity">
            <Button variant="secondary" size="sm">
              <ActivitySquare className="w-3.5 h-3.5 mr-1" />
              View Logs
            </Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="secondary" size="sm">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Audit Trail
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Stores Table
const StoresHealthTable = ({
  stores,
  loading,
  error,
  onRetry,
}: {
  stores: Store[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStores = useMemo(
    () =>
      stores.filter(
        (store) =>
          store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.owner.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [stores, searchTerm],
  );

  if (loading) return <TableSkeleton rows={5} columns={8} className="mb-6" />;
  if (error)
    return (
      <Card className="bg-wl-bg-surface border border-wl-border-default mb-6 p-6 text-center">
        <p className="text-wl-text-tertiary text-sm mb-3">{error.message}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </Card>
    );

  return (
    <Card className="bg-wl-bg-surface border border-wl-border-default">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Store Health</CardTitle>
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-8 bg-wl-bg-elevated text-wl-text-primary border border-wl-border-default rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-wl-border-default bg-wl-bg-root">
                {[
                  "Store",
                  "Plan",
                  "Orders (30d)",
                  "Revenue",
                  "Users",
                  "Status",
                  "Last Active",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    className="p-3 text-left text-wl-text-tertiary font-semibold text-xs uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store, idx) => (
                <tr
                  key={store.id}
                  className={cn(
                    "border-b border-wl-border-default transition-all duration-200 hover:bg-wl-bg-elevated",
                    idx % 2 === 0 ? "bg-wl-bg-root" : "bg-wl-bg-surface",
                  )}
                >
                  <td className="p-3">
                    <Link
                      href={`/admin/shops/${store.id}`}
                      className="text-wl-info-400 no-underline font-medium hover:underline"
                    >
                      {store.name}
                    </Link>
                    <p className="text-wl-text-tertiary m-0 mt-0.5 text-xs">
                      {store.domain}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={getPlanVariant(store.planTier)}
                      className="text-xs capitalize"
                    >
                      {store.planTier}
                    </Badge>
                  </td>
                  <td className="p-3 text-wl-text-primary font-medium">
                    {store.ordersThisMonth}
                  </td>
                  <td className="p-3 text-wl-info-400 font-semibold">
                    ${store.revenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-wl-text-primary font-medium">
                    {store.totalUsers}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        store.status === "active"
                          ? "success"
                          : store.status === "suspended"
                            ? "danger"
                            : "info"
                      }
                      className="text-xs capitalize"
                    >
                      {store.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-wl-text-tertiary text-xs">
                    {store.lastActive}
                  </td>
                  <td className="p-3 text-center">
                    <button className="bg-transparent border-0 text-wl-text-tertiary cursor-pointer p-1 inline-flex items-center justify-center transition-all duration-200 hover:text-wl-text-primary">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Page
export default function AdminDashboardPage() {
  const {
    items: stores,
    loading,
    error,
    refetch,
  } = useApiList<Store>("/api/v4/shops");

  if (loading && stores.length === 0) return <LoadingSkeleton />;

  return (
    <div className="bg-wl-bg-root min-h-screen">
      <Header
        title="Platform Admin"
        subtitle="Manage all stores, users, and platform operations"
      />

      <main className="flex-1 p-6 max-w-6xl mx-auto">
        <MetricsBar stores={stores} />
        <SystemHealth />
        <QuickActions />
        <StoresHealthTable
          stores={stores}
          loading={loading}
          error={error}
          onRetry={refetch}
        />
      </main>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
