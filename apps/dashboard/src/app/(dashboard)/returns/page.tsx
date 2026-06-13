'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { useReturns, useReturnStats, type Return } from '@/hooks/use-returns';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, ChevronRight, RotateCcw, DollarSign, Clock, CheckCircle, Package } from 'lucide-react';

type ReturnStatus = 'pending' | 'approved' | 'shipped_back' | 'received' | 'inspected' | 'refunded' | 'rejected';

const STATUS_CONFIG: Record<string, { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string }> = {
  pending:     { badge: 'info',    label: 'Pending' },
  approved:    { badge: 'primary', label: 'Approved' },
  shipped_back:{ badge: 'primary', label: 'Shipped Back' },
  received:    { badge: 'warning', label: 'Received' },
  inspected:   { badge: 'warning', label: 'Inspected' },
  refunded:    { badge: 'success', label: 'Refunded' },
  rejected:    { badge: 'danger',  label: 'Rejected' },
};

const PIPELINE_STATUSES = ['pending', 'approved', 'received', 'inspected', 'refunded'] as const;

function normalizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'initiated') return 'pending';
  if (s === 'picked_up' || s === 'in_transit') return 'shipped_back';
  return s;
}

// ─── Pipeline Bar ───────────────────────────────────────────

function StatusPipeline({ returns }: { returns: Return[] }) {
  const counts = PIPELINE_STATUSES.reduce(
    (acc, st) => {
      acc[st] = returns.filter((r) => normalizeStatus(r.status as string) === st).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {PIPELINE_STATUSES.map((status, idx) => {
            const config = STATUS_CONFIG[status];
            return (
              <div key={status} className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className="px-4 py-2 rounded-lg border border-white/[0.08] text-center min-w-[80px]">
                    <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">
                      {status.replace(/_/g, ' ')}
                    </div>
                    <div className="text-lg font-semibold text-wl-text-primary mt-1">{counts[status]}</div>
                  </div>
                </div>
                {idx < PIPELINE_STATUSES.length - 1 && (
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

// ─── Table ─────────────────────────────────────────────────

function ReturnsTable({ returns }: { returns: Return[] }) {
  return (
    <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
        {['Return #', 'Order #', 'Customer', 'Reason', 'Status', 'Refund', 'Date', 'Actions'].map((h, i) => (
          <div
            key={h}
            className={cn(
              'text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider',
              i === 0 ? 'col-span-1' : i === 2 || i === 3 ? 'col-span-2' : 'col-span-1',
              i === 7 ? 'col-span-2' : ''
            )}
          >
            {h}
          </div>
        ))}
      </div>

      <div className="divide-y divide-white/[0.05]">
        {returns.map((ret) => {
          const statusKey = normalizeStatus(ret.status as string);
          const config = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
          const date = new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const amount = Number(ret.refundAmount ?? ret.totalRefundAmount ?? 0);

          return (
            <div key={ret.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return #</div>
                <div className="text-sm font-medium text-wl-primary-400 truncate">{ret.id.slice(0, 8)}…</div>
              </div>
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order #</div>
                <div className="text-sm text-wl-text-secondary truncate">{ret.orderId.slice(0, 8)}…</div>
              </div>
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Customer</div>
                <div className="text-sm text-wl-text-primary">{ret.customerName ?? '—'}</div>
                {ret.customerEmail && (
                  <div className="text-xs text-wl-text-tertiary mt-0.5 truncate">{ret.customerEmail}</div>
                )}
              </div>
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Reason</div>
                <div className="text-sm text-wl-text-secondary capitalize">
                  {(ret.reason as string).replace(/_/g, ' ').toLowerCase()}
                </div>
              </div>
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                <Badge variant={config.badge}>{config.label}</Badge>
              </div>
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
                <div className="text-sm font-semibold text-wl-success-400">
                  {amount > 0 ? `$${amount.toFixed(2)}` : '—'}
                </div>
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
}

// ─── Page ──────────────────────────────────────────────────

export default function ReturnsPage() {
  const { items, loading, error, refetch, pagination } = useReturns();
  const { data: stats, loading: statsLoading } = useReturnStats();

  if (loading) {
    return (
      <>
        <Header title="Returns & RMA" subtitle="Loading…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-20 animate-pulse bg-white/[0.03]">&nbsp;</CardContent></Card>
          ))}
        </div>
        <TableSkeleton rows={8} columns={6} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Returns & RMA" subtitle="Error loading returns" />
        <ErrorState message={error.message} onRetry={refetch} />
      </>
    );
  }

  return (
    <>
      <Header
        title="Returns & RMA"
        subtitle={`${pagination.total} total returns`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Returns"
            value={stats.totalReturns}
            icon={<RotateCcw size={18} />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Pending Approvals"
            value={stats.pendingApprovals}
            icon={<Clock size={18} />}
            accentColor="var(--wl-warning-500)"
            index={1}
          />
          <StatCard
            label="Refunded"
            value={stats.refundedReturns}
            icon={<CheckCircle size={18} />}
            accentColor="var(--wl-success-500)"
            index={2}
          />
          <StatCard
            label="Total Refunded"
            value={`$${stats.totalRefunded.toFixed(2)}`}
            icon={<DollarSign size={18} />}
            accentColor="var(--wl-info-500)"
            index={3}
          />
        </div>
      )}

      {/* Pipeline */}
      <StatusPipeline returns={items} />

      {/* Table or empty state */}
      {items.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="w-12 h-12 text-wl-text-tertiary" />}
          title="No returns yet"
          description="Return requests from customers will appear here."
          action={{ label: 'Create Return', onClick: () => {} }}
        />
      ) : (
        <ReturnsTable returns={items} />
      )}
    </>
  );
}
