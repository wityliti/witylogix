'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { StatusTimeline, type TimelineStep } from '@/components/ui/status-timeline';
import { cn } from '@/lib/utils';
import {
  useReturn,
  useApproveReturn,
  useRejectReturn,
  useProcessRefund,
  type Return,
} from '@/hooks/use-returns';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

// ─── Status config ────────────────────────────────────────────────────────────

const BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  pending:   'info',
  requested: 'info',
  approved:  'primary',
  received:  'warning',
  inspected: 'warning',
  refunded:  'success',
  rejected:  'danger',
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  requested: 'Requested',
  approved:  'Approved',
  received:  'Received',
  inspected: 'Inspected',
  refunded:  'Refunded',
  rejected:  'Rejected',
};

function normalise(status: string): string {
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

// Build timeline steps from return data
function buildTimeline(ret: Return): TimelineStep[] {
  const norm = normalise(ret.status as string);

  const steps: Array<{ id: string; title: string; timestamp?: string; reached: boolean }> = [
    { id: 'pending',   title: 'Return Requested', timestamp: ret.requestedAt ?? ret.createdAt, reached: true },
    { id: 'approved',  title: 'Approved',          timestamp: ret.approvedAt,  reached: !!ret.approvedAt },
    { id: 'received',  title: 'Item Received',     timestamp: ret.receivedAt,  reached: !!ret.receivedAt },
    { id: 'inspected', title: 'Inspected',          timestamp: undefined,       reached: norm === 'inspected' || norm === 'refunded' },
    { id: 'refunded',  title: 'Refund Processed',  timestamp: ret.refundedAt,  reached: norm === 'refunded' },
  ];

  if (norm === 'rejected') {
    steps.splice(1, 4, { id: 'rejected', title: 'Rejected', timestamp: ret.rejectedAt, reached: true });
  }

  const currentIdx = steps.findLastIndex((s) => s.reached);

  return steps.map((s, idx) => ({
    id: s.id,
    title: s.title,
    description: s.timestamp
      ? new Date(s.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined,
    status: idx < currentIdx ? 'completed' : idx === currentIdx ? 'active' : 'pending',
  }));
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ReturnActions({ ret, onSuccess }: { ret: Return; onSuccess: () => void }) {
  const norm = normalise(ret.status as string);
  const approve = useApproveReturn(ret.id);
  const reject = useRejectReturn(ret.id);
  const refund = useProcessRefund(ret.id);

  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (norm === 'refunded' || norm === 'rejected') return null;

  const handleApprove = async () => {
    await approve.execute({ approvedBy: 'admin', notes: '' });
    onSuccess();
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) return;
    await reject.execute({ reason: rejectNote });
    onSuccess();
  };

  const handleRefund = async () => {
    await refund.execute({});
    onSuccess();
  };

  const mutError = approve.error ?? reject.error ?? refund.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mutError && (
          <p className="text-sm text-wl-danger-400 bg-wl-danger-bg/30 rounded-lg px-3 py-2">
            {mutError.message}
          </p>
        )}

        {norm === 'pending' && (
          <>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleApprove}
              disabled={approve.loading}
            >
              <CheckCircle className="w-4 h-4" />
              {approve.loading ? 'Approving…' : 'Approve Return'}
            </Button>

            {!showRejectInput ? (
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => setShowRejectInput(true)}
              >
                <XCircle className="w-4 h-4" />
                Reject Return
              </Button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason for rejection…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-primary text-sm resize-none focus:outline-none focus:border-wl-primary-500"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={handleReject}
                    disabled={reject.loading || !rejectNote.trim()}
                  >
                    {reject.loading ? 'Rejecting…' : 'Confirm Reject'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {norm === 'inspected' && (
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={handleRefund}
            disabled={refund.loading}
          >
            <DollarSign className="w-4 h-4" />
            {refund.loading ? 'Processing…' : 'Process Refund'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail skeleton ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded w-3/4" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ret, loading, error, refetch } = useReturn(id);

  if (loading) {
    return (
      <>
        <Header title="Return Detail" />
        <DetailSkeleton />
      </>
    );
  }

  if (error || !ret) {
    return (
      <>
        <Header
          title="Return Detail"
          actions={
            <Link href="/returns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Returns
              </Button>
            </Link>
          }
        />
        <div className="p-6">
          <ErrorState
            title="Return not found"
            message={error?.message ?? 'This return may have been removed.'}
            onRetry={refetch}
          />
        </div>
      </>
    );
  }

  const norm = normalise(ret.status as string);
  const badgeVariant = BADGE_VARIANT[norm] ?? 'default';
  const statusLabel = STATUS_LABEL[norm] ?? norm;
  const amount = ret.refundAmount ?? ret.totalRefundAmount ?? 0;
  const timeline = buildTimeline(ret);

  return (
    <>
      <Header
        title={`Return ${ret.id}`}
        subtitle={`Order ${ret.orderId} · ${ret.customerName}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={badgeVariant}>{statusLabel}</Badge>
            <Link href="/returns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Returns
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: detail + items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle>Return Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  ['Return ID',   ret.id],
                  ['Order ID',    ret.orderId],
                  ['Customer',    ret.customerName],
                  ['Email',       ret.customerEmail ?? '—'],
                  ['Reason',      ret.reason.replace(/_/g, ' ')],
                  ['Status',      statusLabel],
                  ['Refund Amount', `$${Number(amount).toFixed(2)}`],
                  ['Created',     new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-0.5">{label}</dt>
                    <dd className={cn(
                      'text-wl-text-primary',
                      label === 'Reason' && 'capitalize',
                      label === 'Refund Amount' && 'font-semibold text-wl-success-400',
                    )}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {ret.notes && (
                <div className="mt-4 p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle">
                  <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-wl-text-secondary">{ret.notes}</p>
                </div>
              )}

              {ret.rejectionReason && (
                <div className="mt-4 p-3 rounded-lg bg-wl-danger-bg/30 border border-wl-danger-400/20 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-wl-danger-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-wl-danger-400 uppercase tracking-wider mb-0.5">Rejection Reason</p>
                    <p className="text-sm text-wl-text-secondary">{ret.rejectionReason}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          {ret.items && ret.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Package className="w-4 h-4 inline-block mr-2 text-wl-text-secondary" />
                  Returned Items ({ret.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-wl-border-subtle">
                  {ret.items.map((item, idx) => (
                    <div key={item.id ?? idx} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-wl-text-primary">
                          {item.productName ?? item.name ?? 'Unknown item'}
                        </p>
                        <p className="text-xs text-wl-text-tertiary mt-0.5 capitalize">
                          Condition: {item.condition} · Qty: {item.quantity}
                        </p>
                      </div>
                      {item.refundAmount != null && (
                        <span className="text-sm font-semibold text-wl-success-400">
                          ${Number(item.refundAmount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: timeline + actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline steps={timeline} orientation="vertical" />
            </CardContent>
          </Card>

          <ReturnActions ret={ret} onSuccess={refetch} />
        </div>
      </div>
    </>
  );
}
