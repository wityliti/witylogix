'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime?: number;
  lastChecked: string;
}

interface IntegrationStatus {
  name: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  accountsConnected?: number;
  error?: string;
}

interface PlatformAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

interface PlatformMetrics {
  activeConnections?: number;
  requestsPerSecond?: number;
  errorRate?: number;
  p95Latency?: number;
  p99Latency?: number;
}

interface PlatformHealth {
  score: number;
  services: ServiceStatus[];
}

function HealthScoreGauge({ score }: { score: number }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const color = score >= 95 ? 'rgb(34, 197, 94)' : score >= 85 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="220" viewBox="0 0 220 220" className="mb-4">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--wl-border)" strokeWidth="8" />
        <circle
          cx="110" cy="110" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '110px 110px' }}
        />
        <text x="110" y="110" textAnchor="middle" dy="0.3em" className="text-4xl font-bold" fill="var(--wl-foreground)">
          {score.toFixed(1)}
        </text>
        <text x="110" y="135" textAnchor="middle" className="text-sm fill-muted-foreground">Health Score</text>
      </svg>
      <Badge variant={score >= 95 ? 'success' : score >= 85 ? 'warning' : 'danger'} className="mt-2">
        {score >= 95 ? 'Excellent' : score >= 85 ? 'Good' : 'Needs Attention'}
      </Badge>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-wl-border-default last:border-0">
      <div className="flex-1">
        <h4 className="font-medium text-sm text-white">{service.name}</h4>
        <p className="text-xs text-gray-400 mt-1">
          Last checked: {service.lastChecked ? new Date(service.lastChecked).toLocaleTimeString() : '—'}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {service.responseTime != null && (
          <p className="text-xs font-mono text-gray-400">{service.responseTime}ms</p>
        )}
        <div className="text-right w-20">
          <p className="text-sm font-semibold text-white">{service.uptime?.toFixed(2)}%</p>
          <div className="w-16 h-1 bg-wl-bg-elevated rounded-full overflow-hidden mt-1 mx-auto">
            <div
              className={cn('h-full', service.uptime >= 99.5 ? 'bg-emerald-500' : service.uptime >= 99 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${Math.min(service.uptime, 100)}%` }}
            />
          </div>
        </div>
        <Badge
          variant={service.status === 'healthy' ? 'success' : service.status === 'degraded' ? 'warning' : 'danger'}
          className="w-20 justify-center"
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
          <h4 className="font-semibold text-sm text-white">{integration.name}</h4>
          <p className="text-xs text-gray-400 capitalize">{integration.provider}</p>
        </div>
        <Badge variant={integration.status === 'connected' ? 'success' : integration.status === 'error' ? 'danger' : 'warning'}>
          {integration.status === 'connected' ? 'Connected' : integration.status === 'error' ? 'Error' : 'Disconnected'}
        </Badge>
      </div>
      <div className="space-y-2 text-xs">
        {integration.accountsConnected != null && (
          <div className="flex justify-between">
            <span className="text-gray-400">Accounts:</span>
            <span className="font-medium text-white">{integration.accountsConnected}</span>
          </div>
        )}
        {integration.lastSync && (
          <div className="flex justify-between">
            <span className="text-gray-400">Last Sync:</span>
            <span className="font-mono text-gray-400">{new Date(integration.lastSync).toLocaleTimeString()}</span>
          </div>
        )}
        {integration.error && (
          <div className="text-red-400 mt-2 p-2 bg-red-500/10 rounded text-xs">{integration.error}</div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ alert, onAcknowledge }: { alert: PlatformAlert; onAcknowledge: (id: string) => void }) {
  const [acked, setAcked] = useState(alert.acknowledged);

  const handleAck = () => {
    setAcked(true);
    onAcknowledge(alert.id);
  };

  return (
    <div className="border border-wl-border-default rounded-lg p-4 mb-3 last:mb-0 bg-wl-bg-surface">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}>
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </Badge>
          <div>
            <h4 className="font-semibold text-sm text-white">{alert.title}</h4>
            <p className="text-xs text-gray-400 mt-1">{alert.description}</p>
            <p className="text-xs text-gray-400 mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
          </div>
        </div>
        {!acked ? (
          <Button variant="ghost" size="sm" onClick={handleAck} className="ml-2">Acknowledge</Button>
        ) : (
          <Badge variant="default" className="ml-2">Acknowledged</Badge>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: number | string | undefined; unit?: string }) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
          {unit && value != null && <span className="text-xs text-gray-400">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformHealthPage() {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useApiQuery<PlatformHealth>('/api/v4/platform/health');
  const { data: integrationsData, loading: intLoading, refetch: refetchInt } = useApiQuery<IntegrationStatus[] | { data: IntegrationStatus[] }>('/api/v4/platform/integrations');
  const { data: metrics } = useApiQuery<PlatformMetrics>('/api/v4/platform/metrics');
  const { data: alertsData, refetch: refetchAlerts } = useApiQuery<PlatformAlert[] | { data: PlatformAlert[] }>('/api/v4/platform/alerts');

  const loading = healthLoading || intLoading;
  const services = health?.services ?? [];
  const healthScore = health?.score ?? 0;
  const alerts = Array.isArray(alertsData) ? alertsData : ((alertsData as { data?: PlatformAlert[] })?.data ?? []);
  const integrations = Array.isArray(integrationsData) ? integrationsData : ((integrationsData as { data?: IntegrationStatus[] })?.data ?? []);

  const handleRefresh = () => {
    refetchHealth();
    refetchInt();
    refetchAlerts();
  };

  const handleAcknowledge = useCallback(async (alertId: string) => {
    await api.post('/api/v4/platform/alerts/acknowledge', { alertId });
  }, []);

  return (
    <div className="space-y-8 bg-wl-bg-root min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Platform Health</h1>
          <p className="text-gray-400 mt-2">System status overview and integration monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="primary">
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {/* Health Score + Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="pt-6">
              {healthLoading ? (
                <div className="h-[260px] flex items-center justify-center text-gray-400">Loading...</div>
              ) : (
                <HealthScoreGauge score={healthScore} />
              )}
            </CardContent>
          </Card>
        </div>
        <MetricCard label="Active Connections" value={metrics?.activeConnections} />
        <MetricCard label="Request Rate" value={metrics?.requestsPerSecond} unit="/s" />
        <MetricCard label="Error Rate" value={metrics?.errorRate != null ? metrics.errorRate.toFixed(2) : undefined} unit="%" />
      </div>

      {metrics && (metrics.p95Latency != null || metrics.p99Latency != null) && (
        <div className="grid grid-cols-2 gap-6">
          <MetricCard label="P95 Latency" value={metrics.p95Latency} unit="ms" />
          <MetricCard label="P99 Latency" value={metrics.p99Latency} unit="ms" />
        </div>
      )}

      {/* Service Status */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-white">Service Status ({services.length} monitored)</CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="py-8 text-center text-gray-400">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No services reported</div>
          ) : (
            <div className="divide-y divide-[#1e1e2e]">
              {services.map((s) => <ServiceRow key={s.name} service={s} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-white">
            Third-Party Integrations ({integrations.filter((i) => i.status === 'connected').length} connected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {intLoading ? (
            <div className="py-8 text-center text-gray-400">Loading integrations...</div>
          ) : integrations.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No integrations configured</div>
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
          <CardTitle className="text-white">
            Recent Alerts &amp; Incidents ({alerts.filter((a) => !a.acknowledged).length} pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No active alerts</p>
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
