"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Gauge,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";

interface LiveKPICountersProps {
  className?: string;
}

interface OverviewMetrics {
  totalOrders: number;
  totalDeliveries: number;
  activeDrivers: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  revenue: number;
  failedDeliveries: number;
}

interface AnalyticsOverview {
  metrics: OverviewMetrics;
}

const statusBgColors = {
  good: "from-wl-success-500/10 to-wl-success-500/5",
  warning: "from-wl-warning-500/10 to-wl-warning-500/5",
  critical: "from-wl-danger-500/10 to-wl-danger-500/5",
} as const;

type Status = keyof typeof statusBgColors;

function getDriverStatus(count: number): Status {
  if (count < 5) return "critical";
  if (count < 10) return "warning";
  return "good";
}

function getSlaStatus(rate: number): Status {
  if (rate < 90) return "critical";
  if (rate < 95) return "warning";
  return "good";
}

function KPICard({
  label,
  value,
  unit,
  icon,
  status,
  trend,
}: {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  status: Status;
  trend?: { direction: "up" | "down"; label: string };
}) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br rounded-lg p-5 border border-wl-border-subtle",
        "transition-all hover:border-wl-border-default hover:shadow-md",
        statusBgColors[status]
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-wl-text-secondary font-medium tracking-wide uppercase mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-wl-text-primary">{value}</span>
            <span className="text-xs text-wl-text-secondary">{unit}</span>
          </div>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-wl-bg-surface">
          <div className="text-wl-text-secondary">{icon}</div>
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1">
          {trend.direction === "up" ? (
            <TrendingUp className="w-3 h-3 text-wl-success-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-wl-danger-400" />
          )}
          <span className={cn(
            "text-xs font-semibold",
            trend.direction === "up" ? "text-wl-success-400" : "text-wl-danger-400"
          )}>
            {trend.label}
          </span>
        </div>
      )}

      {status !== "good" && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: status === "warning" ? "rgb(251, 146, 60)" : "rgb(220, 38, 38)" }}
        />
      )}
    </div>
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-wl-bg-overlay border border-wl-border-subtle rounded-lg p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <Skeleton className="h-3 w-20 mb-2 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
        <Skeleton className="h-10 w-10 rounded" />
      </div>
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

export function LiveKPICounters({ className }: LiveKPICountersProps) {
  const { data, loading } = useApiQuery<AnalyticsOverview>("/api/v4/analytics/overview?range=today");

  if (loading) {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
      </div>
    );
  }

  const m = data?.metrics;

  const cards = [
    {
      label: "Orders Today",
      value: m?.totalOrders ?? 0,
      unit: "orders",
      icon: <Package className="w-5 h-5" />,
      status: "good" as Status,
    },
    {
      label: "Active Deliveries",
      value: m?.totalDeliveries ?? 0,
      unit: "in transit",
      icon: <Truck className="w-5 h-5" />,
      status: "good" as Status,
    },
    {
      label: "Available Drivers",
      value: m?.activeDrivers ?? 0,
      unit: "drivers",
      icon: <Users className="w-5 h-5" />,
      status: getDriverStatus(m?.activeDrivers ?? 0),
    },
    {
      label: "On-Time Rate",
      value: m?.onTimeRate !== undefined ? `${m.onTimeRate.toFixed(1)}` : "—",
      unit: "%",
      icon: <Gauge className="w-5 h-5" />,
      status: getSlaStatus(m?.onTimeRate ?? 100),
      trend: m?.onTimeRate !== undefined
        ? {
            direction: m.onTimeRate >= 95 ? ("up" as const) : ("down" as const),
            label: m.onTimeRate >= 95 ? "On target" : "Below SLA",
          }
        : undefined,
    },
  ];

  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative", className)}>
      {cards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}
