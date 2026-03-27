'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomers } from '@/hooks/use-customers';

/* ═══════════════════════════════════════════════════════════
   CUSTOMERS PAGE — Customer management with Shopify sync
   ═══════════════════════════════════════════════════════════ */

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const getTierColor = (tier: string): "primary" | "success" | "warning" | "info" | "default" => {
  const map: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
    enterprise: "primary",
    premium: "success",
    standard: "info",
  };
  return map[tier] ?? "default";
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'totalOrders' | 'lastOrderDate'>('name');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // Fetch customers from API
  const { items: customers, loading, error, refetch, pagination } = useCustomers({
    search: search || undefined,
    limit: pageSize,
  });

  // Filter customers client-side
  const filtered = useMemo(() => {
    let result = customers;

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'totalSpent':
          return b.totalSpent - a.totalSpent;
        case 'totalOrders':
          return b.totalOrders - a.totalOrders;
        case 'lastOrderDate':
          return (new Date(b.lastOrderDate || 0).getTime() - new Date(a.lastOrderDate || 0).getTime());
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [customers, statusFilter, sortBy]);

  const paginatedItems = filtered.slice(0, pageSize);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pageSize));

  // Calculate stats
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const avgOrders =
    customers.length > 0 ? (customers.reduce((sum, c) => sum + c.totalOrders, 0) / customers.length).toFixed(1) : '0';
  const topSpender = customers.length > 0 ? Math.max(...customers.map((c) => c.totalSpent)) : 0;

  return (
    <>
      <Header
        title="Customers"
        subtitle={`${activeCustomers} active · ${pagination.total} total`}
        actions={
          <Button variant="primary" size="md">
            + Sync from Shopify
          </Button>
        }
      />

      <div className="p-6">
        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 flex items-center justify-between">
              <span>Failed to load customers</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-red-400">
                Retry
              </Button>
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Customers"
            value={pagination.total}
            change={{ value: 5.2, label: 'vs last month' }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Customers"
            value={activeCustomers}
            change={{ value: 12.8, label: 'vs last month' }}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Average Orders"
            value={avgOrders}
            change={{ value: 2.3, label: 'per customer' }}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Top Spender"
            value={formatCurrency(topSpender)}
            change={{ value: 15.1, label: 'vs avg' }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Filters Bar */}
        <div className="flex gap-4 mb-5 items-center flex-wrap">
          {/* Search */}
          <div className="flex-1 flex-grow-0 w-[300px] max-w-96">
            <input
              type="text"
              placeholder="Search customers, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 px-4 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm font-sans outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={cn(
                  'p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans transition-all duration-fast',
                  statusFilter === status
                    ? 'bg-blue-500 text-black border-blue-500'
                    : 'bg-transparent text-gray-400 border-[#1e1e2e]',
                  'capitalize'
                )}
              >
                {status === 'all' ? 'All Statuses' : status}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            className="p-1 px-3 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm font-sans cursor-pointer outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="totalSpent">Sort by Total Spent</option>
            <option value="totalOrders">Sort by Orders</option>
            <option value="lastOrderDate">Sort by Last Order</option>
          </select>
        </div>

        {/* Tiers Overview */}
        <Card className="mb-5 p-4">
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <h3 className="m-0 text-sm font-semibold text-white">Customer Tiers</h3>
            </div>
            {(['standard', 'premium', 'enterprise'] as const).map((tier) => {
              const count = customers.filter((c) => c.tier === tier).length;
              return (
                <button
                  key={tier}
                  className={cn(
                    'p-2 px-3 rounded-md border text-xs font-semibold cursor-pointer font-sans capitalize',
                    'bg-transparent text-gray-300 border-[#1e1e2e]'
                  )}
                >
                  {tier} <span className="ml-1.5 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Customers Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                  <th className="p-3 px-4 text-left font-semibold text-gray-300">Name</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-300">Email</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-300">Phone</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">Orders</th>
                  <th className="p-3 px-4 text-right font-semibold text-gray-300">Total Spent</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-300">Tier</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1e1e2e]">
                      <td colSpan={8} className="px-4 py-3 h-12 bg-[#1a1a2e]/50 animate-pulse" />
                    </tr>
                  ))
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((customer, idx) => (
                    <tr
                      key={customer.id}
                      className={cn(
                        'border-b border-[#1e1e2e] transition-colors duration-fast',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-[#1a1a2e]'
                      )}
                    >
                      <td className="p-3 px-4 text-white font-semibold">{customer.name}</td>
                      <td className="p-3 px-4 text-gray-300">{customer.email}</td>
                      <td className="p-3 px-4 text-gray-300">{customer.phone}</td>
                      <td className="p-3 px-4 text-center text-white font-semibold">
                        {customer.totalOrders}
                      </td>
                      <td className="p-3 px-4 text-right text-white font-semibold">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="p-3 px-4 text-left">
                        <Badge variant={getTierColor(customer.tier)}>{customer.tier}</Badge>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                          {customer.status}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="secondary" size="sm">
                            View
                          </Button>
                          <Button variant="secondary" size="sm">
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-[#1e1e2e] bg-[#1a1a2e] text-sm text-gray-300">
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
