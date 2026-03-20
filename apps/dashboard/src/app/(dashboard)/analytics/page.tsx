'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Download,
  RefreshCw,
  Clock,
  TrendingUp,
  BarChart3,
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
 * and reporting dashboard with professional dark theme.
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
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              <p className="text-sm text-gray-400 mt-1">Data infrastructure and reporting dashboard</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Data
              </Button>
              <Button variant="primary" size="md">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6 max-w-7xl">
          {/* KPI Metric Cards */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Events</p>
                    <p className="text-3xl font-bold text-white mt-3">
                      {(metrics.totalEvents / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-400">+12% vs last week</span>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Unique Users</p>
                    <p className="text-3xl font-bold text-white mt-3">
                      {(metrics.uniqueUsers / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-400">+8% growth</span>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avg Session</p>
                    <p className="text-3xl font-bold text-white mt-3">
                      {Math.round(metrics.avgSessionDuration)}
                      <span className="text-lg text-gray-400 ml-1">min</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span className="text-gray-300">Session average</span>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Conversion Rate</p>
                    <p className="text-3xl font-bold text-white mt-3">
                      {Math.round(metrics.conversionRate)}
                      <span className="text-lg text-gray-400 ml-1">%</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3 text-amber-500" />
                      <span className="text-gray-300">3% improvement</span>
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Data Freshness Section */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Data Sync Status
            </h2>
            <div className="space-y-3">
              {dataFreshness.map((source) => (
                <div
                  key={source.source}
                  className="flex items-center justify-between p-4 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e] hover:border-blue-500/30 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{source.source}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(source.lastSync).toLocaleString()} · Next: {new Date(source.nextSync).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={source.status === 'fresh' ? 'success' : source.status === 'syncing' ? 'info' : 'warning'}>
                    {source.status === 'syncing' ? `${source.percentComplete || 0}%` : source.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Reports Table */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-4">Top Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Report Name</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Executions</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Last Run</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {topReports.map((report, idx) => (
                    <tr
                      key={report.id}
                      className={cn(
                        'border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors',
                        idx % 2 === 0 ? 'bg-[#0f0f14]' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">{report.name}</td>
                      <td className="text-right px-4 py-3 text-gray-300">{report.executions}</td>
                      <td className="px-4 py-3 text-gray-300">{new Date(report.lastRun).toLocaleString()}</td>
                      <td className="text-right px-4 py-3 text-gray-300">
                        <Badge variant="info">{Math.round(report.avgDuration)}ms</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Scheduled Reports Table */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-4">Scheduled Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Report</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Frequency</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Last Run</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Next Run</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map((report, idx) => (
                    <tr
                      key={report.id}
                      className={cn(
                        'border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors',
                        idx % 2 === 0 ? 'bg-[#0f0f14]' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">{report.name}</td>
                      <td className="px-4 py-3 text-gray-300">{report.frequency}</td>
                      <td className="px-4 py-3 text-gray-300">{new Date(report.lastRun).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{new Date(report.nextRun).toLocaleString()}</td>
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
