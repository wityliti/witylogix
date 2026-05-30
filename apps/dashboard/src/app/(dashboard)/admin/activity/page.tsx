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
