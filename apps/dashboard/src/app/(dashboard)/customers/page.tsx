'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import {
  useCustomers,
  useCustomerStats,
  useCustomerLocations,
} from '@/hooks/use-customers';
import { LayoutGrid, Map as MapIcon, Users, TrendingUp, ShoppingBag, Star } from 'lucide-react';

const CustomersMapView = dynamic(
  () => import('./components/customers-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] flex items-center justify-center">
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
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'standard' | 'premium' | 'enterprise'>('all');

  const {
    items: customers,
    loading,
    error,
    refetch,
    pagination,
    setPage,
    setSearch: setApiSearch,
  } = useCustomers({
    limit: 20,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    tier: tierFilter !== 'all' ? tierFilter : undefined,
  });

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

  const statCards = [
    {
      label: 'Total Customers',
      value: statsLoading ? null : stats?.total ?? 0,
      icon: <Users className="w-5 h-5 text-blue-400" />,
      change: totalPct !== null ? fmtPct(totalPct) + ' vs prior period' : null,
    },
    {
      label: 'Active',
      value: statsLoading ? null : stats?.activeCount ?? 0,
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      change: activePct !== null ? `${activePct.toFixed(0)}% of total` : null,
    },
    {
      label: 'Avg Orders / Customer',
      value: statsLoading ? null : (stats?.avgOrderCount ?? 0).toFixed(1),
      icon: <ShoppingBag className="w-5 h-5 text-purple-400" />,
      change: null,
    },
    {
      label: 'Top Spender',
      value: statsLoading ? null : fmt.format(stats?.topSpenderAmount ?? 0),
      icon: <Star className="w-5 h-5 text-amber-400" />,
      change: null,
    },
  ];

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
          <div className="flex gap-2">
            <div className="flex rounded-md border border-[#1e1e2e] overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                  view === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                  view === 'map' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white',
                )}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map
              </button>
            </div>
            <Link href="/customers/segments">
              <Button variant="secondary" size="sm">Segments</Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400 font-medium">{s.label}</span>
                {s.icon}
              </div>
              {s.value === null ? (
                <Skeleton type="text" className="w-24 h-7 mb-1" />
              ) : (
                <div className="text-2xl font-bold text-white">{s.value}</div>
              )}
              {s.change && <div className="text-xs text-gray-500 mt-1">{s.change}</div>}
            </Card>
          ))}
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
            className="w-72 px-4 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-md text-white text-sm outline-none focus:border-blue-500/50 transition-colors"
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
                    : 'bg-transparent text-gray-400 border-[#1e1e2e] hover:border-gray-500',
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
                    : 'bg-transparent text-gray-400 border-[#1e1e2e] hover:border-gray-500',
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
              <div className="w-full h-full bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] flex items-center justify-center">
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

        {/* Table View */}
        {view === 'grid' && (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e] bg-[#111118]">
                    <th className="p-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                    <th className="p-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
                    <th className="p-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Orders</th>
                    <th className="p-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Spent</th>
                    <th className="p-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Tier</th>
                    <th className="p-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="p-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-[#1e1e2e]">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="p-3 px-4">
                              <Skeleton type="text" className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : customers.length === 0
                      ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-14 text-center">
                            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                            <p className="text-sm text-gray-400 mb-2">No customers found</p>
                            {(search || statusFilter !== 'all' || tierFilter !== 'all') && (
                              <button
                                onClick={() => { handleSearch(''); setStatusFilter('all'); setTierFilter('all'); }}
                                className="text-xs text-blue-400 hover:underline"
                              >
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                      : customers.map((c, idx) => (
                          <tr
                            key={c.id}
                            className={cn(
                              'border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e]/40',
                              idx % 2 === 0 ? 'bg-transparent' : 'bg-[#111118]/40',
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
            <div className="flex items-center justify-between p-4 border-t border-[#1e1e2e] bg-[#111118] text-xs text-gray-400">
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
