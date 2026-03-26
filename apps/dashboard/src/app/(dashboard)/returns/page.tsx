'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReturns, Return } from '@/hooks/use-returns';
import { Plus, ChevronRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — RMA lifecycle with status pipeline
   Clean, data-focused design emphasizing return workflow stages
   ═══════════════════════════════════════════════════════════ */

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

// Mock returns data for development (fallback when API has no ReturnRequest model yet)
const MOCK_RETURNS: Return[] = [
  {
    id: "RET-2024-001",
    orderId: "ORD-2024-115",
    customerId: "CUST-001",
    customerName: "John Smith",
    customerEmail: "john.smith@email.com",
    status: "requested",
    reason: "Product arrived damaged",
    items: [{ id: "I-1", name: "Blue Wireless Headphones", quantity: 1, condition: "damaged" }],
    refundAmount: 89.99,
    createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    notes: "Customer reports broken cable connector",
    timeline: [],
  },
  {
    id: "RET-2024-002",
    orderId: "ORD-2024-114",
    customerId: "CUST-002",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@email.com",
    status: "approved",
    reason: "Wrong size",
    items: [{ id: "I-2", name: "Wool Winter Jacket (L)", quantity: 1, condition: "good" }],
    refundAmount: 159.99,
    createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    notes: "Customer ordered size L but needed M",
    timeline: [],
  },
  {
    id: "RET-2024-003",
    orderId: "ORD-2024-113",
    customerId: "CUST-003",
    customerName: "Emily Davis",
    customerEmail: "emily.davis@email.com",
    status: "received",
    reason: "Defective unit",
    items: [{ id: "I-3", name: "Portable Phone Charger 20K", quantity: 2, condition: "defective" }],
    refundAmount: 119.98,
    createdAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Units won't charge. Package received on 3/17.",
    timeline: [],
  },
  {
    id: "RET-2024-004",
    orderId: "ORD-2024-112",
    customerId: "CUST-004",
    customerName: "Michael Brown",
    customerEmail: "m.brown@email.com",
    status: "refunded",
    reason: "Changed mind",
    items: [{ id: "I-4", name: "Gaming Mouse RGB", quantity: 1, condition: "good" }],
    refundAmount: 74.99,
    createdAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    refundedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Quick return and refund processed",
    timeline: [],
  },
];

const StatusPipeline = ({ returns }: { returns: Return[] }) => {
  const statuses: ReturnStatusDisplay[] = ['requested', 'approved', 'shipped_back', 'received', 'inspected', 'refunded'];

  const countByStatus = statuses.reduce(
    (acc, status) => {
      acc[status] = returns.filter((r) => normalizeStatus(r.status as string) === status).length;
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

const ReturnsTable = ({ returns }: { returns: Return[] }) => {
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
  const { items: apiReturns } = useReturns();
  const returnsData = apiReturns.length > 0 ? apiReturns : MOCK_RETURNS;

  return (
    <>
      {/* Header */}
      <Header
        title="Returns & RMA"
        subtitle={`${returnsData.length} active returns`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Create Return
          </Button>
        }
      />

      {/* Status pipeline */}
      <StatusPipeline returns={returnsData} />

      {/* Returns table */}
      <ReturnsTable returns={returnsData} />
    </>
  );
}
