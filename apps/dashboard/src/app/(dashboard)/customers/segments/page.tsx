'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useCustomerStats, useCustomerDensity } from '@/hooks/use-customers';
import type { CustomerDensityPoint } from '@/hooks/use-customers';
import { Users, Star, TrendingUp, Globe, Map as MapIcon, ChevronRight } from 'lucide-react';

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
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);

const pct = (n: number, total: number) =>
  total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;

// ─── Tier Config ──────────────────────────────────────────────

const TIER_CONFIG = {
  enterprise: {
    label: 'Enterprise',
    badge: 'primary' as const,
    color: '#818cf8',
    bg: 'bg-indigo-500/10',
    icon: '🏆',
    description: '$1,000+ lifetime spend',
    spendMin: 1000,
  },
  premium: {
    label: 'Premium',
    badge: 'success' as const,
    color: '#34d399',
    bg: 'bg-green-500/10',
    icon: '⭐',
    description: '$200–$999 lifetime spend',
    spendMin: 200,
  },
  standard: {
    label: 'Standard',
    badge: 'info' as const,
    color: '#60a5fa',
    bg: 'bg-blue-500/10',
    icon: '👤',
    description: 'Under $200 lifetime spend',
    spendMin: 0,
  },
} as const;

// ─── Skeleton ─────────────────────────────────────────────────

function SegmentSkeleton() {
  return (
    <div className="h-36 bg-[#1a1a2e] rounded-xl animate-pulse" />
  );
}

// ─── Tier Card ────────────────────────────────────────────────

function TierCard({
  tier,
  count,
  total,
}: {
  tier: keyof typeof TIER_CONFIG;
  count: number;
  total: number;
}) {
  const cfg = TIER_CONFIG[tier];
  const ratio = total === 0 ? 0 : count / total;

  return (
    <Link href={`/customers?tier=${tier}`}>
      <Card hover className="p-5 group cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg', cfg.bg)}>
            {cfg.icon}
          </div>
          <Badge variant={cfg.badge}>{cfg.label}</Badge>
        </div>

        <div className="mb-1">
          <span className="text-3xl font-bold text-white">{count.toLocaleString()}</span>
          <span className="ml-2 text-sm text-gray-500">customers</span>
        </div>

        <div className="text-xs text-gray-500 mb-3">{cfg.description}</div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.round(ratio * 100)}%`, background: cfg.color }}
          />
        </div>
        <div className="mt-1 text-xs text-gray-500 text-right">{pct(count, total)} of total</div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
            View customers →
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300 transition-colors" />
        </div>
      </Card>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CustomerSegmentsPage() {
  const { data: stats, loading, error, refetch } = useCustomerStats();
  const { data: densityRaw } = useCustomerDensity();
  const [mapId, setMapId] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<CustomerDensityPoint | null>(null);

  const density: CustomerDensityPoint[] = Array.isArray(densityRaw) ? densityRaw : [];
  const handleMapReady = useCallback((id: string) => setMapId(id), []);
  const handleCityClick = useCallback((p: CustomerDensityPoint) => setSelectedCity(p), []);

  const total = stats?.total ?? 0;

  return (
    <>
      <Header
        title="Customer Segments"
        subtitle="Tier breakdown, geographic distribution, and revenue analysis"
        actions={
          <Link href="/customers">
            <Button variant="secondary" size="md">
              <Users className="w-4 h-4 mr-2" /> All Customers
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {error && !loading && (
          <ErrorState
            title="Failed to load segment data"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {/* Tier Cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">Tier Segments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SegmentSkeleton key={i} />)
            ) : stats ? (
              (['enterprise', 'premium', 'standard'] as const).map((tier) => (
                <TierCard key={tier} tier={tier} count={stats.tiers[tier]} total={total} />
              ))
            ) : null}
          </div>
        </section>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-500">Active</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.active.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{pct(stats.active, total)} of total</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-500">Avg Orders</span>
              </div>
              <div className="text-2xl font-bold text-white">{Number(stats.avgOrderCount).toFixed(1)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-gray-500">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold text-white">{fmtCurrency(stats.totalRevenue)}</div>
            </Card>
          </div>
        )}

        {/* Top Spenders */}
        {stats && stats.topSpenders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">Top Spenders</h2>
            <Card className="overflow-hidden p-0">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Email</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-300">Revenue</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300">Orders</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {stats.topSpenders.map((s, idx) => {
                    const tier =
                      s.totalSpent >= 1000 ? 'enterprise' : s.totalSpent >= 200 ? 'premium' : 'standard';
                    const cfg = TIER_CONFIG[tier];
                    return (
                      <tr key={s.id} className="border-b border-[#1e1e2e] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center',
                            idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                            idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                            idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-[#1e1e2e] text-gray-500',
                          )}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-gray-400">{s.email ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold" style={{ color: cfg.color }}>
                            {fmtCurrency(s.totalSpent)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{s.ordersCount}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/customers/${s.id}`}>
                            <Button variant="secondary" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </section>
        )}

        {/* Geographic Distribution Map */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2">
            <MapIcon className="w-4 h-4" /> Geographic Distribution
          </h2>

          <div className="h-[400px] relative rounded-xl overflow-hidden border border-[#1e1e2e]">
            <WLMap
              className="w-full h-full"
              center={[20, 0]}
              zoom={2}
              onReady={handleMapReady}
            >
              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 z-[1000] bg-[rgba(13,13,20,0.9)] border border-white/10 rounded-lg p-3 pointer-events-auto">
                <div className="text-xs font-semibold text-gray-300 mb-2">Bubble = customer count</div>
                <div className="flex flex-col gap-1">
                  {[
                    { color: '#818cf8', label: 'High density' },
                    { color: '#60a5fa', label: 'Mid density' },
                    { color: '#34d399', label: 'Low density' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
                      <span className="text-xs text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </WLMap>
            {mapId && density.length > 0 && (
              <CustomerDensityLayer
                mapId={mapId}
                points={density}
                onCityClick={handleCityClick}
              />
            )}
          </div>

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
                className="text-xs text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </Card>
          )}

          {density.length === 0 && !loading && (
            <EmptyState
              icon={<Globe className="w-6 h-6" />}
              title="No geographic data yet"
              description="Geographic distribution populates once customers have delivery orders with city data."
            />
          )}
        </section>
      </div>
    </>
  );
}
