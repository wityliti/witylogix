'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Download,
  FilterX,
  TrendingUp,
  DollarSign,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

// ── Types — aligned with PaymentTransaction DB model ──────────────

interface ApiPayment {
  id: string;
  shopId: string;
  orderId: string | null;
  shipmentId: string | null;
  paymentMethodId: string | null;
  /** Amount in cents (BigInt serialized as string or number) */
  amount: string | number;
  currency: string;
  type: string;          // charge | refund | adjustment | cod_collection
  status: string;        // pending | processing | completed | failed | refunded
  providerName: string | null;
  providerTxnId: string | null;
  providerRef: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shop?: { id: string; name: string };
}

function centsToUsd(cents: string | number): number {
  const n = typeof cents === 'string' ? parseFloat(cents) : Number(cents);
  return isNaN(n) ? 0 : n / 100;
}

function formatUsd(dollars: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  completed: { label: 'Completed', variant: 'success' },
  processing: { label: 'Processing', variant: 'info' },
  pending:    { label: 'Pending', variant: 'warning' },
  failed:     { label: 'Failed', variant: 'danger' },
  refunded:   { label: 'Refunded', variant: 'default' },
};

const TYPE_CONFIG: Record<string, string> = {
  charge: 'Charge',
  refund: 'Refund',
  adjustment: 'Adjustment',
  cod_collection: 'COD',
};

function statusConfig(status: string) {
  return STATUS_CONFIG[status.toLowerCase()] ?? { label: status, variant: 'default' as const };
}

// ── Stat card ──────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18`, color }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white/90 font-mono tracking-tight">{value}</p>
    </div>
  );
}

// ── Revenue bar chart (SVG, from real data) ────────────────────

interface RevenueBar {
  month: string;
  revenue: number;
  count: number;
}

function RevenueChart({ data }: { data: RevenueBar[] }) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-40 text-white/25 text-sm">No revenue data</div>
  );
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const chartH = 120;
  const barW = 40;
  const gap = 24;
  const totalW = data.length * (barW + gap);

  return (
    <svg width="100%" height={chartH + 40} viewBox={`0 0 ${totalW} ${chartH + 40}`} preserveAspectRatio="xMidYMid meet">
      {data.map((item, i) => {
        const bh = (item.revenue / maxRev) * chartH;
        const x = i * (barW + gap);
        const y = chartH - bh;
        return (
          <g key={item.month}>
            <rect x={x} y={y} width={barW} height={bh} fill="var(--wl-primary, #6366f1)" rx="4" opacity="0.8" />
            <text x={x + barW / 2} y={chartH + 14} fontSize="11" fill="rgba(255,255,255,0.4)" textAnchor="middle">
              {item.month}
            </text>
            <text x={x + barW / 2} y={y - 4} fontSize="10" fill="rgba(255,255,255,0.5)" textAnchor="middle">
              {item.revenue >= 1000 ? `$${(item.revenue / 1000).toFixed(0)}k` : formatUsd(item.revenue)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');

  const { items: payments, loading, error, refetch } = useApiList<ApiPayment>('/api/v4/payments', {
    limit: 100,
  });

  // Filter & sort
  const filtered = useMemo(() => {
    let result = payments;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.id.includes(q) ||
        (p.orderId ?? '').includes(q) ||
        (p.providerTxnId ?? '').toLowerCase().includes(q) ||
        (p.providerRef ?? '').toLowerCase().includes(q) ||
        (p.providerName ?? '').toLowerCase().includes(q)
      );
    }

    if (selectedType) {
      result = result.filter((p) => p.type.toLowerCase() === selectedType);
    }

    if (selectedStatus) {
      result = result.filter((p) => p.status.toLowerCase() === selectedStatus);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((p) => new Date(p.createdAt) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      result = result.filter((p) => new Date(p.createdAt) <= to);
    }

    const sorted = [...result];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'amount') {
      sorted.sort((a, b) => centsToUsd(b.amount) - centsToUsd(a.amount));
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    }
    return sorted;
  }, [searchQuery, selectedType, selectedStatus, dateFrom, dateTo, sortBy, payments]);

  // Stats from real data
  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status.toLowerCase() === 'completed');
    const pending = payments.filter((p) => ['pending', 'processing'].includes(p.status.toLowerCase()));
    const failed = payments.filter((p) => p.status.toLowerCase() === 'failed');

    const totalCollected = completed.reduce((s, p) => s + centsToUsd(p.amount), 0);
    const totalPending = pending.reduce((s, p) => s + centsToUsd(p.amount), 0);
    const totalFailed = failed.reduce((s, p) => s + centsToUsd(p.amount), 0);

    return {
      totalCollected,
      totalPending,
      totalFailed,
      completedCount: completed.length,
      pendingCount: pending.length,
    };
  }, [payments]);

  // Monthly revenue from real data
  const monthlyRevenue: RevenueBar[] = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    payments
      .filter((p) => p.status.toLowerCase() === 'completed')
      .forEach((p) => {
        const d = new Date(p.createdAt);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!map[key]) map[key] = { revenue: 0, count: 0 };
        map[key].revenue += centsToUsd(p.amount);
        map[key].count += 1;
      });
    return Object.entries(map)
      .map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }))
      .slice(-6);
  }, [payments]);

  const hasFilters = Boolean(searchQuery || selectedType || selectedStatus || dateFrom || dateTo);

  const handleExportCSV = useCallback(() => {
    const rows = filtered.map((p) => [
      p.id,
      p.orderId ?? '',
      formatUsd(centsToUsd(p.amount)),
      p.currency,
      TYPE_CONFIG[p.type] ?? p.type,
      statusConfig(p.status).label,
      p.providerName ?? '',
      p.providerTxnId ?? '',
      new Date(p.createdAt).toISOString(),
    ]);
    const csv = [
      ['ID', 'Order ID', 'Amount', 'Currency', 'Type', 'Status', 'Provider', 'Transaction ID', 'Created'].join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  if (loading && payments.length === 0) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-white/[0.06] rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-white/[0.04] rounded animate-pulse mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#111118] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-[#111118] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <ErrorState
          title="Could not load payments"
          message={error.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90 tracking-tight">Payment Tracking</h1>
          <p className="text-sm text-white/35 mt-0.5">Monitor and manage payment transactions</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportCSV} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Collected" value={formatUsd(stats.totalCollected)} icon={DollarSign} color="#34d399" />
        <StatTile label="Pending" value={formatUsd(stats.totalPending)} icon={Clock} color="#fbbf24" />
        <StatTile label="Failed" value={formatUsd(stats.totalFailed)} icon={XCircle} color="#f87171" />
        <StatTile label="Completed" value={String(stats.completedCount)} icon={CheckCircle2} color="#818cf8" />
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white/60 tracking-wide">Monthly Collected Revenue</h3>
        </div>
        <div className="flex justify-center">
          <RevenueChart data={monthlyRevenue} />
        </div>
      </div>

      {/* Collected vs Outstanding */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Collected</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400 mb-1 font-mono">{formatUsd(stats.totalCollected)}</p>
          <p className="text-xs text-white/30">{stats.completedCount} completed payments</p>
          {(stats.totalCollected + stats.totalPending) > 0 && (
            <div className="mt-3 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${(stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Outstanding</span>
          </div>
          <p className="text-3xl font-bold text-amber-400 mb-1 font-mono">{formatUsd(stats.totalPending)}</p>
          <p className="text-xs text-white/30">{stats.pendingCount} pending payments</p>
          {(stats.totalCollected + stats.totalPending) > 0 && (
            <div className="mt-3 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full"
                style={{ width: `${(stats.totalPending / (stats.totalCollected + stats.totalPending)) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5 flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search by ID, order, provider, reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0d0d14] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-[#0d0d14] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Types</option>
            <option value="charge">Charge</option>
            <option value="refund">Refund</option>
            <option value="cod_collection">COD</option>
            <option value="adjustment">Adjustment</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-[#0d0d14] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
            className="px-3 py-2 bg-[#0d0d14] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="status">Sort: Status</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('');
                setSelectedStatus('');
                setDateFrom('');
                setDateTo('');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              <FilterX className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.04] pt-3">
          <span className="text-xs text-white/30">Date range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1 bg-[#0d0d14] border border-white/[0.08] rounded text-sm text-white/60 focus:outline-none focus:border-indigo-500/50"
          />
          <span className="text-white/20 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1 bg-[#0d0d14] border border-white/[0.08] rounded text-sm text-white/60 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Payments table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12 flex flex-col items-center gap-3">
          <CreditCard className="w-10 h-10 text-white/10" />
          <p className="text-sm text-white/30">
            {hasFilters ? 'No payments match your filters' : 'No payment transactions yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Transaction ID', 'Order / Shipment', 'Amount', 'Type', 'Provider', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map((p) => {
                  const sc = statusConfig(p.status);
                  const amountUsd = centsToUsd(p.amount);
                  const isRefund = p.type === 'refund';
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-blue-400">
                          {(p.providerTxnId ?? p.providerRef ?? p.id).slice(0, 16)}…
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 font-mono text-xs">
                        {p.orderId ? p.orderId.slice(0, 8) : p.shipmentId ? p.shipmentId.slice(0, 8) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold font-mono">
                        <span className={isRefund ? 'text-red-400' : 'text-white/80'}>
                          {isRefund ? '-' : ''}{formatUsd(amountUsd)}
                        </span>
                        {p.currency !== 'USD' && (
                          <span className="text-xs text-white/25 ml-1">{p.currency}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50">
                        {TYPE_CONFIG[p.type] ?? p.type}
                      </td>
                      <td className="px-4 py-3 text-white/40">
                        {p.providerName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-white/30 text-xs">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-xs text-white/25">{filtered.length} transactions</span>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-white/20 animate-spin" />}
          </div>
        </div>
      )}

      {/* Recent feed */}
      {filtered.length > 0 && (
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Recent Transactions</h3>
          <div className="space-y-2.5">
            {filtered.slice(0, 5).map((p) => {
              const sc = statusConfig(p.status);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0d0d14] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                >
                  <div>
                    <p className="text-sm text-white/70 font-mono">
                      {(p.providerTxnId ?? p.providerRef ?? p.id).slice(0, 20)}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {TYPE_CONFIG[p.type] ?? p.type}
                      {p.providerName ? ` · ${p.providerName}` : ''}
                      {p.orderId ? ` · Order ${p.orderId.slice(0, 8)}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white/80 font-mono">{formatUsd(centsToUsd(p.amount))}</p>
                      <p className="text-xs text-white/30">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
