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
  const { items: drivers, loading, error, refetch } = useApiList<Driver>('/api/v4/fleet/vehicles');

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

      <main className="min-h-screen bg-[#0a0a0f] p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <StatCard label="Total Fuel Spend" value={formatCurrency(analytics.totalSpend)} change={{ value: 8.5, label: 'vs last month' }} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard label="Average MPG" value={`${analytics.avgMpg}`} change={{ value: -2.1, label: 'efficiency decline' }} accentColor="var(--wl-warning-500)" index={1} />
          <StatCard label="Avg Price/Gallon" value={formatCurrency(analytics.pricePerGallon)} change={{ value: 3.2, label: 'increase' }} accentColor="var(--wl-danger-400)" index={2} />
          <StatCard label="Idle Time" value={`${analytics.idleTimePercent}%`} change={{ value: -1.5, label: 'improvement' }} accentColor="var(--wl-info-500)" index={3} />
        </div>

        {/* Anomaly Alerts */}
        {analytics.anomalies.length > 0 && (
          <Card className="bg-[#12121a] border border-red-500/30">
            <CardHeader>
              <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Fuel Anomalies Detected ({analytics.anomalies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.anomalies.slice(0, 3).map((anomaly) => (
                  <div key={anomaly.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-md border border-[#1e1e2e]">
                    <div>
                      <p className="text-sm font-medium text-white">Anomaly Detected</p>
                      <p className="text-xs text-gray-400">{formatCurrency(anomaly.amount)} • {anomaly.gallons.toFixed(1)} gal • {formatDate(anomaly.date)}</p>
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
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-sm text-white">Top Fuel Consumers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topConsumers.map((item, idx) => {
                  const maxSpend = analytics.topConsumers[0].spend;
                  const percentage = (item.spend / maxSpend) * 100;
                  return (
                    <div key={item.vehicleId}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">{idx + 1}. Vehicle {idx + 1}</p>
                        <p className="text-xs font-semibold text-gray-400">{formatCurrency(item.spend)}</p>
                      </div>
                      <div className="h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-sm text-white">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Fuel Spend</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(12000)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Maintenance</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(3000)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Insurance (Monthly)</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(500)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fuel Cards */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-sm text-white">Fuel Cards Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Shell ****1234', 'Chevron ****5678', 'Shell ****9012'].map((card, idx) => (
                  <div key={card} className="p-3 bg-[#1a1a2e] rounded-md border border-[#1e1e2e]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-white">{card}</p>
                      <Badge variant={idx === 2 ? 'danger' : 'success'}>{idx === 2 ? 'Blocked' : 'Active'}</Badge>
                    </div>
                    <p className="text-xs text-gray-400">Daily: {formatCurrency(500 + idx * 100)} • Monthly: {formatCurrency(10000 + idx * 2000)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="overflow-hidden p-0 bg-[#12121a] border border-[#1e1e2e]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Date</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Vehicle</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Station</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Gallons</th>
                  <th className="p-3 px-4 text-right font-semibold text-gray-400">Amount</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Price/Gal</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">MPG</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => (
                  <tr key={tx.id} className={cn('border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e]', idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f14]')}>
                    <td className="p-3 px-4 text-gray-400 text-xs">{formatDate(tx.date)}</td>
                    <td className="p-3 px-4 text-white font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs">
                          <Fuel className="w-3 h-3" />
                        </div>
                        <p className="text-sm">Vehicle</p>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-center text-gray-400 text-xs">{tx.station}</td>
                    <td className="p-3 px-4 text-center text-white font-medium">{tx.gallons.toFixed(1)}</td>
                    <td className="p-3 px-4 text-right text-white font-semibold">{formatCurrency(tx.amount)}</td>
                    <td className="p-3 px-4 text-center text-gray-400 text-xs">{formatCurrency(tx.price)}</td>
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
          <div className="flex items-center justify-between p-4 border-t border-[#1e1e2e] bg-[#1a1a2e] text-sm text-gray-400">
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
              <span className="px-3 py-1 flex items-center text-gray-400">
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
      </main>
    </>
  );
}
