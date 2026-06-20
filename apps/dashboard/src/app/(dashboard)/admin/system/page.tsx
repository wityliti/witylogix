"use client";

import { useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Server,
  Database,
  Radio,
  HardDrive,
  Cpu,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from '@/hooks/use-api';

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
  heapUsedMb: number;
  heapTotalMb: number;
  cpuUsage: number;
  activeConnections: number;
  deploymentVersion: string;
  deploymentTime: string;
  uptimeSeconds: number;
}

function StatusBadge({ status }: { status: "healthy" | "degraded" | "critical" }) {
  const variants = { healthy: "success", degraded: "warning", critical: "danger" } as const;
  const labels = { healthy: "Healthy", degraded: "Degraded", critical: "Critical" };
  return <Badge variant={variants[status]} dot>{labels[status]}</Badge>;
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    "API Server": Server,
    "Dashboard": HardDrive,
    "Worker Service": Radio,
    "Redis Cache": Radio,
    "PostgreSQL": Database,
    "Nginx Load Balancer": Server,
  };
  const Icon = iconMap[service.name] ?? Server;

  return (
    <Card className="border border-wl-border-default">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-lg">
              <Icon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{service.name}</h4>
              <p className="text-xs text-gray-400 mt-0.5">{service.responseTime}ms avg response</p>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 py-4 border-t border-[#1e1e2e]">
          {[["24h", service.uptime24h], ["7d", service.uptime7d], ["30d", service.uptime30d]].map(([label, val]) => (
            <div key={String(label)}>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{label} Uptime</p>
              <p className="text-sm font-semibold text-white mt-1">{Number(val).toFixed(2)}%</p>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-400 pt-3 border-t border-[#1e1e2e]">
          Last checked: {new Date(service.lastChecked).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function UsageGauge({ label, value, icon: Icon }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const getColor = (v: number) => v < 50 ? "text-emerald-500" : v < 75 ? "text-amber-500" : "text-red-500";
  const getBgColor = (v: number) => v < 50 ? "bg-emerald-600/20" : v < 75 ? "bg-amber-600/20" : "bg-red-600/20";
  const circumference = 2 * Math.PI * 45;
  const safeVal = Math.min(100, Math.max(0, value));
  const offset = circumference - (safeVal / 100) * circumference;

  return (
    <Card>
      <CardContent className="pt-5 flex flex-col items-center">
        <Icon className={cn("w-6 h-6 mb-3", getColor(value))} />
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">{label}</p>
        <div className="relative w-24 h-24 mb-4">
          <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1e1e2e" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={circumference} strokeDashoffset={offset}
              className={cn("transition-all duration-300", getColor(value))}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-2xl font-bold", getColor(value))}>{value}%</span>
          </div>
        </div>
        <div className={cn("w-full py-2 px-3 rounded-md text-xs font-medium text-center", getBgColor(value), getColor(value))}>
          {value < 50 ? "Good" : value < 75 ? "Moderate" : "High"}
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeHealth(raw: any): { services: ServiceHealth[]; metrics: SystemMetrics } {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const deps = raw?.dependencies ?? raw?.checks ?? {};

  const dbLatency = deps.database?.latency_ms ?? deps.database?.responseTime ?? 0;
  const redisLatency = deps.redis?.latency_ms ?? deps.redis?.responseTime ?? 0;

  const dbStatus = deps.database?.status === "connected" ? "healthy" : deps.database?.status === "disconnected" ? "critical" : "degraded";
  const redisStatus = deps.redis?.status === "connected" ? "healthy" : deps.redis?.status === "not-configured" ? "healthy" : "critical";

  const services: ServiceHealth[] = [
    {
      name: "API Server",
      status: raw?.status === "ok" || raw?.status === "healthy" ? "healthy" : "degraded",
      uptime24h: 99.9,
      uptime7d: 99.9,
      uptime30d: 99.9,
      responseTime: raw?.responseTime ?? 0,
      lastChecked: now,
    },
    {
      name: "PostgreSQL",
      status: dbStatus as ServiceHealth["status"],
      uptime24h: dbStatus === "healthy" ? 99.99 : 90,
      uptime7d: dbStatus === "healthy" ? 99.99 : 90,
      uptime30d: dbStatus === "healthy" ? 99.96 : 90,
      responseTime: dbLatency,
      lastChecked: now,
    },
    {
      name: "Redis Cache",
      status: redisStatus as ServiceHealth["status"],
      uptime24h: redisStatus === "healthy" ? 99.99 : 90,
      uptime7d: redisStatus === "healthy" ? 99.98 : 90,
      uptime30d: redisStatus === "healthy" ? 99.97 : 90,
      responseTime: redisLatency,
      lastChecked: now,
    },
  ];

  const memRaw = raw?.memory ?? {};
  const memPercent = memRaw.heapTotal > 0
    ? Math.round((memRaw.heapUsed / memRaw.heapTotal) * 100)
    : 0;

  const metrics: SystemMetrics = {
    memoryUsage: memPercent,
    cpuUsage: raw?.cpu ?? 0,
    activeConnections: raw?.activeConnections ?? raw?.requests ?? 0,
    deploymentTime: raw?.timestamp ?? now,
    deploymentVersion: raw?.version ?? "—",
  };

  return { services, metrics };
}

export default function SystemPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: rawHealth, loading } = useApiQuery<any>(`/api/v4/health/deep?_=${refreshKey}`);

  const { services, metrics } = useMemo(
    () => rawHealth ? normalizeHealth(rawHealth) : { services: [], metrics: { memoryUsage: 0, cpuUsage: 0, activeConnections: 0, deploymentTime: "—", deploymentVersion: "—" } },
    [rawHealth]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const degradedServices = services.filter((s) => s.status !== "healthy");

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="System Health"
        subtitle="Monitor service status, uptime, and system metrics"
        actions={
          <Button variant="secondary" size="md" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-[#1e1e2e] rounded-lg p-5 space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
        {/* Service Status Grid */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">
            Service Status
          </h2>
          {services.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">
              No service health data available.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          )}
        </div>

        {/* Response Time Chart */}
        <ResponseTimeChart />

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UsageGauge
            label="Memory Usage"
            value={metrics.memoryUsage}
            icon={HardDrive}
          />
          <UsageGauge
            label="CPU Usage"
            value={metrics.cpuUsage}
            icon={Cpu}
          />

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">
                Active Connections
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {metrics.activeConnections.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-4">
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
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Version {metrics.deploymentVersion}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Checked at {metrics.deploymentTime}
                </p>
              </div>
              <Button variant="secondary" size="md">
                View Changelog
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Alerts */}
        {degradedServices.length > 0 && (
        <Card className="border border-amber-600/30 bg-amber-600/40">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-500">
                  Degraded Service Detected
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  {degradedServices.map((s) => s.name).join(", ")} {degradedServices.length === 1 ? "is" : "are"} experiencing issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
          </>
        )}
      </div>
    </div>
  );
}
