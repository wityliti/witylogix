'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, Download, Filter, Plus } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  createdDate: string;
  items: Array<{ description: string; quantity: number; price: number }>;
}

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { items: invoices, loading, error, setSearch } = useApiList<Invoice>(
    '/api/v4/invoices'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const filtered = invoices.filter((inv) => {
    if (selectedStatus !== 'all' && inv.status !== selectedStatus) return false;
    if (searchTerm && !inv.invoiceNumber.includes(searchTerm) && !inv.customer.includes(searchTerm)) return false;
    return true;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'overdue':
        return 'danger';
      case 'sent':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Invoices</h1>
              <p className="text-sm text-gray-400 mt-1">Manage customer invoices</p>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          </div>

          <div className="flex gap-4 mt-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearch(e.target.value);
                }}
                className={cn(
                  'w-full pl-10 pr-4 py-2 rounded-md text-sm',
                  'bg-wl-bg-elevated border border-wl-border-default',
                  'text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                'bg-wl-bg-elevated border border-wl-border-default',
                'text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4 max-w-7xl">
          {filtered.length === 0 ? (
            <Card className={cn("p-12 bg-wl-bg-surface border border-wl-border-default text-center")}>
              <p className="text-gray-400">No invoices found</p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Invoice #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Customer</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Due Date</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                      <td className="px-4 py-3 font-medium text-white">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-300">{inv.customer}</td>
                      <td className="text-right px-4 py-3 font-medium text-white">
                        ${inv.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(inv.status) as any}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3">
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
