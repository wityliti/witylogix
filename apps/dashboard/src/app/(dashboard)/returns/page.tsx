'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useReturns, useReturnStats, type Return } from '@/hooks/use-returns';
import { Plus, ChevronRight, Package, RefreshCw } from 'lucide-react';

type ReturnStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'REFUNDED'
  | 'CLOSED';

const STATUS_CONFIG: Record<
  ReturnStatus,
  { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string }
> = {
  PENDING: { badge: 'info', label: 'Pending' },
  APPROVED: { badge: 'primary', label: 'Approved' },
  REJECTED: { badge: 'danger', label: 'Rejected' },
  RECEIVED: { badge: 'warning', label: 'Received' },
  INSPECTED: { badge: 'warning', label: 'Inspected' },
  REFUNDED: { badge: 'success', label: 'Refunded' },
  CLOSED: { badge: 'default', label: 'Closed' },
};

const normalizeStatus = (s: string): ReturnStatus => {
  const up = s.toUpperCase() as ReturnStatus;
  if (up in STATUS_CONFIG) return up;
  if (s.toLowerCase() === 'initiated' || s.toLowerCase() === 'requested') return 'PENDING';
  if (s.toLowerCase() === 'picked_up' || s.toLowerCase() === 'in_transit') return 'APPROVED';
  return 'PENDING';
};

const PIPELINE_STAGES: ReturnStatus[] = [
  'PENDING',
  'APPROVED',
  'RECEIVED',
  'INSPECTED',
  'REFUNDED',
];

// ─── Stats pipeline ───────────────────────────────────────────

type StatsCounts = Record<string, number>;

const StatsSkeleton = () => (
  <Card className="mb-8">
    <CardContent className="p-6">
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((s) => (
          <div key={s} className="flex items-center gap-3 flex-shrink-0">
            <Skeleton className="h-16 w-24 rounded-lg" />
            {s !== 'REFUNDED' && <Skeleton className="h-4 w-4 rounded" />}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const StatusPipeline = ({
  counts,
  totalRefundAmount,
  loading,
}: {
  counts: StatsCounts;
  totalRefundAmount: number;
  loading: boolean;
}) => {
  if (loading) return <StatsSkeleton />;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((status, idx) => {
            const config = STATUS_CONFIG[status];
            const count = counts[status.toLowerCase()] ?? 0;

            return (
              <div key={status} className="flex items-center gap-3 flex-shrink-0">
                <div className="px-4 py-2 rounded-lg border border-white/[0.08] text-center min-w-[80px]">
                  <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">
                    {config.label}
                  </div>
                  <div className="text-lg font-semibold text-wl-text-primary mt-1">{count}</div>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-wl-border-default flex-shrink-0" />
                )}
              </div>
            );
          })}

          <div className="ml-auto flex-shrink-0 px-4 py-2 rounded-lg border border-white/[0.08] text-center">
            <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">
              Total Refunded
            </div>
            <div className="text-lg font-semibold text-wl-success-400 mt-1">
              ${totalRefundAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Table skeleton / empty ───────────────────────────────────

const TableSkeleton = () => (
  <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
    <div className="divide-y divide-white/[0.05]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4">
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="col-span-1">
              <Skeleton className="h-4 w-full rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
      <Package className="w-8 h-8 text-wl-text-tertiary" />
    </div>
    <h3 className="text-lg font-semibold text-wl-text-primary mb-2">No returns yet</h3>
    <p className="text-sm text-wl-text-secondary mb-6 max-w-xs">
      When customers initiate returns or RMAs they will appear here for review and processing.
    </p>
  </div>
);

// ─── Returns table ────────────────────────────────────────────

const ReturnsTable = ({ returns }: { returns: Return[] }) => (
  <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
      {(
        [
          ['Return #', 1],
          ['Order #', 1],
          ['Customer', 2],
          ['Reason', 2],
          ['Status', 1],
          ['Refund', 1],
          ['Date', 1],
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
      {returns.map((ret) => {
        const status = normalizeStatus(ret.status as string);
        const config = STATUS_CONFIG[status];
        const date = new Date(ret.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const amount = Number(ret.refundAmount ?? ret.totalRefundAmount ?? 0);
        const reason = (ret.reason as string)
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());

        return (
          <div
            key={ret.id}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="col-span-1">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return #</div>
              <div className="text-sm font-medium text-wl-primary-400 truncate">
                {ret.id.slice(0, 8)}…
              </div>
            </div>

            <div className="col-span-1">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order #</div>
              <div className="text-sm text-wl-text-secondary truncate">
                {ret.orderId.slice(0, 8)}…
              </div>
            </div>

            <div className="col-span-2">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Customer</div>
              <div className="text-sm text-wl-text-primary truncate">{ret.customerName}</div>
              {ret.customerEmail && (
                <div className="text-xs text-wl-text-tertiary mt-0.5 truncate">
                  {ret.customerEmail}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Reason</div>
              <div className="text-sm text-wl-text-secondary">{reason}</div>
              {ret.description && (
                <div className="text-xs text-wl-text-tertiary mt-0.5 line-clamp-1">
                  {ret.description}
                </div>
              )}
            </div>

            <div className="col-span-1">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
              <Badge variant={config.badge}>{config.label}</Badge>
            </div>

            <div className="col-span-1">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
              <div className="text-sm font-semibold text-wl-success-400">${amount.toFixed(2)}</div>
            </div>

            <div className="col-span-1">
              <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Date</div>
              <div className="text-sm text-wl-text-secondary">{date}</div>
            </div>

            <div className="col-span-2 flex gap-2">
              <Link href={`/returns/${ret.id}`} className="flex-1">
                <Button variant="ghost" size="sm" className="w-full">
                  View
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────

export default function ReturnsPage() {
  const [filterStatus, setFilterStatus] = useState<ReturnStatus | 'ALL'>('ALL');

  const { items, loading, error, refetch } = useReturns(
    filterStatus !== 'ALL' ? { status: filterStatus as any } : undefined,
  );

  const { data: statsRaw, loading: statsLoading } = useReturnStats();
  const statsData = (statsRaw as any)?.data as
    | { counts?: StatsCounts; totalRefundAmount?: number }
    | undefined;
  const counts: StatsCounts = statsData?.counts ?? {};
  const totalRefundAmount = Number(statsData?.totalRefundAmount ?? 0);

  const totalCount = statsData?.counts?.total ?? (statsLoading ? null : items.length);

  if (error) {
    return (
      <>
        <Header
          title="Returns & RMA"
          subtitle="Return lifecycle management"
          actions={
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Create Return
            </Button>
          }
        />
        <ErrorState
          error={error}
          onRetry={() => { refetch(); }}
          title="Failed to load returns"
          message="Could not fetch return requests. Please check your connection and try again."
        />
      </>
    );
  }

  return (
    <>
      <Header
        title="Returns & RMA"
        subtitle={
          totalCount !== null ? `${totalCount} total returns` : 'Return lifecycle management'
        }
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Create Return
            </Button>
          </div>
        }
      />

      <StatusPipeline counts={counts} totalRefundAmount={totalRefundAmount} loading={statsLoading} />

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTED', 'REFUNDED', 'CLOSED'] as const).map(
          (s) => {
            const label = s === 'ALL' ? 'All' : STATUS_CONFIG[s as ReturnStatus].label;
            const count =
              s !== 'ALL' ? (counts[(s as string).toLowerCase()] ?? 0) : undefined;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  filterStatus === s
                    ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                    : 'bg-white/[0.04] text-wl-text-secondary hover:bg-white/[0.08] border border-transparent',
                )}
              >
                {label}
                {count !== undefined && (
                  <span className="ml-1 opacity-60">{count}</span>
                )}
              </button>
            );
          },
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ReturnsTable returns={items} />
      )}
    </>
  );
}
