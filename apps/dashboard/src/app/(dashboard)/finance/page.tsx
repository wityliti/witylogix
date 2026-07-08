'use client';

import { useApiQuery, useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DollarSign, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface InvoiceSummary {
  totalInvoices: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalVoided: number;
  averageInvoiceAmount: number;
  paymentRate: number;
  byStatus: Record<string, number>;
  byCurrency: Record<string, number>;
}

interface Payment {
  id: string;
  createdAt: string;
  amount: string;
  status: string;
  type: string;
  method: string;
  reference?: string;
}

export default function FinancePage() {
  const { data: summaryData, loading: summaryLoading, error: summaryError } =
    useApiQuery<{ summary: InvoiceSummary }>('/api/v4/invoices/summary');
  const {
    items: payments,
    loading: paymentsLoading,
    error: paymentsError,
  } = useApiList<Payment>('/api/v4/payments');

  const loading = summaryLoading || paymentsLoading;
  const error = summaryError || paymentsError;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const summary = summaryData?.summary;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Finance</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Revenue, invoices, and payments</p>
            </div>
            <Link href="/invoices/create">
              <Button variant="primary" size="md">
                <DollarSign className="w-4 h-4" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className={cn('p-4 bg-wl-bg-surface border border-wl-border-default')}>
                <p className="text-xs font-medium text-wl-text-secondary uppercase">Total Billed</p>
                <p className="text-2xl font-bold text-emerald-500 mt-2">
                  ${summary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </Card>
              <Card className={cn('p-4 bg-wl-bg-surface border border-wl-border-default')}>
                <p className="text-xs font-medium text-wl-text-secondary uppercase">Collected</p>
                <p className="text-2xl font-bold text-white mt-2">
                  ${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </Card>
              <Card className={cn('p-4 bg-wl-bg-surface border border-wl-border-default')}>
                <p className="text-xs font-medium text-wl-text-secondary uppercase">Outstanding</p>
                <p className="text-2xl font-bold text-red-500 mt-2">
                  ${summary.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </Card>
              <Card className={cn('p-4 bg-wl-bg-surface border border-wl-border-default')}>
                <p className="text-xs font-medium text-wl-text-secondary uppercase">Payment Rate</p>
                <p className="text-2xl font-bold text-white mt-2">
                  {summary.paymentRate.toFixed(1)}%
                </p>
              </Card>
            </div>
          )}

          {summary && (
            <Card className={cn('p-6 bg-wl-bg-surface border border-wl-border-default')}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Invoice Status Breakdown
              </h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {Object.entries(summary.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <p className="text-xs font-medium text-wl-text-secondary capitalize">{status}</p>
                    <p
                      className={cn(
                        'text-2xl font-bold mt-2',
                        status === 'paid'
                          ? 'text-emerald-500'
                          : status === 'overdue'
                            ? 'text-red-500'
                            : status === 'voided'
                              ? 'text-wl-text-tertiary'
                              : 'text-white',
                      )}
                    >
                      {count}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className={cn('p-6 bg-wl-bg-surface border border-wl-border-default overflow-hidden')}>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Payments</h2>
            {payments.length === 0 ? (
              <p className="text-wl-text-secondary text-center py-8">No payments found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Reference</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Method</th>
                      <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 10).map((payment) => (
                      <tr key={payment.id} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                        <td className="px-4 py-3 text-wl-text-secondary">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {payment.reference || payment.id.slice(0, 8)}
                        </td>
                        <td className="text-right px-4 py-3 font-medium text-white">
                          $
                          {parseFloat(payment.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-center px-4 py-3">
                          <Badge variant="primary">{payment.method?.toLowerCase() ?? '—'}</Badge>
                        </td>
                        <td className="text-center px-4 py-3">
                          <Badge
                            variant={
                              payment.status === 'COMPLETED'
                                ? 'success'
                                : payment.status === 'FAILED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {payment.status?.toLowerCase() ?? '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
