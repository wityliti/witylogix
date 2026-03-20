'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface AnalyticsData {
  metrics: {
    totalEvents: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    conversionRate: number;
  };
  dataFreshness: Array<{
    source: string;
    lastSync: string;
    nextSync: string;
    status: 'fresh' | 'stale' | 'syncing';
    percentComplete?: number;
  }>;
  topReports: Array<{
    id: string;
    name: string;
    executions: number;
    lastRun: string;
    avgDuration: number;
  }>;
  scheduledReports: Array<{
    id: string;
    name: string;
    frequency: string;
    lastRun: string;
    nextRun: string;
    status: string;
  }>;
}

/**
 * Analytics Overview Page
 *
 * Provides high-level summary of analytics infrastructure, data sources,
 * and reporting dashboard.
 */
export default function AnalyticsPage() {
  const { data, loading, error } = useApiQuery<AnalyticsData>(
    '/api/v4/analytics'
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  const metrics = data?.metrics;
  const dataFreshness = data?.dataFreshness || [];
  const topReports = data?.topReports || [];
  const scheduledReports = data?.scheduledReports || [];

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Analytics</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Data infrastructure and reporting</p>
            </div>
            <Button variant="primary" size="md">
              <RefreshCw className="w-4 h-4" />
              Sync All
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Key Metrics */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Total Events</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">
                  {metrics.totalEvents.toLocaleString()}
                </p>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Unique Users</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">
                  {metrics.uniqueUsers.toLocaleString()}
                </p>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Avg Session</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">
                  {Math.round(metrics.avgSessionDuration)}m
                </p>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Conversion</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">
                  {Math.round(metrics.conversionRate)}%
                </p>
              </Card>
            </div>
          )}

          {/* Data Freshness */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Data Freshness
            </h2>
            <div className="space-y-3">
              {dataFreshness.map((source) => (
                <div key={source.source} className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded border border-wl-border-default">
                  <div className="flex-1">
                    <p className="font-medium text-wl-text-primary">{source.source}</p>
                    <p className="text-sm text-wl-text-secondary mt-1">
                      Last: {new Date(source.lastSync).toLocaleString()} | Next: {new Date(source.nextSync).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={source.status === 'fresh' ? 'success' : source.status === 'syncing' ? 'info' : 'warning'}>
                    {source.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Reports */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Top Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Report</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Executions</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Last Run</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {topReports.map((report, idx) => (
                    <tr key={report.id} className={cn(
                      'border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors',
                      idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-transparent'
                    )}>
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{report.name}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">{report.executions}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{new Date(report.lastRun).toLocaleString()}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">{Math.round(report.avgDuration)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Scheduled Reports */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Scheduled Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Report</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Frequency</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Last Run</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Next Run</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map((report, idx) => (
                    <tr key={report.id} className={cn(
                      'border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors',
                      idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-transparent'
                    )}>
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{report.name}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{report.frequency}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{new Date(report.lastRun).toLocaleString()}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{new Date(report.nextRun).toLocaleString()}</td>
                      <td className="text-center px-4 py-3">
                        <Badge variant="success">{report.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
