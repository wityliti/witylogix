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
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/loading-skeleton';

// ── Types ────────────────────────────────────────────────────

/** Matches the API response after BigInt→number conversion (amount in dollars) */
interface PaymentTransaction {
  id: string;
  shopId: string;
  orderId: string | null;
  shipmentId: string | null;
  paymentMethodId: string | null;
  amount: number; // dollars (API converts cents/100)
  currency: string;
  type: string; // charge, refund, adjustment, cod_collection
  status: string; // pending, processing, completed, failed, refunded
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

interface MonthlyRevenue {
  month: string;
  revenue: number;
  count: number;
}

// ── Helpers ──────────────────────────────────────────────────

function normalizeStatus(status: string): 'completed' | 'pending' | 'failed' | 'processing' | 'other' {
  const s = status?.toLowerCase() ?? '';
  if (s === 'completed' || s === 'refunded') return 'completed';
  if (s === 'pending') return 'pending';
  if (s === 'processing') return 'processing';
  if (s === 'failed' || s === 'cancelled') return 'failed';
  return 'other';
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const n = normalizeStatus(status);
  if (n === 'completed') return 'success';
  if (n === 'pending') return 'warning';
  if (n === 'processing') return 'info';
  if (n === 'failed') return 'danger';
  return 'default';
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    charge: 'Charge',
    refund: 'Refund',
    adjustment: 'Adjustment',
    cod_collection: 'COD',
  };
  return labels[type] ?? type;
}

function providerLabel(name: string | null): string {
  if (!name) return '—';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Simple SVG Bar Chart ─────────────────────────────────────

function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const chartH = 160;
  const barW = 40;
  const gap = 28;
  const padL = 8;

  return (
    <svg
      width="100%"
      height={chartH + 32}
      viewBox={`0 0 ${data.length * (barW + gap) + padL} ${chartH + 32}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((item, i) => {
        const barH = Math.max((item.revenue / max) * chartH, 2);
        const x = padL + i * (barW + gap);
        const y = chartH - barH;
        const isPositive = item.revenue > 0;
        return (
          <g key={item.month}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={isPositive ? '#6366f1' : '#374151'} rx="4" opacity="0.85" />
            <text x={x + barW / 2} y={chartH + 14} fontSize="10" fill="#6b7280" textAnchor="middle">
              {item.month}
            </text>
            {isPositive && (
              <text x={x + barW / 2} y={y - 5} fontSize="9" fill="#818cf8" textAnchor="middle">
                {fmtUSD(item.revenue).replace('$', '$').replace(',000', 'K')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');

  const { items: transactions, loading, error, refetch } = useApiList<PaymentTransaction>(
    '/api/v4/payments',
    { limit: 100 },
  );

  // ── Filters ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = transactions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          (p.providerRef ?? '').toLowerCase().includes(q) ||
          (p.providerTxnId ?? '').toLowerCase().includes(q) ||
          (p.orderId ?? '').toLowerCase().includes(q) ||
          (p.providerName ?? '').toLowerCase().includes(q),
      );
    }

    if (selectedType) result = result.filter((p) => p.type === selectedType);
    if (selectedStatus) result = result.filter((p) => normalizeStatus(p.status) === selectedStatus);

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((p) => new Date(p.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      result = result.filter((p) => new Date(p.createdAt) <= to);
    }

    const sorted = [...result];
    if (sortBy === 'amount') sorted.sort((a, b) => b.amount - a.amount);
    else if (sortBy === 'status') sorted.sort((a, b) => a.status.localeCompare(b.status));
    else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sorted;
  }, [searchQuery, selectedType, selectedStatus, dateFrom, dateTo, sortBy, transactions]);

  // ── Stats ────────────────────────────────────────────────

  const stats = useMemo(() => {
    const completed = transactions.filter((p) => normalizeStatus(p.status) === 'completed' && p.type === 'charge');
    const pending = transactions.filter((p) => normalizeStatus(p.status) === 'pending');
    const failed = transactions.filter((p) => normalizeStatus(p.status) === 'failed');
    const refunds = transactions.filter((p) => p.type === 'refund');

    return {
      totalCollected: completed.reduce((s, p) => s + p.amount, 0),
      totalPending: pending.reduce((s, p) => s + p.amount, 0),
      totalRefunded: refunds.reduce((s, p) => s + p.amount, 0),
      completedCount: completed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
    };
  }, [transactions]);

  // ── Monthly revenue from real data ───────────────────────

  const monthlyRevenue = useMemo<MonthlyRevenue[]>(() => {
    const charges = transactions.filter(
      (p) => p.type === 'charge' && normalizeStatus(p.status) === 'completed',
    );
    const buckets: Record<string, { revenue: number; count: number }> = {};
    charges.forEach((p) => {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) buckets[key] = { revenue: 0, count: 0 };
      buckets[key].revenue += p.amount;
      buckets[key].count += 1;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, val]) => {
        const [year, month] = key.split('-');
        const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en-US', {
          month: 'short',
        });
        return { month: `${monthName} ${year}`, revenue: val.revenue, count: val.count };
      });
  }, [transactions]);

  // ── Export ───────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    const headers = ['ID', 'Type', 'Status', 'Amount', 'Currency', 'Provider', 'Reference', 'Date'];
    const rows = filtered.map((p) => [
      p.id,
      typeLabel(p.type),
      statusLabel(p.status),
      p.amount.toFixed(2),
      p.currency,
      providerLabel(p.providerName),
      p.providerRef ?? p.providerTxnId ?? '—',
      new Date(p.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `payments-${new Date().toISOString().split('T')[0]}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filtered]);

  const hasFilters = Boolean(searchQuery || selectedType || selectedStatus || dateFrom || dateTo);

  // ── Render ───────────────────────────────────────────────

  if (error) {
    return (
      <ErrorState
        message={error.message || 'Failed to load payments'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Tracking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? 'Loading…' : `${transactions.length} transactions`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={loading || filtered.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#12121a] border border-white/[0.06] p-5 animate-pulse">
              <Skeleton variant="text" className="h-3 w-20 mb-3" />
              <Skeleton variant="text" className="h-7 w-28 mb-2" />
              <Skeleton variant="text" className="h-3 w-16" />
            </div>
          ))
        ) : (
          <>
            <MetricTile label="Collected" value={fmtUSD(stats.totalCollected)} sub={`${stats.completedCount} charges`} accent="#10b981" />
            <MetricTile label="Pending" value={fmtUSD(stats.totalPending)} sub={`${stats.pendingCount} transactions`} accent="#f59e0b" />
            <MetricTile label="Refunded" value={fmtUSD(stats.totalRefunded)} sub="total refunds" accent="#6366f1" />
            <MetricTile label="Failed" value={String(stats.failedCount)} sub="transactions" accent="#ef4444" />
          </>
        )}
      </div>

      {/* Revenue Chart */}
      <Card className="p-6 bg-[#12121a] border border-white/[0.06]">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Monthly Completed Revenue
        </h2>
        {loading ? (
          <div className="h-48 animate-pulse bg-white/[0.04] rounded-lg" />
        ) : monthlyRevenue.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
            No completed charges yet
          </div>
        ) : (
          <>
            <div className="h-48 flex items-end">
              <RevenueChart data={monthlyRevenue} />
            </div>
            <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
              {monthlyRevenue.map((item) => (
                <div key={item.month} className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-0.5">{item.month}</p>
                  <p className="text-sm font-bold text-white">{fmtUSD(item.revenue)}</p>
                  <p className="text-[10px] text-zinc-600">{item.count} txns</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Collected vs Outstanding */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-[#12121a] border border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500 mb-3">
            <DollarSign className="w-3.5 h-3.5" />
            Collected
          </div>
          <p className="text-3xl font-bold text-emerald-400 mb-1">{fmtUSD(stats.totalCollected)}</p>
          <p className="text-xs text-zinc-500 mb-3">{stats.completedCount} completed charges</p>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width: stats.totalCollected + stats.totalPending > 0
                  ? `${(stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </Card>
        <Card className="p-6 bg-[#12121a] border border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500 mb-3">
            <Clock className="w-3.5 h-3.5" />
            Outstanding
          </div>
          <p className="text-3xl font-bold text-amber-400 mb-1">{fmtUSD(stats.totalPending)}</p>
          <p className="text-xs text-zinc-500 mb-3">{stats.pendingCount} pending transactions</p>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{
                width: stats.totalCollected + stats.totalPending > 0
                  ? `${(stats.totalPending / (stats.totalCollected + stats.totalPending)) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-5 bg-[#12121a] border border-white/[0.06]">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by ID, provider, reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            label="Type"
            className="w-36"
            options={[
              { value: '', label: 'All Types' },
              { value: 'charge', label: 'Charge' },
              { value: 'refund', label: 'Refund' },
              { value: 'adjustment', label: 'Adjustment' },
              { value: 'cod_collection', label: 'COD' },
            ]}
          />
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            label="Status"
            className="w-36"
            options={[
              { value: '', label: 'All Status' },
              { value: 'completed', label: 'Completed' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
            label="Sort"
            className="w-28"
            options={[
              { value: 'date', label: 'Date' },
              { value: 'amount', label: 'Amount' },
              { value: 'status', label: 'Status' },
            ]}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedType('');
                setSelectedStatus('');
                setDateFrom('');
                setDateTo('');
                setSortBy('date');
              }}
            >
              <FilterX className="w-4 h-4" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-3 items-center border-t border-white/[0.04] pt-3 mt-3">
          <span className="text-xs text-zinc-500">Date range</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded text-xs text-white" />
          <span className="text-zinc-600 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded text-xs text-white" />
        </div>
      </Card>

      {/* Transactions Table */}
      {loading ? (
        <Card className="p-6 bg-[#12121a] border border-white/[0.06]">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 bg-[#12121a] border border-white/[0.06]">
          <CreditCard className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No transactions found</p>
          <p className="text-zinc-600 text-sm mt-1">
            {hasFilters ? 'Try adjusting your filters' : 'No payment data yet'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-[#12121a] border border-white/[0.06]">
          <Table<PaymentTransaction>
            columns={[
              {
                key: 'type',
                header: 'Type',
                render: (p) => (
                  <span className="text-xs font-mono px-2 py-1 rounded bg-white/[0.06] text-zinc-300">
                    {typeLabel(p.type)}
                  </span>
                ),
                width: 110,
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (p) => (
                  <span className={cn(
                    'font-mono font-semibold text-sm',
                    p.type === 'refund' ? 'text-red-400' : 'text-white',
                  )}>
                    {p.type === 'refund' ? '-' : ''}{fmtUSD(p.amount)}
                  </span>
                ),
                sortable: true,
                align: 'right',
                width: 120,
              },
              {
                key: 'status',
                header: 'Status',
                render: (p) => (
                  <Badge variant={statusVariant(p.status)}>
                    {statusLabel(p.status)}
                  </Badge>
                ),
                width: 110,
              },
              {
                key: 'providerName',
                header: 'Provider',
                render: (p) => (
                  <span className="text-sm text-zinc-400">{providerLabel(p.providerName)}</span>
                ),
                width: 120,
              },
              {
                key: 'providerRef',
                header: 'Reference',
                render: (p) => (
                  <span className="font-mono text-xs text-zinc-500 truncate max-w-[140px] block">
                    {p.providerRef ?? p.providerTxnId ?? '—'}
                  </span>
                ),
                width: 160,
              },
              {
                key: 'createdAt',
                header: 'Date',
                render: (p) => (
                  <span className="text-sm text-zinc-400">
                    {new Date(p.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                ),
                sortable: true,
                width: 120,
              },
            ]}
            data={filtered}
          />
        </Card>
      )}

      {/* Recent Feed */}
      {!loading && filtered.length > 0 && (
        <Card className="p-5 bg-[#12121a] border border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
            Recent Transactions
          </h2>
          <div className="space-y-2">
            {filtered.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    p.type === 'refund' ? 'bg-red-950/50' : 'bg-indigo-950/50',
                  )}>
                    <CreditCard className={cn(
                      'w-4 h-4',
                      p.type === 'refund' ? 'text-red-400' : 'text-indigo-400',
                    )} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      {typeLabel(p.type)} · {providerLabel(p.providerName)}
                    </p>
                    <p className="text-[11px] text-zinc-600 font-mono">
                      {p.providerRef ?? p.id.slice(0, 8) + '…'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'font-mono font-semibold text-sm',
                    p.type === 'refund' ? 'text-red-400' : 'text-white',
                  )}>
                    {p.type === 'refund' ? '-' : ''}{fmtUSD(p.amount)}
                  </p>
                  <Badge variant={statusVariant(p.status)} size="sm">
                    {statusLabel(p.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Metric Tile ──────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#12121a] border border-white/[0.06] p-5 group hover:border-white/[0.10] transition-all">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }}
      />
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-xl font-bold text-white font-mono mb-0.5">{value}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </div>
  );
}
