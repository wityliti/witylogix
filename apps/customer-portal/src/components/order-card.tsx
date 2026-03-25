'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

interface OrderCardProps {
  order: Order;
}

const statusConfig: Record<OrderStatus, {
  label: string;
  dotClass: string;
  badgeClass: string;
  accentClass: string;
}> = {
  pending: {
    label: 'Pending',
    dotClass: 'bg-wl-warning-500',
    badgeClass: 'status-pending',
    accentClass: 'card-accent-pending',
  },
  confirmed: {
    label: 'Confirmed',
    dotClass: 'bg-wl-info-500',
    badgeClass: 'status-confirmed',
    accentClass: 'card-accent-confirmed',
  },
  'out-for-delivery': {
    label: 'Out for Delivery',
    dotClass: 'bg-wl-primary-500',
    badgeClass: 'status-active',
    accentClass: 'card-accent-active',
  },
  delivered: {
    label: 'Delivered',
    dotClass: 'bg-wl-success-500',
    badgeClass: 'status-delivered',
    accentClass: 'card-accent-delivered',
  },
  cancelled: {
    label: 'Cancelled',
    dotClass: 'bg-wl-danger-500',
    badgeClass: 'status-cancelled',
    accentClass: 'card-accent-cancelled',
  },
};

export function OrderCard({ order }: OrderCardProps) {
  const config = statusConfig[order.status];

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn('card-accent', config.accentClass, 'cursor-pointer group')}>
        {/* Top row: order number + status */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-wl-text-primary truncate mono">
              {order.orderNumber}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">
              {format(order.createdAt, 'MMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('status-badge', config.badgeClass)}>
              <span className="status-badge-dot" />
              {config.label}
            </span>
            <ChevronRight
              size={16}
              className="text-wl-text-tertiary group-hover:text-wl-text-secondary transition-colors"
            />
          </div>
        </div>

        {/* Details row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-wl-text-secondary">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </span>
          <span className="font-semibold text-wl-text-primary mono">
            ${order.totalPrice.toFixed(2)}
          </span>
        </div>

        {/* Delivery info */}
        <div className="flex items-center justify-between text-xs text-wl-text-tertiary mt-2">
          <span>
            {order.status === 'delivered' && order.actualDeliveryDate
              ? `Delivered ${format(order.actualDeliveryDate, 'MMM d')}`
              : `Delivery ${format(order.scheduledDeliveryDate, 'MMM d')}`}
          </span>
          {order.estimatedDelivery && (
            <span className="text-wl-primary-400 font-medium">
              ETA: {order.estimatedDelivery}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
