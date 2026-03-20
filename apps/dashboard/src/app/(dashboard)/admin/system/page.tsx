"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Server,
  Database,
  Zap,
  Radio,
  HardDrive,
  Cpu,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "critical";
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  responseTime: number;
  lastChecked: string;
}

interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  deploymentTime: string;
  deploymentVersion: string;
}

const mockServices: ServiceHealth[] = [
  {
    name: "API Server",
    status: "healthy",
    uptime24h: 99.98,
    uptime7d: 99.94,
    uptime30d: 99.87,
    responseTime: 45,
    lastChecked: "2026-03-12 14:32:10",
  },
  {
    name: "Dashboard",
    status: "healthy",
    uptime24h: 100.0,
    uptime7d: 99.99,
    uptime30d: 99.95,
    responseTime: 32,
    lastChecked: "2026-03-12 14:32:05",
  },
  {
    name: "Worker Service",
    status: "healthy",
    uptime24h: 99.85,
    uptime7d: 99.72,
    uptime30d: 99.48,
    responseTime: 120,
    lastChecked: "2026-03-12 14:31:55",
  },
  {
    name: "Redis Cache",
    status: "healthy",
    uptime24h: 99.99,
    uptime7d: 99.98,
    uptime30d: 99.97,
    responseTime: 2,
    lastChecked: "2026-03-12 14:32:15",
  },
  {
    name: "PostgreSQL",
    status: "healthy",
    uptime24h: 100.0,
    uptime7d: 99.99,
    uptime30d: 99.96,
    responseTime: 85,
    lastChecked: "2026-03-12 14:32:00",
  },
  {
    name: "Nginx Load Balancer",
    status: "degraded",
    uptime24h: 99.5,
    uptime7d: 99.3,
    uptime30d: 98.9,
    responseTime: 12,
    lastChecked: "2026-03-12 14:31:45",
  },
];

const mockMetrics: SystemMetrics = {
  memoryUsage: 68,
  cpuUsage: 42,
  activeConnections: 3542,
  deploymentTime: "2026-03-11 09:45:32",
  deploymentVersion: "v4.9.2",
};

function StatusBadge({ status }: { status: "healthy" | "degraded" | "critical" }) {
  const variants: Record<typeof status, any> = {
    healthy: "success",
    degraded: "warning",
    critical: "danger",
  };

  const labels: Record<typeof status, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    critical: "Critical",
  };

  return (
    <Badge variant={variants[status]} dot>
      {labels[status]}
    </Badge>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const iconMap: Record<string, any> = {
    "API Server": Server,
    "Dashboard": HardDrive,
    "Worker Service": Zap,
    "Redis Cache": Radio,
    "PostgreSQL": Database,
    "Nginx Load Balancer": Server,
  };

  const Icon = iconMap[service.name];

  return (
    <Card className="border border-wl-border-subtle">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-wl-primary-500/10 rounded-lg">
                <Icon className="w-5 h-5 text-wl-primary-400" />
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-wl-text-primary">
                {service.name}
              </h4>
              <p className="text-xs text-wl-text-tertiary mt-0.5">
                {service.responseTime}ms avg response time
              </p>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 py-4 border-t border-wl-border-subtle">
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
              24h Uptime
            </p>
            <p className="text-sm font-semibold text-wl-text-primary mt-1">
              {service.uptime24h}%
            </p>
          </div>
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
              7d Uptime
            </p>
            <p className="text-sm font-semibold text-wl-text-primary mt-1">
              {service.uptime7d}%
            </p>
          </div>
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
              30d Uptime
            </p>
            <p className="text-sm font-semibold text-wl-text-primary mt-1">
              {service.uptime30d}%
            </p>
          </div>
        </div>

        <div className="text-xs text-wl-text-tertiary pt-3 border-t border-wl-border-subtle">
          Last checked: {service.lastChecked}
        </div>
      </CardContent>
    </Card>
  );
}

function ResponseTimeChart() {
  const data = [
    { time: "00:00", api: 45, dashboard: 32, worker: 125, db: 82 },
    { time: "04:00", api: 48, dashboard: 35, worker: 128, db: 85 },
    { time: "08:00", api: 52, dashboard: 40, worker: 135, db: 90 },
    { time: "12:00", api: 62, dashboard: 48, worker: 155, db: 105 },
    { time: "16:00", api: 55, dashboard: 42, worker: 140, db: 95 },
    { time: "20:00", api: 50, dashboard: 38, worker: 130, db: 88 },
    { time: "23:59", api: 46, dashboard: 33, worker: 122, db: 83 },
  ];

  const maxValue = Math.max(...data.map(d => Math.max(d.api, d.dashboard, d.worker, d.db)));
  const chartHeight = 200;
  const chartWidth = 520;
  const pointSpacing = chartWidth / (data.length - 1);

  const createPath = (key: keyof Omit<typeof data[0], 'time'>, color: string) => {
    const points = data.map((d, i) => {
      const x = i * pointSpacing + 30;
      const y = chartHeight - (d[key] / maxValue) * (chartHeight - 40) + 10;
      return `${x},${y}`;
    }).join(' ');

    return (
      <polyline
        key={key}
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time (24h)</CardTitle>
        <div className="flex gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wl-primary-400 rounded-full" />
            <span className="text-xs text-wl-text-tertiary">API</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wl-success-400 rounded-full" />
            <span className="text-xs text-wl-text-tertiary">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wl-warning-400 rounded-full" />
            <span className="text-xs text-wl-text-tertiary">Worker</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wl-info-400 rounded-full" />
            <span className="text-xs text-wl-text-tertiary">Database</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <svg
          width="100%"
          height={chartHeight}
          className="mb-2"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="grad-bg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wl-primary-500)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--wl-primary-500)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`grid-${i}`}
              x1="20"
              y1={10 + (chartHeight - 50) * (i / 4)}
              x2={chartWidth - 10}
              y2={10 + (chartHeight - 50) * (i / 4)}
              stroke="var(--wl-border-subtle)"
              strokeWidth="1"
            />
          ))}

          {/* Y-axis */}
          <line x1="20" y1="10" x2="20" y2={chartHeight - 30} stroke="var(--wl-border-subtle)" strokeWidth="1" />

          {/* X-axis */}
          <line x1="20" y1={chartHeight - 30} x2={chartWidth - 10} y2={chartHeight - 30} stroke="var(--wl-border-subtle)" strokeWidth="1" />

          {/* Lines */}
          {createPath("api", "#8B5CF6")}
          {createPath("dashboard", "#10B981")}
          {createPath("worker", "#F59E0B")}
          {createPath("db", "#3B82F6")}

          {/* Time labels */}
          {data.map((d, i) => (
            <text
              key={`label-${i}`}
              x={i * pointSpacing + 30}
              y={chartHeight - 10}
              textAnchor="middle"
              fontSize="11"
              fill="var(--wl-text-tertiary)"
            >
              {d.time}
            </text>
          ))}
        </svg>

        <div className="text-xs text-wl-text-tertiary">
          Response times in milliseconds. Lower is better.
        </div>
      </CardContent>
    </Card>
  );
}

function UsageGauge({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: any;
}) {
  const getColor = (val: number) => {
    if (val < 50) return "text-wl-success-400";
    if (val < 75) return "text-wl-warning-400";
    return "text-wl-danger-400";
  };

  const getBgColor = (val: number) => {
    if (val < 50) return "bg-wl-success-500/20";
    if (val < 75) return "bg-wl-warning-500/20";
    return "bg-wl-danger-500/20";
  };

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;

  return (
    <Card>
      <CardContent className="pt-5 flex flex-col items-center">
        <Icon className={cn("w-6 h-6 mb-3", getColor(value))} />
        <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-4">
          {label}
        </p>

        <div className="relative w-24 h-24 mb-4">
          <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-90">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--wl-border-subtle)"
              strokeWidth="3"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-300",
                getColor(value)
              )}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-2xl font-bold", getColor(value))}>
              {value}%
            </span>
          </div>
        </div>

        <div className={cn(
          "w-full py-2 px-3 rounded-md text-xs font-medium text-center",
          getBgColor(value),
          getColor(value)
        )}>
          {value < 50 ? "Good" : value < 75 ? "Moderate" : "High"}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="System Health"
        subtitle="Monitor service status, uptime, and system metrics"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn(
                "w-4 h-4",
                isRefreshing && "animate-spin"
              )} />
              Refresh
            </Button>
            <Button variant="secondary" size="md">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Service Status Grid */}
        <div>
          <h2 className="text-lg font-bold text-wl-text-primary mb-4">
            Service Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockServices.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>
        </div>

        {/* Response Time Chart */}
        <ResponseTimeChart />

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UsageGauge
            label="Memory Usage"
            value={mockMetrics.memoryUsage}
            icon={HardDrive}
          />
          <UsageGauge
            label="CPU Usage"
            value={mockMetrics.cpuUsage}
            icon={Cpu}
          />

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-4">
                Active Connections
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-wl-text-primary">
                  {mockMetrics.activeConnections.toLocaleString()}
                </span>
                <span className="text-sm text-wl-success-400">+12%</span>
              </div>
              <p className="text-xs text-wl-text-tertiary mt-4">
                Connected clients across all services
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deployment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Last Deployment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-wl-text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-wl-success-400" />
                  Version {mockMetrics.deploymentVersion}
                </p>
                <p className="text-sm text-wl-text-tertiary mt-1">
                  Deployed on {mockMetrics.deploymentTime}
                </p>
              </div>
              <Button variant="secondary" size="md">
                View Changelog
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Alerts */}
        <Card className="border border-wl-warning-500/30 bg-wl-warning-bg/40">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-wl-warning-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-wl-warning-400">
                  Degraded Performance on Nginx Load Balancer
                </h4>
                <p className="text-sm text-wl-text-secondary mt-1">
                  Response times are elevated (average 12ms). Consider investigating connection pooling or scaling horizontal load balancing capacity.
                </p>
                <Button variant="secondary" size="sm" className="mt-3">
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
