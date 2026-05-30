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
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  deploymentTime: string;
  deploymentVersion: string;
  heapUsedMb: number;
  rssMb: number;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
}

interface SystemData {
  data: {
    services: ServiceHealth[];
    metrics: SystemMetrics;
  };
}

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
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    "API Server": Server,
    "Dashboard": HardDrive,
    "Worker Service": Zap,
    "Redis Cache": Radio,
    "PostgreSQL": Database,
    "Nginx Load Balancer": Server,
  };
  const Icon = iconMap[service.name] || Server;

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
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">24h Uptime</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime24h}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">7d Uptime</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime7d}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">30d Uptime</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime30d}%</p>
          </div>
        </div>

        <div className="text-xs text-gray-400 pt-3 border-t border-[#1e1e2e]">
          Last checked: {new Date(service.lastChecked).toLocaleTimeString()}
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
  icon: React.ComponentType<{ className?: string }>;
}) {
  const getColor = (val: number) => {
    if (val < 50) return "text-emerald-500";
    if (val < 75) return "text-amber-500";
    return "text-red-500";
  };
  const getBgColor = (val: number) => {
    if (val < 50) return "bg-emerald-600/20";
    if (val < 75) return "bg-amber-600/20";
    return "bg-red-600/20";
  };
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
  const { data: systemData, loading, error, refetch } = useApiQuery<SystemData>('/api/v4/admin/system');

  const services = systemData?.data?.services ?? [];
  const metrics = systemData?.data?.metrics;
  const degradedServices = services.filter(s => s.status !== "healthy");

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="System Health"
        subtitle="Monitor service status, uptime, and system metrics"
        actions={
          <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loading && services.length === 0 ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : (
          <>
            {/* Service Status Grid */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Service Status</h2>
              {services.length === 0 ? (
                <p className="text-gray-400 text-sm">No services reporting. Check API connectivity.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((service) => (
                    <ServiceCard key={service.name} service={service} />
                  ))}
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <UsageGauge label="Memory Usage" value={metrics.memoryUsage} icon={HardDrive} />
                <UsageGauge label="CPU Load" value={metrics.cpuUsage} icon={Cpu} />
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Process Uptime</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">
                        {formatUptime(metrics.uptimeSeconds)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Heap: {metrics.heapUsedMb} MB</p>
                    <p className="text-xs text-gray-400">RSS: {metrics.rssMb} MB</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Deployment Info */}
            {metrics && (
              <Card>
                <CardHeader>
                  <CardTitle>Runtime Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Version</p>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {metrics.deploymentVersion}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Node.js</p>
                      <p className="text-sm font-semibold text-white">{metrics.nodeVersion}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Platform</p>
                      <p className="text-sm font-semibold text-white">{metrics.platform}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Checked At</p>
                      <p className="text-sm font-semibold text-white">
                        {new Date(metrics.deploymentTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health Alerts */}
            {degradedServices.length > 0 && (
              <div className="space-y-3">
                {degradedServices.map(service => (
                  <Card key={service.name} className="border border-amber-600/30 bg-amber-600/10">
                    <CardContent className="pt-5">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-500">
                            {service.status === "critical" ? "Critical" : "Degraded"}: {service.name}
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            Response time: {service.responseTime}ms. Uptime (24h): {service.uptime24h}%.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {degradedServices.length === 0 && services.length > 0 && (
              <Card className="border border-emerald-600/30 bg-emerald-600/10">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-500">
                      All services are healthy
                    </p>
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
