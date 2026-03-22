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

const MOCK_PAYMENTS: Payment[] = [
  {
    id: "pay-001",
    invoiceNumber: "INV-2024-001",
    customerName: "Acme Corp",
    amount: 2750.0,
    method: "bank_transfer",
    status: "completed",
    date: new Date("2024-02-10"),
    reference: "TXN-20240210-12345",
  },
  {
    id: "pay-002",
    invoiceNumber: "INV-2024-005",
    customerName: "Delta Logistics",
    amount: 4500.0,
    method: "bank_transfer",
    status: "completed",
    date: new Date("2024-01-28"),
    reference: "TXN-20240128-67890",
  },
  {
    id: "pay-003",
    invoiceNumber: "INV-2024-008",
    customerName: "Gamma Ltd",
    amount: 1450.0,
    method: "card",
    status: "completed",
    date: new Date("2024-02-18"),
    reference: "CARD-20240218-11111",
  },
  {
    id: "pay-004",
    invoiceNumber: "INV-2024-003",
    customerName: "Gamma Ltd",
    amount: 3200.0,
    method: "bank_transfer",
    status: "pending",
    date: new Date("2024-03-05"),
    reference: "TXN-20240305-22222",
  },
  {
    id: "pay-005",
    invoiceNumber: "INV-2024-002",
    customerName: "Beta Inc",
    amount: 1850.5,
    method: "check",
    status: "pending",
    date: new Date("2024-03-08"),
    reference: "CHK-20240308-33333",
  },
  {
    id: "pay-006",
    invoiceNumber: "INV-2024-007",
    customerName: "Beta Inc",
    amount: 3050.0,
    method: "bank_transfer",
    status: "completed",
    date: new Date("2024-02-25"),
    reference: "TXN-20240225-44444",
  },
  {
    id: "pay-007",
    invoiceNumber: "INV-2024-004",
    customerName: "Acme Corp",
    amount: 1600.0,
    method: "card",
    status: "failed",
    date: new Date("2024-02-28"),
    reference: "CARD-20240228-55555",
  },
  {
    id: "pay-008",
    invoiceNumber: "INV-2024-006",
    customerName: "Echo Distribution",
    amount: 2200.0,
    method: "bank_transfer",
    status: "pending",
    date: new Date("2024-03-10"),
    reference: "TXN-20240310-66666",
  },
  {
    id: "pay-009",
    invoiceNumber: "INV-2024-009",
    customerName: "Acme Corp",
    amount: 5200.0,
    method: "bank_transfer",
    status: "completed",
    date: new Date("2024-03-01"),
    reference: "TXN-20240301-77777",
  },
  {
    id: "pay-010",
    invoiceNumber: "INV-2024-010",
    customerName: "Delta Logistics",
    amount: 3800.0,
    method: "card",
    status: "completed",
    date: new Date("2024-03-02"),
    reference: "CARD-20240302-88888",
  },
];

const MONTHLY_REVENUE: MonthlyRevenue[] = [
  { month: "Jan", revenue: 12500, payments: 5 },
  { month: "Feb", revenue: 18900, payments: 8 },
  { month: "Mar", revenue: 15600, payments: 6 },
];

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

  const { items: payments, loading, error, refetch } = useApiList<Payment>('/api/v4/payments');

  if (error) {
    return (
      <ErrorState
        message={error.message || 'Failed to load payments'}
        onRetry={refetch}
      />
    );
  }

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

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">
            Payment Tracking
          </h1>
          <p className="text-gray-400">
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
          value={`$${stats.totalCollected.toFixed(2)}`}
          trend={null}
          icon={null}
        />
        <MetricCard
          label="Pending Payments"
          value={`$${stats.totalPending.toFixed(2)}`}
          trend={null}
          icon={null}
        />
        <MetricCard
          label="Failed Payments"
          value={`$${stats.totalFailed.toFixed(2)}`}
          trend={null}
          icon={null}
        />
        <MetricCard
          label="Avg Payment"
          value={`$${stats.avgPaymentAmount.toFixed(2)}`}
          trend={null}
          icon={null}
        />
      </div>

      {/* Revenue Chart */}
      <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e]")}>
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Monthly Revenue
        </h2>
        <div className="h-80 flex items-end justify-center">
          <RevenueChart data={MONTHLY_REVENUE} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {MONTHLY_REVENUE.map((item) => (
            <div key={item.month} className="text-center">
              <p className="text-sm text-gray-400 mb-1">
                {item.month}
              </p>
              <p className="text-lg font-bold text-white">
                ${item.revenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">
                {item.payments} payments
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Outstanding vs Collected Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e]")}>
          <h3 className="text-sm font-semibold uppercase text-gray-400 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Collected
          </h3>
          <p className="text-3xl font-bold text-emerald-500 mb-2">
            ${stats.totalCollected.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400">
            {stats.completedCount} completed payments
          </p>
          <div className="mt-4 w-full bg-[#1a1a2e] rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full"
              style={{
                width: `${(stats.totalCollected / (stats.totalCollected + stats.totalPending)) * 100}%`,
              }}
            />
          </div>
        </Card>

        <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e]")}>
          <h3 className="text-sm font-semibold uppercase text-gray-400 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Outstanding
          </h3>
          <p className="text-3xl font-bold text-amber-500 mb-2">
            ${stats.totalPending.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400">
            {stats.pendingCount} pending payments
          </p>
          <div className="mt-4 w-full bg-[#1a1a2e] rounded-full h-2">
            <div
              className="bg-amber-500 h-2 rounded-full"
              style={{
                width: `${(stats.totalPending / (stats.totalCollected + stats.totalPending)) * 100}%`,
              }}
            />
          </div>
        </Card>
      </div>

      {/* Filters & Controls */}
      <Card className={cn("flex flex-col gap-4 bg-[#12121a] border border-[#1e1e2e] p-6")}>
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
            value={selectedMethod as string}
            onChange={(value) =>
              setSelectedMethod((value as PaymentMethod) || "")
            }
            label="Method"
            className="w-40"
          >
            <option value="">All Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
          </Select>

          <Select
            value={selectedStatus as string}
            onChange={(value) =>
              setSelectedStatus((value as PaymentStatus) || "")
            }
            label="Status"
            className="w-32"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select
            value={sortBy}
            onChange={(value) => setSortBy(value as "date" | "amount" | "status")}
            label="Sort By"
            className="w-32"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </Select>

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
        <div className="flex gap-3 flex-wrap items-end border-t border-[#1e1e2e] pt-4">
          <div className="flex gap-2 items-end">
            <label className="text-xs font-semibold uppercase text-gray-400">
              Date Range
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white"
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      {filtered.length === 0 ? (
        <Card className={cn("flex flex-col items-center justify-center gap-4 py-16 bg-[#12121a] border border-[#1e1e2e]")}>
          <Search className="w-12 h-12 text-gray-500" />
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-400">
              No payments found
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your search or filters
            </p>
          </div>
        </Card>
      ) : (
        <Card className={cn("overflow-hidden bg-[#12121a] border border-[#1e1e2e]")}>
          <Table
            columns={[
              {
                key: "invoiceNumber",
                header: "Invoice #",
                render: (item: Record<string, unknown>) => (
                  <div className="font-mono text-sm font-medium text-blue-500">
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
                render: (item: Record<string, unknown>) => (
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
                render: (item: Record<string, unknown>) => (
                  <div className="text-sm text-gray-300">
                    {getMethodLabel(item.method)}
                  </div>
                ),
                width: 140,
              },
              {
                key: "status",
                header: "Status",
                render: (item: Record<string, unknown>) => (
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {getStatusLabel(item.status)}
                  </Badge>
                ),
                width: 110,
              },
              {
                key: "date",
                header: "Date",
                render: (item: Record<string, unknown>) => (
                  <div className="text-sm text-gray-300">
                    {item.date.toLocaleDateString()}
                  </div>
                ),
                sortable: true,
                width: 110,
              },
              {
                key: "reference",
                header: "Reference",
                render: (item: Record<string, unknown>) => (
                  <div className="font-mono text-xs text-gray-400">
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
      <Card className={cn("p-6 bg-[#12121a] border border-[#1e1e2e]")}>
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Payments
        </h2>
        <div className="space-y-3">
          {filtered.slice(0, 5).map((payment) => (
            <div
              key={payment.id}
              className={cn("flex items-center justify-between p-4 rounded border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors")}
            >
              <div className="flex-1">
                <p className="font-medium text-white">
                  {payment.customerName}
                </p>
                <p className="text-xs text-gray-400">
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
                  <span className="text-xs text-gray-400">
                    {payment.date.toLocaleDateString()}
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
