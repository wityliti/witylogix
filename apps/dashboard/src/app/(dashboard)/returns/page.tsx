'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useReturns, useReturnStats, type Return } from '@/hooks/use-returns';
import {
  Plus,
  ChevronRight,
  RotateCcw,
  Map,
  LayoutList,
  DollarSign,
  CheckCircle,
  XCircle,
  Package,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — RMA lifecycle with status pipeline
   ═══════════════════════════════════════════════════════════ */

// ── Lazy-load map (no SSR for maplibre-gl) ────────────────────────────────────
const ReturnsMapView = dynamic(() => import('./components/returns-map-view'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] rounded-xl bg-wl-bg-elevated border border-wl-border-subtle flex items-center justify-center">
      <div className="text-center">
        <div className="w-7 h-7 rounded-full border-2 border-wl-border-subtle border-t-wl-primary animate-spin mx-auto mb-3" />
        <p className="text-sm text-wl-text-tertiary">Loading map…</p>
      </div>
    </div>
  ),
});

// ── Status helpers ────────────────────────────────────────────────────────────

type NormStatus = 'pending' | 'approved' | 'rejected' | 'received' | 'inspected' | 'refunded';

const STATUS_CONFIG: Record<NormStatus, { badge: 'default' | 'info' | 'primary' | 'danger' | 'warning' | 'success'; label: string }> = {
  pending:   { badge: 'info',    label: 'Pending'   },
  approved:  { badge: 'primary', label: 'Approved'  },
  rejected:  { badge: 'danger',  label: 'Rejected'  },
  received:  { badge: 'warning', label: 'Received'  },
  inspected: { badge: 'warning', label: 'Inspected' },
  refunded:  { badge: 'success', label: 'Refunded'  },
};

const PIPELINE_STATUSES: NormStatus[] = ['pending', 'approved', 'received', 'inspected', 'refunded'];

function normalize(status: string): NormStatus {
  const s = status?.toLowerCase?.() ?? '';
  if (s === 'rejected') return 'rejected';
  if (s === 'approved') return 'approved';
  if (s === 'received' || s === 'picked_up' || s === 'in_transit') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Status Pipeline Strip ─────────────────────────────────────────────────────

function StatusPipelineStrip({ returns }: { returns: Return[] }) {
  const countByStatus = useMemo(() => {
    const acc: Record<NormStatus, number> = { pending: 0, approved: 0, rejected: 0, received: 0, inspected: 0, refunded: 0 };
    returns.forEach((r) => { acc[normalize(r.status as string)]++; });
    return acc;
  }, [returns]);

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PIPELINE_STATUSES.map((status, idx) => (
            <div key={status} className="flex items-center gap-2 flex-shrink-0">
              <div className="px-4 py-2.5 rounded-lg border border-wl-border-subtle bg-wl-bg-elevated text-center min-w-[90px]">
                <div className="text-[10px] font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
                  {status.replace(/_/g, ' ')}
                </div>
                <div className="text-xl font-bold text-wl-text-primary font-mono">
                  {countByStatus[status]}
                </div>
              </div>
              {idx < PIPELINE_STATUSES.length - 1 && (
                <ChevronRight className="w-4 h-4 text-wl-border-default flex-shrink-0" />
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4 pl-4 border-l border-wl-border-subtle">
            <div className="px-4 py-2.5 rounded-lg border border-wl-error-500/20 bg-wl-error-500/5 text-center min-w-[80px]">
              <div className="text-[10px] font-semibold text-wl-error-400 uppercase tracking-wider mb-1">Rejected</div>
              <div className="text-xl font-bold text-wl-error-400 font-mono">{countByStatus.rejected}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Returns Table ─────────────────────────────────────────────────────────────

function ReturnsTable({ returns, onView }: { returns: Return[]; onView: (id: string) => void }) {
  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-wl-border-subtle bg-wl-bg-elevated">
        <RotateCcw className="w-10 h-10 text-wl-text-tertiary" />
        <div className="text-center">
          <p className="text-sm font-medium text-wl-text-secondary">No returns yet</p>
          <p className="text-xs text-wl-text-tertiary mt-1">Customer return requests will appear here</p>
        </div>
        <Button variant="primary" size="sm">
          <Plus className="w-4 h-4" />
          Create Return
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-wl-border-subtle bg-wl-bg-elevated">
        {['Return ID', 'Order', 'Customer', 'Reason', 'Status', 'Refund', 'Date', 'Actions'].map((h, i) => (
          <div
            key={h}
            className={cn(
              'text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider',
              i === 0 ? 'col-span-1' :
              i === 1 ? 'col-span-1' :
              i === 2 ? 'col-span-2' :
              i === 3 ? 'col-span-2' :
              i === 4 ? 'col-span-1' :
              i === 5 ? 'col-span-1 text-right' :
              i === 6 ? 'col-span-1' :
              'col-span-3',
            )}
          >
            {h}
          </div>
        ))}
      </div>

      <div className="divide-y divide-wl-border-subtle">
        {returns.map((ret) => {
          const status = normalize(ret.status as string);
          const cfg = STATUS_CONFIG[status];
          const date = new Date(ret.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
          const amount = ret.refundAmount ?? ret.totalRefundAmount ?? 0;

          return (
            <div
              key={ret.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-wl-bg-elevated/60 transition-colors cursor-pointer"
              onClick={() => onView(ret.id)}
              role="row"
              aria-label={`Return from ${ret.customerName}`}
            >
              {/* Return ID */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Return ID</div>
                <div className="text-sm font-mono font-medium text-wl-primary">
                  {ret.id.slice(0, 8).toUpperCase()}
                </div>
              </div>

              {/* Order */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Order</div>
                <div className="text-sm font-mono text-wl-text-secondary">{ret.orderId.slice(0, 8)}</div>
              </div>

              {/* Customer */}
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Customer</div>
                <div className="text-sm text-wl-text-primary font-medium">{ret.customerName}</div>
                {ret.customerEmail && (
                  <div className="text-xs text-wl-text-tertiary mt-0.5 truncate">{ret.customerEmail}</div>
                )}
              </div>

              {/* Reason */}
              <div className="col-span-2">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Reason</div>
                <div className="text-sm text-wl-text-secondary capitalize">{ret.reason?.replace(/_/g, ' ') ?? '—'}</div>
              </div>

              {/* Status */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Status</div>
                <Badge variant={cfg.badge}>{cfg.label}</Badge>
              </div>

              {/* Refund */}
              <div className="col-span-1 text-right">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Refund</div>
                <div className="text-sm font-semibold font-mono text-wl-success-400">
                  {amount > 0 ? fmtCurrency(amount) : '—'}
                </div>
              </div>

              {/* Date */}
              <div className="col-span-1">
                <div className="md:hidden text-xs text-wl-text-tertiary mb-1">Date</div>
                <div className="text-sm text-wl-text-secondary">{date}</div>
              </div>

              {/* Actions */}
              <div className="col-span-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => onView(ret.id)}>
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'map';

export default function ReturnsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { items: returns, loading, error, refetch } = useReturns();
  const { data: statsData } = useReturnStats();

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return returns;
    return returns.filter((r) => normalize(r.status as string) === statusFilter);
  }, [returns, statusFilter]);

  const returnsWithCoords = useMemo(
    () => returns.filter((r) => (r as Return & { order?: { deliveryLat?: number } }).order?.deliveryLat != null),
    [returns],
  );

  const totalRefunded = statsData?.totalRefundAmount ?? 0;
  const pendingCount  = statsData?.counts?.requested ?? returns.filter((r) => normalize(r.status as string) === 'pending').length;
  const refundedCount = statsData?.counts?.refunded  ?? returns.filter((r) => normalize(r.status as string) === 'refunded').length;
  const totalCount    = statsData?.totalReturns       ?? returns.length;

  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Returns & RMA"
        subtitle={`${totalCount} total return${totalCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-wl-border-subtle overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'list' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                aria-pressed={viewMode === 'map'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'map' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Map</span>
                {returnsWithCoords.length > 0 && (
                  <span className="text-[10px] bg-wl-info-500 text-white rounded-full px-1.5 py-0 font-bold">
                    {returnsWithCoords.length}
                  </span>
                )}
              </button>
            </div>

            <Button variant="primary" size="md" onClick={() => router.push('/returns/create')}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Return</span>
            </Button>
          </div>
        }
      />

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Returns"
          value={totalCount}
          icon={<RotateCcw className="w-5 h-5" />}
          accentColor="var(--wl-primary-500)"
        />
        <StatCard
          label="Pending Approval"
          value={pendingCount}
          icon={<Package className="w-5 h-5" />}
          accentColor="var(--wl-warning-500)"
        />
        <StatCard
          label="Refunded"
          value={refundedCount}
          icon={<CheckCircle className="w-5 h-5" />}
          accentColor="var(--wl-success-500)"
        />
        <StatCard
          label="Total Refunded"
          value={fmtCurrency(totalRefunded)}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="var(--wl-success-400)"
        />
      </div>

      {/* ── Status pipeline ──────────────────────────────────── */}
      <StatusPipelineStrip returns={returns} />

      {/* ── Status filter ─────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex gap-2 flex-wrap mb-4">
          {['all', 'pending', 'approved', 'received', 'inspected', 'refunded', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                statusFilter === s
                  ? 'bg-wl-primary text-white border-wl-primary'
                  : 'bg-wl-bg-elevated text-wl-text-secondary border-wl-border-subtle hover:text-wl-text-primary',
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  ({returns.filter((r) => normalize(r.status as string) === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────── */}
      {viewMode === 'map' ? (
        <div className="space-y-3">
          <ReturnsMapView returns={returns} onSelect={(id) => router.push(`/returns/${id}`)} />
          {returnsWithCoords.length === 0 && (
            <p className="text-center text-sm text-wl-text-tertiary py-3">
              No returns have delivery coordinates. Coordinates come from the associated order's shipment.
            </p>
          )}
        </div>
      ) : (
        <ReturnsTable returns={filtered} onView={(id) => router.push(`/returns/${id}`)} />
      )}
    </>
  );
}
