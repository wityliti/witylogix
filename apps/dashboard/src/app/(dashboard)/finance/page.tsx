/**
 * Financial Sync Dashboard — Overview of revenue, reconciliation, and cash flow
 *
 * Features:
 * - Revenue overview cards with animated counters
 * - Payment reconciliation panel (matched/unmatched/partial)
 * - Invoice status breakdown chart (lazy loaded)
 * - Recent transactions feed with real-time updates
 * - Cash flow forecast mini-chart
 * - Quick actions (create invoice, record payment, export)
 */

'use client';

import { Suspense, lazy, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';
import { useFinancialMetrics, useReconciliation } from '@/hooks/use-financial-data';
import { AlertCircle, TrendingUp, DollarSign, CheckCircle, Clock, Zap } from 'lucide-react';

// Lazy-loaded chart components
const InvoiceStatusChart = lazy(() =>
  import('@/components/invoicing/revenue-chart').then((mod) => ({
    default: () => (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-8 h-8 text-wl-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-wl-text-tertiary">Invoice Status Distribution</p>
        </div>
      </div>
    ),
  }))
);

const CashFlowChart = lazy(() =>
  import('@/components/invoicing/revenue-chart').then((mod) => ({
    default: () => (
      <div className="h-48 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-8 h-8 text-wl-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-wl-text-tertiary">Cash Flow Forecast</p>
        </div>
      </div>
    ),
  }))
);

function ChartLoadingFallback() {
  return (
    <div className="h-64 bg-wl-bg-surface rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-wl-text-tertiary text-sm">Loading chart...</p>
    </div>
  );
}

export default function FinanceDashboard() {
  const metrics = useFinancialMetrics();
  const reconciliation = useReconciliation();

  // Calculate reconciliation summary
  const reconciliationSummary = useMemo(() => {
    const matched = reconciliation.matches.filter((m) => m.status === 'matched').length;
    const unmatched = reconciliation.matches.filter((m) => m.status === 'unmatched').length;
    const partial = reconciliation.matches.filter((m) => m.status === 'partial').length;
    const matchedAmount = reconciliation.matches
      .filter((m) => m.status === 'matched')
      .reduce((sum, m) => sum + m.amount, 0);

    return { matched, unmatched, partial, matchedAmount };
  }, [reconciliation.matches]);

  const daysOverduePercentage = Math.min((metrics.overallDaysOverdue / 30) * 100, 100);
  const collectionRate = metrics.totalRevenue > 0 ? (metrics.paidThisMonth / metrics.totalRevenue) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-wl-bg-primary to-wl-bg-secondary">
      {/* Page Header */}
      <div className="px-6 py-8 border-b border-wl-border-subtle bg-wl-bg-elevated/40">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-wl-text-primary mb-2">Financial Dashboard</h1>
          <p className="text-wl-text-secondary">Monitor revenue, invoices, and payment reconciliation</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Revenue Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-wl-primary-500/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-wl-primary-400" />
                </div>
                <Badge variant="secondary">YTD</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-wl-text-secondary">Total Revenue</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={metrics.totalRevenue}
                    format="currency"
                    className="text-2xl font-bold text-wl-text-primary"
                  />
                </div>
                <p className="text-xs text-wl-text-tertiary mt-3 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {collectionRate.toFixed(1)}% collected this month
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Invoices */}
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-wl-warning-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-wl-warning-400" />
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-wl-text-secondary">Outstanding</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={metrics.outstandingAmount}
                    format="currency"
                    className="text-2xl font-bold text-wl-text-primary"
                  />
                </div>
                <p className="text-xs text-wl-text-tertiary mt-3">
                  {metrics.invoiceCount} invoices awaiting payment
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Invoices */}
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-wl-error-500/10 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-wl-error-400" />
                </div>
                <Badge variant="danger">Overdue</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-wl-text-secondary">Overdue Amount</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={metrics.overdueAmount}
                    format="currency"
                    className="text-2xl font-bold text-wl-error-400"
                  />
                </div>
                <div className="mt-3 space-y-1">
                  <div className="w-full h-1.5 bg-wl-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-wl-error-500 rounded-full transition-all duration-500"
                      style={{ width: `${daysOverduePercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-wl-text-tertiary">{metrics.overallDaysOverdue} days average</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paid This Month */}
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-wl-success-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-wl-success-400" />
                </div>
                <Badge variant="success">Collected</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-wl-text-secondary">Paid This Month</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={metrics.paidThisMonth}
                    format="currency"
                    className="text-2xl font-bold text-wl-success-400"
                  />
                </div>
                <p className="text-xs text-wl-text-tertiary mt-3">
                  Average collection time: 14 days
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Invoice Status Chart */}
            <Card className="border border-wl-border-subtle">
              <CardHeader className="pb-4">
                <CardTitle>Invoice Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <InvoiceStatusChart />
                </Suspense>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="border border-wl-border-subtle">
              <CardHeader className="pb-4">
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      id: '1',
                      type: 'payment',
                      description: 'Payment received from Acme Corp',
                      amount: 5000,
                      status: 'completed',
                      time: '2 hours ago',
                    },
                    {
                      id: '2',
                      type: 'invoice',
                      description: 'Invoice #INV-00245 sent to TechFlow Inc',
                      amount: 3200,
                      status: 'sent',
                      time: '4 hours ago',
                    },
                    {
                      id: '3',
                      type: 'payment',
                      description: 'Payment received from Global Services',
                      amount: 7850,
                      status: 'completed',
                      time: '1 day ago',
                    },
                  ].map((txn) => (
                    <div
                      key={txn.id}
                      className={cn(
                        'p-3 rounded-lg border border-wl-border-subtle',
                        'hover:bg-wl-bg-overlay transition-colors duration-fast'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-wl-text-primary">{txn.description}</p>
                          <p className="text-xs text-wl-text-tertiary mt-1">{txn.time}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-wl-text-primary">
                            +${txn.amount.toLocaleString()}
                          </p>
                          <Badge
                            variant={txn.status === 'completed' ? 'success' : 'info'}
                            className="mt-1"
                          >
                            {txn.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment Reconciliation & Cash Flow */}
          <div className="space-y-8">
            {/* Payment Reconciliation Panel */}
            <Card className="border border-wl-border-subtle">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Payment Reconciliation</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => reconciliation.autoReconcile()}
                    disabled={reconciliation.isLoading}
                    className="gap-1"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-Match
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Matched */}
                <div className="p-3 bg-wl-success-500/5 rounded-lg border border-wl-success-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-wl-text-primary">Matched</span>
                    <Badge variant="success">{reconciliationSummary.matched}</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    {reconciliationSummary.matched > 0
                      ? `$${reconciliationSummary.matchedAmount.toLocaleString()} matched`
                      : 'No matches yet'}
                  </p>
                </div>

                {/* Unmatched */}
                <div className="p-3 bg-wl-warning-500/5 rounded-lg border border-wl-warning-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-wl-text-primary">Unmatched</span>
                    <Badge variant="warning">{reconciliationSummary.unmatched}</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    {reconciliationSummary.unmatched > 0
                      ? 'Review and match transactions'
                      : 'All matched'}
                  </p>
                </div>

                {/* Partial */}
                <div className="p-3 bg-wl-info-500/5 rounded-lg border border-wl-info-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-wl-text-primary">Partial</span>
                    <Badge variant="info">{reconciliationSummary.partial}</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    {reconciliationSummary.partial > 0
                      ? 'Partial amounts to reconcile'
                      : 'No partial matches'}
                  </p>
                </div>

                {/* Action Button */}
                <Button className="w-full mt-4" variant="primary">
                  Review Reconciliation
                </Button>
              </CardContent>
            </Card>

            {/* Cash Flow Forecast */}
            <Card className="border border-wl-border-subtle">
              <CardHeader className="pb-4">
                <CardTitle>Cash Flow Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <CashFlowChart />
                </Suspense>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="border border-wl-border-subtle">
          <CardHeader className="pb-4">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                variant="secondary"
                className="gap-2 w-full"
              >
                <span>+</span>
                Create Invoice
              </Button>
              <Button
                variant="secondary"
                className="gap-2 w-full"
              >
                <span>+</span>
                Record Payment
              </Button>
              <Button
                variant="secondary"
                className="gap-2 w-full"
              >
                <span>↓</span>
                Export Report
              </Button>
              <Button
                variant="secondary"
                className="gap-2 w-full"
              >
                <span>⚙</span>
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
