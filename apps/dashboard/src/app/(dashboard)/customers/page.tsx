'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomers, useCustomerStats, useCustomerGeo, customerName, type Customer } from '@/hooks/use-customers';
import { WLMap } from '@/components/map/wl-map';
import { CustomerDensityLayer } from '@/components/map/customer-density-layer';
import Link from 'next/link';

const fmt = (n: number | string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <tr className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]/60 transition-colors">
      <td className="p-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1 0%,#818cf8 100%)', color: '#fff' }}
          >
            {(customer.firstName?.[0] ?? customer.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">
              {customerName(customer)}
            </div>
            {customer.email && (
              <div className="text-gray-400 text-xs">{customer.email}</div>
            )}
          </div>
        </div>
      </td>
      <td className="p-3 px-4 text-gray-300 text-sm">{customer.phone ?? '—'}</td>
      <td className="p-3 px-4 text-center text-white font-semibold text-sm">{customer.ordersCount}</td>
      <td className="p-3 px-4 text-right text-white font-semibold text-sm">{fmt(customer.totalSpent)}</td>
      <td className="p-3 px-4">
        <div className="flex flex-wrap gap-1">
          {customer.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="default" className="text-xs">
              {t}
            </Badge>
          ))}
          {customer.tags.length > 2 && (
            <span className="text-xs text-gray-400">+{customer.tags.length - 2}</span>
          )}
          {customer.tags.length === 0 && <span className="text-xs text-gray-500">—</span>}
        </div>
      </td>
      <td className="p-3 px-4 text-gray-300 text-xs">{fmtDate(customer.lastSyncAt)}</td>
      <td className="p-3 px-4 text-center">
        <Link href={`/customers/${customer.id}`}>
          <Button variant="secondary" size="sm">View</Button>
        </Link>
      </td>
    </tr>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[#1e1e2e]">
          <td colSpan={7} className="px-4 py-3 h-14">
            <div className="h-4 bg-[#1e1e2e] rounded animate-pulse w-3/4" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function CustomersPage() {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'firstName' | 'totalSpent' | 'ordersCount' | 'lastSyncAt'>('lastSyncAt');
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: customers, loading, error, refetch, pagination, setSearch: apiSearch } = useCustomers({
    sortBy,
    limit: 25,
  });
  const { data: stats, loading: statsLoading } = useCustomerStats();
  const { data: geoPoints, loading: geoLoading } = useCustomerGeo();

  const handleSearch = (val: string) => {
    setSearch(val);
    apiSearch(val);
  };

  const sorted = useMemo(() => [...customers], [customers]);

  return (
    <>
      <Header
        title="Customers"
        subtitle={
          statsLoading
            ? 'Loading...'
            : `${stats?.recentlyActive ?? 0} active · ${stats?.total ?? pagination.total} total`
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
              {(['list', 'map'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors capitalize',
                    view === v
                      ? 'bg-[#6366f1] text-white'
                      : 'bg-[#12121a] text-gray-400 hover:text-white'
                  )}
                >
                  {v === 'list' ? '≡ List' : '◎ Map'}
                </button>
              ))}
            </div>
            <Button variant="primary" size="md" onClick={() => refetch()}>
              ↻ Sync Shopify
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-red-400">Failed to load customers</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-red-400">
              Retry
            </Button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <StatCard
            label="Total Customers"
            value={statsLoading ? '—' : (stats?.total ?? 0)}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active (30 days)"
            value={statsLoading ? '—' : (stats?.recentlyActive ?? 0)}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Avg Orders / Customer"
            value={statsLoading ? '—' : Number(stats?.avgOrderCount ?? 0).toFixed(1)}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Top Spender"
            value={statsLoading ? '—' : fmt(stats?.topSpent ?? 0)}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-72 p-2 px-4 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm font-sans outline-none placeholder:text-gray-600 focus:border-[#6366f1]/60 transition-colors"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="p-2 px-3 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm font-sans cursor-pointer outline-none"
          >
            <option value="lastSyncAt">Sort: Last Sync</option>
            <option value="totalSpent">Sort: Total Spent</option>
            <option value="ordersCount">Sort: Orders</option>
            <option value="firstName">Sort: Name A→Z</option>
          </select>
          <span className="ml-auto text-xs text-gray-500">
            {loading ? 'Loading…' : `${pagination.total} customers`}
          </span>
        </div>

        {/* Map View */}
        {view === 'map' && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Customer Density by City</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Circle size reflects number of orders from that city
                </p>
              </div>
              {geoLoading && (
                <span className="text-xs text-gray-500 animate-pulse">Loading locations…</span>
              )}
            </div>
            {(!geoPoints || geoPoints.length === 0) && !geoLoading ? (
              <div className="h-80 flex flex-col items-center justify-center text-gray-500">
                <div className="text-2xl mb-2">◎</div>
                <p className="text-sm">No geographic data yet</p>
                <p className="text-xs mt-1 text-gray-600">
                  Geographic data appears once customers place orders with delivery locations
                </p>
              </div>
            ) : (
              <WLMap
                className="h-[480px]"
                center={[40.7128, -74.006]}
                zoom={3}
                onReady={(id) => setMapId(id)}
              >
                <div className="absolute top-3 right-12 z-[1000] bg-[rgba(13,13,20,0.9)] border border-[#1e1e2e] rounded-lg p-2 text-xs space-y-1.5">
                  <div className="text-gray-400 font-semibold mb-1">Customer density</div>
                  {[
                    { label: '100+', r: 22 },
                    { label: '50+', r: 18 },
                    { label: '10+', r: 11 },
                    { label: '1+', r: 7 },
                  ].map(({ label, r }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className="rounded-full shrink-0"
                        style={{
                          width: r,
                          height: r,
                          background: 'rgba(129,140,248,0.55)',
                          border: '1.5px solid #6366f1',
                        }}
                      />
                      <span className="text-gray-300">{label}</span>
                    </div>
                  ))}
                </div>
              </WLMap>
            )}
            {mapId && geoPoints && geoPoints.length > 0 && (
              <CustomerDensityLayer mapId={mapId} points={geoPoints} />
            )}
          </Card>
        )}

        {/* List View */}
        {view === 'list' && (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                    <th className="p-3 px-4 text-left font-semibold text-gray-300">Customer</th>
                    <th className="p-3 px-4 text-left font-semibold text-gray-300">Phone</th>
                    <th className="p-3 px-4 text-center font-semibold text-gray-300">Orders</th>
                    <th className="p-3 px-4 text-right font-semibold text-gray-300">Total Spent</th>
                    <th className="p-3 px-4 text-left font-semibold text-gray-300">Tags</th>
                    <th className="p-3 px-4 text-left font-semibold text-gray-300">Last Sync</th>
                    <th className="p-3 px-4 text-center font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton />
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="text-gray-500">
                          <div className="text-3xl mb-3">👥</div>
                          <p className="text-sm font-medium text-gray-300">No customers found</p>
                          <p className="text-xs mt-1 text-gray-500">
                            {search ? 'Try a different search term' : 'Sync customers from Shopify to get started'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((c) => <CustomerRow key={c.id} customer={c} />)
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-[#1e1e2e] bg-[#1a1a2e] text-sm text-gray-400">
              <div>
                {!loading && sorted.length > 0 && (
                  <span>
                    Showing {sorted.length} of {pagination.total}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {pagination.totalPages > 1 && (
                  <>
                    <span className="text-xs">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Top Spenders */}
        {!statsLoading && stats?.topSpenders && stats.topSpenders.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Top Spenders</h3>
            <div className="space-y-2">
              {stats.topSpenders.slice(0, 5).map((s, i) => {
                const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email || 'Unknown';
                const pct = stats.topSpent
                  ? Math.min(100, (Number(s.totalSpent) / Number(stats.topSpent)) * 100)
                  : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-200 truncate">{name}</span>
                        <span className="text-xs text-white font-semibold ml-2 shrink-0">
                          {fmt(s.totalSpent)}
                        </span>
                      </div>
                      <div className="h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {s.ordersCount} ord.
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
