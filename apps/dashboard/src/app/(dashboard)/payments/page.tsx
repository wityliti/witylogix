'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Download,
  Filter,
  FilterX,
  TrendingUp,
  DollarSign,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'check';
type PaymentStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

interface Payment {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  payments: number;
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildMonthlyRevenue(payments: Payment[]): MonthlyRevenue[] {
  const map = new Map<string, MonthlyRevenue>();
  for (const p of payments) {
    if (p.status !== 'completed') continue;
    const d = new Date(p.date);
    const key = MONTH_ABBR[d.getMonth()];
    const existing = map.get(key);
    if (existing) {
      existing.revenue += p.amount;
      existing.payments += 1;
    } else {
      map.set(key, { month: key, revenue: p.amount, payments: 1 });
    }
  }
  return Array.from(map.values());
}

const getStatusBadgeVariant = (
  status: PaymentStatus
): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
};

const getStatusLabel = (status: PaymentStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    bank_transfer: "Bank Transfer",
    card: "Card",
    cash: "Cash",
    check: "Check",
  };
  return labels[method];
};

// Simple SVG Bar Chart Component
const RevenueChart = ({ data }: { data: MonthlyRevenue[] }) => {
  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const chartHeight = 200;
  const barWidth = 60;
  const gap = 40;

  return (
    <svg
      width="100%"
      height={chartHeight + 40}
      viewBox={`0 0 ${data.length * (barWidth + gap) + 20} ${chartHeight + 40}`}
      className="mx-auto"
    >
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
        <g key={`tick-${tick}`}>
          <text
            x="30"
            y={chartHeight - tick * chartHeight + 5}
            fontSize="12"
            fill="currentColor"
            className="text-wl-text-secondary"
            textAnchor="end"
          >
            ${Math.round((tick * maxRevenue) / 1000)}K
          </text>
          <line
            x1="35"
            y1={chartHeight - tick * chartHeight}
            x2={data.length * (barWidth + gap) + 10}
            y2={chartHeight - tick * chartHeight}
            stroke="currentColor"
            strokeDasharray="2,2"
            className="text-wl-border-subtle"
          />
        </g>
      ))}

      {/* Bars */}
      {data.map((item, index) => {
        const barHeight = (item.revenue / maxRevenue) * chartHeight;
        const x = 40 + index * (barWidth + gap);
        const y = chartHeight - barHeight;

        return (
          <g key={item.month}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill="var(--wl-primary-500)"
              rx="4"
            />
            {/* Label */}
            <text
              x={x + barWidth / 2}
              y={chartHeight + 20}
              fontSize="13"
              fontWeight="500"
              fill="currentColor"
              className="text-wl-text-primary"
              textAnchor="middle"
            >
              {item.month}
            </text>
            {/* Value */}
            <text
              x={x + barWidth / 2}
              y={y - 8}
              fontSize="12"
              fontWeight="600"
              fill="currentColor"
              className="text-wl-primary-500"
              textAnchor="middle"
            >
              ${item.revenue / 1000}K
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');

  const { items: payments, loading, error, refetch } = useApiList<Payment>('/api/v4/payments', {
    limit: 200,
  });

  // Derive monthly revenue from real payments — no hardcoded data
  const monthlyRevenue = useMemo<MonthlyRevenue[]>(() => {
    const byMonth: Record<string, { revenue: number; payments: number }> = {};
    payments
      .filter((p) => p.status === 'completed')
      .forEach((p) => {
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!byMonth[key]) byMonth[key] = { revenue: 0, payments: 0 };
        byMonth[key].revenue += p.amount;
        byMonth[key].payments += 1;
        (byMonth[key] as any)._label = label;
      });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => ({ month: (v as any)._label, revenue: v.revenue, payments: v.payments }));
  }, [payments]);


  // Filter payments
  const filtered = useMemo(() => {
    let result = payments;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.invoiceNumber.toLowerCase().includes(query) ||
          p.customerName.toLowerCase().includes(query) ||
          p.reference.toLowerCase().includes(query)
      );
    }

    if (selectedMethod) {
      result = result.filter((p) => p.method === selectedMethod);
    }

    if (selectedStatus) {
      result = result.filter((p) => p.status === selectedStatus);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter((p) => new Date(p.date) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      result = result.filter((p) => new Date(p.date) <= toDate);
    }

    // Sort
    const sorted = [...result];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'amount') {
      sorted.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    }

    return sorted;
  }, [searchQuery, selectedMethod, selectedStatus, dateFrom, dateTo, sortBy, payments]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status === 'completed');
    const pending = payments.filter((p) => p.status === 'pending');
    const failed = payments.filter((p) => p.status === 'failed');

    const totalCompleted = completed.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    const totalFailed = failed.reduce((sum, p) => sum + p.amount, 0);

    const avgPaymentAmount =
      completed.length > 0 ? totalCompleted / completed.length : 0;

    return {
      totalCollected: totalCompleted,
      totalPending,
      totalFailed,
      avgPaymentAmount,
      completedCount: completed.length,
      pendingCount: pending.length,
    };
  }, [payments]);

  const handleExportCSV = useCallback(() => {
    const headers = [
      "Invoice",
      "Customer",
      "Amount",
      "Method",
      "Status",
      "Date",
      "Reference",
    ];
    const rows = filtered.map((p) => [
      p.invoiceNumber,
      p.customerName,
      p.amount.toFixed(2),
      getMethodLabel(p.method),
      getStatusLabel(p.status),
      new Date(p.date).toLocaleDateString(),
      p.reference,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedMethod('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
    setSortBy('date');
  }, []);

  const hasActiveFilters = Boolean(
    searchQuery || selectedMethod || selectedStatus || dateFrom || dateTo
  );

  if (loading) return <TableSkeleton columns={6} rows={10} />;
  if (error) {
    return (
      <ErrorState
        message={error.message || 'Failed to load payments'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-wl-bg-root min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">
            Payment Tracking
          </h1>
          <p className="text-wl-text-secondary">
            Monitor and manage incoming payments
          </p>
        </div>
        <Button variant="secondary" size="lg" onClick={handleExportCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Collected"
          value={stats.totalCollected}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <MetricCard
          label="Pending Payments"
          value={stats.totalPending}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <MetricCard
          label="Failed Payments"
          value={stats.totalFailed}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <MetricCard
          label="Avg Payment"
          value={stats.avgPaymentAmount}
          format={(v) => `$${v.toFixed(2)}`}
        />
      </div>

      {/* Revenue Chart */}
      <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Monthly Revenue
        </h2>
        <div className="h-80 flex items-end justify-center">
          <RevenueChart data={monthlyRevenue} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {monthlyRevenue.map((item) => (
            <div key={item.month} className="text-center">
              <p className="text-sm text-wl-text-secondary mb-1">
                {item.month}
              </p>
              <p className="text-lg font-bold text-white">
                ${item.revenue.toLocaleString()}
              </p>
              <p className="text-xs text-wl-text-secondary">
                {item.payments} payments
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Outstanding vs Collected Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
          <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Collected
          </h3>
          <p className="text-3xl font-bold text-wl-success-500 mb-2">
            ${stats.totalCollected.toFixed(2)}
          </p>
          <p className="text-sm text-wl-text-secondary">
            {stats.completedCount} completed payments
          </p>
          <div className="mt-4 w-full bg-wl-bg-elevated rounded-full h-2">
            <div
              className="bg-wl-success-500 h-2 rounded-full"
              style={{
                width: `${(stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100}%`,
              }}
            />
          </div>
        </Card>

        <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
          <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Outstanding
          </h3>
          <p className="text-3xl font-bold text-wl-warning-500 mb-2">
            ${stats.totalPending.toFixed(2)}
          </p>
          <p className="text-sm text-wl-text-secondary">
            {stats.pendingCount} pending payments
          </p>
          <div className="mt-4 w-full bg-wl-bg-elevated rounded-full h-2">
            <div
              className="bg-wl-warning-500 h-2 rounded-full"
              style={{
                width: `${(stats.totalPending / (stats.totalCollected + stats.totalPending)) * 100}%`,
              }}
            />
          </div>
        </Card>
      </div>

      {/* Filters & Controls */}
      <Card className={cn("flex flex-col gap-4 bg-wl-bg-surface border border-wl-border-default p-6")}>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by invoice, customer, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              icon={<Search className="w-4 h-4" />}
              className="w-full"
            />
          </div>

          <Select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod((e.target.value as PaymentMethod) || "")}
            label="Method"
            className="w-40"
            options={[
              { value: "", label: "All Methods" },
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "card", label: "Card" },
              { value: "cash", label: "Cash" },
              { value: "check", label: "Check" },
            ]}
          />

          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus((e.target.value as PaymentStatus) || "")}
            label="Status"
            className="w-32"
            options={[
              { value: "", label: "All Status" },
              { value: "completed", label: "Completed" },
              { value: "pending", label: "Pending" },
              { value: "failed", label: "Failed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "amount" | "status")}
            label="Sort By"
            className="w-32"
            options={[
              { value: "date", label: "Date" },
              { value: "amount", label: "Amount" },
              { value: "status", label: "Status" },
            ]}
          />

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto"
            >
              <FilterX className="w-4 h-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Additional Filters */}
        <div className="flex gap-3 flex-wrap items-end border-t border-wl-border-default pt-4">
          <div className="flex gap-2 items-end">
            <label className="text-xs font-semibold uppercase text-wl-text-secondary">
              Date Range
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-sm text-white"
            />
            <span className="text-wl-text-secondary">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-sm text-white"
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      {filtered.length === 0 ? (
        <Card className={cn("flex flex-col items-center justify-center gap-4 py-16 bg-wl-bg-surface border border-wl-border-default")}>
          <Search className="w-12 h-12 text-wl-text-tertiary" />
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-wl-text-secondary">
              No payments found
            </h3>
            <p className="text-sm text-wl-text-tertiary">
              Try adjusting your search or filters
            </p>
          </div>
        </Card>
      ) : (
        <Card className={cn("overflow-hidden bg-wl-bg-surface border border-wl-border-default")}>
          <Table<Payment>
            columns={[
              {
                key: "invoiceNumber",
                header: "Invoice #",
                render: (item) => (
                  <div className="font-mono text-sm font-medium text-wl-info-500">
                    {item.invoiceNumber}
                  </div>
                ),
                sortable: true,
                width: 120,
              },
              {
                key: "customerName",
                header: "Customer",
                sortable: true,
                width: 180,
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => (
                  <div className="font-medium text-white">
                    ${item.amount.toFixed(2)}
                  </div>
                ),
                sortable: true,
                align: "right",
                width: 120,
              },
              {
                key: "method",
                header: "Method",
                render: (item) => (
                  <div className="text-sm text-wl-neutral-300">
                    {getMethodLabel(item.method)}
                  </div>
                ),
                width: 140,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {getStatusLabel(item.status)}
                  </Badge>
                ),
                width: 110,
              },
              {
                key: "date",
                header: "Date",
                render: (item) => (
                  <div className="text-sm text-wl-neutral-300">
                    {new Date(item.date).toLocaleDateString()}
                  </div>
                ),
                sortable: true,
                width: 110,
              },
              {
                key: "reference",
                header: "Reference",
                render: (item) => (
                  <div className="font-mono text-xs text-wl-text-secondary">
                    {item.reference}
                  </div>
                ),
                width: 160,
              },
            ]}
            data={filtered}
          />
        </Card>
      )}

      {/* Recent Payments Feed */}
      <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Payments
        </h2>
        <div className="space-y-3">
          {filtered.slice(0, 5).map((payment) => (
            <div
              key={payment.id}
              className={cn("flex items-center justify-between p-4 rounded border border-wl-border-default hover:bg-wl-bg-elevated transition-colors")}
            >
              <div className="flex-1">
                <p className="font-medium text-white">
                  {payment.customerName}
                </p>
                <p className="text-xs text-wl-text-secondary">
                  {payment.invoiceNumber} • {getMethodLabel(payment.method)}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-white">
                  ${payment.amount.toFixed(2)}
                </p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <Badge variant={getStatusBadgeVariant(payment.status)}>
                    {getStatusLabel(payment.status)}
                  </Badge>
                  <span className="text-xs text-wl-text-secondary">
                    {new Date(payment.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
