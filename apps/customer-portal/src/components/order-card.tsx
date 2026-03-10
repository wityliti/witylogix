'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

interface OrderCardProps {
  order: Order;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    bg: 'bg-wl-warning-bg',
    text: 'text-wl-warning-500',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-wl-info-bg',
    text: 'text-wl-info-500',
  },
  'out-for-delivery': {
    label: 'Out for Delivery',
    bg: 'bg-wl-primary-500/20',
    text: 'text-wl-primary-400',
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-wl-success-bg',
    text: 'text-wl-success-500',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-wl-danger-bg',
    text: 'text-wl-danger-500',
  },
};

export function OrderCard({ order }: OrderCardProps) {
  const config = statusConfig[order.status];

  return (
    <Link href={`/orders/${order.id}`}>
      <div
        className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'p-4 sm:p-6',
          'hover:border-wl-border-default hover:shadow-md',
          'transition-all duration-fast',
          'cursor-pointer'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-md flex-shrink-0',
              'bg-wl-primary-500/20 flex items-center justify-center'
            )}>
              <Package size={20} className="text-wl-primary-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-wl-text-primary truncate">
                Order #{order.orderNumber}
              </h3>
              <p className="text-xs text-wl-text-tertiary">
                {format(order.createdAt, 'PPP')}
              </p>
            </div>
          </div>

          <ChevronRight
            size={20}
            className="text-wl-text-tertiary flex-shrink-0 mt-1"
          />
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={cn(
            'inline-block px-3 py-1 rounded-full',
            'text-xs font-medium',
            config.bg,
            config.text
          )}>
            {config.label}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm mb-4">
          <div className="flex justify-between items-center">
            <span className="text-wl-text-secondary">Items:</span>
            <span className="text-wl-text-primary font-medium">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-wl-text-secondary">Scheduled Delivery:</span>
            <span className="text-wl-text-primary font-medium">
              {format(order.scheduledDeliveryDate, 'PPP')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-wl-text-secondary">Total:</span>
            <span className="text-wl-text-primary font-bold">
              ${order.totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ETA if available */}
        {order.estimatedDelivery && (
          <div className={cn(
            'text-xs p-3 rounded-md',
            'bg-wl-primary-500/10 text-wl-primary-400'
          )}>
            ETA: {order.estimatedDelivery}
          </div>
        )}
      </div>
    </Link>
  );
}
