'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useCustomers, useCustomerStats } from '@/hooks/use-customers';

const CustomersMapView = dynamic(
  () => import('./components/customers-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-wl-bg-root rounded-xl border border-wl-border-default flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-white animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading map…</p>
        </div>
      </div>
    ),
  },
);

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const TIER_BADGE_VARIANT = {
  enterprise: 'warning',
  premium: 'primary',
  standard: 'default',
} as const;

const TIER_DOT: Record<string, string> = {
  enterprise: 'bg-amber-400',
  premium: 'bg-blue-400',
  standard: 'bg-gray-500',
};

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'standard' | 'premium' | 'enterprise'>('all');

  const pageSize = 20;

  // Fetch customers + global stats from API
  const { items: customers, loading, error, refetch, pagination } = useCustomers({
    search: search || undefined,
    limit: pageSize,
    page: currentPage,
  });
  const { data: statsData } = useCustomerStats();

  const { data: stats, loading: statsLoading } = useCustomerStats();
  const { data: locations, loading: locLoading } = useCustomerLocations();

  const handleSearch = useCallback(
    (val: string) => {
      setSearch(val);
      setApiSearch(val);
      setPage(1);
    },
    [setApiSearch, setPage],
  );

  const totalPct =
    stats && stats.totalPrev > 0 ? ((stats.total - stats.totalPrev) / stats.totalPrev) * 100 : null;
  const activePct = stats && stats.total > 0 ? (stats.activeCount / stats.total) * 100 : null;

  const totalPages = Math.max(1, Math.ceil(pagination.total / pageSize));

  // Stats — prefer server-side stats, fall back to client-computed from loaded page
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const avgOrders = statsData?.avgOrderCount
    ? statsData.avgOrderCount.toFixed(1)
    : customers.length > 0
    ? (customers.reduce((sum, c) => sum + c.totalOrders, 0) / customers.length).toFixed(1)
    : '0';
  const topSpender = statsData?.topSpenders?.[0]
    ? Number(statsData.topSpenders[0].totalSpent)
    : customers.length > 0
    ? Math.max(...customers.map((c) => c.totalSpent))
    : 0;

  return (
    <>
      <Header
        title="Customers"
        subtitle={
          loading || statsLoading
            ? 'Loading…'
            : `${stats?.activeCount ?? 0} active · ${pagination.total} total`
        }
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/customers/create')}
          >
            + Add Customer
          </Button>
        }
      />

      <div className="p-6">
        {/* Error State */}
        {error && !loading && (
          <ErrorState
            title="Failed to load customers"
            error={error}
            onRetry={() => refetch()}
            className="mb-6"
          />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Customers"
            value={statsData?.total ?? pagination.total}
            change={{ value: statsData?.syncedToday ?? 0, label: 'synced today' }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Customers"
            value={activeCustomers}
            change={{ value: 0, label: 'on this page' }}
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

        {/* Error */}
        {error && !loading && (
          <ErrorState title="Failed to load customers" error={error} onRetry={() => refetch()} />
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search customers"
            className="w-72 px-4 py-2 bg-wl-bg-surface border border-wl-border-default rounded-md text-white text-sm outline-none focus:border-blue-500/50 transition-colors"
          />

          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize',
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent text-gray-400 border-wl-border-default hover:border-gray-500',
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {(['all', 'standard', 'premium', 'enterprise'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTierFilter(t); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5',
                  tierFilter === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent text-gray-400 border-wl-border-default hover:border-gray-500',
                )}
              >
                {t !== 'all' && (
                  <span className={cn('w-2 h-2 rounded-full inline-block', TIER_DOT[t])} />
                )}
                {t === 'all' ? 'All Tiers' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Map View */}
        {view === 'map' && (
          <div className="h-[520px]">
            {locLoading ? (
              <div className="w-full h-full bg-wl-bg-root rounded-xl border border-wl-border-default flex items-center justify-center">
                <div className="text-center">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-white animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Loading customer locations…</p>
                </div>
              </div>
            ) : (
              <CustomersMapView customers={locations ?? []} />
            )}
          </div>
        )}

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
                      onClick={() => router.push(`/customers/${customer.id}`)}
                      className={cn(
                        'border-b border-[#1e1e2e] transition-colors duration-fast cursor-pointer hover:bg-[#1a1a2e]',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-[#1a1a2e]/60'
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
                      <td className="p-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            View
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

              <div className="flex gap-1">
                {(['all', 'active', 'inactive'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-semibold transition-all capitalize',
                      statusFilter === s
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'text-gray-400 border-[#1e1e2e] hover:border-gray-600',
                    )}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setCurrentPage(1); }}
                className="px-3 py-1.5 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm outline-none cursor-pointer"
              >
                <option value="name">Sort: Name</option>
                <option value="totalSpent">Sort: Revenue</option>
                <option value="totalOrders">Sort: Orders</option>
              </select>

              <button
                onClick={() => refetch()}
                className="ml-auto p-1.5 text-gray-400 hover:text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>

            {/* Table */}
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Phone</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300">Orders</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-300">Revenue</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300">Tier</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState
                            icon={<Users className="w-6 h-6" />}
                            title="No customers found"
                            description={
                              search
                                ? `No results for "${search}". Try a different search term.`
                                : 'Sync customers from Shopify to get started.'
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      filtered.map((customer, idx) => {
                        const initials = customer.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <tr
                            key={c.id}
                            className={cn(
                              'border-b border-wl-border-default transition-colors hover:bg-wl-bg-elevated/40',
                              idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-surface/40',
                            )}
                          >
                            <td className="p-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-white">
                                    {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-white text-sm truncate">{c.name}</div>
                                  {c.tags.length > 0 && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                      {c.tags.slice(0, 2).join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 px-4">
                              <div className="text-xs text-gray-300 truncate">{c.email ?? '—'}</div>
                              {c.phone && <div className="text-[10px] text-gray-500 mt-0.5">{c.phone}</div>}
                            </td>
                            <td className="p-3 px-4 text-center font-semibold text-white">{c.totalOrders}</td>
                            <td className="p-3 px-4 text-right font-semibold text-white">{fmt.format(c.totalSpent)}</td>
                            <td className="p-3 px-4 text-center">
                              <Badge variant={TIER_BADGE_VARIANT[c.tier]}>{c.tier}</Badge>
                            </td>
                            <td className="p-3 px-4 text-center">
                              <Badge variant={c.status === 'active' ? 'success' : 'default'}>
                                {c.status}
                              </Badge>
                            </td>
                            <td className="p-3 px-4 text-center">
                              <Link href={`/customers/${c.id}`}>
                                <Button variant="secondary" size="sm">View</Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-wl-border-default bg-wl-bg-surface text-xs text-gray-400">
              <span>{pagination.total} total customers</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <span>
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
