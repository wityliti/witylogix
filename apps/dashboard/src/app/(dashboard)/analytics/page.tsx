'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useAnalyticsMetrics,
  useScheduledReports,
  useDataSources,
  useDashboards,
} from '@/hooks/use-analytics';

interface DataFreshness {
  source: string;
  lastSync: string;
  nextSync: string;
  status: 'fresh' | 'stale' | 'syncing';
  percentComplete?: number;
}

interface TopReport {
  id: string;
  name: string;
  executions: number;
  lastRun: string;
  avgDuration: number;
}

interface QueryPerformance {
  query: string;
  avgTime: number;
  status: 'fast' | 'slow' | 'critical';
  queryCount: number;
}

// Mock data for additional metrics
const DATA_FRESHNESS: DataFreshness[] = [
  {
    source: 'Production Database',
    lastSync: '2026-03-17T12:45:00Z',
    nextSync: '2026-03-17T13:45:00Z',
    status: 'fresh',
  },
  {
    source: 'CRM System',
    lastSync: '2026-03-17T12:30:00Z',
    nextSync: '2026-03-17T13:30:00Z',
    status: 'syncing',
    percentComplete: 65,
  },
  {
    source: 'Marketing API',
    lastSync: '2026-03-17T12:00:00Z',
    nextSync: '2026-03-17T14:00:00Z',
    status: 'fresh',
  },
  {
    source: 'Legacy System',
    lastSync: '2026-03-16T18:30:00Z',
    nextSync: '2026-03-18T18:30:00Z',
    status: 'stale',
  },
];

const TOP_REPORTS: TopReport[] = [
  {
    id: 'rep-001',
    name: 'Weekly Sales Summary',
    executions: 52,
    lastRun: '2026-03-16T08:00:00Z',
    avgDuration: 145,
  },
  {
    id: 'rep-002',
    name: 'Daily Operations Report',
    executions: 156,
    lastRun: '2026-03-17T06:00:00Z',
    avgDuration: 87,
  },
  {
    id: 'rep-003',
    name: 'Customer Cohort Analysis',
    executions: 28,
    lastRun: '2026-03-15T14:30:00Z',
    avgDuration: 342,
  },
  {
    id: 'rep-004',
    name: 'Revenue Recognition Report',
    executions: 12,
    lastRun: '2026-03-13T09:00:00Z',
    avgDuration: 256,
  },
];

const QUERY_PERFORMANCE: QueryPerformance[] = [
  {
    query: 'Daily Aggregates',
    avgTime: 240,
    status: 'fast',
    queryCount: 1245,
  },
  {
    query: 'Customer Lifetime Value',
    avgTime: 1850,
    status: 'slow',
    queryCount: 342,
  },
  {
    query: 'Anomaly Detection',
    avgTime: 3200,
    status: 'critical',
    queryCount: 89,
  },
  {
    query: 'Trend Analysis',
    avgTime: 680,
    status: 'fast',
    queryCount: 567,
  },
];

const ANOMALIES = [
  {
    id: 'anom-001',
    title: 'Unusual spike in transaction volume',
    severity: 'warning' as const,
    detectedTime: '2026-03-17T11:30:00Z',
    affectedMetric: 'Daily Orders',
  },
  {
    id: 'anom-002',
    title: 'Data quality issue in customer table',
    severity: 'danger' as const,
    detectedTime: '2026-03-17T10:15:00Z',
    affectedMetric: 'Customer Table',
  },
  {
    id: 'anom-003',
    title: 'Slower than usual query performance',
    severity: 'info' as const,
    detectedTime: '2026-03-17T09:45:00Z',
    affectedMetric: 'Query Performance',
  },
];

export default function AnalyticsPage() {
  const metrics = useAnalyticsMetrics();
  const scheduledReports = useScheduledReports();
  const dataSources = useDataSources();
  const dashboards = useDashboards();

  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.metrics.map((metric, idx) => (
          <StatCard
            key={metric.id}
            label={metric.name}
            value={metric.value.toLocaleString()}
            change={{
              value: metric.trend,
              label: metric.trendLabel,
            }}
            accentColor={`var(--wl-${metric.color}-500)`}
            index={idx}
          />
        ))}
      </div>

      {/* Data Freshness Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Data Freshness & Sync Status</CardTitle>
            <Button variant="secondary" size="sm">
              View All Sources
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DATA_FRESHNESS.map((source) => (
              <div key={source.source} className="flex items-start justify-between pb-4 border-b border-wl-border-subtle last:border-0">
                <div className="flex-1">
                  <h4 className="font-medium text-wl-text-primary">{source.source}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-xs text-wl-text-tertiary">
                      Last sync: {new Date(source.lastSync).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-wl-text-tertiary">
                      Next sync: {new Date(source.nextSync).toLocaleTimeString()}
                    </div>
                  </div>
                  {source.status === 'syncing' && source.percentComplete && (
                    <div className="mt-2 w-48 bg-wl-bg-overlay rounded-full h-1.5">
                      <div
                        className="h-full bg-wl-primary-500 rounded-full"
                        style={{ width: `${source.percentComplete}%` }}
                      />
                    </div>
                  )}
                </div>
                <Badge
                  variant={
                    source.status === 'fresh'
                      ? 'success'
                      : source.status === 'syncing'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {source.status === 'syncing' ? 'Syncing' : source.status === 'fresh' ? 'Fresh' : 'Stale'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Top Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {TOP_REPORTS.map((report) => (
                <div key={report.id} className="flex items-start justify-between pb-4 border-b border-wl-border-subtle last:border-0">
                  <div className="flex-1">
                    <h4 className="font-medium text-wl-text-primary">{report.name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-wl-text-tertiary">
                        Executions: {report.executions}
                      </span>
                      <span className="text-xs text-wl-text-tertiary">
                        {report.avgDuration}ms avg
                      </span>
                    </div>
                    <span className="text-xs text-wl-text-secondary">
                      Last: {new Date(report.lastRun).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Query Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Query Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {QUERY_PERFORMANCE.map((query) => (
                <div key={query.query} className="flex items-start justify-between pb-4 border-b border-wl-border-subtle last:border-0">
                  <div className="flex-1">
                    <h4 className="font-medium text-wl-text-primary">{query.query}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-wl-text-tertiary">
                        {query.avgTime}ms avg
                      </span>
                      <span className="text-xs text-wl-text-tertiary">
                        {query.queryCount} queries
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      query.status === 'fast'
                        ? 'success'
                        : query.status === 'slow'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {query.status === 'fast' ? 'Fast' : query.status === 'slow' ? 'Slow' : 'Critical'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detected Anomalies</CardTitle>
            <Badge variant="warning">{ANOMALIES.length} Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ANOMALIES.map((anomaly) => (
              <div
                key={anomaly.id}
                onClick={() => setSelectedAnomaly(selectedAnomaly === anomaly.id ? null : anomaly.id)}
                className={cn(
                  'p-4 rounded-lg border border-wl-border-subtle cursor-pointer transition-colors',
                  selectedAnomaly === anomaly.id && 'bg-wl-bg-overlay'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-wl-text-primary">{anomaly.title}</h4>
                      <Badge variant={anomaly.severity}>
                        {anomaly.severity === 'warning' ? 'Warning' : anomaly.severity === 'danger' ? 'Critical' : 'Info'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-wl-text-tertiary">
                        Metric: {anomaly.affectedMetric}
                      </span>
                      <span className="text-xs text-wl-text-tertiary">
                        {new Date(anomaly.detectedTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-wl-text-primary">
                {dashboards.dashboards.length}
              </div>
              <p className="text-sm text-wl-text-secondary mt-1">Active Dashboards</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-wl-text-primary">
                {scheduledReports.reports.length}
              </div>
              <p className="text-sm text-wl-text-secondary mt-1">Scheduled Reports</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-wl-text-primary">
                {dataSources.dataSources.length}
              </div>
              <p className="text-sm text-wl-text-secondary mt-1">Data Sources</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-wl-text-primary">
                {ANOMALIES.length}
              </div>
              <p className="text-sm text-wl-text-secondary mt-1">Anomalies</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
