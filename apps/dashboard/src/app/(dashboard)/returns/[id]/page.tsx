'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  RotateCcw,
  Package,
  CheckCircle,
  XCircle,
  Truck,
  Search,
  DollarSign,
  RefreshCw,
  MapPin,
  Calendar,
  User,
  ShoppingBag,
  Tag,
  AlertCircle,
  Map,
  LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useReturn,
  useApproveReturn,
  useRejectReturn,
  useReceiveReturn,
  useInspectReturn,
  useProcessRefund,
  type ReturnItem,
} from '@/hooks/use-returns';

// ── Lazy map ──────────────────────────────────────────────────────────────────

const ReturnLocationMap = dynamic(() => import('./components/return-location-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 rounded-xl bg-wl-bg-elevated border border-wl-border-subtle flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 rounded-full border-2 border-wl-border-subtle border-t-wl-primary animate-spin mx-auto mb-2" />
        <p className="text-xs text-wl-text-tertiary">Loading map…</p>
      </div>
    </div>
  ),
});

// ── Types & helpers ───────────────────────────────────────────────────────────

type NormalStatus = 'pending' | 'approved' | 'rejected' | 'received' | 'inspected' | 'refunded';

const STATUS_CONFIG: Record<NormalStatus, { badge: 'default' | 'info' | 'primary' | 'danger' | 'warning' | 'success'; label: string; icon: React.ElementType }> = {
  pending:   { badge: 'info',    label: 'Pending',   icon: RotateCcw   },
  approved:  { badge: 'primary', label: 'Approved',  icon: CheckCircle },
  rejected:  { badge: 'danger',  label: 'Rejected',  icon: XCircle     },
  received:  { badge: 'warning', label: 'Received',  icon: Package     },
  inspected: { badge: 'warning', label: 'Inspected', icon: Search      },
  refunded:  { badge: 'success', label: 'Refunded',  icon: DollarSign  },
};

const PIPELINE: NormalStatus[] = ['pending', 'approved', 'received', 'inspected', 'refunded'];

function normalize(status: string): NormalStatus {
  const s = status?.toLowerCase?.() ?? '';
  if (s === 'rejected') return 'rejected';
  if (s === 'approved') return 'approved';
  if (s === 'received' || s === 'picked_up' || s === 'in_transit') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPipeline({ status }: { status: NormalStatus }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-error-500/10 border border-wl-error-500/20">
        <XCircle className="w-4 h-4 text-wl-error-400" />
        <span className="text-sm font-medium text-wl-error-400">Return Rejected</span>
      </div>
    );
  }
  const currentIdx = PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {PIPELINE.map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = cfg.icon;
        return (
          <div key={step} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                done  ? 'bg-wl-success-500/15 text-wl-success-400 border border-wl-success-500/20' :
                active ? 'bg-wl-primary/20 text-wl-primary border border-wl-primary/30' :
                         'bg-wl-bg-elevated text-wl-text-tertiary border border-wl-border-subtle',
              )}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={cn('h-px w-4 flex-shrink-0', done ? 'bg-wl-success-500/40' : 'bg-wl-border-subtle')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemsTable({ items }: { items: ReturnItem[] }) {
  if (!items?.length) {
    return (
      <div className="text-center py-8 text-wl-text-tertiary text-sm">No items recorded</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-wl-border-subtle">
            <th className="text-left py-2 px-3 text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Item</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Qty</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Condition</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Unit Price</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Refund</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-wl-border-subtle">
          {items.map((item, i) => (
            <tr key={item.id ?? i} className="hover:bg-wl-bg-elevated/50 transition-colors">
              <td className="py-2.5 px-3 text-wl-text-primary font-medium">
                {item.productName ?? item.name ?? `Item ${i + 1}`}
              </td>
              <td className="py-2.5 px-3 text-center text-wl-text-secondary">{item.quantity}</td>
              <td className="py-2.5 px-3">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  item.condition === 'good'      ? 'bg-wl-success-500/15 text-wl-success-400' :
                  item.condition === 'damaged'   ? 'bg-wl-error-500/15 text-wl-error-400' :
                  item.condition === 'defective' ? 'bg-wl-warning-500/15 text-wl-warning-400' :
                                                   'bg-wl-bg-elevated text-wl-text-tertiary',
                )}>
                  {item.condition ?? '—'}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right text-wl-text-secondary font-mono">
                {item.unitPrice != null ? fmtCurrency(item.unitPrice) : '—'}
              </td>
              <td className="py-2.5 px-3 text-right text-wl-success-400 font-mono font-medium">
                {item.refundAmount != null ? fmtCurrency(item.refundAmount) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'detail' | 'map';

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: ret, loading, error, refetch } = useReturn(id);

  const approve  = useApproveReturn(id);
  const reject   = useRejectReturn(id);
  const receive  = useReceiveReturn(id);
  const inspect  = useInspectReturn(id);
  const refund   = useProcessRefund(id);

  const status = normalize(ret?.status ?? '');
  const cfg    = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  const hasCoords = useMemo(
    () => (ret?.order?.deliveryLat != null && ret?.order?.deliveryLng != null),
    [ret],
  );

  async function doAction(
    fn: { execute: (payload?: unknown) => Promise<unknown> },
    payload?: unknown,
  ) {
    setActionError(null);
    try {
      await fn.execute(payload);
      refetch();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-wl-bg-elevated animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-wl-bg-elevated animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 bg-wl-bg-elevated animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ────────────────────────────────────────
  if (error || !ret) {
    return (
      <div className="p-6">
        <Link href="/returns" className="inline-flex items-center gap-2 text-sm text-wl-text-tertiary hover:text-wl-text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Returns
        </Link>
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-wl-border-subtle bg-wl-bg-elevated gap-4">
          <AlertCircle className="w-10 h-10 text-wl-error-400" />
          <div className="text-center">
            <p className="font-medium text-wl-text-primary">{error ? 'Failed to load return' : 'Return not found'}</p>
            {error && <p className="text-sm text-wl-text-tertiary mt-1">{error.message}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const refundTotal = ret.refundAmount ?? ret.totalRefundAmount ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* ── Back + header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/returns"
            className="p-2 rounded-lg border border-wl-border-subtle hover:bg-wl-bg-elevated transition-colors text-wl-text-tertiary hover:text-wl-text-primary"
            aria-label="Back to Returns"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-wl-text-primary font-mono">
                RMA-{id.slice(0, 8).toUpperCase()}
              </h1>
              <Badge variant={cfg.badge}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-wl-text-tertiary mt-0.5">
              Created {fmtDate(ret.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle — only show map option when coords available */}
          {hasCoords && (
            <div className="flex rounded-lg border border-wl-border-subtle overflow-hidden">
              <button
                onClick={() => setViewMode('detail')}
                aria-pressed={viewMode === 'detail'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'detail' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <LayoutList className="w-3.5 h-3.5" /> Detail
              </button>
              <button
                onClick={() => setViewMode('map')}
                aria-pressed={viewMode === 'map'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'map' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={refetch} aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Status pipeline ────────────────────────────────────── */}
      <StatusPipeline status={status} />

      {/* ── Action error ───────────────────────────────────────── */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-error-500/10 border border-wl-error-500/20 text-sm text-wl-error-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* ── Map view ───────────────────────────────────────────── */}
      {viewMode === 'map' && hasCoords && (
        <ReturnLocationMap
          lat={ret.order!.deliveryLat!}
          lng={ret.order!.deliveryLng!}
          label={ret.order?.customerName ?? ret.customerName ?? 'Return location'}
          status={status}
        />
      )}

      {viewMode === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main column ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-wl-primary" />
                  Return Items
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ItemsTable items={ret.items ?? []} />
                {refundTotal > 0 && (
                  <div className="mt-4 pt-4 border-t border-wl-border-subtle flex items-center justify-between">
                    <span className="text-sm text-wl-text-secondary font-medium">Total Refund Amount</span>
                    <span className="text-lg font-semibold text-wl-success-400 font-mono">
                      {fmtCurrency(refundTotal)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reason + notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-wl-primary" />
                  Return Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">Reason</p>
                  <p className="text-sm text-wl-text-primary capitalize">{ret.reason?.replace(/_/g, ' ') ?? '—'}</p>
                </div>
                {ret.reasonDetails && (
                  <div>
                    <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">Details</p>
                    <p className="text-sm text-wl-text-secondary">{ret.reasonDetails}</p>
                  </div>
                )}
                {ret.notes && (
                  <div>
                    <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-wl-text-secondary">{ret.notes}</p>
                  </div>
                )}
                {ret.trackingNumber && (
                  <div>
                    <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">Return Tracking #</p>
                    <p className="text-sm font-mono text-wl-primary">{ret.trackingNumber}</p>
                  </div>
                )}
                {ret.shippingLabelUrl && (
                  <a
                    href={ret.shippingLabelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-wl-primary hover:underline"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    View Shipping Label
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-wl-primary" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {[
                    { label: 'Return Requested', date: ret.createdAt, show: true },
                    { label: 'Approved',          date: ret.approvedAt, show: !!ret.approvedAt },
                    { label: 'Received',           date: ret.receivedAt, show: !!ret.receivedAt },
                    { label: 'Refunded',           date: ret.refundedAt, show: !!ret.refundedAt },
                    { label: 'Rejected',           date: ret.rejectedAt, show: !!ret.rejectedAt },
                  ]
                    .filter((e) => e.show)
                    .map((event, i, arr) => (
                      <div key={event.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            'w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0',
                            event.label === 'Rejected' ? 'bg-wl-error-400' :
                            i === arr.length - 1      ? 'bg-wl-primary' :
                                                        'bg-wl-success-400',
                          )} />
                          {i < arr.length - 1 && <div className="w-px h-6 bg-wl-border-subtle mt-1" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-wl-text-primary">{event.label}</p>
                          <p className="text-xs text-wl-text-tertiary">{fmtDate(event.date)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ─────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Customer info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-wl-primary" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div>
                  <p className="text-sm font-medium text-wl-text-primary">{ret.customerName}</p>
                  {ret.customerEmail && (
                    <p className="text-xs text-wl-text-tertiary mt-0.5">{ret.customerEmail}</p>
                  )}
                </div>
                {ret.order && (
                  <div className="pt-2 border-t border-wl-border-subtle">
                    <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1.5">Related Order</p>
                    <Link
                      href={`/orders/${ret.order.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-wl-primary hover:underline"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      #{ret.order.externalOrderNumber ?? ret.order.id.slice(0, 8)}
                    </Link>
                    {ret.order.totalPrice != null && (
                      <p className="text-xs text-wl-text-tertiary mt-1">
                        Order total: {fmtCurrency(ret.order.totalPrice)}
                      </p>
                    )}
                  </div>
                )}
                {ret.order?.deliveryLat != null && (
                  <div className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                    <MapPin className="w-3 h-3" />
                    Delivery location available
                    <button
                      className="text-wl-primary hover:underline ml-1"
                      onClick={() => setViewMode('map')}
                    >
                      View map
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            {status !== 'rejected' && status !== 'refunded' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {status === 'pending' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => doAction(approve)}
                        disabled={approve.loading}
                      >
                        {approve.loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Approve Return
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full"
                        onClick={() => doAction(reject, { reason: 'Rejected by admin' })}
                        disabled={reject.loading}
                      >
                        {reject.loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Reject Return
                      </Button>
                    </>
                  )}
                  {status === 'approved' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => doAction(receive)}
                      disabled={receive.loading}
                    >
                      {receive.loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                      Mark as Received
                    </Button>
                  )}
                  {status === 'received' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => doAction(inspect, { condition: 'good', notes: '' })}
                      disabled={inspect.loading}
                    >
                      {inspect.loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Mark as Inspected
                    </Button>
                  )}
                  {status === 'inspected' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => doAction(refund, { amount: refundTotal, method: 'original_payment' })}
                      disabled={refund.loading}
                    >
                      {refund.loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <DollarSign className="w-4 h-4" />
                      )}
                      Process Refund {refundTotal > 0 ? `(${fmtCurrency(refundTotal)})` : ''}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {[
                  { label: 'Return ID', value: id.slice(0, 8).toUpperCase(), mono: true },
                  { label: 'Items Count', value: String(ret.items?.length ?? 0) },
                  { label: 'Refund Amount', value: fmtCurrency(refundTotal), mono: true },
                  ret.restockingFee ? { label: 'Restocking Fee', value: fmtCurrency(ret.restockingFee), mono: true } : null,
                ].filter(Boolean).map((item) => item && (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-wl-text-tertiary">{item.label}</span>
                    <span className={cn('text-sm text-wl-text-primary', item.mono && 'font-mono')}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
