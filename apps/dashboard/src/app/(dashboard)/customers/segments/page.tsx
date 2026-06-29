'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useCustomerSegmentStats } from '@/hooks/use-customers';
import {
  ArrowLeft, Star, TrendingUp, Users, MapPin, BarChart2, Map as MapIcon,
} from 'lucide-react';

// Leaflet map for top-city visualization
const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full bg-wl-bg-root rounded-xl animate-pulse" /> },
);

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (val: number, total: number) =>
  total > 0 ? `${((val / total) * 100).toFixed(1)}%` : '0%';

const TIER_CONFIG = {
  enterprise: {
    label: 'Enterprise',
    color: '#f59e0b',
    bgClass: 'bg-amber-400/10 border-amber-400/30',
    dotClass: 'bg-amber-400',
    badgeVariant: 'warning' as const,
    description: 'Top 5%+ by lifetime spend — highest-value accounts',
  },
  premium: {
    label: 'Premium',
    color: '#60a5fa',
    bgClass: 'bg-blue-400/10 border-blue-400/30',
    dotClass: 'bg-blue-400',
    badgeVariant: 'primary' as const,
    description: 'Regular buyers with solid order history',
  },
  standard: {
    label: 'Standard',
    color: '#6b7280',
    bgClass: 'bg-wl-neutral-500/10 border-wl-neutral-500/30',
    dotClass: 'bg-wl-neutral-500',
    badgeVariant: 'default' as const,
    description: 'New or low-frequency customers',
  },
} as const;

export default function CustomerSegmentsPage() {
  const { data: stats, loading, error, refetch } = useCustomerSegmentStats();
  const [activeView, setActiveView] = useState<'cards' | 'geo'>('cards');

  const total = stats?.total ?? 0;

  return (
    <>
      <Header
        title="Customer Segments"
        subtitle={loading ? 'Loading…' : `${total} customers across ${Object.keys(stats?.tiers ?? {}).length} tiers`}
        actions={
          <div className="flex gap-2">
            <Link href="/customers">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            </Link>
            <div className="flex rounded-md border border-wl-border-default overflow-hidden">
              <button
                onClick={() => setActiveView('cards')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                  activeView === 'cards' ? 'bg-blue-600 text-white' : 'text-wl-text-secondary hover:text-white',
                )}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Tiers
              </button>
              <button
                onClick={() => setActiveView('geo')}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                  activeView === 'geo' ? 'bg-blue-600 text-white' : 'text-wl-text-secondary hover:text-white',
                )}
              >
                <MapIcon className="w-3.5 h-3.5" /> Geography
              </button>
            </div>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {error && !loading && (
          <ErrorState title="Failed to load segment data" error={error} onRetry={() => refetch()} />
        )}

        {activeView === 'cards' && (
          <>
            {/* Tier breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['enterprise', 'premium', 'standard'] as const).map((tier) => {
                const cfg = TIER_CONFIG[tier];
                const seg = stats?.tiers?.[tier];

                return (
                  <Card key={tier} className={cn('p-5 border', cfg.bgClass)}>
                    {loading ? (
                      <div className="space-y-3">
                        <Skeleton type="text" className="w-24 h-5" />
                        <Skeleton type="text" className="w-16 h-8" />
                        <Skeleton type="text" className="w-32 h-4" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', cfg.dotClass)} />
                            <span className="font-semibold text-white text-sm">{cfg.label}</span>
                          </div>
                          <Badge variant={cfg.badgeVariant}>{fmtPct(seg?.count ?? 0, total)}</Badge>
                        </div>

                        <div className="text-3xl font-bold text-white mb-1">
                          {(seg?.count ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-wl-text-tertiary mb-4">customers</div>

                        <div className="space-y-2 text-xs border-t border-white/[0.06] pt-3">
                          <div className="flex justify-between">
                            <span className="text-wl-text-tertiary">Total revenue</span>
                            <span className="text-wl-text-primary font-semibold">
                              {fmt.format(seg?.totalSpent ?? 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-wl-text-tertiary">Avg orders</span>
                            <span className="text-wl-text-primary font-semibold">
                              {seg && seg.count > 0 ? (seg.totalOrders / seg.count).toFixed(1) : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-wl-text-tertiary">Avg spend</span>
                            <span className="text-wl-text-primary font-semibold">
                              {seg && seg.count > 0 ? fmt.format(seg.totalSpent / seg.count) : '—'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-wl-text-tertiary mt-3 leading-relaxed">
                          {cfg.description}
                        </p>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Active vs Inactive */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-wl-text-tertiary" /> Engagement Status
              </h3>
              {loading ? (
                <div className="flex gap-4">
                  <Skeleton type="rect" className="h-20 flex-1" />
                  <Skeleton type="rect" className="h-20 flex-1" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {(['active', 'inactive'] as const).map((status) => {
                    const count = stats?.statuses?.[status] ?? 0;
                    return (
                      <div
                        key={status}
                        className={cn(
                          'p-4 rounded-lg border',
                          status === 'active'
                            ? 'bg-green-400/5 border-green-400/20'
                            : 'bg-wl-neutral-500/5 border-wl-neutral-500/20',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-wl-neutral-300 capitalize font-medium">
                            {status}
                          </span>
                          <Badge variant={status === 'active' ? 'success' : 'default'}>
                            {fmtPct(count, total)}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {count.toLocaleString()}
                        </div>
                        <div className="text-xs text-wl-text-tertiary mt-1">
                          {status === 'active'
                            ? 'Have placed at least one order'
                            : 'No orders on record'}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              status === 'active' ? 'bg-green-400' : 'bg-wl-neutral-500',
                            )}
                            style={{ width: fmtPct(count, total) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Top tier actions */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Segment Criteria
              </h3>
              <div className="space-y-3 text-sm">
                {([
                  { tier: 'enterprise', rule: 'Lifetime spend ≥ $5,000', color: 'text-amber-400' },
                  { tier: 'premium', rule: 'Lifetime spend $1,000 – $4,999', color: 'text-blue-400' },
                  { tier: 'standard', rule: 'Lifetime spend < $1,000', color: 'text-wl-text-secondary' },
                ] as const).map(({ tier, rule, color }) => (
                  <div key={tier} className="flex items-center justify-between py-2 border-b border-wl-border-default last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', TIER_CONFIG[tier].dotClass)} />
                      <span className="capitalize font-medium text-white">{TIER_CONFIG[tier].label}</span>
                    </div>
                    <span className={cn('text-xs', color)}>{rule}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-wl-text-tertiary mt-3">
                Tiers are computed automatically based on cumulative spend synced from your store.
              </p>
            </Card>
          </>
        )}

        {activeView === 'geo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top cities table */}
            <Card className="overflow-hidden p-0">
              <div className="p-4 border-b border-wl-border-default">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-wl-text-tertiary" /> Top Cities
                </h3>
              </div>
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} type="rect" className="h-10" />
                  ))}
                </div>
              ) : !stats?.topCities || stats.topCities.length === 0 ? (
                <div className="p-10 text-center">
                  <MapPin className="w-8 h-8 text-wl-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-wl-text-secondary">No city data available</p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    Sync customers with addresses to see geographic breakdown
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-default bg-wl-bg-surface">
                        <th className="p-3 px-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">#</th>
                        <th className="p-3 px-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">City</th>
                        <th className="p-3 px-4 text-center text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">Customers</th>
                        <th className="p-3 px-4 text-right text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">Revenue</th>
                        <th className="p-3 px-4 text-center text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">Avg Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topCities.map((city, i) => {
                        const maxCount = stats.topCities[0]?.count ?? 1;
                        return (
                          <tr
                            key={city.city}
                            className={cn(
                              'border-b border-wl-border-default hover:bg-wl-bg-elevated/30 transition-colors',
                              i % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-surface/40',
                            )}
                          >
                            <td className="p-3 px-4 text-xs text-wl-text-tertiary font-mono">{i + 1}</td>
                            <td className="p-3 px-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-1.5 bg-blue-500 rounded-full"
                                  style={{ width: `${Math.max(4, (city.count / maxCount) * 60)}px` }}
                                />
                                <span className="text-white text-xs font-medium">{city.city}</span>
                              </div>
                            </td>
                            <td className="p-3 px-4 text-center font-semibold text-white">
                              {city.count.toLocaleString()}
                            </td>
                            <td className="p-3 px-4 text-right text-white text-xs">
                              {fmt.format(city.totalSpent)}
                            </td>
                            <td className="p-3 px-4 text-center text-wl-neutral-300 text-xs">
                              {city.avgOrders.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Revenue by tier bar chart (CSS-based) */}
            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-wl-text-tertiary" /> Revenue Distribution by Tier
                </h3>
                {loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} type="rect" className="h-8" />)}
                  </div>
                ) : stats?.tiers ? (() => {
                  const totalRevenue = Object.values(stats.tiers).reduce((s, t) => s + t.totalSpent, 0);
                  return (
                    <div className="space-y-4">
                      {(['enterprise', 'premium', 'standard'] as const).map((tier) => {
                        const seg = stats.tiers[tier];
                        const pct = totalRevenue > 0 ? (seg.totalSpent / totalRevenue) * 100 : 0;
                        const cfg = TIER_CONFIG[tier];
                        return (
                          <div key={tier}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={cn('w-2 h-2 rounded-full', cfg.dotClass)} />
                                <span className="text-wl-neutral-300 capitalize font-medium">{cfg.label}</span>
                              </div>
                              <span className="text-wl-text-secondary">
                                {fmt.format(seg.totalSpent)} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : null}
              </Card>

              {/* Customer count by tier */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-wl-text-tertiary" /> Customer Count by Tier
                </h3>
                {loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} type="rect" className="h-8" />)}
                  </div>
                ) : stats?.tiers ? (() => {
                  return (
                    <div className="space-y-4">
                      {(['enterprise', 'premium', 'standard'] as const).map((tier) => {
                        const seg = stats.tiers[tier];
                        const pct = total > 0 ? (seg.count / total) * 100 : 0;
                        const cfg = TIER_CONFIG[tier];
                        return (
                          <div key={tier}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={cn('w-2 h-2 rounded-full', cfg.dotClass)} />
                                <span className="text-wl-neutral-300 capitalize font-medium">{cfg.label}</span>
                              </div>
                              <span className="text-wl-text-secondary">
                                {seg.count.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : null}
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
