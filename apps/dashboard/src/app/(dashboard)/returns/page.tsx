'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useReturns, Return } from '@/hooks/use-returns';
import { Plus, ChevronRight, RotateCcw } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — RMA lifecycle with status pipeline
   ═══════════════════════════════════════════════════════════ */

type ReturnStatus = 'requested' | 'approved' | 'shipped_back' | 'received' | 'inspected' | 'refunded';

const statusConfig: Record<ReturnStatus, { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string }> = {
  requested:   { badge: 'info',    label: 'Requested'    },
  approved:    { badge: 'primary', label: 'Approved'     },
  shipped_back:{ badge: 'primary', label: 'Shipped Back' },
  received:    { badge: 'warning', label: 'Received'     },
  inspected:   { badge: 'warning', label: 'Inspected'    },
  refunded:    { badge: 'success', label: 'Refunded'     },
};

const normalizeStatus = (status: string): ReturnStatus => {
  const s = status.toLowerCase();
  if (s === 'requested' || s === 'initiated' || s === 'pending') return 'requested';
  if (s === 'approved') return 'approved';
  if (s === 'shipped_back' || s === 'picked_up' || s === 'in_transit') return 'shipped_back';
  if (s === 'received') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'requested';
};

const StatusPipeline = ({ returns }: { returns: Return[] }) => {
  const statuses: ReturnStatus[] = ['requested', 'approved', 'shipped_back', 'received', 'inspected', 'refunded'];

  const countByStatus = statuses.reduce((acc, status) => {
    acc[status] = returns.filter((r) => normalizeStatus(r.status as string) === status).length;
    return acc;
  }, {} as Record<ReturnStatus, number>);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {statuses.map((status, idx) => (
            <div key={status} className="flex items-center gap-3 flex-shrink-0">
              <div className="flex flex-col items-center gap-2">
                <div className="px-4 py-2 rounded-lg border border-white/[0.08] text-center">
                  <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">
                    {status.replace(/_/g, ' ')}
                  </div>
                  <div className="text-lg font-semibold text-wl-text-primary mt-1">{countByStatus[status]}</div>
                </div>
              </div>
              {idx < statuses.length - 1 && (
                <ChevronRight className="w-4 h-4 text-wl-border-default flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ReturnsTable = ({ returns }: { returns: Return[] }) => {
  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-white/[0.08] bg-[#13131a]">
        <RotateCcw className="w-10 h-10 text-white/10" />
        <div className="text-center">
          <p className="text-sm font-medium text-white/40">No returns yet</p>
          <p className="text-xs text-white/20 mt-1">Customer return requests will appear here</p>
        </div>
        <Button variant="primary" size="sm">
          <Plus className="w-4 h-4" />
          Create Return
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
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

      <div className="divide-y divide-white/[0.05]">
        {returns.map((ret) => {
          const status = normalizeStatus(ret.status as string);
          const config = statusConfig[status];
          const date = new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const amount = ret.refundAmount ?? ret.totalRefundAmount ?? 0;

          return (
            <div key={ret.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="md:hidden col-span-1 text-sm font-semibold text-wl-text-primary">{ret.id}</div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return #</div>
                <div className="text-sm font-medium text-wl-primary-400">{ret.id.slice(0, 8)}</div>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order #</div>
                <div className="text-sm text-wl-text-secondary font-mono">{ret.orderId.slice(0, 8)}</div>
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
                <div className="text-sm text-wl-text-secondary">{ret.reason}</div>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                <Badge variant={config.badge}>{config.label}</Badge>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
                <div className="text-sm font-semibold text-wl-success-400">${Number(amount).toFixed(2)}</div>
              </div>

              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Date</div>
                <div className="text-sm text-wl-text-secondary">{date}</div>
              </div>

              <div className="col-span-2 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1">View</Button>
                <Button variant="secondary" size="sm" className="flex-1">Edit</Button>
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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Returns & RMA"
        subtitle={`${returns.length} active return${returns.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      <StatusPipeline returns={returns} />
      <ReturnsTable returns={returns} />
    </>
  );
}
