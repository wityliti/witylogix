'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-wl-bg-elevated',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** Full-page loading spinner */
export function PageLoader() {
  return (
    <div className="page-container animate-fade-in flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-wl-text-secondary">Loading…</p>
      </div>
    </div>
  );
}

/** Card-level skeleton for an order/delivery card */
export function OrderCardSkeleton() {
  return (
    <div className="section-card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-3 w-40" />
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

/** Skeleton for a list of order cards */
export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Generic error message */
interface ErrorMessageProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="section-card flex flex-col items-center gap-3 py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-wl-error-500/10 flex items-center justify-center">
        <span className="text-wl-error-500 text-lg">!</span>
      </div>
      <p className="text-sm text-wl-text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-ghost text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

/** Empty state */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="section-card flex flex-col items-center gap-3 py-14 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-wl-bg-elevated flex items-center justify-center text-wl-text-tertiary">
          {icon}
        </div>
      )}
      <p className="font-semibold text-wl-text-primary">{title}</p>
      {description && (
        <p className="text-sm text-wl-text-secondary max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
