"use client";

import { useCallback } from "react";
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
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
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

interface SystemHealthData {
  services: ServiceHealth[];
  metrics: SystemMetrics;
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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function SystemPage() {
  const { data: healthData, loading, error, refetch } = useApiQuery<SystemHealthData>('/api/v4/admin/system/health');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const services = systemData?.data?.services ?? [];
  const metrics = systemData?.data?.metrics;
  const degradedServices = services.filter(s => s.status !== "healthy");

  const services = data?.services ?? [];
  const metrics = data?.metrics;
  const degradedServices = services.filter((s) => s.status !== "healthy");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const services: ServiceHealth[] = (raw as any)?.services ?? [];
  const metrics: SystemMetrics = (raw as any)?.metrics ?? { memoryUsage: 0, cpuUsage: 0, activeConnections: 0, deploymentTime: new Date().toISOString(), deploymentVersion: 'v1.0.0' };
  const degradedServices = services.filter((s) => s.status !== 'healthy');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const services = healthData?.services ?? [];
  const metrics = healthData?.metrics ?? null;
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
                <span className="text-sm text-emerald-500">+12%</span>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Connected clients across all services
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deployment Info */}
        {metrics && (
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
                    Deployed on {new Date(metrics.deploymentTime).toLocaleString()}
                  </p>
                </div>
                <Button variant="secondary" size="md">
                  View Changelog
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Check Alerts — only for degraded services */}
        {degradedServices.map((service) => (
          <Card key={service.name} className="border border-amber-600/30 bg-amber-600/40">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-500">
                    {service.status === "critical" ? "Critical" : "Degraded"} — {service.name}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Response time: {service.responseTime}ms. Last checked:{" "}
                    {new Date(service.lastChecked).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
