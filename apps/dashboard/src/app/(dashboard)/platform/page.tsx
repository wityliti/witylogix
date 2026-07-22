'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RefreshCw, Server, Database, Layers } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/error-state';

// ─── Types ────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime?: number;
  lastChecked: string;
}

interface PlatformStatus {
  score: number;
  services: ServiceStatus[];
  summary: { total: number; healthy: number; degraded: number; down: number };
}

interface IntegrationStatus {
  name: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string | null;
  accountsConnected?: number;
  error?: string;
}

interface IntegrationsPayload {
  integrations: IntegrationStatus[];
  summary: { total: number; connected: number; disconnected: number; error: number };
}

interface PlatformAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

interface AlertsPayload {
  alerts: PlatformAlert[];
  summary: { total: number; pending: number };
}

interface PlatformMetrics {
  uptimeSeconds: number;
  memUsagePct: number;
  heapUsedMb: number;
  rssMb: number;
  dbLatencyMs: number;
  nodeVersion: string;
  platform: string;
}

// ─── Sub-components ───────────────────────────────────────────

function HealthScoreGauge({ score }: { score: number }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(score, 100) / 100);
  const color = score >= 95 ? 'rgb(34, 197, 94)' : score >= 75 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="220" viewBox="0 0 220 220" className="mb-4">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--wl-border-default)" strokeWidth="8" />
        <circle
          cx="110" cy="110" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '110px 110px' }}
        />
        <text x="110" y="108" textAnchor="middle" dy="0.3em" fontSize="36" fontWeight="bold" fill="var(--wl-foreground)">
          {score.toFixed(0)}
        </text>
        <text x="110" y="136" textAnchor="middle" fontSize="13" fill="var(--wl-text-secondary)">Health Score</text>
      </svg>
      <Badge variant={score >= 95 ? 'success' : score >= 75 ? 'warning' : 'danger'} className="mt-2">
        {score >= 95 ? 'Excellent' : score >= 75 ? 'Degraded' : 'Critical'}
      </Badge>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-wl-border-default last:border-0">
      <div className="flex items-center gap-3 flex-1">
        {service.name === 'API Server' ? (
          <Server className="w-4 h-4 text-wl-info-400 shrink-0" />
        ) : service.name.includes('Redis') ? (
          <Layers className="w-4 h-4 text-wl-warning-400 shrink-0" />
        ) : (
          <Database className="w-4 h-4 text-wl-primary-400 shrink-0" />
        )}
        <div>
          <h4 className="font-medium text-sm text-wl-text-primary">{service.name}</h4>
          <p className="text-xs text-wl-text-tertiary mt-0.5">
            Checked {service.lastChecked ? new Date(service.lastChecked).toLocaleTimeString() : '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {service.responseTime != null && (
          <p className="text-xs font-mono text-wl-text-secondary">{service.responseTime}ms</p>
        )}
        <Badge
          variant={service.status === 'healthy' ? 'success' : service.status === 'degraded' ? 'warning' : 'danger'}
          className="w-22 justify-center"
        >
          {service.status === 'healthy' ? 'Healthy' : service.status === 'degraded' ? 'Degraded' : 'Down'}
        </Badge>
      </div>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationStatus }) {
  return (
    <div className="border border-wl-border-default rounded-lg p-4 hover:bg-wl-bg-elevated transition-colors bg-wl-bg-surface">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm text-wl-text-primary">{integration.name}</h4>
          <p className="text-xs text-wl-text-secondary capitalize">{integration.provider}</p>
        </div>
        <Badge variant={integration.status === 'connected' ? 'success' : integration.status === 'error' ? 'danger' : 'warning'}>
          {integration.status === 'connected' ? 'Connected' : integration.status === 'error' ? 'Error' : 'Inactive'}
        </Badge>
      </div>
      {integration.lastSync && (
        <p className="text-xs text-wl-text-tertiary">
          Last sync: {new Date(integration.lastSync).toLocaleTimeString()}
        </p>
      )}
      {integration.error && (
        <div className="text-wl-danger-400 mt-2 p-2 bg-wl-danger-500/10 rounded text-xs">{integration.error}</div>
      )}
    </div>
  );
}

function AlertItem({ alert, onAcknowledge }: { alert: PlatformAlert; onAcknowledge: (id: string) => void }) {
  const [acked, setAcked] = useState(alert.acknowledged);

  return (
    <div className="border border-wl-border-default rounded-lg p-4 mb-3 last:mb-0 bg-wl-bg-surface">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}>
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </Badge>
          <div>
            <h4 className="font-semibold text-sm text-wl-text-primary">{alert.title}</h4>
            <p className="text-xs text-wl-text-secondary mt-1">{alert.description}</p>
            <p className="text-xs text-wl-text-tertiary mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
          </div>
        </div>
        {!acked ? (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setAcked(true); onAcknowledge(alert.id); }}
            className="ml-2"
          >
            Acknowledge
          </Button>
        ) : (
          <Badge variant="default" className="ml-2">Acknowledged</Badge>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, sublabel }: {
  label: string;
  value: number | string | undefined;
  unit?: string;
  sublabel?: string;
}) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-baseline gap-1">
          {value == null ? (
            <span className="text-2xl font-bold text-wl-text-tertiary">—</span>
          ) : (
            <span className="text-2xl font-bold text-wl-text-primary">{value}</span>
          )}
          {unit && value != null && <span className="text-xs text-wl-text-secondary">{unit}</span>}
        </div>
        {sublabel && <p className="text-xs text-wl-text-tertiary mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// ─── Page ─────────────────────────────────────────────────────

export default function PlatformHealthPage() {
  const {
    data: statusData,
    loading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useApiQuery<PlatformStatus>('/api/v4/platform/status');

  const {
    data: integrationsPayload,
    loading: intLoading,
    error: intError,
    refetch: refetchInt,
  } = useApiQuery<IntegrationsPayload>('/api/v4/platform/integrations');

  const {
    data: metricsData,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useApiQuery<PlatformMetrics>('/api/v4/platform/metrics');

  const {
    data: alertsPayload,
    error: alertsError,
    refetch: refetchAlerts,
  } = useApiQuery<AlertsPayload>('/api/v4/platform/alerts');

  const loading = statusLoading || intLoading || metricsLoading;
  const criticalError = statusError || intError || metricsError || alertsError;
  const services = statusData?.services ?? [];
  const healthScore = statusData?.score ?? 0;
  const integrations = integrationsPayload?.integrations ?? [];
  const alerts = alertsPayload?.alerts ?? [];

  const handleRefresh = useCallback(() => {
    refetchStatus();
    refetchInt();
    refetchMetrics();
    refetchAlerts();
  }, [refetchStatus, refetchInt, refetchMetrics, refetchAlerts]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    await api.post(`/api/v4/platform/alerts/${alertId}/acknowledge`, {});
  }, []);

  if (criticalError && !loading) {
    return (
      <div className="space-y-8 bg-wl-bg-root min-h-screen p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-wl-text-primary">Platform Health</h1>
          <p className="text-wl-text-secondary mt-2">Live system status and integration monitoring</p>
        </div>
        <ErrorState error={criticalError} onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-wl-bg-root min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-wl-text-primary">Platform Health</h1>
          <p className="text-wl-text-secondary mt-2">Live system status and integration monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="primary">
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          {loading ? 'Refreshing…' : 'Refresh Status'}
        </Button>
      </div>

      {/* Health Score + Process Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-wl-bg-surface border-wl-border-default h-full">
            <CardContent className="pt-6 flex items-center justify-center h-full">
              {statusLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Skeleton className="h-48 w-48 rounded-full" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ) : (
                <HealthScoreGauge score={healthScore} />
              )}
            </CardContent>
          </Card>
        </div>

        {metricsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-5 pb-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              label="Uptime"
              value={metricsData ? formatUptime(metricsData.uptimeSeconds) : undefined}
              sublabel="Since last restart"
            />
            <MetricCard
              label="Memory Usage"
              value={metricsData?.memUsagePct}
              unit="%"
              sublabel={metricsData ? `${metricsData.heapUsedMb} MB heap` : undefined}
            />
            <MetricCard
              label="DB Latency"
              value={metricsData?.dbLatencyMs}
              unit="ms"
              sublabel={metricsData ? metricsData.nodeVersion : undefined}
            />
          </>
        )}
      </div>

      {/* Service Status */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-wl-text-primary">
              Service Status
            </CardTitle>
            {statusData && (
              <div className="flex items-center gap-2">
                <Badge variant="success">{statusData.summary.healthy} Healthy</Badge>
                {statusData.summary.degraded > 0 && (
                  <Badge variant="warning">{statusData.summary.degraded} Degraded</Badge>
                )}
                {statusData.summary.down > 0 && (
                  <Badge variant="danger">{statusData.summary.down} Down</Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="py-8 text-center text-wl-text-secondary text-sm">
              No services reported
            </div>
          ) : (
            <div>
              {services.map((s) => <ServiceRow key={s.name} service={s} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Integrations */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-wl-text-primary">Connected Integrations</CardTitle>
            {integrationsPayload && (
              <Badge variant={integrationsPayload.summary.error > 0 ? 'warning' : 'success'}>
                {integrationsPayload.summary.connected} of {integrationsPayload.summary.total} active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {intLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : integrations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-wl-text-secondary">No integrations installed</p>
              <p className="text-xs text-wl-text-tertiary mt-1">
                Connect your first integration from the{' '}
                <Link href="/integrations/catalog" className="text-wl-info-400 hover:underline">
                  Integration Catalog
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {integrations.map((i) => <IntegrationCard key={i.provider} integration={i} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-wl-text-primary">
            Active Alerts
            {alertsPayload && alertsPayload.summary.pending > 0 && (
              <Badge variant="warning" className="ml-2">{alertsPayload.summary.pending} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-wl-success-500/10 flex items-center justify-center">
                <span className="text-wl-success-500 text-lg">✓</span>
              </div>
              <p className="text-sm text-wl-text-secondary">No active alerts</p>
              <p className="text-xs text-wl-text-tertiary mt-1">All systems operating normally</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
