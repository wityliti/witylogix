'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn, formatNumber, formatRelativeTime } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import dynamic from 'next/dynamic';
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Bell,
  Plus,
  Copy,
  Pause,
  Trash2,
  TrendingUp,
  Send,
  Map,
  List,
  RefreshCw,
  Layers,
} from 'lucide-react';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-wl-bg-secondary rounded-xl flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-xl" />
      </div>
    ),
  }
);

const CampaignReachLayer = dynamic(
  () =>
    import('@/components/map/campaign-reach-layer').then((m) => ({
      default: m.CampaignReachLayer,
    })),
  { ssr: false }
);

// ─── Types ─────────────────────────────────────────────────

type CampaignType = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'MULTI_CHANNEL';
type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface CampaignStats {
  total: number;
  byStatus: Record<string, number>;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
}

interface ReachPoint {
  city: string;
  country: string | null;
  customerCount: number;
  orderCount: number;
  lat: number;
  lng: number;
}

// ─── Helpers ───────────────────────────────────────────────

const TYPE_CONFIG: Record<
  CampaignType,
  { variant: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'; icon: React.ReactNode }
> = {
  EMAIL: { variant: 'info', icon: <Mail size={13} /> },
  SMS: { variant: 'success', icon: <MessageSquare size={13} /> },
  WHATSAPP: { variant: 'primary', icon: <MessageCircle size={13} /> },
  PUSH: { variant: 'warning', icon: <Bell size={13} /> },
  MULTI_CHANNEL: { variant: 'default', icon: <Layers size={13} /> },
};

const STATUS_CONFIG: Record<
  CampaignStatus,
  { variant: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'; label: string }
> = {
  DRAFT: { variant: 'default', label: 'Draft' },
  SCHEDULED: { variant: 'info', label: 'Scheduled' },
  SENDING: { variant: 'warning', label: 'Sending' },
  PAUSED: { variant: 'warning', label: 'Paused' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  FAILED: { variant: 'danger', label: 'Failed' },
  CANCELLED: { variant: 'default', label: 'Cancelled' },
};

// ─── Skeletons ─────────────────────────────────────────────

const StatsSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {[0, 1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-24 rounded-xl" />
    ))}
  </div>
);

const TableSkeleton = () => (
  <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
    <div className="divide-y divide-white/[0.05]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4">
          {[3, 1, 1, 1, 1, 1, 1, 2].map((span, j) => (
            <div key={j} className={`col-span-${span}`}>
              <Skeleton className="h-4 w-full rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const EmptyState = ({ filtered }: { filtered: boolean }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
      <Send className="w-8 h-8 text-wl-text-tertiary" />
    </div>
    <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
      {filtered ? 'No campaigns match your filters' : 'No campaigns yet'}
    </h3>
    <p className="text-sm text-wl-text-secondary mb-6 max-w-xs">
      {filtered
        ? 'Try adjusting the type or status filter to see more results.'
        : 'Create your first campaign to start reaching customers via email, SMS, or push.'}
    </p>
    {!filtered && (
      <Button variant="primary" size="md">
        <Plus className="w-4 h-4" />
        New Campaign
      </Button>
    )}
  </div>
);

// ─── Page ──────────────────────────────────────────────────

export default function CampaignsPage() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [filterType, setFilterType] = useState<CampaignType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | 'ALL'>('ALL');
  const [mapId, setMapId] = useState<string | null>(null);
  const handleMapReady = useCallback((id: string) => setMapId(id), []);

  // Build filtered URL — useApiList doesn't support custom query params
  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (filterType !== 'ALL') params.set('type', filterType);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);
    return `/api/v4/campaigns?${params.toString()}`;
  }, [filterType, filterStatus]);

  // API returns { data: Campaign[], pagination: {...} }; useApiQuery unwraps to Campaign[]
  const { data: items, loading, error, refetch } = useApiQuery<Campaign[]>(listUrl);
  const campaigns: Campaign[] = items ?? [];

  const { data: statsData, loading: statsLoading } = useApiQuery<CampaignStats>(
    '/api/v4/campaigns/stats'
  );

  // API returns { data: ReachPoint[] }; useApiQuery unwraps to ReachPoint[]
  const { data: reachPoints, loading: geoLoading } = useApiQuery<ReachPoint[]>(
    view === 'map' ? '/api/v4/customers/density' : null
  );

  const isFiltered = filterType !== 'ALL' || filterStatus !== 'ALL';

  const summaryStats = useMemo(() => {
    const sent = statsData?.sentCount ?? 0;
    const delivered = statsData?.deliveredCount ?? 0;
    const opened = statsData?.openedCount ?? 0;
    const clicked = statsData?.clickedCount ?? 0;
    const active =
      (statsData?.byStatus?.SENDING ?? 0) + (statsData?.byStatus?.SCHEDULED ?? 0);

    return {
      active,
      totalSent: sent,
      openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0',
      clickRate: delivered > 0 ? ((clicked / delivered) * 100).toFixed(1) : '0.0',
    };
  }, [statsData]);

  if (error) {
    return (
      <>
        <Header
          title="Campaigns"
          subtitle="Marketing campaign management"
          actions={
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          }
        />
        <ErrorState
          error={error}
          onRetry={() => { refetch(); }}
          title="Failed to load campaigns"
          message="Could not fetch campaigns. Please check your connection and try again."
        />
      </>
    );
  }

  return (
    <>
      <Header
        title="Campaigns"
        subtitle={
          statsData
            ? `${statsData.total} total · ${summaryStats.active} active`
            : 'Marketing campaign management'
        }
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Campaigns"
            value={summaryStats.active}
            icon={<Send size={18} />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Total Sent"
            value={formatNumber(summaryStats.totalSent)}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-info-500)"
            index={1}
          />
          <StatCard
            label="Avg. Open Rate"
            value={`${summaryStats.openRate}%`}
            icon={<Mail size={18} />}
            accentColor="var(--wl-success-500)"
            index={2}
          />
          <StatCard
            label="Avg. Click Rate"
            value={`${summaryStats.clickRate}%`}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CampaignType | 'ALL')}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-wl-text-primary text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="PUSH">Push</option>
          <option value="MULTI_CHANNEL">Multi-channel</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CampaignStatus | 'ALL')}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-wl-text-primary text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="SENDING">Sending</option>
          <option value="PAUSED">Paused</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'p-2 rounded-lg text-sm transition-colors',
              view === 'grid'
                ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                : 'bg-white/[0.04] text-wl-text-secondary hover:bg-white/[0.08] border border-transparent'
            )}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('map')}
            className={cn(
              'p-2 rounded-lg text-sm transition-colors',
              view === 'map'
                ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                : 'bg-white/[0.04] text-wl-text-secondary hover:bg-white/[0.08] border border-transparent'
            )}
            title="Map view"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map view */}
      {view === 'map' && (
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="relative h-[480px] rounded-xl overflow-hidden">
              {geoLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-wl-bg-primary/60">
                  <Skeleton className="w-full h-full" />
                </div>
              )}
              <WLMap className="w-full h-full" onReady={handleMapReady} />
              {mapId && !geoLoading && (
                <CampaignReachLayer mapId={mapId} points={reachPoints ?? []} />
              )}
              <div className="absolute bottom-3 left-3 z-[1000] bg-wl-bg-primary/90 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-wl-text-secondary">
                Campaign audience reach by city
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table / Empty */}
      {loading ? (
        <TableSkeleton />
      ) : campaigns.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
            {(
              [
                ['Campaign', 3],
                ['Type', 1],
                ['Status', 1],
                ['Sent', 1],
                ['Delivered', 1],
                ['Opened', 1],
                ['Clicked', 1],
                ['Created', 1],
                ['Actions', 2],
              ] as [string, number][]
            ).map(([label, span]) => (
              <div
                key={label}
                className={`col-span-${span} text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.05]">
            {campaigns.map((campaign) => {
              const typeConf = TYPE_CONFIG[campaign.type] ?? TYPE_CONFIG.EMAIL;
              const statusConf = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;
              const sent = campaign.sentCount ?? 0;
              const delivered = campaign.deliveredCount ?? 0;
              const opened = campaign.openedCount ?? 0;
              const clicked = campaign.clickedCount ?? 0;
              const openRate = sent > 0 ? `${((opened / sent) * 100).toFixed(0)}%` : '—';
              const clickRate = delivered > 0 ? `${((clicked / delivered) * 100).toFixed(0)}%` : '—';

              return (
                <div
                  key={campaign.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="col-span-3">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Campaign</div>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="text-sm font-medium text-wl-text-primary hover:text-wl-primary-400 transition-colors"
                    >
                      {campaign.name}
                    </Link>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Type</div>
                    <Badge variant={typeConf.variant} className="inline-flex items-center gap-1">
                      {typeConf.icon}
                      {campaign.type.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                    <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Sent</div>
                    <div className="text-sm text-wl-text-secondary">{formatNumber(sent)}</div>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Delivered</div>
                    <div className="text-sm text-wl-text-secondary">{formatNumber(delivered)}</div>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Opened</div>
                    <div className="text-sm text-wl-text-secondary">
                      {formatNumber(opened)}{' '}
                      <span className="text-xs text-wl-text-tertiary">{openRate}</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Clicked</div>
                    <div className="text-sm text-wl-text-secondary">
                      {formatNumber(clicked)}{' '}
                      <span className="text-xs text-wl-text-tertiary">{clickRate}</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <div className="lg:hidden text-xs text-wl-text-tertiary mb-1">Created</div>
                    <div className="text-xs text-wl-text-tertiary">
                      {formatRelativeTime(campaign.createdAt)}
                    </div>
                  </div>

                  <div className="col-span-2 flex gap-2">
                    <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full">
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="px-2">
                      <Copy size={13} className="text-wl-text-tertiary" />
                    </Button>
                    {(campaign.status === 'SENDING' || campaign.status === 'SCHEDULED') && (
                      <Button variant="ghost" size="sm" className="px-2">
                        <Pause size={13} className="text-wl-text-tertiary" />
                      </Button>
                    )}
                    {campaign.status === 'DRAFT' && (
                      <Button variant="ghost" size="sm" className="px-2">
                        <Trash2 size={13} className="text-wl-danger-400" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
