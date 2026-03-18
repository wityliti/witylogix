'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/navigation/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/skeleton';
import { useOrderStats } from '@/hooks/use-orders';
import { useDrivers } from '@/hooks/use-drivers';

interface QuickStat {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: string;
}

interface ActivityEvent {
  id: string;
  type: "order" | "delivery" | "driver" | "system";
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
  icon: string;
}

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function StatCard({ stat, loading }: { stat: QuickStat; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset]">
        <div className="flex items-start justify-between w-full mb-4">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04]" />
          <div className="w-14 h-4 rounded bg-white/[0.04]" />
        </div>
        <div className="w-20 h-3 rounded bg-white/[0.04] mb-2" />
        <div className="w-24 h-8 rounded bg-white/[0.06]" />
      </div>
    );
  }

  const trendColor =
    stat.trend === "up"
      ? "text-emerald-400"
      : stat.trend === "down"
        ? "text-red-400"
        : "text-wl-text-tertiary";

  const trendBg =
    stat.trend === "up"
      ? "bg-emerald-400/10 border-emerald-400/20"
      : stat.trend === "down"
        ? "bg-red-400/10 border-red-400/20"
        : "bg-white/[0.04] border-white/[0.08]";

  return (
    <div className={cn(
      "bg-[#13131a] border border-white/[0.08] rounded-xl p-5",
      "shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset]",
      "transition-all duration-200",
      "hover:border-white/[0.14] hover:bg-[#161620] group"
    )}>
      <div className="flex items-start justify-between w-full mb-4">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          "bg-[rgba(245,166,35,0.1)] border border-[rgba(245,166,35,0.18)]",
          "text-[#f5a623]",
          "group-hover:shadow-[0_0_12px_rgba(245,166,35,0.15)]",
          "transition-shadow duration-200"
        )}>
          <Icon d={stat.icon} size={17} />
        </div>
        {stat.trendValue && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full border",
            trendColor, trendBg
          )}>
            {stat.trendValue}
          </span>
        )}
      </div>

      <p className="text-[10px] uppercase tracking-[0.12em] text-wl-text-tertiary font-medium mb-1.5">
        {stat.label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[1.75rem] font-bold text-wl-text-primary leading-none tracking-tight">
          {stat.value}
        </p>
        {stat.unit && (
          <p className="text-xs text-wl-text-secondary">{stat.unit}</p>
        )}
      </div>
    </div>
  );
}

function ActivityFeed({ events, loading }: { events: ActivityEvent[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 pb-4 border-b border-wl-border-subtle last:border-0">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <SkeletonText lines={2} className="w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const typeColors = {
    order: "bg-wl-primary-500/12",
    delivery: "bg-wl-success-500/12",
    driver: "bg-wl-info-500/12",
    system: "bg-wl-neutral-500/12",
  };

  const typeIcons = {
    order: "M16 3h5v5 M21 3l-7 7 M8 21H3v-5 M3 21l7-7",
    delivery: "M3 12l9-5 9 5v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z",
    driver: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
    system: "M12 2v20m0 0l-7-7m7 7l7-7",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.slice(0, 10).map((event, index) => (
            <div
              key={event.id}
              className={cn(
                "flex gap-4 pb-4",
                index !== events.length - 1 && "border-b border-wl-border-subtle"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  "text-wl-text-secondary",
                  typeColors[event.type]
                )}
              >
                <Icon d={typeIcons[event.type]} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-wl-text-primary">
                  {event.action}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  {event.description}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {event.timestamp.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GettingStartedChecklist({
  items,
  loading,
}: {
  items: ChecklistItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="w-5 h-5 rounded mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <SkeletonText lines={2} className="w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Getting Started</CardTitle>
          <Badge variant="info">
            {completedCount}/{items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex gap-3 items-start p-3 rounded-lg",
                "transition-colors duration-fast ease-default",
                "hover:bg-wl-bg-overlay",
                item.completed ? "opacity-60" : ""
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  "border-2 transition-colors duration-fast ease-default",
                  item.completed
                    ? "bg-wl-success-500/20 border-wl-success-500"
                    : "border-wl-border-subtle"
                )}
              >
                {item.completed && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-wl-success-400"
                  >
                    <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-wl-text-primary">
                  {item.label}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  {item.description}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-wl-text-tertiary flex-shrink-0 mt-0.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Fetch real API data
  const { data: orderStats, loading: statsLoading, error: statsError, refetch: refetchStats } = useOrderStats();
  const { items: drivers, loading: driversLoading, error: driversError } = useDrivers({ limit: 5 });

  const now = new Date();

  // Build stats from API data or show loading state
  const stats: QuickStat[] = statsLoading
    ? Array.from({ length: 4 }).map((_, i) => ({
        label: 'Loading...',
        value: '—',
        icon: 'M12 2v20m0 0l-7-7m7 7l7-7',
      }))
    : [
        {
          label: 'Total Orders',
          value: orderStats?.totalOrders ?? 0,
          trend: 'up',
          trendValue: '+12.5%',
          icon: 'M16 3h5v5 M21 3l-7 7 M8 21H3v-5 M3 21l7-7',
        },
        {
          label: 'Pending Orders',
          value: orderStats?.pendingOrders ?? 0,
          trend: 'up',
          trendValue: '+8.2%',
          icon: 'M3 12l9-5 9 5v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z',
        },
        {
          label: 'Drivers Online',
          value: drivers.length,
          trend: 'neutral',
          trendValue: '100%',
          icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
        },
        {
          label: 'Delivered Today',
          value: orderStats?.deliveredToday ?? 0,
          trend: 'up',
          trendValue: '+2.3%',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        },
      ];

  // Mock activity events (can be replaced with real API call later)
  const activityEvents: ActivityEvent[] = [
    {
      id: '1',
      type: 'order',
      action: 'Order Placed',
      description: 'New order received',
      timestamp: new Date(now.getTime() - 5 * 60000),
    },
    {
      id: '2',
      type: 'delivery',
      action: 'Route Optimized',
      description: 'Delivery route updated',
      timestamp: new Date(now.getTime() - 15 * 60000),
    },
    {
      id: '3',
      type: 'driver',
      action: 'Driver Online',
      description: 'Status changed from offline',
      timestamp: new Date(now.getTime() - 22 * 60000),
    },
    {
      id: '4',
      type: 'order',
      action: 'Delivered',
      description: 'Order successfully delivered',
      timestamp: new Date(now.getTime() - 45 * 60000),
    },
    {
      id: '5',
      type: 'system',
      action: 'Report Generated',
      description: 'Daily report created',
      timestamp: new Date(now.getTime() - 120 * 60000),
    },
  ];

  const checklistItems: ChecklistItem[] = [
    {
      id: '1',
      label: 'Complete Your Profile',
      description: 'Add profile picture and company details',
      completed: true,
      href: '/settings',
      icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2',
    },
    {
      id: '2',
      label: 'Add Your First Driver',
      description: 'Register a driver in the fleet management',
      completed: drivers.length > 0,
      href: '/drivers',
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
    },
    {
      id: '3',
      label: 'Create Delivery Zone',
      description: 'Define your service area',
      completed: true,
      href: '/zones',
      icon: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z',
    },
    {
      id: '4',
      label: 'Configure Integrations',
      description: 'Connect with order management systems',
      completed: false,
      href: '/integrations',
      icon: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    },
    {
      id: '5',
      label: 'Invite Team Members',
      description: 'Add your team to collaborate',
      completed: false,
      href: '/settings',
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
    },
  ];

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Welcome back!"
        subtitle={`Today is ${now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}`}
        breadcrumb={false}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              View Report
            </Button>
            <Button variant="primary" size="md">
              New Order
            </Button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="p-6 space-y-8">
        {/* Quick Stats */}
        <section>
          <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
            Key Metrics
          </h2>
          {statsError && (
            <div className="mb-4 p-4 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-lg">
              <p className="text-sm text-wl-danger-400 flex items-center justify-between">
                <span>Failed to load stats</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchStats()}
                  className="text-wl-danger-400 hover:text-wl-danger-300"
                >
                  Retry
                </Button>
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <StatCard key={i} stat={stat} loading={statsLoading} />
            ))}
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Activity Feed */}
          <div className="lg:col-span-2">
            <ActivityFeed events={activityEvents} loading={statsLoading} />
          </div>

          {/* Right Column - Checklist + Actions */}
          <div className="space-y-6">
            <GettingStartedChecklist items={checklistItems} loading={driversLoading} />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link
                    href="/orders/new"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      "text-wl-text-secondary hover:text-wl-text-primary",
                      "hover:bg-wl-bg-overlay",
                      "transition-colors duration-fast ease-default",
                      "no-underline"
                    )}
                  >
                    <Icon
                      d="M16 3h5v5 M21 3l-7 7 M8 21H3v-5 M3 21l7-7"
                      size={18}
                    />
                    <span className="text-sm font-medium">New Order</span>
                  </Link>
                  <Link
                    href="/drivers"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      "text-wl-text-secondary hover:text-wl-text-primary",
                      "hover:bg-wl-bg-overlay",
                      "transition-colors duration-fast ease-default",
                      "no-underline"
                    )}
                  >
                    <Icon
                      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                      size={18}
                    />
                    <span className="text-sm font-medium">Add Driver</span>
                  </Link>
                  <Link
                    href="/map"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      "text-wl-text-secondary hover:text-wl-text-primary",
                      "hover:bg-wl-bg-overlay",
                      "transition-colors duration-fast ease-default",
                      "no-underline"
                    )}
                  >
                    <Icon
                      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"
                      size={18}
                    />
                    <span className="text-sm font-medium">View Map</span>
                  </Link>
                  <Link
                    href="/analytics"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      "text-wl-text-secondary hover:text-wl-text-primary",
                      "hover:bg-wl-bg-overlay",
                      "transition-colors duration-fast ease-default",
                      "no-underline"
                    )}
                  >
                    <Icon d="M18 20V10 M12 20V4 M6 20v-6" size={18} />
                    <span className="text-sm font-medium">Reports</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-wl-primary-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-wl-text-primary">
                        Morning Dispatch
                      </p>
                      <p className="text-xs text-wl-text-tertiary">8:00 AM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-wl-success-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-wl-text-primary">
                        Team Standup
                      </p>
                      <p className="text-xs text-wl-text-tertiary">10:00 AM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-wl-warning-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-wl-text-primary">
                        Evening Delivery Batch
                      </p>
                      <p className="text-xs text-wl-text-tertiary">2:00 PM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
