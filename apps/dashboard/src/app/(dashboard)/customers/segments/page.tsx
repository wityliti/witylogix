'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCustomers, useCustomerGeo, useCustomerStats, customerName, type Customer } from '@/hooks/use-customers';
import { WLMap } from '@/components/map/wl-map';
import { CustomerDensityLayer } from '@/components/map/customer-density-layer';

const fmt = (n: string | number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));

// Spend-based segments
type SpendTier = 'vip' | 'loyal' | 'regular' | 'new';

function getSpendTier(totalSpent: string | number): SpendTier {
  const v = Number(totalSpent);
  if (v >= 1000) return 'vip';
  if (v >= 300) return 'loyal';
  if (v >= 50) return 'regular';
  return 'new';
}

const TIER_CONFIG: Record<SpendTier, { label: string; color: string; bg: string; variant: 'primary' | 'success' | 'warning' | 'info' | 'default'; description: string }> = {
  vip:     { label: 'VIP',     color: '#f59e0b', bg: '#f59e0b20', variant: 'warning', description: '≥ $1,000 spent' },
  loyal:   { label: 'Loyal',   color: '#34d399', bg: '#34d39920', variant: 'success', description: '$300–$999 spent' },
  regular: { label: 'Regular', color: '#60a5fa', bg: '#60a5fa20', variant: 'info',    description: '$50–$299 spent' },
  new:     { label: 'New',     color: '#94a3b8', bg: '#94a3b820', variant: 'default', description: 'Under $50' },
};

function SegmentBar({
  tier,
  count,
  total,
  onClick,
  active,
}: {
  tier: SpendTier;
  count: number;
  total: number;
  onClick: () => void;
  active: boolean;
}) {
  const cfg = TIER_CONFIG[tier];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all cursor-pointer',
        active ? 'border-opacity-60' : 'border-[#1e1e2e] hover:border-[#2e2e4e]'
      )}
      style={active ? { borderColor: cfg.color, background: cfg.bg } : {}}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
          <span className="text-sm font-semibold text-white">{cfg.label}</span>
          <span className="text-xs text-gray-500">{cfg.description}</span>
        </div>
        <div className="text-right">
          <span className="text-base font-bold text-white">{count}</span>
          <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: cfg.color }}
        />
      </div>
    </button>
  );
}

export default function CustomersSegmentsPage() {
  const [activeTier, setActiveTier] = useState<SpendTier | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: customers, loading } = useCustomers({ limit: 200 });
  const { data: stats, loading: statsLoading } = useCustomerStats();
  const { data: geoPoints } = useCustomerGeo();

  const segments = useMemo(() => {
    const map: Record<SpendTier, Customer[]> = { vip: [], loyal: [], regular: [], new: [] };
    customers.forEach((c) => map[getSpendTier(c.totalSpent)].push(c));
    return map;
  }, [customers]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => c.tags.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [customers]);

  const filtered = activeTier ? segments[activeTier] : customers;
  const total = customers.length;

  return (
    <>
      <Header
        title="Customer Segments"
        subtitle={`${total} customers · segmented by spend`}
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <StatCard
            label="Total Customers"
            value={statsLoading ? '—' : (stats?.total ?? total)}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="VIP Customers"
            value={loading ? '—' : segments.vip.length}
            accentColor="#f59e0b"
            index={1}
          />
          <StatCard
            label="Total Revenue"
            value={statsLoading ? '—' : fmt(stats?.totalRevenue ?? 0)}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Avg Order Count"
            value={statsLoading ? '—' : Number(stats?.avgOrderCount ?? 0).toFixed(1)}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Segments sidebar */}
          <div className="xl:col-span-2 space-y-3">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Spend Segments</h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-[#1e1e2e] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(['vip', 'loyal', 'regular', 'new'] as SpendTier[]).map((tier) => (
                    <SegmentBar
                      key={tier}
                      tier={tier}
                      count={segments[tier].length}
                      total={total}
                      active={activeTier === tier}
                      onClick={() => setActiveTier(activeTier === tier ? null : tier)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Tag cloud */}
            {tagCounts.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Top Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {tagCounts.map(([tag, count]) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      {tag} <span className="ml-1 opacity-60">{count}</span>
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Map + table */}
          <div className="xl:col-span-3 space-y-4">
            {/* Geographic map */}
            <Card className="p-0 overflow-hidden">
              <div className="p-3 border-b border-[#1e1e2e]">
                <h3 className="text-sm font-semibold text-white">Geographic Distribution</h3>
                <p className="text-xs text-gray-400">Order delivery locations by city</p>
              </div>
              {(!geoPoints || geoPoints.length === 0) ? (
                <div className="h-60 flex flex-col items-center justify-center text-gray-500">
                  <div className="text-2xl mb-2">◎</div>
                  <p className="text-sm">No location data yet</p>
                </div>
              ) : (
                <WLMap
                  className="h-64"
                  center={[40.7128, -74.006]}
                  zoom={3}
                  onReady={(id) => setMapId(id)}
                />
              )}
              {mapId && geoPoints && geoPoints.length > 0 && (
                <CustomerDensityLayer mapId={mapId} points={geoPoints} />
              )}
            </Card>

            {/* Customer list for active segment */}
            <Card className="overflow-hidden p-0">
              <div className="p-3 border-b border-[#1e1e2e] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {activeTier ? `${TIER_CONFIG[activeTier].label} Customers` : 'All Customers'}
                  </h3>
                  <p className="text-xs text-gray-400">{filtered.length} customers</p>
                </div>
                {activeTier && (
                  <button
                    onClick={() => setActiveTier(null)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Clear filter ×
                  </button>
                )}
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-[#1a1a2e]">
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="p-2 px-4 text-left font-semibold text-gray-400 text-xs">Name</th>
                      <th className="p-2 px-4 text-center font-semibold text-gray-400 text-xs">Orders</th>
                      <th className="p-2 px-4 text-right font-semibold text-gray-400 text-xs">Spent</th>
                      <th className="p-2 px-4 text-left font-semibold text-gray-400 text-xs">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-[#1e1e2e]">
                          <td colSpan={4} className="px-4 py-2 h-10">
                            <div className="h-3 bg-[#1e1e2e] rounded animate-pulse w-2/3" />
                          </td>
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No customers in this segment
                        </td>
                      </tr>
                    ) : (
                      filtered.slice(0, 50).map((c) => {
                        const tier = getSpendTier(c.totalSpent);
                        const cfg = TIER_CONFIG[tier];
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]/50 transition-colors"
                          >
                            <td className="p-2 px-4">
                              <div className="text-white text-xs font-medium">{customerName(c)}</div>
                              {c.email && <div className="text-gray-500 text-xs">{c.email}</div>}
                            </td>
                            <td className="p-2 px-4 text-center text-white text-xs">{c.ordersCount}</td>
                            <td className="p-2 px-4 text-right text-white text-xs font-semibold">
                              {fmt(c.totalSpent)}
                            </td>
                            <td className="p-2 px-4">
                              <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
