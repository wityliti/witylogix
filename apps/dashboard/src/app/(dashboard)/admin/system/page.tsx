"use client";

import { useState } from "react";
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
  cpuUsage: number;
  activeConnections: number;
  deploymentTime: string;
  deploymentVersion: string;
}

interface SystemData {
  services: ServiceHealth[];
  metrics: SystemMetrics;
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
  return (
    <Badge variant={variants[status]} dot>
      {labels[status]}
    </Badge>
  );
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
  const Icon = iconMap[service.name] ?? Server;
  return (
    <Card className="border border-[#1e1e2e]">
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
            <p className="text-sm font-semibold text-white mt-1">{service.uptime24h.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">7d Uptime</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime7d.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">30d Uptime</p>
            <p className="text-sm font-semibold text-white mt-1">{service.uptime30d.toFixed(2)}%</p>
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
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;
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
        <div className={cn(
          "w-full py-2 px-3 rounded-md text-xs font-medium text-center",
          value < 50 ? "bg-emerald-600/20 text-emerald-500" : value < 75 ? "bg-amber-600/20 text-amber-500" : "bg-red-600/20 text-red-500"
        )}>
          {value < 50 ? "Good" : value < 75 ? "Moderate" : "High"}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error, refetch } = useApiQuery<SystemData>('/api/v4/admin/system');

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  const degradedServices = (data?.services ?? []).filter(s => s.status !== 'healthy');

  return (
    <div className="min-h-screen bg-[#12121a]">
      <Header
        title="System Health"
        subtitle="Monitor service status, uptime, and system metrics"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
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
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : (
          <>
            {/* Service Status Grid */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Service Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.services ?? []).map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UsageGauge label="Memory Usage" value={data?.metrics.memoryUsage ?? 0} icon={HardDrive} />
              <UsageGauge label="CPU Usage" value={data?.metrics.cpuUsage ?? 0} icon={Cpu} />
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Active DB Connections</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {(data?.metrics.activeConnections ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">Active PostgreSQL connections</p>
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
                      Version {data?.metrics.deploymentVersion ?? '—'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Deployed {data?.metrics.deploymentTime
                        ? new Date(data.metrics.deploymentTime).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <Button variant="secondary" size="md">View Changelog</Button>
                </div>
              </CardContent>
            </Card>

            {/* Degraded service alerts */}
            {degradedServices.map(service => (
              <Card key={service.name} className="border border-amber-600/30 bg-amber-600/10">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-500">
                        {service.status === 'critical' ? 'Critical' : 'Degraded'} — {service.name}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Response time elevated ({service.responseTime}ms). Uptime 24h: {service.uptime24h.toFixed(2)}%.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
