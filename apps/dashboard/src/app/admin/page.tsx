"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Users,
  ShoppingCart,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  ActivitySquare,
  Server,
  Database,
  Zap,
  AlertCircle,
  CheckCircle2,
  Plus,
  Eye,
  LogOut,
  TrendingDown,
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

// Mock stores data
const mockStores: Store[] = [
  {
    id: "store-001",
    name: "Elegant Boutique",
    domain: "elegantboutique.com",
    planTier: "enterprise",
    owner: "Sarah Anderson",
    ordersThisMonth: 450,
    revenue: 145000,
    status: "active",
    lastActive: "2026-03-07 14:32:10",
    totalUsers: 12,
  },
  {
    id: "store-002",
    name: "Tech Gadgets Hub",
    domain: "techgadgetshub.com",
    planTier: "growth",
    owner: "Michael Chen",
    ordersThisMonth: 215,
    revenue: 87500,
    status: "active",
    lastActive: "2026-03-07 13:15:42",
    totalUsers: 5,
  },
  {
    id: "store-003",
    name: "Organic Wellness",
    domain: "organicwellness.io",
    planTier: "starter",
    owner: "Emma Rodriguez",
    ordersThisMonth: 85,
    revenue: 28900,
    status: "trial",
    lastActive: "2026-03-07 11:20:15",
    totalUsers: 2,
  },
  {
    id: "store-004",
    name: "Fashion Forward",
    domain: "fashionforward.store",
    planTier: "enterprise",
    owner: "James Mitchell",
    ordersThisMonth: 523,
    revenue: 210000,
    status: "active",
    lastActive: "2026-03-07 15:45:30",
    totalUsers: 15,
  },
  {
    id: "store-005",
    name: "Sports Paradise",
    domain: "sportsparadise.net",
    planTier: "growth",
    owner: "Lisa Thompson",
    ordersThisMonth: 178,
    revenue: 65000,
    status: "suspended",
    lastActive: "2026-03-05 09:12:22",
    totalUsers: 4,
  },
  {
    id: "store-006",
    name: "Home & Garden",
    domain: "homeandgarden.co",
    planTier: "starter",
    owner: "David Kim",
    ordersThisMonth: 42,
    revenue: 15600,
    status: "active",
    lastActive: "2026-03-07 12:30:45",
    totalUsers: 1,
  },
  {
    id: "store-007",
    name: "Artisan Crafts",
    domain: "artisancrafts.shop",
    planTier: "free",
    owner: "Nina Patel",
    ordersThisMonth: 14,
    revenue: 4200,
    status: "active",
    lastActive: "2026-03-06 10:15:20",
    totalUsers: 1,
  },
  {
    id: "store-008",
    name: "Beauty & Cosmetics",
    domain: "beautycosmetics.com",
    planTier: "growth",
    owner: "Victoria Hayes",
    ordersThisMonth: 342,
    revenue: 112300,
    status: "active",
    lastActive: "2026-03-07 14:50:15",
    totalUsers: 6,
  },
];

// Helper functions
const getPlanColor = (plan: string): string => {
  switch (plan) {
    case "free":
      return "#94a3b8";
    case "starter":
      return "#3b82f6";
    case "growth":
      return "#8b5cf6";
    case "enterprise":
      return "#ec4899";
    default:
      return "#6366f1";
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "active":
      return "#10b981";
    case "suspended":
      return "#ef4444";
    case "trial":
      return "#f59e0b";
    default:
      return "#6b7280";
  }
};

// Key Metrics Cards
const MetricsBar = ({ stores }: { stores: Store[] }) => {
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === "active").length;
  const totalOrders = stores.reduce((sum, s) => sum + s.ordersThisMonth, 0);
  const totalRevenue = stores.reduce((sum, s) => sum + s.revenue, 0);
  const activeSubscriptions = stores.filter((s) => s.planTier !== "free").length;

  return (
    <div
      className="grid gap-4 mb-6 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
    >

      {[
        { label: "Total Stores", value: totalStores.toString(), icon: ShoppingCart, color: "#6366f1" },
        { label: "Active Stores", value: activeStores.toString(), icon: CheckCircle2, color: "#10b981" },
        { label: "Orders (30d)", value: totalOrders.toLocaleString(), icon: BarChart3, color: "#f59e0b" },
        { label: "Revenue", value: `$${(totalRevenue / 1000).toFixed(0)}K`, icon: TrendingUp, color: "#8b5cf6" },
        { label: "Paid Plans", value: activeSubscriptions.toString(), icon: Zap, color: "#3b82f6" },
      ].map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <Card
            key={idx}
            className="bg-wl-bg-surface border-wl-border-subtle"
            style={{
              animation: `fadeInUp 0.4s ease-out ${idx * 50}ms both`,
            }}
          >

            <CardContent className="p-4 flex gap-3 items-start">
              <div
                className="p-2 rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: metric.color + "15",
                }}
              >

                <Icon style={{ color: metric.color, width: "20px", height: "20px" }} />
              </div>
              <div className="flex-1">
                <p className="text-wl-text-secondary text-xs font-semibold m-0 uppercase tracking-wider">
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

// System Health Section
const SystemHealth = () => {
  const metrics = [
    { label: "API Uptime", value: "99.98%", status: "healthy", icon: Server },
    { label: "DB Connections", value: "245 / 500", status: "healthy", icon: Database },
    { label: "Queue Depth", value: "1,234 jobs", status: "warning", icon: ActivitySquare },
    { label: "Cache Hit Rate", value: "94.2%", status: "healthy", icon: Zap },
  ];

  return (
    <Card
      className="bg-wl-bg-surface border-wl-border-subtle mb-6"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Server style={{ width: "20px", height: "20px", color: "var(--wl-text-secondary)" }} />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"
        >

          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div key={idx} className="flex gap-3 items-start">
                <div
                  className="p-2 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: metric.status === "healthy" ? "#10b98115" : "#f59e0b15",
                  }}
                >

                  <Icon style={{ color: metric.status === "healthy" ? "#10b981" : "#f59e0b", width: "18px", height: "18px" }} />
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary m-0 mb-0.5 font-semibold uppercase">
                    {metric.label}
                  </p>
                  <p className="text-wl-text-primary font-semibold m-0 text-sm">
                    {metric.value}
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
    <Card
      className="bg-wl-bg-surface border-wl-border-subtle mb-6"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap style={{ width: "20px", height: "20px", color: "var(--wl-text-secondary)" }} />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 flex-wrap">
          <Button variant="primary" size="sm">
            <Plus style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Create Store
          </Button>
          <Link href="/admin/users">
            <Button variant="secondary" size="sm">
              <Users style={{ width: "14px", height: "14px", marginRight: "4px" }} />
              Manage Users
            </Button>
          </Link>
          <Link href="/activity">
            <Button variant="secondary" size="sm">
              <ActivitySquare style={{ width: "14px", height: "14px", marginRight: "4px" }} />
              View Logs
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            <TrendingUp style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Stores Table
const StoresHealthTable = ({ stores }: { stores: Store[] }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStores = useMemo(() => {
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stores, searchTerm]);

  return (
    <Card
      className="bg-wl-bg-surface border-wl-border-subtle"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Store Health</CardTitle>
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-8 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
          >
            <thead>
              <tr className="border-b border-wl-border-subtle bg-wl-bg-base">
                {["Store", "Plan", "Orders (30d)", "Revenue", "Users", "Status", "Last Active", "Actions"].map((header) => (
                  <th
                    key={header}
                    className="p-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wider"
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
                  className="border-b border-wl-border-subtle transition-all duration-200"
                  style={{
                    backgroundColor: idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--wl-bg-surface)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)";
                  }}
                >

                  <td className="p-3">
                    <Link
                      href={`/admin/shops/${store.id}`}
                      className="text-wl-brand-primary no-underline font-medium"
                    >
                      {store.name}
                    </Link>
                    <p className="text-wl-text-secondary m-0 mt-0.5 text-xs">
                      {store.domain}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: getPlanColor(store.planTier) + "20",
                        color: getPlanColor(store.planTier),
                        fontSize: "var(--wl-text-xs)",
                        border: `1px solid ${getPlanColor(store.planTier)}40`,
                      }}
                    >

                      {store.planTier.charAt(0).toUpperCase() + store.planTier.slice(1)}
                    </Badge>
                  </td>
                  <td className="p-3 text-wl-text-primary font-medium">
                    {store.ordersThisMonth}
                  </td>
                  <td className="p-3 text-wl-brand-primary font-semibold">
                    ${store.revenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-wl-text-primary font-medium">
                    {store.totalUsers}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={store.status === "active" ? "success" : store.status === "suspended" ? "danger" : "info"}
                      className="text-xs capitalize"
                    >
                      {store.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-wl-text-secondary text-xs">
                    {store.lastActive}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      className="bg-transparent border-0 text-wl-text-secondary cursor-pointer p-1 inline-flex items-center justify-center transition-all duration-200 hover:text-wl-text-primary"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-secondary)";
                      }}
                    >

                      <MoreVertical style={{ width: "16px", height: "16px" }} />
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
  return (
    <div className="bg-wl-bg-base">
      <Header
        title="Platform Admin"
        subtitle="Manage all stores, users, and platform operations"
      />

      <main className="flex-1 p-6 max-w-6xl mx-auto">
        {/* Key Metrics */}
        <MetricsBar stores={mockStores} />

        {/* System Health */}
        <SystemHealth />

        {/* Quick Actions */}
        <QuickActions />

        {/* Stores Health Table */}
        <StoresHealthTable stores={mockStores} />
      </main>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
