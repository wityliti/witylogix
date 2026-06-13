'use client';

import { use } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReturn, useApproveReturn, useRejectReturn } from '@/hooks/use-returns';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  ArrowLeft, CheckCircle, XCircle, Package, DollarSign, Calendar, User, Hash
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string; color: string }> = {
  pending:     { badge: 'info',    label: 'Pending',      color: '#3b82f6' },
  approved:    { badge: 'primary', label: 'Approved',     color: '#8b5cf6' },
  received:    { badge: 'warning', label: 'Received',     color: '#f59e0b' },
  inspected:   { badge: 'warning', label: 'Inspected',    color: '#f59e0b' },
  refunded:    { badge: 'success', label: 'Refunded',     color: '#22c55e' },
  rejected:    { badge: 'danger',  label: 'Rejected',     color: '#ef4444' },
};

const TIMELINE_STEPS = [
  { status: 'pending',   label: 'Requested' },
  { status: 'approved',  label: 'Approved' },
  { status: 'received',  label: 'Received' },
  { status: 'inspected', label: 'Inspected' },
  { status: 'refunded',  label: 'Refunded' },
];

function getStepIndex(status: string): number {
  return TIMELINE_STEPS.findIndex((s) => s.status === status.toLowerCase());
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-wl-text-tertiary">{label}</span>
      <span className="text-sm text-wl-text-primary font-medium">{value ?? '—'}</span>
    </div>
  );
}

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ret, loading, error, refetch } = useReturn(id);
  const approveMutation = useApproveReturn(id);
  const rejectMutation = useRejectReturn(id);

  if (loading) {
    return (
      <div className="p-8">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error || !ret) {
    return (
      <div className="p-8">
        <ErrorState message={error?.message ?? 'Return not found'} onRetry={refetch} />
      </div>
    );
  }

  const statusKey = (ret.status as string).toLowerCase();
  const config = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const currentStep = getStepIndex(statusKey);
  const amount = Number(ret.refundAmount ?? ret.totalRefundAmount ?? 0);

  async function handleApprove() {
    await approveMutation.execute({});
    refetch();
  }

  async function handleReject() {
    const reason = window.prompt('Rejection reason:');
    if (!reason) return;
    await rejectMutation.execute({ rejectionReason: reason });
    refetch();
  }

  return (
    <>
      <Header
        title={`Return ${id.slice(0, 8)}…`}
        subtitle={`Order ${ret.orderId.slice(0, 8)}… · ${config.label}`}
        actions={
          <div className="flex gap-2">
            <Link href="/returns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            {statusKey === 'pending' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  disabled={approveMutation.loading}
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleReject}
                  disabled={rejectMutation.loading}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-0">
        {/* Left column — main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Return Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {TIMELINE_STEPS.map((step, idx) => {
                  const done = idx <= currentStep;
                  const active = idx === currentStep;
                  return (
                    <div key={step.status} className="flex items-center gap-2 flex-1 last:flex-none">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        done && !active && 'bg-wl-success-500/20 text-wl-success-400 border border-wl-success-500/30',
                        active && 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/50',
                        !done && 'bg-white/[0.04] text-wl-text-tertiary border border-white/[0.08]'
                      )}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          'text-xs font-medium truncate',
                          done ? 'text-wl-text-primary' : 'text-wl-text-tertiary'
                        )}>{step.label}</div>
                      </div>
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <div className={cn(
                          'h-0.5 flex-1 rounded',
                          idx < currentStep ? 'bg-wl-success-500/40' : 'bg-white/[0.08]'
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Return items */}
          <Card>
            <CardHeader>
              <CardTitle>Items in Return</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(ret.items) && ret.items.length > 0 ? (
                <div className="divide-y divide-white/[0.05]">
                  {(ret.items as any[]).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-wl-text-tertiary" />
                        <div>
                          <div className="text-sm font-medium text-wl-text-primary">
                            {item.productName ?? item.name ?? 'Unknown item'}
                          </div>
                          <div className="text-xs text-wl-text-tertiary capitalize">
                            Qty {item.quantity} · Condition: {item.condition}
                          </div>
                        </div>
                      </div>
                      {item.refundAmount != null && (
                        <div className="text-sm font-semibold text-wl-success-400">
                          ${Number(item.refundAmount).toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-wl-text-tertiary">No items listed.</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {ret.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-wl-text-secondary whitespace-pre-wrap">{ret.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Rejection reason */}
          {statusKey === 'rejected' && ret.rejectionReason && (
            <Card className="border-wl-danger-500/30">
              <CardHeader><CardTitle className="text-wl-danger-400">Rejection Reason</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-wl-text-secondary">{ret.rejectionReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Status" value={<Badge variant={config.badge}>{config.label}</Badge>} />
              <DetailRow label="Return ID" value={<span className="font-mono text-xs">{id.slice(0, 12)}…</span>} />
              <DetailRow label="Order ID" value={<span className="font-mono text-xs">{ret.orderId.slice(0, 12)}…</span>} />
              <DetailRow label="Customer" value={ret.customerName} />
              <DetailRow label="Email" value={ret.customerEmail} />
              <DetailRow label="Reason" value={
                <span className="capitalize">
                  {(ret.reason as string).replace(/_/g, ' ').toLowerCase()}
                </span>
              } />
              <DetailRow
                label="Refund Amount"
                value={amount > 0 ? <span className="text-wl-success-400">${amount.toFixed(2)}</span> : '—'}
              />
              <DetailRow
                label="Requested"
                value={new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              />
              {ret.approvedAt && (
                <DetailRow
                  label="Approved"
                  value={new Date(ret.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                />
              )}
              {ret.refundedAt && (
                <DetailRow
                  label="Refunded"
                  value={new Date(ret.refundedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
