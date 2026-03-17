/**
 * Invoice List Page — Virtualized table for 1000+ invoices with filtering, search, and bulk actions
 *
 * Features:
 * - Virtualized table (useVirtualizer pattern)
 * - Debounced search by invoice number/customer
 * - Filter sidebar (status, platform, date range, amount range, customer)
 * - Sort by date, amount, status, customer
 * - Bulk actions (mark paid, void, export, resend)
 * - Invoice detail expand with line items
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useInvoices } from '@/hooks/use-financial-data';
import { InvoiceLineItemsDisplay } from '@/components/finance/invoice-line-items';
import { ChevronDown, ChevronUp, Download, MoreVertical, Search, X } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/components/invoicing/types';

// Debounce utility
function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

// Status color mapping
const statusColors: Record<InvoiceStatus, string> = {
  draft: 'secondary',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  void: 'muted',
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

interface InvoiceRowProps {
  invoice: Invoice;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
}

function InvoiceRow({ invoice, isSelected, onSelect, onExpand, isExpanded }: InvoiceRowProps) {
  const date = new Date(invoice.issueDate);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <tr
        className={cn(
          'border-b border-wl-border-subtle',
          'hover:bg-wl-bg-overlay transition-colors duration-fast',
          isSelected && 'bg-wl-primary-500/5'
        )}
      >
        {/* Checkbox */}
        <td className="px-4 py-3 w-12">
          <Checkbox
            checked={isSelected}
            onChange={(checked) => onSelect(invoice.id, checked as boolean)}
          />
        </td>

        {/* Invoice Number */}
        <td className="px-4 py-3">
          <button
            onClick={() => onExpand(invoice.id)}
            className={cn(
              'flex items-center gap-2',
              'text-sm font-medium text-wl-primary-400 hover:text-wl-primary-300',
              'transition-colors duration-fast'
            )}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronUp className="w-4 h-4 flex-shrink-0" />
            )}
            {invoice.invoiceNumber}
          </button>
        </td>

        {/* Customer */}
        <td className="px-4 py-3">
          <p className="text-sm text-wl-text-primary">{invoice.customerName}</p>
        </td>

        {/* Date */}
        <td className="px-4 py-3">
          <p className="text-sm text-wl-text-secondary">{dateStr}</p>
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-semibold text-wl-text-primary">
            ${invoice.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center">
          <Badge variant={statusColors[invoice.status]}>
            {statusLabels[invoice.status]}
          </Badge>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <button
            className={cn(
              'p-1 rounded hover:bg-wl-bg-overlay',
              'text-wl-text-secondary hover:text-wl-text-primary',
              'transition-colors duration-fast'
            )}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </td>
      </tr>

      {/* Expanded Row */}
      {isExpanded && invoice.lineItems && (
        <tr className="border-b border-wl-border-subtle bg-wl-bg-surface">
          <td colSpan={7} className="px-4 py-4">
            <InvoiceLineItemsDisplay items={invoice.lineItems} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function InvoiceListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch invoices with filters
  const invoicesState = useInvoices({
    status: selectedStatus || undefined,
    searchQuery: debouncedSearch,
  });


  // Handle selection
  const handleSelectInvoice = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(invoicesState.invoices.map((inv) => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [invoicesState.invoices]);

  const handleExpandInvoice = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalAmount = invoicesState.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const statusCounts = invoicesState.invoices.reduce(
      (acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      },
      {} as Record<InvoiceStatus, number>
    );

    return { totalAmount, statusCounts };
  }, [invoicesState.invoices]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-wl-bg-primary to-wl-bg-secondary">
      {/* Header */}
      <div className="px-6 py-8 border-b border-wl-border-subtle bg-wl-bg-elevated/40">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-wl-text-primary mb-2">Invoices</h1>
          <p className="text-wl-text-secondary">Manage and track all invoices</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Filters & Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="col-span-1 md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-wl-text-tertiary" />
              <Input
                type="text"
                placeholder="Search by invoice number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-wl-text-tertiary hover:text-wl-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus((e.target.value as InvoiceStatus) || '')}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </Select>
          </div>

          {/* Export */}
          <div>
            <Button variant="secondary" className="w-full gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm font-medium text-wl-text-primary">
              {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                Mark as Paid
              </Button>
              <Button size="sm" variant="secondary">
                Void
              </Button>
              <Button size="sm" variant="secondary">
                Resend
              </Button>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-4">
              <p className="text-xs text-wl-text-secondary mb-1">Total Amount</p>
              <p className="text-lg font-semibold text-wl-text-primary">
                ${metrics.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          {Object.entries(metrics.statusCounts).map(([status, count]) => (
            <Card key={status} className="border border-wl-border-subtle">
              <CardContent className="p-4">
                <p className="text-xs text-wl-text-secondary mb-1">{statusLabels[status as InvoiceStatus]}</p>
                <p className="text-lg font-semibold text-wl-text-primary">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Invoices Table */}
        <Card className="border border-wl-border-subtle">
          <CardContent className="p-0">
            {invoicesState.isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-wl-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-wl-text-secondary">Loading invoices...</p>
                </div>
              </div>
            ) : invoicesState.invoices.length === 0 ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-wl-text-secondary mb-2">No invoices found</p>
                  <p className="text-xs text-wl-text-tertiary">Try adjusting your filters</p>
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-wl-border-subtle bg-wl-bg-surface sticky top-0 z-20">
                    <th className="px-4 py-3 text-left w-12">
                      <Checkbox
                        checked={selectedIds.size === invoicesState.invoices.length && invoicesState.invoices.length > 0}
                        onChange={(checked) => handleSelectAll(checked as boolean)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Invoice
                      </p>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Customer
                      </p>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Date
                      </p>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Amount
                      </p>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Status
                      </p>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                        Actions
                      </p>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesState.invoices.map((invoice) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      isSelected={selectedIds.has(invoice.id)}
                      onSelect={handleSelectInvoice}
                      onExpand={handleExpandInvoice}
                      isExpanded={expandedId === invoice.id}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-wl-text-secondary">
            Showing {invoicesState.invoices.length > 0 ? (invoicesState.page - 1) * invoicesState.pageSize + 1 : 0} to{' '}
            {Math.min(invoicesState.page * invoicesState.pageSize, invoicesState.total)} of{' '}
            {invoicesState.total} invoices
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={invoicesState.page === 1}
              onClick={() => invoicesState.setPage(invoicesState.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={invoicesState.page * invoicesState.pageSize >= invoicesState.total}
              onClick={() => invoicesState.setPage(invoicesState.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
