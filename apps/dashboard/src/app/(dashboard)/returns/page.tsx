'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useReturns, useReturnStats, type Return, type ReturnFilters } from '@/hooks/use-returns';
import { Plus, ChevronRight, RotateCcw, Package } from 'lucide-react';

// ─── Status config ───────────────────────────────────────────────────────────

type NormalisedStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'received'
  | 'inspected'
  | 'refunded';

const STATUS_CONFIG: Record<NormalisedStatus, {
  badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  label: string;
}> = {
  pending:   { badge: 'info',    label: 'Pending' },
  approved:  { badge: 'primary', label: 'Approved' },
  rejected:  { badge: 'danger',  label: 'Rejected' },
  received:  { badge: 'warning', label: 'Received' },
  inspected: { badge: 'warning', label: 'Inspected' },
  refunded:  { badge: 'success', label: 'Refunded' },
};

const PIPELINE: NormalisedStatus[] = [
  'pending', 'approved', 'received', 'inspected', 'refunded',
];

function normalise(status: string): NormalisedStatus {
  const s = status.toLowerCase();
  if (['pending', 'requested', 'initiated'].includes(s)) return 'pending';
  if (s === 'approved') return 'approved';
  if (['shipped_back', 'picked_up', 'in_transit'].includes(s)) return 'received';
  if (s === 'received') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded' || s === 'closed') return 'refunded';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

// ─── Pipeline bar ─────────────────────────────────────────────────────────────

function PipelineBar({ counts }: { counts: Record<string, number> }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PIPELINE.map((stage, idx) => {
            const cfg = STATUS_CONFIG[stage];
            const count = counts[stage] ?? 0;
            return (
              <div key={stage} className="flex items-center gap-2 flex-shrink-0">
                <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border border-wl-border-subtle bg-wl-bg-elevated min-w-[90px]">
                  <span className="text-[10px] font-semibold text-wl-text-tertiary uppercase tracking-wider">
                    {cfg.label}
                  </span>
                  <span className="text-xl font-bold text-wl-text-primary">{count}</span>
                </div>
                {idx < PIPELINE.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-wl-border-default flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pipeline skeleton ────────────────────────────────────────────────────────

function PipelineSkeleton() {
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          {PIPELINE.map((s) => (
            <Skeleton key={s} className="h-16 w-[90px] rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Table row skeleton ───────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.05]">
      <Skeleton className="col-span-1 h-4 rounded" />
      <Skeleton className="col-span-1 h-4 rounded" />
      <Skeleton className="col-span-2 h-4 rounded" />
      <Skeleton className="col-span-2 h-4 rounded" />
      <Skeleton className="col-span-2 h-5 w-20 rounded-full" />
      <Skeleton className="col-span-1 h-4 rounded" />
      <Skeleton className="col-span-1 h-4 rounded" />
      <div className="col-span-2 flex gap-2">
        <Skeleton className="h-8 flex-1 rounded" />
        <Skeleton className="h-8 flex-1 rounded" />
      </div>
    </div>
  );
}

// ─── Returns table ────────────────────────────────────────────────────────────

function ReturnsTable({ returns }: { returns: Return[] }) {
  return (
    <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-wl-border-subtle bg-wl-bg-elevated">
        {['Return #', 'Order #', 'Customer', 'Reason', 'Status', 'Refund', 'Date', 'Actions'].map(
          (h, i) => (
            <div
              key={h}
              className={cn(
                'text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider',
                i === 0 ? 'col-span-1' :
                i === 1 ? 'col-span-1' :
                i === 2 ? 'col-span-2' :
                i === 3 ? 'col-span-2' :
                i === 4 ? 'col-span-2' :
                i === 5 ? 'col-span-1' :
                i === 6 ? 'col-span-1' :
                'col-span-2',
              )}
            >
              {h}
            </div>
          ),
        )}
      </div>

      <div className="divide-y divide-wl-border-subtle">
        {returns.map((ret) => {
          const status = normalise(ret.status as string);
          const cfg = STATUS_CONFIG[status];
          const amount = ret.refundAmount ?? ret.totalRefundAmount ?? 0;
          const date = new Date(ret.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={ret.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return #</div>
                <span className="text-sm font-medium text-wl-primary-400">{ret.id}</span>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order #</div>
                <span className="text-sm text-wl-text-secondary">{ret.orderId}</span>
              </div>

              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Customer</div>
                <div className="text-sm text-wl-text-primary">{ret.customerName}</div>
                {ret.customerEmail && (
                  <div className="text-xs text-wl-text-tertiary mt-0.5">{ret.customerEmail}</div>
                )}
              </div>

              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Reason</div>
                <span className="text-sm text-wl-text-secondary capitalize">
                  {ret.reason.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                <Badge variant={cfg.badge}>{cfg.label}</Badge>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
                <span className="text-sm font-semibold text-wl-success-400">
                  ${Number(amount).toFixed(2)}
                </span>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Date</div>
                <span className="text-sm text-wl-text-secondary">{date}</span>
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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filters: ReturnFilters = useMemo(
    () => (statusFilter ? { status: statusFilter as ReturnFilters['status'] } : {}),
    [statusFilter],
  );

  const { items, loading, error, refetch } = useReturns(filters);
  const { data: stats, loading: statsLoading } = useReturnStats();

  // Build pipeline counts from live stats or fall back to counting items
  const pipelineCounts: Record<string, number> = useMemo(() => {
    if (stats?.counts) {
      return {
        pending:   (stats.counts.requested ?? 0),
        approved:  stats.counts.approved ?? 0,
        received:  stats.counts.received ?? 0,
        inspected: stats.counts.inspected ?? 0,
        refunded:  stats.counts.refunded ?? 0,
      };
    }
    // Fallback: derive from current page of items
    return items.reduce<Record<string, number>>((acc, r) => {
      const s = normalise(r.status as string);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
  }, [stats, items]);

  const totalRefunded = stats?.totalRefundAmount ?? 0;
  const totalCount = stats?.totalReturns ?? items.length;

  return (
    <>
      <Header
        title="Returns & RMA"
        subtitle={loading ? undefined : `${totalCount} total returns · $${Number(totalRefunded).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} refunded`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      <div className="p-6">
        {/* Pipeline bar */}
        {statsLoading && !stats ? (
          <PipelineSkeleton />
        ) : (
          <PipelineBar counts={pipelineCounts} />
        )}

        {/* Filter row */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
            Filter by status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="inspected">Inspected</option>
            <option value="refunded">Refunded</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to load returns"
            message={error.message}
            onRetry={refetch}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No returns yet"
            description={
              statusFilter
                ? `No returns with status "${statusFilter}".`
                : 'Returns will appear here when customers request them.'
            }
            action={statusFilter ? { label: 'Clear filter', onClick: () => setStatusFilter('') } : undefined}
          />
        ) : (
          <ReturnsTable returns={items} />
        )}
      </div>
    </>
  );
}
