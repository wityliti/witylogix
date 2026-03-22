'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import {
  LogIn,
  ShoppingCart,
  Route,
  Settings,
  LogOut,
  Lock,
  FileText,
  Download,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  type: 'login' | 'order_created' | 'route_planned' | 'setting_changed' | 'logout' | 'permission_changed' | 'export' | 'payment';
  action: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const mockActivities: ActivityLog[] = [
  {
    id: "act-001",
    userId: "user-001",
    userName: "Sarah Johnson",
    userEmail: "sarah.johnson@company.com",
    userAvatar: "SJ",
    type: "login",
    action: "Logged in from 192.168.1.45",
    timestamp: "2026-03-12 14:35:22",
    metadata: { ipAddress: "192.168.1.45", device: "Chrome 124 on macOS" },
  },
  {
    id: "act-002",
    userId: "user-002",
    userName: "Michael Chen",
    userEmail: "michael.chen@company.com",
    userAvatar: "MC",
    type: "order_created",
    action: "Created order #ORD-2026-8945",
    timestamp: "2026-03-12 14:32:10",
    metadata: { orderId: "ORD-2026-8945", totalAmount: "$2,450.00", items: 8 },
  },
  {
    id: "act-003",
    userId: "user-003",
    userName: "Emma Rodriguez",
    userEmail: "emma.rodriguez@company.com",
    userAvatar: "ER",
    type: "route_planned",
    action: "Planned delivery route with 23 stops",
    timestamp: "2026-03-12 14:28:45",
    metadata: { routeId: "ROUTE-2026-1234", stops: 23, distance: "87.4 km", estimated: "4h 32m" },
  },
  {
    id: "act-004",
    userId: "user-001",
    userName: "Sarah Johnson",
    userEmail: "sarah.johnson@company.com",
    userAvatar: "SJ",
    type: "setting_changed",
    action: "Updated integration settings",
    timestamp: "2026-03-12 14:25:30",
    metadata: { setting: "stripe_api_key", changed: true },
  },
  {
    id: "act-005",
    userId: "user-004",
    userName: "James Wilson",
    userEmail: "james.wilson@company.com",
    userAvatar: "JW",
    type: "payment",
    action: "Recorded payment of $5,200.50",
    timestamp: "2026-03-12 14:22:15",
    metadata: { orderId: "ORD-2026-8944", amount: "$5,200.50", method: "Credit Card" },
  },
  {
    id: "act-006",
    userId: "user-005",
    userName: "Lisa Thompson",
    userEmail: "lisa.thompson@company.com",
    userAvatar: "LT",
    type: "export",
    action: "Exported 1,254 orders as CSV",
    timestamp: "2026-03-12 14:18:00",
    metadata: { recordCount: 1254, format: "CSV", filters: { dateRange: "30d" } },
  },
  {
    id: "act-007",
    userId: "user-002",
    userName: "Michael Chen",
    userEmail: "michael.chen@company.com",
    userAvatar: "MC",
    type: "permission_changed",
    action: "User 'john.doe@company.com' granted Admin access",
    timestamp: "2026-03-12 14:15:33",
    metadata: { targetUser: "john.doe@company.com", role: "Admin" },
  },
  {
    id: "act-008",
    userId: "user-001",
    userName: "Sarah Johnson",
    userEmail: "sarah.johnson@company.com",
    userAvatar: "SJ",
    type: "logout",
    action: "Logged out",
    timestamp: "2026-03-12 14:10:22",
    metadata: { sessionDuration: "4h 23m" },
  },
  {
    id: "act-009",
    userId: "user-003",
    userName: "Emma Rodriguez",
    userEmail: "emma.rodriguez@company.com",
    userAvatar: "ER",
    type: "order_created",
    action: "Created order #ORD-2026-8943",
    timestamp: "2026-03-12 14:05:45",
    metadata: { orderId: "ORD-2026-8943", totalAmount: "$1,875.00", items: 6 },
  },
];

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, any> = {
    login: LogIn,
    order_created: ShoppingCart,
    route_planned: Route,
    setting_changed: Settings,
    logout: LogOut,
    permission_changed: Lock,
    export: FileText,
    payment: ShoppingCart,
  };

  const Icon = icons[type] || LogIn;
  const colors: Record<string, string> = {
    login: "text-blue-500",
    order_created: "text-emerald-500",
    route_planned: "text-blue-500",
    setting_changed: "text-amber-500",
    logout: "text-gray-400",
    permission_changed: "text-red-500",
    export: "text-blue-500",
    payment: "text-emerald-500",
  };

  return (
    <Icon className={cn("w-5 h-5", colors[type] || "text-gray-400")} />
  );
}

function ActivityTypeLabel({ type }: { type: string }) {
  const labels: Record<string, { text: string; variant: string }> = {
    login: { text: "Login", variant: "info" },
    order_created: { text: "Order Created", variant: "success" },
    route_planned: { text: "Route Planned", variant: "primary" },
    setting_changed: { text: "Settings", variant: "warning" },
    logout: { text: "Logout", variant: "default" },
    permission_changed: { text: "Permission", variant: "danger" },
    export: { text: "Export", variant: "primary" },
    payment: { text: "Payment", variant: "success" },
  };

  const label = labels[type] || labels.login;

  return <Badge variant={label.variant as any}>{label.text}</Badge>;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase();

  const colors = [
    "bg-blue-600/20 text-blue-500",
    "bg-emerald-600/20 text-emerald-500",
    "bg-amber-600/20 text-amber-500",
    "bg-blue-600/20 text-blue-500",
  ];

  const colorIndex =
    initials.charCodeAt(0) % colors.length;

  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
        colors[colorIndex]
      )}
    >
      {initials}
    </div>
  );
}

export default function ActivityPage() {
  const { items: activities, loading, error, refetch } = useApiList<ActivityLog>('/api/v4/admin/activity');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('all');

  const activityTypes = [
    { id: 'login', label: 'Login' },
    { id: 'order_created', label: 'Orders' },
    { id: 'route_planned', label: 'Routes' },
    { id: 'setting_changed', label: 'Settings' },
    { id: 'logout', label: 'Logout' },
    { id: 'permission_changed', label: 'Permissions' },
    { id: 'export', label: 'Exports' },
    { id: 'payment', label: 'Payments' },
  ];

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (selectedType && activity.type !== selectedType) return false;
      return true;
    });
  }, [selectedType, activities]);

  if (loading && activities.length === 0) return <LoadingSkeleton />;
  if (error && activities.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[#12121a]">
      <Header
        title="User Activity"
        subtitle="Monitor user actions and system events"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              <Download className="w-4 h-4" />
              Export Activity Log
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Total Activities (24h)
              </p>
              <span className="text-3xl font-bold text-white">
                {activities.length}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Unique Users
              </p>
              <span className="text-3xl font-bold text-white">
                {new Set(activities.map(a => a.userId)).size}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Login/Logout
              </p>
              <span className="text-3xl font-bold text-white">
                {activities.filter(a => a.type === 'login' || a.type === 'logout').length}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Orders Created
              </p>
              <span className="text-3xl font-bold text-white">
                {activities.filter(a => a.type === 'order_created').length}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-3 font-semibold">
                Activity Type
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedType(null)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    !selectedType
                      ? "bg-blue-600 text-white"
                      : "bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#1e1e2e]"
                  )}
                >
                  All Activities
                </button>
                {activityTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      selectedType === type.id
                        ? "bg-blue-600 text-white"
                        : "bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#1e1e2e]"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2 font-semibold">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-[#1e1e2e]-focus"
                >
                  <option value="all">All Time</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed ({filteredActivities.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredActivities.map((activity, idx) => (
                <div
                  key={activity.id}
                  className={cn(
                    "px-5 py-4 flex gap-4 hover:bg-[#1a1a2e] transition-colors",
                    idx !== filteredActivities.length - 1 &&
                    "border-b border-[#1e1e2e]"
                  )}
                >
                  {/* Timeline */}
                  <div className="flex flex-col items-center pt-1">
                    <div className="p-2 bg-[#1a1a2e] rounded-lg">
                      <ActivityIcon type={activity.type} />
                    </div>
                    {idx !== filteredActivities.length - 1 && (
                      <div className="w-0.5 h-12 bg-[#1e1e2e] my-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 py-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <UserAvatar name={activity.userName} />
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {activity.userName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {activity.userEmail}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-2">
                          {activity.action}
                        </p>

                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2 p-2 bg-[#1a1a2e] rounded text-xs text-gray-400 space-y-1">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span>{key}:</span>
                                <span className="text-gray-400 font-medium">
                                  {typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <ActivityTypeLabel type={activity.type} />
                        <p className="text-xs text-gray-400 mt-2 whitespace-nowrap">
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredActivities.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <p>No activities found for the selected filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Load More */}
        {filteredActivities.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" size="md">
              Load More Activities
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
