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
    <div className="min-h-screen bg-wl-bg-root p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Campaigns</h1>
          <p className="text-gray-400">Create and manage marketing campaigns</p>
        </div>

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

        {/* Controls Card */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Filters & Actions</CardTitle>
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} className="mr-2" />
                New Campaign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Campaign Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as CampaignType | "ALL")}
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default text-white text-sm"
                >
                  <option value="ALL">All Types</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as CampaignStatus | "ALL")}
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default text-white text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="SENDING">Sending</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">Campaigns ({filteredCampaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Campaign Name</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Recipients</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Sent</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Opened</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Clicked</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Created</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-400">
                        No campaigns found. Create your first campaign to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className={cn(
                          "border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors",
                          selectedId === campaign.id && "bg-blue-500/10"
                        )}
                        onClick={() => setSelectedId(campaign.id)}
                      >
                        <td className="py-3 px-4 text-white font-medium">{campaign.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={typeVariant(campaign.type)} className="inline-flex items-center gap-1">
                            {typeIcon(campaign.type)}
                            {campaign.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">{formatNumber(campaign.recipients)}</td>
                        <td className="py-3 px-4 text-right text-gray-300">{formatNumber(campaign.sent)}</td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {formatNumber(campaign.opened)} ({campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(0) : "0"}%)
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {formatNumber(campaign.clicked)} ({campaign.sent > 0 ? ((campaign.clicked / campaign.sent) * 100).toFixed(0) : "0"}%)
                        </td>
                        <td className="py-3 px-4 text-right text-gray-400 text-xs">{formatRelativeTime(campaign.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="p-1">
                              <Copy size={14} className="text-gray-400" />
                            </Button>
                            {campaign.status === "SENDING" && (
                              <Button variant="ghost" size="sm" className="p-1">
                                <Pause size={14} className="text-gray-400" />
                              </Button>
                            )}
                            {campaign.status === "DRAFT" && (
                              <Button variant="ghost" size="sm" className="p-1">
                                <Trash2 size={14} className="text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
