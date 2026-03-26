'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Plus, ChevronRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — RMA lifecycle with status pipeline
   Clean, data-focused design emphasizing return workflow stages
   ═══════════════════════════════════════════════════════════ */

interface ReturnRecord {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  status: string;
  reason: string;
  refundAmount: number;
  createdAt: string;
  approvedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  notes?: string | null;
}

const MOCK_RETURNS: ReturnRecord[] = [
  {
    id: 'RET-001',
    orderId: 'ORD-1001',
    customerId: 'cust-1',
    customerName: 'Alice Johnson',
    customerEmail: 'alice@example.com',
    status: 'requested',
    reason: 'Item damaged on arrival',
    refundAmount: 49.99,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'RET-002',
    orderId: 'ORD-1045',
    customerId: 'cust-2',
    customerName: 'Bob Martinez',
    customerEmail: 'bob@example.com',
    status: 'approved',
    reason: 'Wrong item shipped',
    refundAmount: 129.0,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'RET-003',
    orderId: 'ORD-998',
    customerId: 'cust-3',
    customerName: 'Carol White',
    status: 'received',
    reason: 'Changed mind',
    refundAmount: 75.5,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'RET-004',
    orderId: 'ORD-876',
    customerId: 'cust-4',
    customerName: 'David Lee',
    status: 'refunded',
    reason: 'Defective product',
    refundAmount: 220.0,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    receivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    refundedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

type ReturnStatusDisplay = 'requested' | 'approved' | 'shipped_back' | 'received' | 'inspected' | 'refunded';

const statusConfig: Record<ReturnStatusDisplay, { badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'; label: string }> = {
  requested: { badge: 'info', label: 'Requested' },
  approved: { badge: 'primary', label: 'Approved' },
  shipped_back: { badge: 'primary', label: 'Shipped Back' },
  received: { badge: 'warning', label: 'Received' },
  inspected: { badge: 'warning', label: 'Inspected' },
  refunded: { badge: 'success', label: 'Refunded' },
};

const normalizeStatus = (status: string): ReturnStatusDisplay => {
  const s = status.toLowerCase();
  if (s === 'requested' || s === 'initiated') return 'requested';
  if (s === 'approved') return 'approved';
  if (s === 'shipped_back' || s === 'picked_up' || s === 'in_transit') return 'shipped_back';
  if (s === 'received') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'requested';
};


const StatusPipeline = ({ returns }: { returns: ReturnRecord[] }) => {
  const statuses: ReturnStatusDisplay[] = ['requested', 'approved', 'shipped_back', 'received', 'inspected', 'refunded'];

  const countByStatus = statuses.reduce(
    (acc, status) => {
      acc[status] = returns.filter((r) => normalizeStatus(r.status) === status).length;
      return acc;
    },
    {} as Record<ReturnStatusDisplay, number>
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {statuses.map((status, idx) => {
            const count = countByStatus[status];

            return (
              <div key={status} className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn('px-4 py-2 rounded-lg border border-white/[0.08] text-center')}>
                    <div className="text-xs font-medium text-wl-text-secondary uppercase tracking-wider">{status.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-semibold text-wl-text-primary mt-1">{count}</div>
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

const ReturnsTable = ({ returns }: { returns: ReturnRecord[] }) => {
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
          const status = normalizeStatus(ret.status);
          const config = statusConfig[status];
          const date = new Date(ret.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
                <div className="text-sm font-semibold text-wl-success-400">${Number(ret.refundAmount).toFixed(2)}</div>
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
  const { items: apiReturns, loading, error, refetch } = useApiList<ReturnRecord>('/api/v4/returns', { limit: 50 });

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const returns = apiReturns.length > 0 ? apiReturns : MOCK_RETURNS;

  return (
    <>
      {/* Header */}
      <Header
        title="Returns & RMA"
        subtitle={`${returns.length} active returns`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      {/* Status pipeline */}
      <StatusPipeline returns={returns} />

      {/* Returns table */}
      <ReturnsTable returns={returns} />
    </>
  );
}
