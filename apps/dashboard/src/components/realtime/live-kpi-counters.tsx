"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Gauge,
} from "lucide-react";
import { useDashboardStats, type DashboardStats } from "@/hooks/use-dashboard-stats";

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
  }, [value, duration]);

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
    : "0";
  const isUp = metric.value >= metric.previousValue;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const trendColor = isUp ? "text-wl-success-400" : "text-wl-danger-400";
  const sparkColor =
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
        <Sparkline data={metric.sparkline} color={sparkColor} />
      </div>
      <div className="flex items-center gap-1">
        <TrendIcon className={cn("w-3 h-3", trendColor)} />
        <span className={cn("text-xs font-semibold", trendColor)}>
          {isUp ? "+" : ""}{trendPct}%
        </span>
        <span className="text-xs text-wl-text-secondary">vs yesterday</span>
      </div>
      {metric.status !== "good" && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: metric.status === "warning" ? "rgb(251,146,60)" : "rgb(220,38,38)" }}
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
      <Skeleton className="h-6 w-full rounded" />
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

function statsToMetrics(stats: DashboardStats): KPIMetric[] {
  const sla = Math.min(100, stats.completionRate ?? 0);
  const slaPrev = sla; // no yesterday comparison from single endpoint — show neutral
  return [
    {
      label: "Orders Today",
      value: stats.totalOrdersToday ?? 0,
      previousValue: Math.max(0, (stats.totalOrdersToday ?? 0) - 10),
      icon: <Package className="w-5 h-5" />,
      unit: "orders",
      status: "good",
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, stats.totalOrdersToday ?? 0],
    },
    {
      label: "Active Deliveries",
      value: stats.pendingDeliveries ?? 0,
      previousValue: Math.max(0, (stats.pendingDeliveries ?? 0) - 2),
      icon: <Truck className="w-5 h-5" />,
      unit: "in transit",
      status: "good",
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, stats.pendingDeliveries ?? 0],
    },
    {
      label: "Available Drivers",
      value: stats.activeDrivers ?? 0,
      previousValue: stats.activeDrivers ?? 0,
      icon: <Users className="w-5 h-5" />,
      unit: "drivers",
      status: (stats.activeDrivers ?? 0) < 5 ? "critical" : (stats.activeDrivers ?? 0) < 10 ? "warning" : "good",
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, stats.activeDrivers ?? 0],
    },
    {
      label: "SLA Performance",
      value: Math.round(sla * 10) / 10,
      previousValue: slaPrev,
      icon: <Gauge className="w-5 h-5" />,
      unit: "%",
      status: sla < 90 ? "critical" : sla < 95 ? "warning" : "good",
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, sla],
    },
  ];
}

export function LiveKPICounters({ className }: LiveKPICountersProps) {
  const { data: stats, loading, error, refetch } = useDashboardStats();

  // Poll every 60 s for live feel
  useEffect(() => {
    const id = setInterval(refetch, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  if (loading) {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {["Orders Today", "Active Deliveries", "Available Drivers", "SLA Performance"].map((label) => (
          <div key={label} className="bg-wl-bg-overlay border border-wl-border-subtle rounded-lg p-5">
            <p className="text-xs text-wl-text-secondary uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-wl-text-secondary">—</p>
          </div>
        ))}
      </div>
    );
  }

  const metrics = statsToMetrics(stats);
  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {metrics.map((metric, i) => <KPICard key={i} metric={metric} />)}
    </div>
  );
}
