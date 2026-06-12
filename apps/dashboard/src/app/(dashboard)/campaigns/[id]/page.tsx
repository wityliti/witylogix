'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import dynamic from 'next/dynamic';
import {
  Edit,
  Copy,
  Archive,
  Mail,
  MessageSquare,
  MessageCircle,
  Bell,
  Layers,
  ArrowLeft,
  Map,
} from 'lucide-react';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <Skeleton className="w-full h-full rounded-xl" /> }
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
  bouncedCount: number;
  unsubscribedCount: number;
  audienceFilter: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ReachPoint {
  city: string;
  country: string | null;
  customerCount: number;
  orderCount: number;
  lat: number;
  lng: number;
}

// ─── Config ────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  CampaignType,
  { variant: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'; icon: React.ReactNode; label: string }
> = {
  EMAIL: { variant: 'info', icon: <Mail size={13} />, label: 'Email' },
  SMS: { variant: 'success', icon: <MessageSquare size={13} />, label: 'SMS' },
  WHATSAPP: { variant: 'primary', icon: <MessageCircle size={13} />, label: 'WhatsApp' },
  PUSH: { variant: 'warning', icon: <Bell size={13} />, label: 'Push' },
  MULTI_CHANNEL: { variant: 'default', icon: <Layers size={13} />, label: 'Multi-channel' },
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

// ─── Loading skeleton ──────────────────────────────────────

function CampaignSkeleton() {
  return (
    <>
      <Header title="Campaign" subtitle="Loading…" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mapId, setMapId] = useState<string | null>(null);
  const handleMapReady = useCallback((mid: string) => setMapId(mid), []);

  const {
    data: campaign,
    loading,
    error,
    refetch,
  } = useApiQuery<Campaign>(`/api/v4/campaigns/${id}`);

  // API returns { data: ReachPoint[] }; useApiQuery unwraps to ReachPoint[]
  const { data: reachPoints, loading: geoLoading } = useApiQuery<ReachPoint[]>(
    `/api/v4/campaigns/${id}/geo`
  );

  if (loading) return <CampaignSkeleton />;

  if (error || !campaign) {
    return (
      <>
        <Header
          title="Campaign"
          subtitle="Not found"
          actions={
            <Link href="/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Campaigns
              </Button>
            </Link>
          }
        />
        <ErrorState
          error={error ?? undefined}
          onRetry={() => { refetch(); }}
          title="Failed to load campaign"
          message="This campaign could not be loaded. It may have been deleted or you may not have access."
        />
      </>
    );
  }

  const typeConf = TYPE_CONFIG[campaign.type] ?? TYPE_CONFIG.EMAIL;
  const statusConf = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;

  const sent = campaign.sentCount ?? 0;
  const delivered = campaign.deliveredCount ?? 0;
  const opened = campaign.openedCount ?? 0;
  const clicked = campaign.clickedCount ?? 0;
  const failed = campaign.failedCount ?? 0;

  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0.0';
  const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : '0.0';
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : '0.0';

  const funnel = [
    { label: 'Sent', value: sent, color: '#818cf8' },
    { label: 'Delivered', value: delivered, color: '#60a5fa', rate: `${deliveryRate}%` },
    { label: 'Opened', value: opened, color: '#34d399', rate: `${openRate}%` },
    { label: 'Clicked', value: clicked, color: '#f97316', rate: `${clickRate}%` },
  ];

  return (
    <>
      <Header
        title={campaign.name}
        subtitle={`${typeConf.label} campaign · Created ${formatRelativeTime(campaign.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <Button variant="secondary" size="md">
              <Edit size={15} />
              Edit
            </Button>
            <Button variant="secondary" size="md">
              <Copy size={15} />
              Duplicate
            </Button>
            <Button variant="ghost" size="md">
              <Archive size={15} />
              Archive
            </Button>
          </div>
        }
      />

      {/* Status bar */}
      <div className="flex items-center gap-3 mb-8">
        <Badge variant={typeConf.variant} className="inline-flex items-center gap-1">
          {typeConf.icon}
          {typeConf.label}
        </Badge>
        <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
        {campaign.startedAt && (
          <span className="text-sm text-wl-text-secondary">
            Started {formatRelativeTime(campaign.startedAt)}
          </span>
        )}
        {campaign.completedAt && (
          <span className="text-sm text-wl-text-secondary">
            · Completed {formatRelativeTime(campaign.completedAt)}
          </span>
        )}
        {campaign.scheduledAt && campaign.status === 'SCHEDULED' && (
          <span className="text-sm text-wl-text-secondary">
            Scheduled for {new Date(campaign.scheduledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Performance stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Sent"
          value={formatNumber(sent)}
          accentColor="var(--wl-primary-500)"
          index={0}
        />
        <StatCard
          label="Delivered"
          value={formatNumber(delivered)}
          change={{ value: parseFloat(deliveryRate), label: 'delivery rate' }}
          accentColor="var(--wl-info-500)"
          index={1}
        />
        <StatCard
          label="Opened"
          value={formatNumber(opened)}
          change={{ value: parseFloat(openRate), label: 'open rate' }}
          accentColor="var(--wl-success-500)"
          index={2}
        />
        <StatCard
          label="Clicked"
          value={formatNumber(clicked)}
          change={{ value: parseFloat(clickRate), label: 'click rate' }}
          accentColor="var(--wl-warning-500)"
          index={3}
        />
        <StatCard
          label="Failed"
          value={formatNumber(failed)}
          accentColor="var(--wl-danger-500)"
          index={4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {sent === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail className="w-8 h-8 text-wl-text-tertiary mb-3" />
                <p className="text-sm text-wl-text-secondary">
                  No messages sent yet for this campaign.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {funnel.map((step, idx) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-20 flex-shrink-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: step.color }}
                      />
                      <span className="text-xs text-wl-text-secondary">{step.label}</span>
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          background: step.color,
                          width: sent > 0 ? `${Math.max(2, (step.value / sent) * 100)}%` : '2%',
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <div className="text-sm font-medium text-wl-text-primary w-16 text-right flex-shrink-0">
                      {formatNumber(step.value)}
                    </div>
                    {step.rate && (
                      <div className="text-xs text-wl-text-tertiary w-10 text-right flex-shrink-0">
                        {step.rate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audience details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map size={16} className="text-wl-text-secondary" />
              Audience Reach
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative h-[260px]">
              {geoLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Skeleton className="w-full h-full" />
                </div>
              )}
              <WLMap className="w-full h-full rounded-b-xl" onReady={handleMapReady} />
              {mapId && !geoLoading && (reachPoints?.length ?? 0) > 0 && (
                <CampaignReachLayer mapId={mapId} points={reachPoints ?? []} />
              )}
              {!geoLoading && (reachPoints?.length ?? 0) === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-xs text-wl-text-tertiary bg-wl-bg-primary/80 px-3 py-1.5 rounded-lg">
                    No geographic data available
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {campaign.audienceFilter && Object.keys(campaign.audienceFilter).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Audience Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(campaign.audienceFilter).map(([key, val]) => (
                <div key={key}>
                  <div className="text-xs text-wl-text-tertiary mb-1 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-wl-text-primary">
                    {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
