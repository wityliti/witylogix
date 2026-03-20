'use client';

import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RoutePerformanceData {
  summary: {
    totalRoutes: number;
    avgEfficiency: number;
    onTimeDeliveries: number;
    costPerDelivery: number;
  };
  metrics: Array<{
    routeId: string;
    routeName: string;
    plannedDistance: number;
    actualDistance: number;
    plannedTime: number;
    actualTime: number;
    efficiency: number;
    onTimeRate: number;
  }>;
}

export default function RoutePerformancePage() {
  const { data, loading, error } = useApiQuery<RoutePerformanceData>(
    '/api/v4/analytics?type=route-performance'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const summary = data?.summary;
  const metrics = data?.metrics || [];

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-wl-text-primary">Route Performance</h1>
          <p className="text-sm text-wl-text-secondary mt-1">Planned vs Actual analytics</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Total Routes</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">{summary.totalRoutes}</p>
              </Card>
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Avg Efficiency</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">{Math.round(summary.avgEfficiency)}%</p>
              </Card>
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">On-Time Deliveries</p>
                <p className="text-2xl font-bold text-wl-success-500 mt-2">{summary.onTimeDeliveries}%</p>
              </Card>
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Cost per Delivery</p>
                <p className="text-2xl font-bold text-wl-text-primary mt-2">${summary.costPerDelivery.toFixed(2)}</p>
              </Card>
            </div>
          )}

          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Route Metrics</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Route</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Planned</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Actual</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Efficiency</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">On-Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.routeId} className="border-b border-wl-border-default hover:bg-wl-bg-overlay">
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{metric.routeName}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">{metric.plannedDistance}mi</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">{metric.actualDistance}mi</td>
                      <td className="text-right px-4 py-3">
                        <Badge variant={metric.efficiency >= 90 ? 'success' : 'warning'}>
                          {Math.round(metric.efficiency)}%
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3">
                        <Badge variant={metric.onTimeRate >= 95 ? 'success' : 'info'}>
                          {Math.round(metric.onTimeRate)}%
                        </Badge>
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
