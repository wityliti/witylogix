'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
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
} from 'lucide-react';

// Types
interface Store {
  id: string;
  name: string;
  domain: string;
  planTier: 'free' | 'starter' | 'growth' | 'enterprise';
  owner: string;
  ordersThisMonth: number;
  revenue: number;
  status: 'active' | 'suspended' | 'trial';
  lastActive: string;
  totalUsers: number;
}

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
    <div className="grid gap-4 mb-6 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
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
            className="bg-[#12121a] border border-[#1e1e2e]"
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
                <p className="text-gray-400 text-xs font-semibold m-0 uppercase tracking-wider">
                  {metric.label}
                </p>
                <p className="text-white text-lg font-bold m-0 mt-1">
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
    <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-400" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div key={idx} className="flex gap-3 items-start">
                <div
                  className={cn(
                    "p-2 rounded-md flex items-center justify-center flex-shrink-0",
                    metric.status === "healthy" ? "bg-[#10b98115]" : "bg-[#f59e0b15]"
                  )}
                >
                  <Icon style={{ color: metric.status === "healthy" ? "#10b981" : "#f59e0b", width: "18px", height: "18px" }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 m-0 mb-0.5 font-semibold uppercase">
                    {metric.label}
                  </p>
                  <p className="text-white font-semibold m-0 text-sm">
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
    <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-gray-400" />
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
const StoresHealthTable = ({ stores, loading, error, onRetry }: { stores: Store[]; loading: boolean; error: Error | null; onRetry: () => void }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStores = useMemo(() => {
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stores, searchTerm]);

  if (loading) return <TableSkeleton rows={5} columns={8} className="mb-6" />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;

  return (
    <Card className="bg-[#12121a] border border-[#1e1e2e]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Store Health</CardTitle>
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-8 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e] bg-[#0a0a0f]">
                {['Store', 'Plan', 'Orders (30d)', 'Revenue', 'Users', 'Status', 'Last Active', 'Actions'].map((header) => (
                  <th
                    key={header}
                    className="p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider"
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
                  className={cn('border-b border-[#1e1e2e] transition-all duration-200 hover:bg-[#1a1a2e]', {
                    'bg-[#0a0a0f]': idx % 2 === 0,
                    'bg-[#12121a]': idx % 2 !== 0,
                  })}
                >
                  <td className="p-3">
                    <Link
                      href={`/admin/shops/${store.id}`}
                      className="text-blue-500 no-underline font-medium"
                    >
                      {store.name}
                    </Link>
                    <p className="text-gray-400 m-0 mt-0.5 text-xs">
                      {store.domain}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: getPlanColor(store.planTier) + '20',
                        color: getPlanColor(store.planTier),
                        fontSize: '0.75rem',
                        border: `1px solid ${getPlanColor(store.planTier)}40`,
                      }}
                    >
                      {store.planTier.charAt(0).toUpperCase() + store.planTier.slice(1)}
                    </Badge>
                  </td>
                  <td className="p-3 text-white font-medium">
                    {store.ordersThisMonth}
                  </td>
                  <td className="p-3 text-blue-500 font-semibold">
                    ${store.revenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-white font-medium">
                    {store.totalUsers}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={store.status === 'active' ? 'success' : store.status === 'suspended' ? 'danger' : 'info'}
                      className="text-xs capitalize"
                    >
                      {store.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">
                    {store.lastActive}
                  </td>
                  <td className="p-3 text-center">
                    <button className="bg-transparent border-0 text-gray-400 cursor-pointer p-1 inline-flex items-center justify-center transition-all duration-200 hover:text-white">
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
  const { items: stores, loading, error, refetch } = useApiList<Store>('/api/v4/shops');

  if (loading && stores.length === 0) return <LoadingSkeleton />;

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <Header
        title="Platform Admin"
        subtitle="Manage all stores, users, and platform operations"
      />

      <main className="flex-1 p-6 max-w-6xl mx-auto">
        {/* Key Metrics */}
        <MetricsBar stores={stores} />

        {/* System Health */}
        <SystemHealth />

        {/* Quick Actions */}
        <QuickActions />

        {/* Stores Health Table */}
        <StoresHealthTable stores={stores} loading={loading} error={error} onRetry={refetch} />
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
