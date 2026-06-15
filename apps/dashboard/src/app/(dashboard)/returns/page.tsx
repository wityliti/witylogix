'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReturns, type Return } from '@/hooks/use-returns';
import { Plus, ChevronRight, PackageX } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — RMA lifecycle with status pipeline
   Real API data from /api/v4/returns with loading/empty/error states
   ═══════════════════════════════════════════════════════════ */

type ReturnStatus = 'requested' | 'approved' | 'shipped_back' | 'received' | 'inspected' | 'refunded';

const statusConfig: Record<ReturnStatus, { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string }> = {
  requested: { badge: 'info', label: 'Requested' },
  approved: { badge: 'primary', label: 'Approved' },
  shipped_back: { badge: 'primary', label: 'Shipped Back' },
  received: { badge: 'warning', label: 'Received' },
  inspected: { badge: 'warning', label: 'Inspected' },
  refunded: { badge: 'success', label: 'Refunded' },
};

const normalizeStatus = (status: string): ReturnStatus => {
  const s = status.toLowerCase();
  if (s === 'requested' || s === 'initiated') return 'requested';
  if (s === 'approved') return 'approved';
  if (s === 'shipped_back' || s === 'picked_up' || s === 'in_transit') return 'shipped_back';
  if (s === 'received') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'requested';
};

const StatusPipeline = ({ returns, loading }: { returns: Return[]; loading: boolean }) => {
  const statuses: ReturnStatus[] = ['requested', 'approved', 'shipped_back', 'received', 'inspected', 'refunded'];

  const countByStatus = statuses.reduce(
    (acc, status) => {
      acc[status] = loading ? 0 : returns.filter((r) => normalizeStatus(r.status as string) === status).length;
      return acc;
    },
    {} as Record<ReturnStatus, number>
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {statuses.map((status, idx) => {
            const config = statusConfig[status];
            const count = countByStatus[status];

            return (
              <div key={status} className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn('px-4 py-2 rounded-lg border border-white/[0.08] text-center min-w-[80px]')}>
                    <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">{status.replace(/_/g, ' ')}</div>
                    {loading ? (
                      <div className="h-6 bg-white/10 rounded mt-1 animate-pulse" />
                    ) : (
                      <div className="text-lg font-semibold text-wl-text-primary mt-1">{count}</div>
                    )}
                  </div>
                </div>
                {idx < statuses.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-wl-border-default flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const TableSkeleton = () => (
  <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
    <div className="px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
      <div className="h-4 bg-white/10 rounded w-full animate-pulse" />
    </div>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="px-6 py-4 border-b border-white/[0.05] last:border-0">
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="h-5 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ReturnsTable = ({ returns }: { returns: Return[] }) => {
  if (returns.length === 0) {
    return (
      <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-12 text-center">
        <PackageX className="w-12 h-12 mx-auto text-wl-text-tertiary mb-4 opacity-40" />
        <h3 className="text-base font-semibold text-wl-text-secondary mb-1">No returns found</h3>
        <p className="text-sm text-wl-text-tertiary">Returns and RMA requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="col-span-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Return #</div>
        <div className="col-span-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Order #</div>
        <div className="col-span-2 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Customer</div>
        <div className="col-span-2 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Reason</div>
        <div className="col-span-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Status</div>
        <div className="col-span-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Refund</div>
        <div className="col-span-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Date</div>
        <div className="col-span-2 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">Actions</div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-white/[0.05]">
        {returns.map((ret) => {
          const status = normalizeStatus(ret.status as string);
          const config = statusConfig[status];
          const date = new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const amount = ret.refundAmount ?? ret.totalRefundAmount ?? 0;

          return (
            <div key={ret.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
              {/* Mobile header */}
              <div className="md:hidden col-span-1 text-sm font-semibold text-wl-text-primary">{ret.id}</div>

              {/* Return # */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return #</div>
                <div className="text-sm font-medium text-wl-primary-400">{ret.id}</div>
              </div>

              {/* Order # */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order #</div>
                <div className="text-sm text-wl-text-secondary">{ret.orderId}</div>
              </div>

              {/* Customer */}
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Customer</div>
                <div className="text-sm text-wl-text-primary">{ret.customerName}</div>
                {ret.customerEmail && (
                  <div className="text-xs text-wl-text-tertiary mt-0.5">{ret.customerEmail}</div>
                )}
              </div>

              {/* Reason */}
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Reason</div>
                <div className="text-sm text-wl-text-secondary">{ret.reason}</div>
              </div>

              {/* Status */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                <Badge variant={config.badge}>{config.label}</Badge>
              </div>

              {/* Refund amount */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
                <div className="text-sm font-semibold text-wl-success-400">${Number(amount).toFixed(2)}</div>
              </div>

              {/* Date */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Date</div>
                <div className="text-sm text-wl-text-secondary">{date}</div>
              </div>

              {/* Actions */}
              <div className="col-span-2 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1">
                  View
                </Button>
                <Button variant="secondary" size="sm" className="flex-1">
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function ReturnsPage() {
  const { items: returns, loading, error, refetch } = useReturns();

  return (
    <>
      {/* Header */}
      <Header
        title="Returns & RMA"
        subtitle={loading ? 'Loading…' : error ? 'Error loading returns' : `${returns.length} active returns`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center justify-between">
          <span>Failed to load returns: {error.message}</span>
          <Button variant="ghost" size="sm" onClick={refetch}>Retry</Button>
        </div>
      )}

      {/* Status pipeline */}
      <StatusPipeline returns={returns} loading={loading} />

      {/* Returns table */}
      {loading ? <TableSkeleton /> : <ReturnsTable returns={returns} />}
    </>
  );
}
