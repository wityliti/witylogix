'use client';

import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface FinanceData {
  overview: {
    totalRevenue: number;
    totalInvoiced: number;
    outstandingPayments: number;
    avgPaymentTime: number;
  };
  reconciliation: {
    matched: number;
    unmatched: number;
    partial: number;
    discrepancies: number;
  };
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'invoice' | 'payment' | 'credit' | 'refund';
    status: 'completed' | 'pending' | 'failed';
  }>;
}

export default function FinancePage() {
  const { data, loading, error } = useApiQuery<FinanceData>(
    '/api/v4/payments?view=overview'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const overview = data?.overview;
  const reconciliation = data?.reconciliation;
  const transactions = data?.recentTransactions || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Finance</h1>
              <p className="text-sm text-gray-400 mt-1">Revenue, invoices, and payments</p>
            </div>
            <Button variant="primary" size="md">
              <DollarSign className="w-4 h-4" />
              Create Invoice
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className={cn("p-4 bg-[#12121a] border border-[#1e1e2e]")}>
                <p className="text-xs font-medium text-gray-400 uppercase">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-500 mt-2">
                  ${overview.totalRevenue.toLocaleString()}
                </p>
              </Card>
              <Card className={cn("p-4 bg-[#12121a] border border-[#1e1e2e]")}>
                <p className="text-xs font-medium text-gray-400 uppercase">Invoiced</p>
                <p className="text-2xl font-bold text-white mt-2">
                  ${overview.totalInvoiced.toLocaleString()}
                </p>
              </Card>
              <Card className={cn("p-4 bg-[#12121a] border border-[#1e1e2e]")}>
                <p className="text-xs font-medium text-gray-400 uppercase">Outstanding</p>
                <p className="text-2xl font-bold text-red-500 mt-2">
                  ${overview.outstandingPayments.toLocaleString()}
                </p>
              </Card>
              <Card className={cn("p-4 bg-[#12121a] border border-[#1e1e2e]")}>
                <p className="text-xs font-medium text-gray-400 uppercase">Avg Payment Time</p>
                <p className="text-2xl font-bold text-white mt-2">{overview.avgPaymentTime} days</p>
              </Card>
            </div>
          )}

          {reconciliation && (
            <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e]")}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Reconciliation Status
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-400">Matched</p>
                  <p className="text-2xl font-bold text-emerald-500 mt-2">{reconciliation.matched}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400">Unmatched</p>
                  <p className="text-2xl font-bold text-red-500 mt-2">{reconciliation.unmatched}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400">Partial</p>
                  <p className="text-2xl font-bold text-amber-500 mt-2">{reconciliation.partial}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400">Discrepancies</p>
                  <p className="text-2xl font-bold text-red-500 mt-2">{reconciliation.discrepancies}</p>
                </div>
              </div>
            </Card>
          )}

          <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e] overflow-hidden")}>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Type</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]">
                      <td className="px-4 py-3 text-gray-300">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-white">{tx.description}</td>
                      <td className="text-right px-4 py-3 font-medium text-white">
                        ${tx.amount.toLocaleString()}
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant="primary">{tx.type}</Badge>
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'}>
                          {tx.status}
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
