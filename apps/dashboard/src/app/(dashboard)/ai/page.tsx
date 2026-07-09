'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { useApiQuery } from '@/hooks/use-api';

interface FeatureCard {
  name: string;
  description: string;
  href: string;
  statsPath: string | null;
  status: 'active' | 'coming_soon';
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    name: 'ETA Prediction',
    description: 'AI-powered delivery time estimates using route history and live traffic.',
    href: '/analytics/route-performance',
    statsPath: '/api/ai/eta/statistics',
    status: 'active',
  },
  {
    name: 'Route Efficiency',
    description: 'Detect anomalies and inefficiencies across delivery routes in real time.',
    href: '/analytics/anomalies',
    statsPath: null,
    status: 'active',
  },
  {
    name: 'Driver Insights',
    description: 'Score and rank drivers based on performance, safety, and on-time delivery.',
    href: '/drivers',
    statsPath: '/api/ai/analytics/leaderboard',
    status: 'active',
  },
  {
    name: 'Demand Forecasting',
    description: 'Predict order volumes by zone so you can staff and route proactively.',
    href: '/demand',
    statsPath: '/api/ai/demand',
    status: 'active',
  },
  {
    name: 'Delivery Slot AI',
    description: 'Recommend optimal delivery windows to balance capacity and customer preference.',
    href: '/time-slots',
    statsPath: '/api/ai/slots/recommend',
    status: 'active',
  },
  {
    name: 'AI Co-pilot',
    description: 'Conversational AI assistant for logistics decisions, queries, and planning.',
    href: '/ai/copilot',
    statsPath: null,
    status: 'active',
  },
];

interface EtaStats {
  totalPredictions30d?: number;
  count?: number;
}
interface LeaderboardStats {
  totalEntries?: number;
  count?: number;
}
interface DemandStats {
  totalForecasts?: number;
  count?: number;
}
interface SlotStats {
  totalRecommendations?: number;
  count?: number;
}

function useFeatureUsageCounts() {
  const eta = useApiQuery<EtaStats>('/api/ai/eta/statistics');
  const leaderboard = useApiQuery<LeaderboardStats>('/api/ai/analytics/leaderboard');
  const demand = useApiQuery<DemandStats>('/api/ai/demand');
  const slots = useApiQuery<SlotStats>('/api/ai/slots/recommend');

  const isLoading = eta.loading || leaderboard.loading || demand.loading || slots.loading;
  const hasError = !isLoading && !!(eta.error || leaderboard.error || demand.error || slots.error);

  return {
    isLoading,
    hasError,
    counts: {
      '/api/ai/eta/statistics': eta.data?.totalPredictions30d ?? eta.data?.count ?? 0,
      '/api/ai/analytics/leaderboard': leaderboard.data?.totalEntries ?? leaderboard.data?.count ?? 0,
      '/api/ai/demand': demand.data?.totalForecasts ?? demand.data?.count ?? 0,
      '/api/ai/slots/recommend': slots.data?.totalRecommendations ?? slots.data?.count ?? 0,
    } as Record<string, number>,
  };
}

function AiFeatureCard({ card, usageCount }: { card: FeatureCard; usageCount: number }) {
  const isComingSoon = card.status === 'coming_soon';

  const inner = (
    <Card
      hover={!isComingSoon}
      className={cn(
        'flex flex-col gap-4 h-full',
        isComingSoon && 'opacity-60 cursor-default'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-wl-text-primary leading-snug">
          {card.name}
        </h3>
        <Badge variant={isComingSoon ? 'default' : 'success'} className="flex-shrink-0 text-xs">
          {isComingSoon ? 'Coming Soon' : 'Active'}
        </Badge>
      </div>

      <p className="text-sm text-wl-text-secondary leading-relaxed flex-1">
        {card.description}
      </p>

      {card.statsPath && (
        <div className="text-xs text-wl-text-tertiary">
          <span className="font-semibold text-wl-text-secondary">{usageCount.toLocaleString()}</span>
          {' '}uses last 30 days
        </div>
      )}

      {!isComingSoon && (
        <div className="mt-auto">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-wl-primary-400 group-hover:underline">
            Open feature
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      )}
    </Card>
  );

  if (isComingSoon) {
    return <div className="group h-full">{inner}</div>;
  }

  return (
    <Link href={card.href} className="group h-full no-underline block">
      {inner}
    </Link>
  );
}

export default function AiHubPage() {
  const { isLoading, hasError, counts } = useFeatureUsageCounts();

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-wl-primary-500 to-wl-primary-700 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wl-bg-root)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0110 4a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary tracking-tight">
              AI &amp; Intelligence
            </h1>
            <p className="text-sm text-wl-text-tertiary">
              All your AI-powered logistics features in one place
            </p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      {hasError && (
        <p className="text-xs text-wl-text-tertiary text-center -mb-4">
          Usage statistics temporarily unavailable
        </p>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_CARDS.map((card) => (
            <CardSkeleton key={card.name} className="h-40" />
          ))}
        </div>
      ) : (
        <div
          data-testid="ai-feature-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {FEATURE_CARDS.map((card) => (
            <AiFeatureCard
              key={card.name}
              card={card}
              usageCount={card.statsPath ? (counts[card.statsPath] ?? 0) : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
