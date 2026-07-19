'use client';

import { forwardRef, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PlatformLogo, type Platform } from './platform-logo';

type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type SyncStatus = 'synced' | 'pending' | 'conflict';

interface OrderLineItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

interface UnifiedOrderCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Order unique identifier */
  orderId: string;
  /** E-commerce platform */
  platform: Platform;
  /** Order creation date */
  orderDate: Date;
  /** Customer name */
  customerName: string;
  /** Order total amount */
  totalAmount: number;
  /** Currency code (e.g., 'USD') */
  currency?: string;
  /** Order status */
  status?: OrderStatus;
  /** Line items in the order */
  lineItems: OrderLineItem[];
  /** Sync status */
  syncStatus?: SyncStatus;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Callback when view is clicked */
  onView?: () => void;
  /** Callback when sync is clicked */
  onSync?: () => void;
  /** Callback when track is clicked */
  onTrack?: () => void;
}

const statusConfig: Record<
  OrderStatus,
  {
    bgColor: string;
    textColor: string;
    label: string;
  }
> = {
  pending: {
    bgColor: 'bg-wl-warning-bg',
    textColor: 'text-wl-warning-500',
    label: 'Pending',
  },
  processing: {
    bgColor: 'bg-wl-info-bg',
    textColor: 'text-wl-info-500',
    label: 'Processing',
  },
  shipped: {
    bgColor: 'bg-wl-primary-500/20',
    textColor: 'text-wl-primary-500',
    label: 'Shipped',
  },
  delivered: {
    bgColor: 'bg-wl-success-bg',
    textColor: 'text-wl-success-600',
    label: 'Delivered',
  },
  cancelled: {
    bgColor: 'bg-wl-danger-bg',
    textColor: 'text-wl-danger-600',
    label: 'Cancelled',
  },
  refunded: {
    bgColor: 'bg-wl-bg-surface dark:bg-wl-neutral-500/20',
    textColor: 'text-wl-text-primary dark:text-wl-text-secondary',
    label: 'Refunded',
  },
};

const syncStatusConfig: Record<
  SyncStatus,
  {
    icon: React.ComponentType<any>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  synced: {
    icon: CheckCircle2,
    color: 'text-wl-success-600',
    bgColor: 'bg-wl-success-bg',
    label: 'Synced',
  },
  pending: {
    icon: Clock,
    color: 'text-wl-warning-500',
    bgColor: 'bg-wl-warning-bg',
    label: 'Pending Sync',
  },
  conflict: {
    icon: AlertCircle,
    color: 'text-wl-danger-600',
    bgColor: 'bg-wl-danger-bg',
    label: 'Conflict',
  },
};

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

/**
 * Unified order card displaying order information across all e-commerce platforms
 *
 * @example
 * ```tsx
 * <UnifiedOrderCard
 *   orderId="ORD-12345"
 *   platform="shopify"
 *   orderDate={new Date()}
 *   customerName="John Doe"
 *   totalAmount={299.99}
 *   status="processing"
 *   lineItems={[...]}
 *   syncStatus="synced"
 *   onView={() => handleView()}
 * />
 * ```
 */
const UnifiedOrderCard = forwardRef<HTMLDivElement, UnifiedOrderCardProps>(
  (
    {
      orderId,
      platform,
      orderDate,
      customerName,
      totalAmount,
      currency = 'USD',
      status = 'pending',
      lineItems,
      syncStatus = 'synced',
      lastSyncAt,
      onView,
      onSync,
      onTrack,
      className,
      ...props
    },
    ref
  ) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const statusInfo = statusConfig[status];
    const syncInfo = syncStatusConfig[syncStatus];
    const SyncIcon = syncInfo.icon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col',
          'bg-white dark:bg-wl-bg-surface',
          'border border-wl-border-subtle',
          'rounded-lg overflow-hidden',
          'transition-all duration-200 ease-default',
          'hover:shadow-md dark:hover:shadow-lg',
          isExpanded && 'shadow-md dark:shadow-lg',
          className
        )}
        {...props}
      >
        {/* Card header - clickable to expand */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full p-4 text-left',
            'hover:bg-wl-bg-surface dark:hover:bg-wl-bg-elevated/50',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
          )}
          aria-expanded={isExpanded}
        >
          <div className="flex items-start gap-4">
            {/* Platform badge */}
            <div className="flex items-center gap-2 pt-0.5">
              <PlatformLogo platform={platform} size="sm" showFallback />
              <span className="text-xs font-semibold text-wl-text-tertiary dark:text-wl-text-secondary uppercase">
                {platform}
              </span>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="text-sm font-semibold text-wl-text-primary dark:text-white truncate">
                  {orderId}
                </h3>
                <span className="text-xs text-wl-text-tertiary dark:text-wl-text-tertiary">
                  {formatDate(orderDate)}
                </span>
              </div>
              <p className="text-xs text-wl-text-tertiary dark:text-wl-text-secondary mb-2">
                {customerName}
              </p>

              {/* Row with status badges and amount */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status badge */}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      'px-2 py-1 rounded text-xs font-semibold',
                      statusInfo.bgColor,
                      statusInfo.textColor
                    )}
                  >
                    {statusInfo.label}
                  </span>

                  {/* Item count */}
                  <span className="text-xs text-wl-text-tertiary dark:text-wl-text-secondary">
                    <Package className="w-3 h-3 inline mr-1" />
                    {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Expand/collapse indicator */}
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-wl-text-secondary dark:text-wl-text-tertiary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-wl-text-secondary dark:text-wl-text-tertiary" />
                  )}
                </div>
              </div>
            </div>

            {/* Total amount */}
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-wl-text-primary dark:text-white">
                {formatCurrency(totalAmount, currency)}
              </div>
              <SyncIcon
                className={cn('w-4 h-4 mt-1 ml-auto', syncInfo.color)}
                title={syncInfo.label}
                aria-label={`Sync status: ${syncInfo.label}`}
              />
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div
            className="border-t border-wl-border-subtle p-4 space-y-4"
            role="region"
            aria-label="Order details"
          >
            {/* Sync status section */}
            <div
              className={cn(
                'flex items-start gap-2 p-2 rounded',
                syncInfo.bgColor
              )}
            >
              <SyncIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', syncInfo.color)} />
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-semibold', syncInfo.color)}>
                  {syncInfo.label}
                </div>
                {lastSyncAt && (
                  <div className={cn('text-xs', syncInfo.color, 'opacity-75')}>
                    {formatTime(lastSyncAt)}
                  </div>
                )}
              </div>
            </div>

            {/* Line items preview */}
            <div>
              <h4 className="text-xs font-semibold text-wl-text-primary dark:text-wl-neutral-300 mb-2 uppercase">
                Items ({lineItems.length})
              </h4>
              <div className="space-y-1">
                {lineItems.slice(0, 3).map((item, idx) => (
                  <div
                    key={`${item.sku}-${idx}`}
                    className="text-xs p-2 bg-wl-bg-surface dark:bg-wl-bg-elevated/50 rounded flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-wl-text-primary dark:text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-wl-text-tertiary dark:text-wl-text-secondary">
                        SKU: {item.sku}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="font-semibold text-wl-text-primary dark:text-white">
                        ×{item.quantity}
                      </div>
                      <div className="text-wl-text-tertiary dark:text-wl-text-secondary">
                        {formatCurrency(item.price, currency)}
                      </div>
                    </div>
                  </div>
                ))}
                {lineItems.length > 3 && (
                  <div className="text-xs text-wl-text-tertiary dark:text-wl-text-secondary p-2">
                    +{lineItems.length - 3} more item{lineItems.length - 3 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Order total */}
            <div className="pt-2 border-t border-wl-border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-wl-text-primary dark:text-wl-neutral-300">
                  Total
                </span>
                <span className="text-lg font-bold text-wl-text-primary dark:text-white">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onView}
                disabled={!onView}
                className={cn(
                  'flex items-center justify-center gap-1.5',
                  'flex-1 px-3 py-2 text-xs font-semibold rounded',
                  'bg-wl-primary-500 text-wl-text-inverse',
                  'hover:bg-wl-primary-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>

              <button
                onClick={onSync}
                disabled={!onSync}
                className={cn(
                  'flex items-center justify-center gap-1.5',
                  'flex-1 px-3 py-2 text-xs font-semibold rounded',
                  'bg-wl-neutral-200 dark:bg-wl-bg-overlay text-wl-text-primary dark:text-white',
                  'hover:bg-wl-bg-overlay',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150'
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync
              </button>

              <button
                onClick={onTrack}
                disabled={!onTrack || !['shipped', 'delivered'].includes(status)}
                className={cn(
                  'flex items-center justify-center gap-1.5',
                  'flex-1 px-3 py-2 text-xs font-semibold rounded',
                  'bg-wl-neutral-200 dark:bg-wl-bg-overlay text-wl-text-primary dark:text-white',
                  'hover:bg-wl-bg-overlay',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150'
                )}
              >
                <Package className="w-3.5 h-3.5" />
                Track
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

UnifiedOrderCard.displayName = 'UnifiedOrderCard';

export { UnifiedOrderCard };
export type {
  OrderStatus,
  SyncStatus,
  OrderLineItem,
};
