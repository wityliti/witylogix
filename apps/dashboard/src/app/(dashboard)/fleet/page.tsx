'use client';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import {
  Truck,
  AlertTriangle,
  TrendingUp,
  Plus,
  AlertCircle,
  Wrench,
  Zap,
  Activity,
  CheckCircle2,
  Fuel,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface Driver {
  id: string;
  name: string;
  licenseNumber?: string;
  status?: string;
}

interface HealthCell {
  vehicleId: string;
  score: number;
}

export default function FleetOverviewPage() {
  const { items: drivers, loading, error, refetch } = useApiList<Driver>('/api/v4/drivers');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Generate health heatmap grid from drivers data
  const healthCells: HealthCell[] = drivers.map((driver) => ({
    vehicleId: driver.id,
    score: 75 + Math.random() * 25,
  }));

  const getHealthColor = (score: number): string => {
    if (score >= 90) return 'bg-wl-success-500';
    if (score >= 75) return 'bg-wl-warning-500';
    return 'bg-wl-danger-500';
  };

  const getActivityIcon = (type: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      maintenance: <Wrench className="w-4 h-4" />,
      fuel: <Fuel className="w-4 h-4" />,
      assignment: <Truck className="w-4 h-4" />,
      alert: <AlertTriangle className="w-4 h-4" />,
    };
    return icons[type] || <Activity className="w-4 h-4" />;
  };

  const activeVehicles = drivers.filter((d) => d.status === 'active').length;
  const totalVehicles = drivers.length;
  const overallScore = 85;

  return (
    <>
      <Header
        title="Fleet Management"
        subtitle={`${activeVehicles} active vehicles • 85% utilization`}
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" size="md">
              📅 Schedule Maintenance
            </Button>
            <Button variant="primary" size="md">
              + Add Vehicle
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <StatCard
            label="Total Fleet Cost"
            value={formatCurrency(45000)}
            change={{ value: 5.2, label: 'vs last month' }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Vehicles"
            value={activeVehicles}
            change={{ value: activeVehicles, label: `of ${totalVehicles}` }}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Maintenance Compliance"
            value="92%"
            change={{ value: 2.1, label: 'improvement' }}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Fleet Health Score"
            value={`${overallScore}/100`}
            change={{
              value: overallScore >= 85 ? 1.5 : -2.3,
              label: overallScore >= 85 ? 'vs last month' : 'decline',
            }}
            accentColor={overallScore >= 85 ? 'var(--wl-success-400)' : 'var(--wl-warning-400)'}
            index={3}
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Button variant="secondary" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
              <Button variant="secondary" size="sm">
                <Wrench className="w-4 h-4 mr-2" />
                Schedule Maintenance
              </Button>
              <Button variant="secondary" size="sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                View Alerts (0)
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fuel Spend Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Fuel Spend Trend (Last 8 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array(8).fill(null).map((_, idx) => {
                  const spend = 1000 + Math.random() * 500;
                  const maxSpend = 1500;
                  const percentage = (spend / maxSpend) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="text-xs font-medium text-wl-text-tertiary w-16 flex-shrink-0">
                        {new Date(Date.now() - (8 - idx) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-wl-text-primary w-20 text-right flex-shrink-0">
                        {formatCurrency(spend)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vehicle Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Active', count: activeVehicles, color: 'success' },
                  { label: 'Maintenance', count: 0, color: 'warning' },
                  { label: 'Idle', count: 0, color: 'info' },
                  { label: 'Retired', count: 0, color: 'default' },
                ].map((status) => (
                  <div key={status.label} className="flex items-center justify-between">
                    <span className="text-sm text-wl-text-secondary">{status.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.color as any}>{status.count}</Badge>
                      <span className="text-xs text-wl-text-tertiary">
                        ({Math.round((status.count / (totalVehicles || 1)) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Health Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fleet Health Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {healthCells.map((cell) => (
                <div
                  key={cell.vehicleId}
                  className={cn(
                    'aspect-square rounded-md flex items-center justify-center text-xs font-semibold text-white cursor-pointer transition-transform hover:scale-110 hover:shadow-lg',
                    getHealthColor(cell.score),
                  )}
                  title={`Vehicle: ${cell.vehicleId} - Score: ${cell.score}`}
                >
                  {Math.round(cell.score)}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-wl-success-500 rounded" />
                <span className="text-wl-text-secondary">Excellent (90+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-wl-warning-500 rounded" />
                <span className="text-wl-text-secondary">Good (75-89)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-wl-danger-500 rounded" />
                <span className="text-wl-text-secondary">At Risk (&lt;75)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {drivers.slice(0, 6).map((driver, idx) => (
                <div key={driver.id} className="flex gap-3 pb-3 border-b border-wl-border-subtle last:pb-0 last:border-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-wl-bg-overlay flex items-center justify-center text-wl-primary-500">
                    {getActivityIcon('assignment')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wl-text-primary">{driver.name}</p>
                    <p className="text-xs text-wl-text-tertiary truncate">Driver assigned to fleet</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-wl-text-tertiary whitespace-nowrap">
                    {idx}h ago
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
