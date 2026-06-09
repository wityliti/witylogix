'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/loading-skeleton';
import {
  Truck,
  Map,
  AlertCircle,
  CheckCircle,
  Plus,
  Download,
  Filter,
  Lock,
  Zap,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   FREIGHT INTEGRATIONS — Load board aggregation & rate mgmt
   Data: GET /api/v4/integrations  (filter by freight slugs)
   ═══════════════════════════════════════════════════════════ */

type FreightViewType = 'loads' | 'rates' | 'bookings' | 'compliance';

interface InstalledIntegration {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  isEnabled: boolean;
  healthStatus: string | null;
  lastHealthCheckAt: string | null;
  lastSyncAt: string | null;
}

interface InstalledResponse {
  integrations: InstalledIntegration[];
}

const FREIGHT_PROVIDERS = [
  { slug: 'dat', name: 'DAT (Direct Access)', icon: '📊', description: 'Industry-leading load board network' },
  { slug: 'truckstop', name: 'Truckstop', icon: '🚛', description: 'Full-service freight exchange' },
  { slug: 'loadboard123', name: '123Loadboard', icon: '🔢', description: 'Premium load matching platform' },
  { slug: 'directfreight', name: 'Direct Freight', icon: '🎯', description: 'Direct carrier connections' },
];

function connectionStatus(slug: string, installed: InstalledIntegration[]) {
  const match = installed.find((i) => i.slug === slug);
  if (!match) return { status: 'NOT_CONNECTED' as const, integration: null };
  if (!match.isEnabled) return { status: 'DISABLED' as const, integration: match };
  if (match.healthStatus === 'DOWN' || match.healthStatus === 'DEGRADED')
    return { status: 'ERROR' as const, integration: match };
  return { status: 'CONNECTED' as const, integration: match };
}

function ProviderStatusCard({
  provider,
  installed,
}: {
  provider: typeof FREIGHT_PROVIDERS[number];
  installed: InstalledIntegration[];
}) {
  const { status } = connectionStatus(provider.slug, installed);

  const badgeProps: Record<string, { variant: 'success' | 'default' | 'danger' | 'warning'; label: string }> = {
    CONNECTED:     { variant: 'success', label: 'Connected' },
    DISABLED:      { variant: 'default', label: 'Disabled' },
    ERROR:         { variant: 'danger',  label: 'Error' },
    NOT_CONNECTED: { variant: 'warning', label: 'Not Connected' },
  };

  const { variant, label } = badgeProps[status];

  return (
    <Card className="p-3">
      <div className={cn('flex items-center justify-between mb-2')}>
        <span className={cn('text-lg')}>{provider.icon}</span>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <p className={cn('text-xs font-semibold text-white mb-1')}>{provider.name}</p>
      <p className={cn('text-xs text-gray-400 mb-3')}>{provider.description}</p>
      <Button variant="secondary" size="sm" className="w-full text-xs">
        {status === 'NOT_CONNECTED' ? 'Connect' : 'Manage'}
      </Button>
    </Card>
  );
}

function EmptySectionState({ view }: { view: FreightViewType }) {
  const messages: Record<FreightViewType, { title: string; desc: string }> = {
    loads: {
      title: 'No loads available',
      desc: 'Connect a load board provider (DAT, Truckstop, 123Loadboard, Direct Freight) to see aggregated available loads.',
    },
    rates: {
      title: 'No rate data',
      desc: 'Connect a load board provider to see live lane rate comparisons and market trend analytics.',
    },
    bookings: {
      title: 'No bookings yet',
      desc: 'Once you connect a load board provider and book loads, your bookings will appear here.',
    },
    compliance: {
      title: 'No compliance documents',
      desc: 'Upload compliance documents (MC Authority, Insurance, IFTA) to manage carrier compliance.',
    },
  };

  const { title, desc } = messages[view];

  const icons: Record<FreightViewType, React.ReactNode> = {
    loads:      <Map className="w-10 h-10 text-gray-600 mx-auto mb-3" />,
    rates:      <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />,
    bookings:   <Truck className="w-10 h-10 text-gray-600 mx-auto mb-3" />,
    compliance: <Lock className="w-10 h-10 text-gray-600 mx-auto mb-3" />,
  };

  return (
    <Card className="p-12 text-center">
      {icons[view]}
      <p className={cn('text-sm font-medium text-gray-300 mb-2')}>{title}</p>
      <p className={cn('text-xs text-gray-500 max-w-sm mx-auto mb-4')}>{desc}</p>
      <Button variant="secondary" size="sm">
        <Plus size={14} className="mr-1" />
        Connect Provider
      </Button>
    </Card>
  );
}

export default function FreightIntegrationsPage() {
  const [installed, setInstalled] = useState<InstalledIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [view, setView] = useState<FreightViewType>('loads');

  const fetchInstalled = () => {
    setLoading(true);
    setError(null);
    api.get<InstalledResponse>('/api/v4/integrations')
      .then((res) => setInstalled(Array.isArray(res?.integrations) ? res.integrations : []))
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<InstalledResponse>('/api/v4/integrations')
      .then((res) => { if (!cancelled) setInstalled(Array.isArray(res?.integrations) ? res.integrations : []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const connectedProviders = useMemo(
    () => FREIGHT_PROVIDERS.filter((p) => {
      const { status } = connectionStatus(p.slug, installed);
      return status === 'CONNECTED';
    }),
    [installed],
  );

  return (
    <>
      <Header
        title="Freight Integrations"
        subtitle="Manage load boards, rates, bookings, and compliance"
        actions={
          <div className={cn('flex gap-2')}>
            <Button variant="secondary" size="sm" onClick={fetchInstalled}>Refresh</Button>
            <Button variant="primary" size="sm">
              <Plus size={14} className={cn('mr-1')} />
              Connect Provider
            </Button>
          </div>
        }
      />

      <div className={cn("p-6 bg-wl-bg-root")}>
        {/* Top Stats */}
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card className="p-4">
            <div className={cn('flex items-center justify-between mb-2')}>
              <span className={cn('text-xs text-gray-400 font-medium')}>Connected</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            {loading ? <Skeleton type="text" className="w-16 h-8" /> : (
              <div className={cn('text-2xl font-bold text-white')}>{connectedProviders.length}</div>
            )}
            <p className={cn('text-xs text-gray-400 mt-1')}>load board providers</p>
          </Card>
          <Card className="p-4">
            <div className={cn('flex items-center justify-between mb-2')}>
              <span className={cn('text-xs text-gray-400 font-medium')}>Available Loads</span>
              <Truck className="w-4 h-4 text-blue-400" />
            </div>
            <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
            <p className={cn('text-xs text-gray-400 mt-1')}>connect a provider</p>
          </Card>
          <Card className="p-4">
            <div className={cn('flex items-center justify-between mb-2')}>
              <span className={cn('text-xs text-gray-400 font-medium')}>Best Rate</span>
              <Map className="w-4 h-4 text-purple-400" />
            </div>
            <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
            <p className={cn('text-xs text-gray-400 mt-1')}>no rate data</p>
          </Card>
          <Card className="p-4">
            <div className={cn('flex items-center justify-between mb-2')}>
              <span className={cn('text-xs text-gray-400 font-medium')}>Avg Market Rate</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
            <p className={cn('text-xs text-gray-400 mt-1')}>no market data</p>
          </Card>
        </div>

        {error && (
          <ErrorState
            title="Failed to load integrations"
            error={error}
            onRetry={fetchInstalled}
          />
        )}

        {/* Provider Status */}
        <div>
          <h2 className={cn('text-sm font-semibold text-white mb-3')}>Load Board Providers</h2>
          {loading ? (
            <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3')}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <Skeleton type="text" className="w-full h-4" />
                  <Skeleton type="text" className="w-2/3 h-4" />
                  <Skeleton type="text" className="w-full h-8 mt-2" />
                </Card>
              ))}
            </div>
          ) : (
            <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3')}>
              {FREIGHT_PROVIDERS.map((provider) => (
                <ProviderStatusCard key={provider.slug} provider={provider} installed={installed} />
              ))}
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className={cn("flex gap-2 mb-6 bg-wl-bg-elevated rounded-md p-1 w-fit flex-wrap")}>
          {(["loads", "rates", "bookings", "compliance"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1 rounded-sm text-xs font-semibold cursor-pointer capitalize transition-colors',
                view === v ? 'bg-blue-500 text-white' : 'bg-transparent text-gray-300 hover:text-white',
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* All operational views show empty states until real freight integrations are connected */}
        {view === 'loads' && (
          <div>
            <div className={cn('flex items-center justify-between mb-4')}>
              <h3 className={cn('text-sm font-semibold text-white')}>Aggregated Load Board</h3>
              <Button variant="secondary" size="sm" disabled={connectedProviders.length === 0}>
                <Filter size={14} className={cn('mr-1')} />
                Filter
              </Button>
            </div>

            {AGGREGATED_LOADS.map((load, idx) => {
              const isExpanded = expandedLoad === load.id;
              const pcpm = (load.bestRate / load.distance).toFixed(2);

              return (
                <Card
                  key={load.id}
                  className={cn(
                    "cursor-pointer transition-all blue-500",
                    isExpanded && "ring-1 ring-blue-400"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => setExpandedLoad(isExpanded ? null : load.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex items-center gap-2 mb-1")}>
                          <Map size={14} className={cn("text-blue-400 shrink-0")} />
                          <p className={cn("text-sm font-semibold text-white truncate")}>
                            {load.origin} → {load.destination}
                          </p>
                        </div>
                        <p className={cn("text-xs text-gray-300")}>
                          {load.distance} mi • {load.weight.toLocaleString()} lbs • {load.equipment}
                        </p>
                      </div>
                      <div className={cn("text-right shrink-0")}>
                        <p className={cn("text-xl font-bold text-blue-400")}>
                          ${load.bestRate.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>
                          ${pcpm}/mi
                        </p>
                      </div>
                    </div>

                    <div className={cn("flex items-center gap-2 mb-3")}>
                      {load.sources.map((source) => {
                        const prov = FREIGHT_PROVIDERS.find((p) => p.slug === source);
                        return (
                          <span
                            key={source}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded bg-wl-bg-surface text-gray-300 font-medium"
                            )}
                          >
                            {prov?.name.split(" ")[0]}
                          </span>
                        );
                      })}
                      <span className={cn("text-xs text-gray-300 ml-auto")}>
                        {load.posted}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className={cn("border-t border-wl-border-default pt-3 mt-3 space-y-3")}>
                        <div className={cn("grid grid-cols-4 gap-2 text-xs")}>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-gray-300 mb-1")}>Best Rate</p>
                            <p className={cn("font-bold text-blue-400")}>
                              ${load.bestRate.toLocaleString()}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-gray-300 mb-1")}>Avg Rate</p>
                            <p className={cn("font-bold text-white")}>
                              ${load.avgRate.toLocaleString()}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-gray-300 mb-1")}>Carriers</p>
                            <p className={cn("font-bold text-white")}>
                              {load.carriers}
                            </p>
                          </div>
                          <div className={cn("bg-wl-bg-surface rounded p-2")}>
                            <p className={cn("text-gray-300 mb-1")}>Pickup</p>
                            <p className={cn("font-bold text-white text-xs")}>
                              {load.pickup}
                            </p>
                          </div>
                        </div>

                        <div className={cn("flex gap-2")}>
                          <Button variant="primary" size="sm">
                            <Zap size={14} className={cn("mr-1")} />
                            Book Now
                          </Button>
                          <Button variant="secondary" size="sm">
                            View Details
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Rates View */}
        {view === "rates" && (
          <div className={cn("space-y-4")}>
            <h3 className={cn("text-sm font-semibold text-white mb-4")}>
              Rate Comparison Matrix
            </h3>

            {/* Lane Selection */}
            <div className={cn("flex gap-2 mb-4 flex-wrap")}>
              {RATE_COMPARISONS.map((comp) => (
                <button
                  key={comp.lane}
                  onClick={() => setSelectedLane(comp.lane)}
                  className={cn(
                    "px-3 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-all",
                    selectedLane === comp.lane
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-wl-border-default text-gray-300 hover:border-blue-400"
                  )}
                >
                  {comp.lane}
                </button>
              ))}
            </div>

            {/* Selected Lane Details */}
            {RATE_COMPARISONS.map((comp) => {
              if (selectedLane !== comp.lane) return null;

              return (
                <Card
                  key={`rate-detail-${comp.lane}`}
                  className={cn("mb-6 blue-500")}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-center justify-between mb-4")}>
                      <div>
                        <p className={cn("text-sm font-semibold text-white")}>
                          {comp.origin} → {comp.destination}
                        </p>
                        <p className={cn("text-xs text-gray-300 mt-1")}>
                          {comp.count_last_30} loads in last 30 days
                        </p>
                      </div>
                      <div className={cn("text-right")}>
                        <p className={cn("text-2xl font-bold text-white")}>
                          ${comp.market_avg.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Market Avg</p>
                      </div>
                    </div>

                    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3 mb-4")}>
                      {[
                        { name: "DAT", rate: comp.mat_rate },
                        { name: "Truckstop", rate: comp.truckstop_rate },
                        { name: "123Load", rate: comp.loadboard123_rate },
                        { name: "Direct Freight", rate: comp.directfreight_rate },
                      ].map((source) => {
                        const diff = source.rate - comp.market_avg;
                        const diffPercent = ((diff / comp.market_avg) * 100).toFixed(1);
                        const isAbove = diff > 0;

                        return (
                          <div
                            key={source.name}
                            className={cn(
                              "p-3 rounded border",
                              isAbove
                                ? "border-red-400 border-opacity-30 bg-[rgba(239,68,68,0.08)]"
                                : "border-emerald-400 border-opacity-30 bg-[rgba(16,185,129,0.08)]"
                            )}
                          >
                            <p className={cn("text-xs font-semibold text-white")}>
                              {source.name}
                            </p>
                            <p className={cn("text-lg font-bold text-white mt-1")}>
                              ${source.rate.toLocaleString()}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-semibold mt-1",
                                isAbove ? "text-red-500" : "text-emerald-500"
                              )}
                            >
                              {isAbove ? "+" : "-"}${Math.abs(diff).toLocaleString()} ({diffPercent}%)
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm">
                        View Trend
                      </Button>
                      <Button variant="ghost" size="sm">
                        Set Price Alert
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Market Trends */}
            <div className={cn("mt-6")}>
              <h3 className={cn("text-sm font-semibold text-white mb-4")}>
                Market Rate Trends
              </h3>

              {MARKET_TRENDS.map((trend, idx) => (
                <Card
                  key={`trend-${trend.lane}`}
                  className={cn("mb-3 blue-500")}
                  style={{ animationDelay: `${(RATE_COMPARISONS.length + idx) * 40}ms` }}
                >
                  <div className={cn("p-3 flex items-center justify-between")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-white")}>
                        {trend.lane}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-0.5")}>
                        {trend.volume} loads
                      </p>
                    </div>
                    <div className={cn("flex items-center gap-6 text-right shrink-0")}>
                      <div>
                        <p className={cn("text-lg font-bold text-white")}>
                          ${trend.current.toLocaleString()}
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Current</p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-bold text-sm",
                            trend.change_week < 0 ? "text-emerald-500" : "text-red-500"
                          )}
                        >
                          {trend.change_week > 0 ? "+" : ""}{trend.change_week}%
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Week</p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-bold text-sm",
                            trend.change_month < 0 ? "text-emerald-500" : "text-red-500"
                          )}
                        >
                          {trend.change_month > 0 ? "+" : ""}{trend.change_month}%
                        </p>
                        <p className={cn("text-xs text-gray-300")}>Month</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {view === 'bookings' && (
          <div>
            <div className={cn('flex items-center justify-between mb-4')}>
              <h3 className={cn('text-sm font-semibold text-white')}>Recent Bookings</h3>
              <Button variant="primary" size="sm">
                <Plus size={14} className={cn('mr-1')} />
                New Booking
              </Button>
            </div>

            {RECENT_BOOKINGS.map((booking, idx) => (
              <Card
                key={booking.id}
                className={cn("blue-500")}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn("p-4")}>
                  <div className={cn("flex items-start justify-between mb-3")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("text-sm font-semibold text-white")}>
                        {booking.carrier}
                      </p>
                      <p className={cn("text-xs text-gray-300 mt-1")}>
                        {booking.origin} → {booking.destination}
                      </p>
                    </div>
                    <div className={cn("text-right shrink-0")}>
                      <p className={cn("text-lg font-bold text-blue-400")}>
                        ${booking.rate.toLocaleString()}
                      </p>
                      <Badge variant={bookingStatusVariant(booking.status)} dot>
                        {booking.status}
                      </Badge>
                    </div>
                  </div>

                  <div className={cn("bg-wl-bg-surface rounded p-3 mb-3")}>
                    <div className={cn("grid grid-cols-3 gap-3 text-xs")}>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Booked</p>
                        <p className={cn("font-semibold text-white")}>
                          {booking.booked}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Pickup</p>
                        <p className={cn("font-semibold text-white")}>
                          {booking.pickup}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-gray-300 mb-1")}>Delivery</p>
                        <p className={cn("font-semibold text-white")}>
                          {booking.delivery}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.confirmation !== "PENDING" && (
                    <div className={cn("mb-3 p-2 rounded bg-[rgba(16,185,129,0.1)] border border-emerald-400 border-opacity-30")}>
                      <p className={cn("text-xs text-emerald-500 font-semibold")}>
                        <CheckCircle size={12} className={cn("inline mr-1")} />
                        Confirmed: {booking.confirmation}
                      </p>
                    </div>
                  )}

                  <div className={cn("flex gap-2")}>
                    <Button variant="secondary" size="sm">
                      {booking.documents > 0 ? (
                        <>
                          <Download size={14} className={cn("mr-1")} />
                          Documents ({booking.documents})
                        </>
                      ) : (
                        "Upload Documents"
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {view === 'compliance' && (
          <div>
            <div className={cn('flex items-center justify-between mb-4')}>
              <h3 className={cn('text-sm font-semibold text-white')}>Compliance Documentation</h3>
              <Button variant="primary" size="sm">
                <Download size={14} className={cn('mr-1')} />
                Upload Document
              </Button>
            </div>
            <EmptySectionState view="compliance" />
            <div className={cn('mt-4 p-4 rounded bg-blue-500/10 border border-blue-400/30')}>
              <p className={cn('text-xs text-blue-400 font-semibold')}>
                Keep compliance documents current — expired documents may block load access.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
