"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, DashboardStats } from "@/hooks/use-dashboard-stats";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Gauge,
} from "lucide-react";

interface KPIMetric {
  label: string;
  value: number;
  previousValue: number;
  icon: React.ReactNode;
  unit: string;
  status: "good" | "warning" | "critical";
  sparkline: number[];
}

interface LiveKPICountersProps {
  className?: string;
}

const statusBgColors: Record<"good" | "warning" | "critical", string> = {
  good: "from-wl-success-500/10 to-wl-success-500/5",
  warning: "from-wl-warning-500/10 to-wl-warning-500/5",
  critical: "from-wl-danger-500/10 to-wl-danger-500/5",
};

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    if (diff === 0) return;
    const steps = 40;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const p = step / steps;
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * ease));
      if (step >= steps) {
        clearInterval(interval);
        setDisplay(value);
        prev.current = value;
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{display}</>;
}

function Sparkline({ data, color = "text-wl-primary-500" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className={cn("h-6 w-full", color)} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function KPICard({ metric }: { metric: KPIMetric }) {
  const trendPct = metric.previousValue
    ? ((metric.value - metric.previousValue) / metric.previousValue * 100).toFixed(1)
    : 0;

  const isPositiveTrend = metric.value >= metric.previousValue;
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
  const trendColor = isPositiveTrend ? "text-wl-success-400" : "text-wl-danger-400";

  const sparklineColor =
    metric.status === "good"
      ? "text-wl-success-500"
      : metric.status === "warning"
        ? "text-wl-warning-500"
        : "text-wl-danger-500";

  return (
    <div
      className={cn(
        "relative bg-gradient-to-br rounded-lg p-5 border border-wl-border-subtle",
        "transition-all duration-base ease-default hover:border-wl-border-default hover:shadow-md",
        statusBgColors[metric.status]
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-wl-text-secondary font-medium tracking-wide uppercase mb-1">
            {metric.label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-wl-text-primary">
              <AnimatedNumber value={metric.value} />
            </span>
            <span className="text-xs text-wl-text-secondary">{metric.unit}</span>
          </div>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-wl-bg-surface">
          <div className="text-wl-text-secondary">{metric.icon}</div>
        </div>
      </div>

      <div className="mb-3">
        <Sparkline data={metric.sparkline} color={sparklineColor} />
      </div>

      <div className="flex items-center gap-1">
        <TrendIcon className={cn("w-3 h-3", trendColor)} />
        <span className={cn("text-xs font-semibold", trendColor)}>
          {isPositiveTrend ? "+" : ""}{trendPct}%
        </span>
        <span className="text-xs text-wl-text-secondary">vs yesterday</span>
      </div>
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
      <Skeleton className="h-6 w-full rounded" />
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

function getDriverStatus(value: number): "good" | "warning" | "critical" {
  if (value < 10) return "critical";
  if (value < 15) return "warning";
  return "good";
}

function getSlaStatus(value: number): "good" | "warning" | "critical" {
  if (value < 92) return "critical";
  if (value < 95) return "warning";
  return "good";
}

function buildMetrics(stats: DashboardStats): KPIMetric[] {
  const ordersToday = stats.totalOrders ?? 0;
  const activeDrivers = stats.activeDrivers ?? 0;
  const deliveredToday = stats.deliveredToday ?? 0;

  return [
    {
      label: "Orders Today",
      value: ordersToday,
      previousValue: 0,
      icon: <Package className="w-5 h-5" />,
      unit: "orders",
      status: "good",
      sparkline: [],
    },
    {
      label: "Delivered Today",
      value: deliveredToday,
      previousValue: 0,
      icon: <Truck className="w-5 h-5" />,
      unit: "deliveries",
      status: "good",
      sparkline: [],
    },
    {
      label: "Active Drivers",
      value: activeDrivers,
      previousValue: 0,
      icon: <Users className="w-5 h-5" />,
      unit: "drivers",
      status: getDriverStatus(activeDrivers),
      sparkline: [],
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders ?? 0,
      previousValue: 0,
      icon: <Gauge className="w-5 h-5" />,
      unit: "pending",
      status: "good",
      sparkline: [],
    },
  ];
}

export function LiveKPICounters({ className }: LiveKPICountersProps) {
  const { data: stats, loading } = useDashboardStats();

  const metrics: KPIMetric[] = stats ? buildMetrics(stats) : [];

  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        : metrics.map((metric, i) => (
            <KPICard key={i} metric={metric} />
          ))}
    </div>
  );
}
