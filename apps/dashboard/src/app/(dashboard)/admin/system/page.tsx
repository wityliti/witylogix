"use client";

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
  AlertCircle,
} from "lucide-react";
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "critical";
  responseTime: number;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  activeJobs?: number;
  checkedAt: string;
}

interface SystemMetrics {
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryUsagePct: number;
  processUptimeSec: number;
  version: string;
  nodeVersion: string;
}

interface SystemHealth {
  services: ServiceHealth[];
  metrics: SystemMetrics;
  checkedAt: string;
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "API Server": Server,
  "PostgreSQL": Database,
  "Redis Cache": Radio,
  "Worker Queues": Zap,
};

function StatusBadge({ status }: { status: "healthy" | "degraded" | "critical" }) {
  const variants: Record<typeof status, "success" | "warning" | "danger"> = {
    healthy: "success",
    degraded: "warning",
    critical: "danger",
  };
  const labels: Record<typeof status, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    critical: "Critical",
  };
  return <Badge variant={variants[status]} dot>{labels[status]}</Badge>;
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const Icon = SERVICE_ICONS[service.name] ?? Server;
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
              <p className="text-xs text-gray-400 mt-0.5">
                {service.responseTime > 0 ? `${service.responseTime}ms response` : service.activeJobs != null ? `${service.activeJobs} active jobs` : 'Checked'}
              </p>
            </div>
          </div>
          <StatusBadge status={service.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 py-4 border-t border-[#1e1e2e]">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">24h</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime24h}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">7d</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime7d}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">30d</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime30d}%</p>
          </div>
        </div>

        <div className="text-xs text-gray-400 pt-3 border-t border-[#1e1e2e]">
          Checked: {new Date(service.checkedAt).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

function MemoryGauge({ value, usedMB, totalMB }: { value: number; usedMB: number; totalMB: number }) {
  const getColor = (v: number) =>
    v < 50 ? "text-emerald-500" : v < 75 ? "text-amber-500" : "text-red-500";
  const getBgColor = (v: number) =>
    v < 50 ? "bg-emerald-600/20" : v < 75 ? "bg-amber-600/20" : "bg-red-600/20";
  const circumference = 2 * Math.PI * 45;
  const safeVal = Math.min(100, Math.max(0, value));
  const offset = circumference - (safeVal / 100) * circumference;

  return (
    <Card>
      <CardContent className="pt-5 flex flex-col items-center">
        <HardDrive className={cn("w-6 h-6 mb-3", getColor(value))} />
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Memory Usage</p>
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
        <p className="text-xs text-gray-400">{usedMB} MB / {totalMB} MB</p>
        <div className={cn("w-full mt-3 py-2 px-3 rounded-md text-xs font-medium text-center", getBgColor(value), getColor(value))}>
          {value < 50 ? "Good" : value < 75 ? "Moderate" : "High"}
        </div>
      </CardContent>
    </Card>
  );
}

function UptimeGauge({ uptimeSec }: { uptimeSec: number }) {
  const hours = Math.floor(uptimeSec / 3600);
  const days = Math.floor(hours / 24);
  const label = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  return (
    <Card>
      <CardContent className="pt-5 flex flex-col items-center">
        <Cpu className="w-6 h-6 mb-3 text-blue-500" />
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Process Uptime</p>
        <div className="text-3xl font-bold text-white mb-2">{label}</div>
        <p className="text-xs text-gray-400">{uptimeSec.toLocaleString()} seconds</p>
        <div className="w-full mt-3 py-2 px-3 rounded-md text-xs font-medium text-center bg-blue-600/20 text-blue-400">
          Running
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemPage() {
  const { data, loading, error, refetch } = useApiQuery<SystemHealth>('/api/v4/admin/system');

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const degraded = data?.services.filter((s) => s.status !== "healthy") ?? [];

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="System Health"
        subtitle="Monitor service status, uptime, and system metrics"
        actions={
          <Button variant="secondary" size="md" onClick={refetch} disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
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
          <h2 className="text-lg font-bold text-white mb-4">Service Status</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-[#1e1e2e] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(data?.services ?? []).map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <>
              <div className="h-56 rounded-xl bg-[#1e1e2e] animate-pulse" />
              <div className="h-56 rounded-xl bg-[#1e1e2e] animate-pulse" />
              <div className="h-56 rounded-xl bg-[#1e1e2e] animate-pulse" />
            </>
          ) : data ? (
            <>
              <MemoryGauge
                value={data.metrics.memoryUsagePct}
                usedMB={data.metrics.memoryUsedMB}
                totalMB={data.metrics.memoryTotalMB}
              />
              <UptimeGauge uptimeSec={data.metrics.processUptimeSec} />
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Runtime</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-400">API Version</p>
                      <p className="text-lg font-bold text-white">v{data.metrics.version}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Node.js</p>
                      <p className="text-sm font-semibold text-white">{data.metrics.nodeVersion}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Last Checked</p>
                      <p className="text-sm font-semibold text-white">{new Date(data.checkedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Alerts for degraded services */}
        {!loading && degraded.length > 0 && (
          <div className="space-y-3">
            {degraded.map((service) => (
              <Card key={service.name} className="border border-amber-600/30 bg-amber-600/10">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400">
                        {service.status === "critical" ? "Critical Issue" : "Degraded"}: {service.name}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {service.name} is reporting {service.status} status.{" "}
                        {service.responseTime > 500
                          ? `Response time is elevated at ${service.responseTime}ms.`
                          : "Investigate connectivity and resource usage."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* All healthy banner */}
        {!loading && degraded.length === 0 && data && (
          <Card className="border border-emerald-600/30 bg-emerald-600/10">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">All systems operational</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
