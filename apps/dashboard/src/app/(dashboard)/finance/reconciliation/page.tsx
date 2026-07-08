'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link2, Unlink2, Check } from 'lucide-react';

interface ReconciliationData {
  bankTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    status: 'matched' | 'unmatched' | 'partial';
    confidence?: number;
  }>;
  internalRecords: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    status: 'matched' | 'unmatched' | 'partial';
  }>;
  unmatchedCount: number;
  discrepancyTotal: number;
}

export default function ReconciliationPage() {
  const [showUnmatched, setShowUnmatched] = useState(true);

  const { data, loading, error } = useApiQuery<ReconciliationData>(
    '/api/v4/payments?view=reconciliation'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const bankTx = data?.bankTransactions || [];
  const internalRecs = data?.internalRecords || [];

  if (!loading && bankTx.length === 0 && internalRecs.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-wl-bg-root items-center justify-center gap-4 p-6">
        <Link2 className="w-12 h-12 text-wl-text-tertiary" />
        <h2 className="text-xl font-semibold text-white">No transactions to reconcile</h2>
        <p className="text-wl-text-secondary text-sm text-center max-w-sm">
          Bank and internal records will appear here once payment data is available.
        </p>
        <Button variant="primary" size="md" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Reconciliation</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Match bank transactions with records</p>
            </div>
            <Button variant="primary" size="md">
              <Check className="w-4 h-4" />
              Auto-Match
            </Button>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setShowUnmatched(true)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                showUnmatched
                  ? 'bg-blue-500 text-white'
                  : 'bg-wl-bg-elevated text-wl-text-secondary'
              )}
            >
              Unmatched ({data?.unmatchedCount || 0})
            </button>
            <button
              onClick={() => setShowUnmatched(false)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                !showUnmatched
                  ? 'bg-blue-500 text-white'
                  : 'bg-wl-bg-elevated text-wl-text-secondary'
              )}
            >
              All Transactions
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={cn("p-4 bg-wl-bg-surface border border-wl-border-default")}>
              <p className="text-xs font-medium text-wl-text-secondary uppercase">Unmatched</p>
              <p className="text-2xl font-bold text-red-500 mt-2">{data?.unmatchedCount || 0}</p>
              <p className="text-xs text-wl-text-secondary mt-2">Transactions</p>
            </Card>
            <Card className={cn("p-4 bg-wl-bg-surface border border-wl-border-default")}>
              <p className="text-xs font-medium text-wl-text-secondary uppercase">Discrepancy Total</p>
              <p className="text-2xl font-bold text-amber-500 mt-2">
                ${(data?.discrepancyTotal || 0).toLocaleString()}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Variance</p>
            </Card>
            <Card className={cn("p-4 bg-wl-bg-surface border border-wl-border-default")}>
              <p className="text-xs font-medium text-wl-text-secondary uppercase">Match Rate</p>
              <p className="text-2xl font-bold text-white mt-2">
                {bankTx.length > 0 ? Math.round(((bankTx.length - (data?.unmatchedCount || 0)) / bankTx.length) * 100) : 0}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Success</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default overflow-hidden")}>
              <h2 className="text-lg font-semibold text-white mb-4">Bank Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankTx.map((tx) => (
                      <tr key={tx.id} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                        <td className="px-4 py-3 text-wl-text-secondary">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-white">
                          ${tx.amount.toLocaleString()}
                        </td>
                        <td className="text-center px-4 py-3">
                          <Badge variant={tx.status === 'matched' ? 'success' : tx.status === 'partial' ? 'warning' : 'danger'}>
                            {tx.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default overflow-hidden")}>
              <h2 className="text-lg font-semibold text-white mb-4">Internal Records</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalRecs.map((rec) => (
                      <tr key={rec.id} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                        <td className="px-4 py-3 text-wl-text-secondary">{new Date(rec.date).toLocaleDateString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-white">
                          ${rec.amount.toLocaleString()}
                        </td>
                        <td className="text-center px-4 py-3">
                          <Badge variant={rec.status === 'matched' ? 'success' : rec.status === 'partial' ? 'warning' : 'danger'}>
                            {rec.status}
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
    </div>
  );
}
