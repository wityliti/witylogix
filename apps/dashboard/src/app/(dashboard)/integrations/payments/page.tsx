'use client';

import { useState } from 'react';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Settings,
  Power,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  Activity,
  Eye,
  Download,
  Shield,
  Send,
  Clock,
  RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface Gateway {
  id: string;
  name: string;
  code: string;
  status: 'connected' | 'disconnected' | 'error';
  isDefault: boolean;
  transactionFeePercent: number;
  fixedFeeInCents: number;
  healthScore: number;
  config?: { lastDigits?: string; expiryDate?: string };
}

interface PaymentTx {
  id: string;
  createdAt: string;
  amount: string | number;
  status: string;
  type: string;
  method: string;
  reference?: string;
  customerId?: string;
}

interface PaymentSummary {
  totalRevenue: number;
  byStatus: Array<{ status: string; _sum: { amount: string }; _count: number }>;
  byMethod: Array<{ method: string; _sum: { amount: string }; _count: number }>;
}

interface PaymentMethod {
  id: string;
  type: string;
  displayName: string;
  isDefault: boolean;
  lastDigits?: string;
  expiryDate?: string;
  createdAt: string;
}

interface ReconciliationItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'matched' | 'unmatched';
  confidence: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtAmt(amt: string | number): string {
  const n = typeof amt === 'string' ? parseFloat(amt) : amt;
  if (isNaN(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function gatewayIcon(code: string) {
  const icons: Record<string, React.ReactNode> = {
    stripe: <CreditCard className="w-5 h-5" />,
    paypal: <DollarSign className="w-5 h-5" />,
    square: <Activity className="w-5 h-5" />,
    braintree: <Shield className="w-5 h-5" />,
    authorize_net: <Send className="w-5 h-5" />,
    adyen: <TrendingUp className="w-5 h-5" />,
    cod: <DollarSign className="w-5 h-5" />,
  };
  return icons[code] ?? <CreditCard className="w-5 h-5" />;
}

function txStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'successful') return <Badge variant="success" className="text-xs">Paid</Badge>;
  if (s === 'pending') return <Badge variant="warning" className="text-xs capitalize">{status}</Badge>;
  if (s === 'failed' || s === 'disputed') return <Badge variant="danger" className="text-xs capitalize">{status}</Badge>;
  return <Badge variant="default" className="text-xs capitalize">{status}</Badge>;
}

function methodLabel(type: string): string {
  const map: Record<string, string> = {
    stripe: 'Stripe', paypal: 'PayPal', square: 'Square',
    credit_card: 'Credit Card', debit_card: 'Debit Card',
    bank_transfer: 'Bank Transfer', cod: 'Cash on Delivery',
    wallet: 'Digital Wallet',
  };
  return map[type.toLowerCase()] ?? type;
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  label,
  badge,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  badge?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <button
        className="flex items-center justify-between w-full mb-5 text-left group"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-wl-text-primary">{label}</h2>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-wl-text-tertiary transition-transform group-hover:text-wl-text-secondary',
            expanded ? 'rotate-180' : '',
          )}
        />
      </button>
      {expanded && children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PaymentsIntegrationPage() {
  const [sections, setSections] = useState({
    gateways: true,
    transactions: true,
    methods: false,
    reconciliation: false,
  });

  const toggle = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Data fetching ─────────────────────────────────────────────────────

  const {
    data: gatewaysData,
    loading: gwLoading,
    error: gwError,
    refetch: gwRefetch,
  } = useApiQuery<{ gateways: Gateway[] }>('/api/v4/payments/gateways');

  const {
    data: summaryData,
    loading: sumLoading,
  } = useApiQuery<PaymentSummary>('/api/v4/payments/summary');

  const {
    items: transactions,
    loading: txLoading,
    error: txError,
    refetch: txRefetch,
  } = useApiList<PaymentTx>('/api/v4/payments', { limit: 10 });

  const {
    items: paymentMethods,
    loading: pmLoading,
    error: pmError,
    refetch: pmRefetch,
  } = useApiList<PaymentMethod>('/api/v4/payment-methods', { limit: 25 });

  const {
    data: reconData,
    loading: reconLoading,
    error: reconError,
    refetch: reconRefetch,
  } = useApiQuery<{ bankTransactions: ReconciliationItem[] }>('/api/v4/payments/reconciliation');

  // ── Derived stats ─────────────────────────────────────────────────────

  const gateways: Gateway[] = gatewaysData?.gateways ?? [];
  const connectedCount = gateways.filter((g) => g.status === 'connected').length;

  const totalRevenue = summaryData?.totalRevenue ?? 0;
  const totalTxns = summaryData?.byStatus?.reduce((s, b) => s + b._count, 0) ?? 0;
  const totalFeesPct = gateways.length
    ? gateways.reduce((s, g) => s + g.transactionFeePercent, 0) / gateways.length
    : 2.9;

  const reconItems: ReconciliationItem[] = reconData?.bankTransactions ?? [];
  const unmatchedCount = reconItems.filter((r) => r.status === 'unmatched').length;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Payment Integrations"
        subtitle="Manage payment processors, transactions, and settlement reconciliation"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link href="/integrations">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5 text-wl-text-tertiary hover:text-wl-text-secondary">
            <ChevronLeft className="w-4 h-4" />
            Back to Integrations
          </Button>
        </Link>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Connected Gateways',
              value: gwLoading ? '…' : `${connectedCount}/${gateways.length}`,
              sub: 'active integrations',
              color: 'text-emerald-400',
            },
            {
              label: 'Total Volume',
              value: sumLoading ? '…' : fmtAmt(totalRevenue),
              sub: 'lifetime processed',
              color: 'text-wl-text-primary',
            },
            {
              label: 'Total Transactions',
              value: sumLoading ? '…' : totalTxns.toLocaleString(),
              sub: 'all time',
              color: 'text-wl-text-primary',
            },
            {
              label: 'Avg Gateway Fee',
              value: `${totalFeesPct.toFixed(2)}%`,
              sub: 'across providers',
              color: 'text-amber-400',
            },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-5"
            >
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide mb-2">{label}</p>
              <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
              <p className="text-xs text-wl-text-tertiary mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Gateways ─────────────────────────────────────────────── */}
        <Section
          label="Payment Gateways"
          badge={
            <Badge variant="success" className="bg-emerald-500/15 text-emerald-400 text-xs">
              {connectedCount} connected
            </Badge>
          }
          expanded={sections.gateways}
          onToggle={() => toggle('gateways')}
        >
          {gwLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : gwError ? (
            <ErrorState title="Failed to load gateways" onRetry={gwRefetch} />
          ) : gateways.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-10 text-center">
              <CreditCard className="w-8 h-8 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary mb-1">No payment gateways configured</p>
              <p className="text-xs text-wl-text-tertiary mb-4">Connect Stripe, PayPal, Square, or other providers</p>
              <Link href="/settings/payments">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Gateway
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {gateways.map((gw) => (
                <Card key={gw.id} className="bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-wl-bg-elevated border border-wl-border-default flex items-center justify-center text-wl-text-secondary">
                          {gatewayIcon(gw.code)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-wl-text-primary">{gw.name}</h3>
                          <p className="text-xs text-wl-text-tertiary mt-0.5">
                            {gw.transactionFeePercent}% + ${(gw.fixedFeeInCents / 100).toFixed(2)} per txn
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gw.isDefault && (
                          <Badge variant="info" className="text-xs bg-blue-500/10 text-blue-400">Default</Badge>
                        )}
                        <Badge
                          variant={gw.status === 'connected' ? 'success' : gw.status === 'error' ? 'danger' : 'default'}
                          className="text-xs"
                        >
                          {gw.status === 'connected' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {gw.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                          <span className="capitalize">{gw.status}</span>
                        </Badge>
                      </div>
                    </div>

                    {gw.status === 'connected' && (
                      <div className="flex items-center gap-2 mb-4 text-xs text-wl-text-tertiary">
                        <Clock className="w-3 h-3" />
                        Health score: <span className="text-emerald-400 font-medium">{gw.healthScore}/100</span>
                        {gw.config?.lastDigits && (
                          <span className="ml-auto">•••• {gw.config.lastDigits}</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-wl-border-default">
                      {gw.status === 'connected' ? (
                        <>
                          <Link href="/settings/payments" className="flex-1">
                            <Button variant="secondary" size="sm" className="w-full">
                              <Settings className="w-4 h-4 mr-1.5" />
                              Configure
                            </Button>
                          </Link>
                          <Button variant="danger" size="sm" className="flex-1">
                            <Power className="w-4 h-4 mr-1.5" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Link href="/settings/payments" className="flex-1">
                          <Button variant="primary" size="sm" className="w-full">
                            <Plus className="w-4 h-4 mr-1.5" />
                            {gw.status === 'error' ? 'Reconnect' : 'Connect'}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* ── Recent Transactions ───────────────────────────────────── */}
        <Section
          label="Recent Transactions"
          badge={
            <Badge variant="info" className="bg-blue-500/10 text-blue-400 text-xs">
              Last 10
            </Badge>
          }
          expanded={sections.transactions}
          onToggle={() => toggle('transactions')}
        >
          {txLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : txError ? (
            <ErrorState title="Failed to load transactions" onRetry={txRefetch} />
          ) : transactions.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-10 text-center">
              <Activity className="w-8 h-8 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary mb-1">No transactions yet</p>
              <p className="text-xs text-wl-text-tertiary">Transactions will appear once payments are processed</p>
            </div>
          ) : (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    {['Date', 'Method', 'Amount', 'Status', 'Reference'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-default">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-wl-bg-elevated transition-colors">
                      <td className="px-4 py-3 text-wl-text-secondary text-xs">
                        {new Date(txn.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary text-xs">{methodLabel(txn.method)}</td>
                      <td className={cn('px-4 py-3 font-semibold font-mono text-sm', txn.type === 'REFUND' ? 'text-red-400' : 'text-wl-text-primary')}>
                        {txn.type === 'REFUND' ? '-' : ''}{fmtAmt(txn.amount)}
                      </td>
                      <td className="px-4 py-3">{txStatusBadge(txn.status)}</td>
                      <td className="px-4 py-3 text-wl-text-tertiary text-xs font-mono">
                        {txn.reference ?? txn.id.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-wl-border-default flex justify-end">
                <Link href="/payments">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
                    View all transactions
                    <ChevronLeft className="w-3 h-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Section>

        {/* ── Payment Methods ───────────────────────────────────────── */}
        <Section
          label="Payment Methods"
          badge={
            <Badge variant="default" className="text-xs">
              {paymentMethods.length} configured
            </Badge>
          }
          expanded={sections.methods}
          onToggle={() => toggle('methods')}
        >
          {pmLoading ? (
            <TableSkeleton rows={3} columns={3} />
          ) : pmError ? (
            <ErrorState title="Failed to load payment methods" onRetry={pmRefetch} />
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-8 text-center">
              <CreditCard className="w-7 h-7 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary mb-1">No payment methods saved</p>
              <p className="text-xs text-wl-text-tertiary mb-4">Add credit cards, bank accounts, or digital wallets</p>
              <Link href="/settings/payments">
                <Button variant="primary" size="sm"><Plus className="w-4 h-4 mr-1.5" />Add Method</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between rounded-xl bg-wl-bg-surface border border-wl-border-default px-5 py-4 hover:border-wl-border-strong transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-wl-bg-elevated border border-wl-border-default flex items-center justify-center text-wl-text-secondary">
                      {gatewayIcon(pm.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-wl-text-primary">{pm.displayName}</p>
                      <p className="text-xs text-wl-text-tertiary mt-0.5">
                        {pm.lastDigits ? `•••• ${pm.lastDigits}` : methodLabel(pm.type)}
                        {pm.expiryDate && ` · Exp ${pm.expiryDate}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pm.isDefault && (
                      <Badge variant="success" className="text-xs bg-emerald-500/10 text-emerald-400">Default</Badge>
                    )}
                    <Link href="/settings/payments">
                      <Button variant="ghost" size="sm" className="text-wl-text-tertiary hover:text-wl-text-secondary">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              <Link href="/settings/payments">
                <Button variant="secondary" className="w-full mt-2">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Payment Method
                </Button>
              </Link>
            </div>
          )}
        </Section>

        {/* ── Reconciliation ────────────────────────────────────────── */}
        <Section
          label="Reconciliation"
          badge={
            unmatchedCount > 0 ? (
              <Badge variant="warning" className="bg-amber-500/10 text-amber-400 text-xs">
                {unmatchedCount} unmatched
              </Badge>
            ) : (
              <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 text-xs">All matched</Badge>
            )
          }
          expanded={sections.reconciliation}
          onToggle={() => toggle('reconciliation')}
        >
          {reconLoading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : reconError ? (
            <ErrorState title="Failed to load reconciliation data" onRetry={reconRefetch} />
          ) : reconItems.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-8 text-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary">No reconciliation issues</p>
              <p className="text-xs text-wl-text-tertiary mt-1">All transactions are matched</p>
            </div>
          ) : (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    {['Date', 'Description', 'Amount', 'Status', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-default">
                  {reconItems.map((item) => (
                    <tr key={item.id} className="hover:bg-wl-bg-elevated transition-colors">
                      <td className="px-4 py-3 text-xs text-wl-text-tertiary">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary max-w-xs truncate">{item.description}</td>
                      <td className="px-4 py-3 font-mono text-sm text-wl-text-primary">{fmtAmt(item.amount)}</td>
                      <td className="px-4 py-3">
                        {item.status === 'matched' ? (
                          <Badge variant="success" className="text-xs bg-emerald-500/10 text-emerald-400">Matched</Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs bg-amber-500/10 text-amber-400">Unmatched</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="text-xs text-wl-text-tertiary hover:text-wl-text-secondary">
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-wl-border-default flex items-center justify-between">
                <p className="text-xs text-wl-text-tertiary">Last 30 days</p>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
                  <Download className="w-3 h-3 mr-1" />
                  Export CSV
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* Footer CTA */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-wl-bg-surface border border-wl-border-default px-5 py-4">
          <div>
            <p className="text-sm font-medium text-wl-text-primary">Need another payment provider?</p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">Browse the marketplace for Stripe, PayPal, Square and 20+ more</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
              <RefreshCw className="w-3.5 h-3.5" />
              Sync All
            </Button>
            <Link href="/integrations/marketplace">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Provider
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
