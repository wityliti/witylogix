'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useCustomers, useCustomerStats } from '@/hooks/use-customers';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse" /> },
);
const CustomerDensityLayer = dynamic(
  () => import('@/components/map/customer-density-layer').then((m) => ({ default: m.CustomerDensityLayer })),
  { ssr: false },
);

// ─── Helpers ─────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const TIER_BADGE: Record<string, 'primary' | 'success' | 'info' | 'default'> = {
  enterprise: 'primary',
  premium: 'success',
  standard: 'info',
};

// ─── Row Skeleton ─────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="border-b border-[#1e1e2e]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[#1e1e2e] rounded animate-pulse" style={{ width: `${50 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Stat Skeletons ───────────────────────────────────────────

function StatSkeleton() {
  return <div className="h-24 bg-[#1a1a2e] rounded-xl animate-pulse" />;
}

// ─── Map Legend ───────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] bg-[rgba(13,13,20,0.9)] border border-white/10 rounded-lg p-3 pointer-events-auto">
      <div className="text-xs font-semibold text-gray-300 mb-2">Customer Density</div>
      <div className="flex flex-col gap-1.5">
        {[
          { color: '#818cf8', label: 'High (≥50%)' },
          { color: '#60a5fa', label: 'Mid (20–50%)' },
          { color: '#34d399', label: 'Low (<20%)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color, opacity: 0.7 }} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'totalOrders'>('name');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCity, setSelectedCity] = useState<CustomerDensityPoint | null>(null);

  const pageSize = 20;

  // Fetch customers + global stats from API
  const { items: customers, loading, error, refetch, pagination } = useCustomers({
    search: search || undefined,
    limit: pageSize,
    page: currentPage,
  });
  const { data: statsData } = useCustomerStats();

  const { data: stats, loading: statsLoading } = useCustomerStats();
  const { data: densityRaw } = useCustomerDensity();
  const [mapId, setMapId] = useState<string | null>(null);

  const density: CustomerDensityPoint[] = useMemo(
    () => (Array.isArray(densityRaw) ? densityRaw : []),
    [densityRaw],
  );

  const filtered = useMemo(() => {
    let result = customers;
    if (statusFilter !== 'all') result = result.filter((c) => c.status === statusFilter);
    return [...result].sort((a, b) => {
      if (sortBy === 'totalSpent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'totalOrders') return b.totalOrders - a.totalOrders;
      return a.name.localeCompare(b.name);
    });
  }, [customers, statusFilter, sortBy]);

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
          statsLoading
            ? 'Loading...'
            : stats
            ? `${stats.active.toLocaleString()} active · ${stats.total.toLocaleString()} total`
            : `${pagination.total.toLocaleString()} customers`
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

        {/* Tier Overview */}
        {stats && (
          <Card className="mb-5 p-4">
            <div className="flex gap-6 flex-wrap items-center">
              <span className="text-sm font-semibold text-white">Tiers</span>
              {(
                [
                  { key: 'standard', label: 'Standard', badge: 'info' as const },
                  { key: 'premium', label: 'Premium', badge: 'success' as const },
                  { key: 'enterprise', label: 'Enterprise', badge: 'primary' as const },
                ] as const
              ).map(({ key, label, badge }) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant={badge}>{label}</Badge>
                  <span className="text-sm font-semibold text-white">{stats.tiers[key].toLocaleString()}</span>
                </div>
              ))}
              {stats.lastSync && (
                <div className="ml-auto text-xs text-gray-500">
                  Last sync: {new Date(stats.lastSync).toLocaleString()}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Map View */}
        {view === 'map' && (
          <div className="mb-6">
            <div className="h-[480px] relative rounded-xl overflow-hidden border border-[#1e1e2e]">
              <WLMap
                className="w-full h-full"
                center={[20, 0]}
                zoom={2}
                onReady={handleMapReady}
              >
                <MapLegend />
              </WLMap>
              {mapId && density.length > 0 && (
                <CustomerDensityLayer
                  mapId={mapId}
                  points={density}
                  onCityClick={handleCityClick}
                />
              )}
            </div>

            {/* City Detail Callout */}
            {selectedCity && (
              <Card className="mt-3 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {selectedCity.city}{selectedCity.country ? `, ${selectedCity.country}` : ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {selectedCity.customerCount.toLocaleString()} customers · {selectedCity.orderCount.toLocaleString()} orders
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCity(null)}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </Card>
            )}

            {density.length === 0 && (
              <EmptyState
                icon={<MapIcon className="w-6 h-6" />}
                title="No geographic data yet"
                description="Customer location data populates from delivery orders. Sync customers and create orders to see the density map."
                className="mt-4"
              />
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
                            key={customer.id}
                            className={cn(
                              'border-b border-[#1e1e2e] hover:bg-white/[0.02] transition-colors',
                              idx % 2 === 0 ? 'bg-transparent' : 'bg-[#1a1a2e]/50',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-white">{initials}</span>
                                </div>
                                <span className="text-white font-medium">{customer.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-sm">{customer.email ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-400 text-sm">{customer.phone ?? '—'}</td>
                            <td className="px-4 py-3 text-center text-white font-semibold">{customer.totalOrders}</td>
                            <td className="px-4 py-3 text-right text-white font-semibold">
                              {fmtCurrency(customer.totalSpent)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={TIER_BADGE[customer.tier] ?? 'default'}>{customer.tier}</Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                                {customer.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Link href={`/customers/${customer.id}`}>
                                <Button variant="secondary" size="sm">View</Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e2e] bg-[#1a1a2e] text-sm text-gray-400">
                  <span>
                    {((currentPage - 1) * pageSize + 1).toLocaleString()}–
                    {Math.min(currentPage * pageSize, pagination.total).toLocaleString()} of{' '}
                    {pagination.total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs">
                      {currentPage} / {totalPages}
                    </span>
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
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
