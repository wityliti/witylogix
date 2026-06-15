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

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
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
        <div className={cn('flex gap-2 bg-wl-bg-elevated rounded-md p-1 w-fit flex-wrap')}>
          {(['loads', 'rates', 'bookings', 'compliance'] as const).map((v) => (
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
            <EmptySectionState view="loads" />
          </div>
        )}

        {view === 'rates' && (
          <div>
            <h3 className={cn('text-sm font-semibold text-white mb-4')}>Rate Comparison Matrix</h3>
            <EmptySectionState view="rates" />
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
            <EmptySectionState view="bookings" />
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
