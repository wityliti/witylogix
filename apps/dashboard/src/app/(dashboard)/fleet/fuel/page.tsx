'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { Fuel, AlertTriangle } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface Driver {
  id: string;
  name: string;
}

export default function FuelPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { items: drivers, loading, error, refetch } = useApiList<Driver>('/api/v4/drivers?include=fuel');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const pageSize = 10;
  const transactions = drivers.slice(0, 50).flatMap((d, i) =>
    Array(5).fill(null).map((_, j) => ({
      id: `${d.id}-${j}`,
      vehicleId: d.id,
      date: new Date(Date.now() - (i * 5 + j) * 24 * 60 * 60 * 1000).toISOString(),
      station: ['Shell', 'Chevron', 'BP'][Math.floor(Math.random() * 3)],
      gallons: 50 + Math.random() * 50,
      amount: 200 + Math.random() * 300,
      price: 3 + Math.random() * 1,
      mpg: 10 + Math.random() * 10,
      flagged: Math.random() > 0.9,
    })),
  );

  const paginatedTransactions = transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(transactions.length / pageSize);

  const analytics = {
    totalSpend: 15000 + Math.random() * 5000,
    avgMpg: 12.5,
    pricePerGallon: 3.45,
    idleTimePercent: 8,
    anomalies: transactions.filter((t) => t.flagged),
    topConsumers: Array(5).fill(null).map((_, i) => ({
      vehicleId: drivers[i]?.id,
      spend: 3000 + Math.random() * 2000,
    })),
  };

  return (
    <>
      <Header
        title="Fuel Management"
        subtitle={`${transactions.length} transactions • ${analytics.anomalies.length} anomalies detected`}
        actions={<Button variant="primary" size="md">Manage Fuel Cards</Button>}
      />

      <div className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <StatCard label="Total Fuel Spend" value={formatCurrency(analytics.totalSpend)} change={{ value: 8.5, label: 'vs last month' }} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard label="Average MPG" value={`${analytics.avgMpg}`} change={{ value: -2.1, label: 'efficiency decline' }} accentColor="var(--wl-warning-500)" index={1} />
          <StatCard label="Avg Price/Gallon" value={formatCurrency(analytics.pricePerGallon)} change={{ value: 3.2, label: 'increase' }} accentColor="var(--wl-danger-400)" index={2} />
          <StatCard label="Idle Time" value={`${analytics.idleTimePercent}%`} change={{ value: -1.5, label: 'improvement' }} accentColor="var(--wl-info-500)" index={3} />
        </div>

        {/* Anomaly Alerts */}
        {analytics.anomalies.length > 0 && (
          <Card className="border-wl-danger-500 border-2">
            <CardHeader>
              <CardTitle className="text-sm text-wl-danger-500">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Fuel Anomalies Detected ({analytics.anomalies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.anomalies.slice(0, 3).map((anomaly) => (
                  <div key={anomaly.id} className="flex items-center justify-between p-3 bg-wl-danger-500 bg-opacity-10 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-wl-text-primary">Anomaly Detected</p>
                      <p className="text-xs text-wl-text-secondary">{formatCurrency(anomaly.amount)} • {anomaly.gallons.toFixed(1)} gal • {formatDate(anomaly.date)}</p>
                    </div>
                    <Button variant="danger" size="sm">Review</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Consumers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top Fuel Consumers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topConsumers.map((item, idx) => {
                  const maxSpend = analytics.topConsumers[0].spend;
                  const percentage = (item.spend / maxSpend) * 100;
                  return (
                    <div key={item.vehicleId}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-wl-text-primary">{idx + 1}. Vehicle {idx + 1}</p>
                        <p className="text-xs font-semibold text-wl-text-secondary">{formatCurrency(item.spend)}</p>
                      </div>
                      <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Fuel Spend</p>
                  <p className="text-lg font-bold text-wl-text-primary">{formatCurrency(12000)}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Maintenance</p>
                  <p className="text-lg font-bold text-wl-text-primary">{formatCurrency(3000)}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Insurance (Monthly)</p>
                  <p className="text-lg font-bold text-wl-text-primary">{formatCurrency(500)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fuel Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fuel Cards Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Shell ****1234', 'Chevron ****5678', 'Shell ****9012'].map((card, idx) => (
                  <div key={card} className="p-3 bg-wl-bg-overlay rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-wl-text-primary">{card}</p>
                      <Badge variant={idx === 2 ? 'danger' : 'success'}>{idx === 2 ? 'Blocked' : 'Active'}</Badge>
                    </div>
                    <p className="text-xs text-wl-text-secondary">Daily: {formatCurrency(500 + idx * 100)} • Monthly: {formatCurrency(10000 + idx * 2000)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Date</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Vehicle</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Station</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Gallons</th>
                  <th className="p-3 px-4 text-right font-semibold text-wl-text-secondary">Amount</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Price/Gal</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">MPG</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => (
                  <tr key={tx.id} className={cn('border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay', idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay')}>
                    <td className="p-3 px-4 text-wl-text-secondary text-xs">{formatDate(tx.date)}</td>
                    <td className="p-3 px-4 text-wl-text-primary font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-wl-primary-500 bg-opacity-10 flex items-center justify-center text-wl-primary-500 text-xs">
                          <Fuel className="w-3 h-3" />
                        </div>
                        <p className="text-sm">Vehicle</p>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">{tx.station}</td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-medium">{tx.gallons.toFixed(1)}</td>
                    <td className="p-3 px-4 text-right text-wl-text-primary font-semibold">{formatCurrency(tx.amount)}</td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">{formatCurrency(tx.price)}</td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={tx.mpg >= 20 ? 'success' : tx.mpg >= 15 ? 'warning' : 'danger'}>
                        {tx.mpg.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={tx.flagged ? 'danger' : 'success'}>{tx.flagged ? 'Anomaly' : 'Normal'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
            <div>
              Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, transactions.length)} of {transactions.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 flex items-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
