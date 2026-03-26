'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

interface OrderCardProps {
  order: Order;
}

const statusConfig: Record<OrderStatus, {
  label: string;
  icon: LucideIcon;
  dotClass: string;
  badgeClass: string;
  accentClass: string;
  progressBarClass: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    dotClass: 'bg-wl-warning-500',
    badgeClass: 'status-pending',
    accentClass: 'card-accent-pending',
    progressBarClass: 'bg-wl-warning-500',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle2,
    dotClass: 'bg-wl-info-500',
    badgeClass: 'status-confirmed',
    accentClass: 'card-accent-confirmed',
    progressBarClass: 'bg-wl-info-500',
  },
  'out-for-delivery': {
    label: 'Out for Delivery',
    icon: Truck,
    dotClass: 'bg-wl-primary-500',
    badgeClass: 'status-active',
    accentClass: 'card-accent-active',
    progressBarClass: 'bg-wl-primary-500',
  },
  delivered: {
    label: 'Delivered',
    icon: PackageCheck,
    dotClass: 'bg-wl-success-500',
    badgeClass: 'status-delivered',
    accentClass: 'card-accent-delivered',
    progressBarClass: 'bg-wl-success-500',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    dotClass: 'bg-wl-danger-500',
    badgeClass: 'status-cancelled',
    accentClass: 'card-accent-cancelled',
    progressBarClass: 'bg-wl-danger-500',
  },
};

function getDeliveryProgress(order: Order): number {
  if (order.status !== 'out-for-delivery') {
    return 0;
  }
  if (order.deliveryProgress != null) {
    return Math.min(Math.max(order.deliveryProgress, 0), 100);
  }
  // Estimate progress from scheduled delivery time if no explicit progress
  return 50;
}

function getItemPreview(order: Order): string | null {
  const { items } = order;
  if (items.length === 0) {
    return null;
  }
  const firstTwo = items.slice(0, 2).map((item) => item.name);
  const remaining = items.length - firstTwo.length;
  const preview = firstTwo.join(', ');
  return remaining > 0 ? `${preview} +${remaining} more` : preview;
}

export function OrderCard({ order }: OrderCardProps) {
  const config = statusConfig[order.status];
  const StatusIcon = config.icon;
  const itemPreview = getItemPreview(order);
  const deliveryProgress = getDeliveryProgress(order);

  return (
    <Link href={`/orders/${order.id}`}>
      <div
        className={cn(
          'card-accent',
          config.accentClass,
          'cursor-pointer group',
          'transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/20'
        )}
      >
        {/* Top row: order number + status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-wl-text-primary truncate mono tabular-nums">
              {order.orderNumber}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">
              {format(order.createdAt, 'MMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('status-badge', config.badgeClass)}>
              <StatusIcon size={13} className="mr-1 -ml-0.5 flex-shrink-0" />
              {config.label}
            </span>
            <ChevronRight
              size={16}
              className="text-wl-text-tertiary group-hover:text-wl-text-secondary transition-colors"
            />
          </div>
        </div>

        {/* Delivery progress bar for out-for-delivery orders */}
        {order.status === 'out-for-delivery' && (
          <div className="mb-4">
            <div className="h-1 w-full rounded-full bg-wl-border-subtle overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  config.progressBarClass
                )}
                style={{ width: `${deliveryProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Details row */}
        <div className="flex items-center justify-between text-sm">
          <div className="min-w-0 flex-1 mr-3">
            <span className="text-wl-text-secondary">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </span>
            {itemPreview && (
              <p className="text-xs text-wl-text-tertiary mt-0.5 truncate">
                {itemPreview}
              </p>
            )}
          </div>
          <span className="font-semibold text-wl-text-primary mono tabular-nums flex-shrink-0">
            ${order.totalPrice.toFixed(2)}
          </span>
        </div>

        {/* Delivery info */}
        <div className="flex items-center justify-between text-xs text-wl-text-tertiary mt-3 pt-3 border-t border-wl-border-subtle">
          <span>
            {order.status === 'delivered' && order.actualDeliveryDate
              ? `Delivered ${format(order.actualDeliveryDate, 'MMM d')}`
              : `Delivery ${format(order.scheduledDeliveryDate, 'MMM d')}`}
          </span>
          {order.estimatedDelivery && (
            <span className="text-wl-primary-400 font-medium tabular-nums">
              ETA: {order.estimatedDelivery}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
