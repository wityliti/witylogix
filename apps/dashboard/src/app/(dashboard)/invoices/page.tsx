'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  Send,
  CheckCircle,
  FilterX,
  Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  sentDate: string | null;
  paidDate: string | null;
  taxAmount: number;
  discountAmount: number;
  lineItemsCount: number;
}

const getStatusBadgeVariant = (
  status: InvoiceStatus
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'sent':
      return 'info';
    case 'draft':
      return 'default';
    case 'overdue':
      return 'danger';
    case 'cancelled':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: InvoiceStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function InvoicesPage() {
  const router = useRouter();
  const { items: invoices, loading, error, refetch } = useApiList<Invoice>('/api/v4/invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status' | 'due'>('date');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const { addToast } = useToast();

  // Get unique customers
  const customers = useMemo(() => {
    return Array.from(new Set(invoices.map((i) => i.customerName))).sort();
  }, [invoices]);

  // Filter invoices
  const filtered = useMemo(() => {
    let result = invoices;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.number.toLowerCase().includes(query) ||
          i.customerName.toLowerCase().includes(query)
      );
    }

    if (selectedStatus) {
      result = result.filter((i) => i.status === selectedStatus);
    }

    if (selectedCustomer) {
      result = result.filter((i) => i.customerName === selectedCustomer);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter((i) => i.sentDate && new Date(i.sentDate) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      result = result.filter((i) => i.sentDate && new Date(i.sentDate) <= toDate);
    }

    if (amountMin) {
      const min = parseFloat(amountMin);
      result = result.filter((i) => i.amount >= min);
    }

    if (amountMax) {
      const max = parseFloat(amountMax);
      result = result.filter((i) => i.amount <= max);
    }

    // Sort
    const sorted = [...result];
    if (sortBy === 'date') {
      sorted.sort((a, b) => (b.sentDate ? new Date(b.sentDate).getTime() : 0) - (a.sentDate ? new Date(a.sentDate).getTime() : 0));
    } else if (sortBy === 'amount') {
      sorted.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    } else if (sortBy === 'due') {
      sorted.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    }

    return sorted;
  }, [invoices, searchQuery, selectedStatus, selectedCustomer, dateFrom, dateTo, amountMin, amountMax, sortBy]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const thisMonth = invoices.filter((i) => {
      const now = new Date();
      return (
        i.paidDate &&
        new Date(i.paidDate).getMonth() === now.getMonth() &&
        new Date(i.paidDate).getFullYear() === now.getFullYear()
      );
    });

    const totalOutstanding = invoices.filter(
      (i) => i.status === 'sent' || i.status === 'draft'
    ).reduce((sum, i) => sum + i.amount, 0);

    const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);
    const paidThisMonth = thisMonth.reduce((sum, i) => sum + i.amount, 0);

    const avgDaysToPay =
      paidInvoices.length > 0
        ? paidInvoices.reduce((sum, i) => {
            const days = i.paidDate && i.sentDate
              ? (new Date(i.paidDate).getTime() - new Date(i.sentDate).getTime()) / (1000 * 60 * 60 * 24)
              : 0;
            return sum + days;
          }, 0) / paidInvoices.length
        : 0;

    return {
      totalOutstanding,
      totalOverdue,
      paidThisMonth,
      avgDaysToPay: Math.round(avgDaysToPay),
    };
  }, [invoices]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedInvoices = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleViewInvoice = useCallback((id: string) => {
    router.push(`/invoices/${id}`);
  }, [router]);

  const handleCreateInvoice = useCallback(() => {
    router.push('/invoices/create');
  }, [router]);

  const handleSelectInvoice = useCallback(
    (id: string) => {
      const newSelected = new Set(selectedInvoices);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedInvoices(newSelected);
    },
    [selectedInvoices]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedInvoices.size === paginatedInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(
        new Set(paginatedInvoices.map((i) => i.id))
      );
    }
  }, [paginatedInvoices, selectedInvoices]);

  const handleBulkSend = useCallback(async () => {
    if (selectedInvoices.size === 0 || isSending) return;
    setIsSending(true);
    try {
      await api.post('/api/v4/invoices/bulk-send', {
        ids: Array.from(selectedInvoices),
      });
      addToast({
        type: 'success',
        title: 'Invoices sent',
        message: `${selectedInvoices.size} invoice${selectedInvoices.size !== 1 ? 's' : ''} sent successfully.`,
      });
      setSelectedInvoices(new Set());
      await refetch();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Send failed',
        message: err instanceof Error ? err.message : 'Failed to send invoices. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  }, [selectedInvoices, isSending, addToast, refetch]);

  const handleBulkMarkPaid = useCallback(() => {
    // TODO: API call for mark paid
  }, [selectedInvoices]);

  const handleExportCSV = useCallback(() => {
    const headers = [
      "Invoice Number",
      "Customer",
      "Amount",
      "Status",
      "Due Date",
      "Sent Date",
    ];
    const rows = filtered.map((i) => [
      i.number,
      i.customerName,
      i.amount.toFixed(2),
      i.status,
      new Date(i.dueDate).toLocaleDateString(),
      i.sentDate ? new Date(i.sentDate).toLocaleDateString() : "N/A",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedCustomer("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setSortBy("date");
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    searchQuery ||
      selectedStatus ||
      selectedCustomer ||
      dateFrom ||
      dateTo ||
      amountMin ||
      amountMax
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Invoices</h1>
          <p className="text-gray-400">Manage and track your invoices</p>
        </div>
        <Button variant="primary" onClick={handleCreateInvoice}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Total Outstanding</p>
            <p className="text-3xl font-bold text-white">${stats.totalOutstanding.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Total Overdue</p>
            <p className="text-3xl font-bold text-red-400">${stats.totalOverdue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Paid This Month</p>
            <p className="text-3xl font-bold text-emerald-400">${stats.paidThisMonth.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Avg Days to Pay</p>
            <p className="text-3xl font-bold text-blue-400">{stats.avgDaysToPay} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedInvoices.size > 0 && (
        <Card className="bg-[#12121a] border-[#1e1e2e] flex items-center justify-between gap-4 p-4">
          <span className="text-sm font-medium text-white">{selectedInvoices.size} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleBulkSend} disabled={isSending}>
              <Send className="w-4 h-4 mr-2" />
              {isSending ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleBulkMarkPaid}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Paid
            </Button>
          </div>
        </Card>
      )}

      {/* Filters & Controls */}
      <Card className="bg-[#12121a] border-[#1e1e2e] space-y-4">
        <CardContent className="pt-6">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder="Search by invoice # or customer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                icon={<Search className="w-4 h-4" />}
                className="w-full bg-[#1a1a2e] border-[#1e1e2e] text-white placeholder-gray-500"
              />
            </div>

            <Select
              value={selectedStatus as string}
              onChange={(value) => {
                setSelectedStatus((value as InvoiceStatus) || "");
                setCurrentPage(1);
              }}
              label="Status"
              className="w-40 bg-[#1a1a2e] border-[#1e1e2e] text-white"
            >
              <option value="">All Status</option>
              <option value='draft'>Draft</option>
              <option value='sent'>Sent</option>
              <option value='paid'>Paid</option>
              <option value='overdue'>Overdue</option>
              <option value='cancelled'>Cancelled</option>
            </Select>

            <Select
              value={selectedCustomer}
              onChange={(value) => {
                setSelectedCustomer(value);
                setCurrentPage(1);
              }}
              label="Customer"
              className="w-40 bg-[#1a1a2e] border-[#1e1e2e] text-white"
            >
              <option value="">All Customers</option>
              {customers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>

            <Select
              value={sortBy}
              onChange={(value) =>
                setSortBy(value as "date" | "amount" | "status" | "due")
              }
              label="Sort By"
              className="w-32 bg-[#1a1a2e] border-[#1e1e2e] text-white"
            >
              <option value='date'>Date</option>
              <option value='amount'>Amount</option>
              <option value='status'>Status</option>
              <option value='due'>Due Date</option>
            </Select>

            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-gray-400 hover:text-white"
              >
                <FilterX className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Additional Filters */}
          <div className="flex gap-3 flex-wrap items-end border-t border-[#1e1e2e] pt-4 mt-4">
            <div className="flex gap-2 items-end">
              <label className="text-xs font-semibold uppercase text-gray-400">Date Range</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white"
              />
            </div>

            <div className="flex gap-2 items-end">
              <label className="text-xs font-semibold uppercase text-gray-400">Amount</label>
              <input
                type="number"
                placeholder="Min"
                value={amountMin}
                onChange={(e) => {
                  setAmountMin(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-20 px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white placeholder-gray-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={amountMax}
                onChange={(e) => {
                  setAmountMax(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-20 px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      {filtered.length === 0 ? (
        <Card className="bg-[#12121a] border-[#1e1e2e] flex flex-col items-center justify-center gap-4 py-16">
          <Search className="w-12 h-12 text-gray-600" />
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-300">No invoices found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-[#12121a] border-[#1e1e2e] overflow-hidden">
            <Table
              columns={[
                {
                  key: "checkbox",
                  header: (
                    <input
                      type="checkbox"
                      checked={selectedInvoices.size === paginatedInvoices.length && paginatedInvoices.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-[#1e1e2e] bg-[#1a1a2e]"
                    />
                  ),
                  render: (item: Record<string, unknown>) => (
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(item.id)}
                      onChange={() => handleSelectInvoice(item.id)}
                      className="w-4 h-4 rounded border-[#1e1e2e] bg-[#1a1a2e]"
                    />
                  ),
                  width: 40,
                },
                {
                  key: "number",
                  header: "Invoice #",
                  render: (item: Record<string, unknown>) => (
                    <div className="font-mono text-sm font-medium text-blue-400">
                      {item.number}
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
                  render: (item: Record<string, unknown>) => <span className="text-gray-300">{item.customerName}</span>,
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
                  key: "status",
                  header: "Status",
                  render: (item: Record<string, unknown>) => (
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  ),
                  width: 100,
                },
                {
                  key: "dueDate",
                  header: "Due Date",
                  render: (item: Record<string, unknown>) => (
                    <div className="text-sm text-gray-300">
                      {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                  ),
                  sortable: true,
                  width: 110,
                },
                {
                  key: "sentDate",
                  header: "Sent Date",
                  render: (item: Record<string, unknown>) => (
                    <div className="text-sm text-gray-400">
                      {item.sentDate ? new Date(item.sentDate).toLocaleDateString() : '-'}
                    </div>
                  ),
                  width: 110,
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (item: Record<string, unknown>) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewInvoice(item.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  ),
                  width: 60,
                  align: "center",
                },
              ]}
              data={paginatedInvoices}
            />
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                Showing {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
              </span>
              <Select
                value={pageSize.toString()}
                onChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
                label="Page Size"
                className="w-24 bg-[#1a1a2e] border-[#1e1e2e] text-white"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="min-w-[32px]"
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && <span className="text-gray-500">...</span>}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
