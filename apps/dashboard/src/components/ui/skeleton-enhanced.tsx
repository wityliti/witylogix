'use client';

import { cn } from '../../lib/utils';

/**
 * Base skeleton component with shimmer animation
 * @param className - Additional CSS classes
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse bg-wl-bg-surface rounded relative overflow-hidden',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-wl-bg-elevated before:to-transparent',
        'before:animate-shimmer',
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton text lines component
 * @param lines - Number of text lines to display
 * @param widths - Optional array of width classes for each line
 * @param className - Additional CSS classes
 */
export function SkeletonText({
  lines = 1,
  widths,
  className,
}: {
  lines?: number;
  widths?: string[];
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4 rounded',
            widths?.[i] || (i === lines - 1 ? 'w-3/4' : 'w-full')
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton card component with header and content
 * @param className - Additional CSS classes
 */
export function SkeletonCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5 space-y-4',
        className
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-8 w-2/3 rounded" />
      </div>
      <Skeleton className="h-12 rounded" />
      <div className="space-y-2">
        <Skeleton className="h-3 rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton table component
 * @param rows - Number of table rows
 * @param columns - Number of table columns
 * @param className - Additional CSS classes
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="bg-wl-bg-surface border-b border-wl-border-subtle p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className="h-4 flex-1 rounded"
            />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-wl-border-subtle">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={`row-${rowIdx}`}
            className="p-4 flex gap-4"
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={`cell-${rowIdx}-${colIdx}`}
                className="h-5 flex-1 rounded"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton avatar component
 * @param size - Avatar size (sm, md, lg, xl)
 * @param className - Additional CSS classes
 */
export function SkeletonAvatar({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  return (
    <Skeleton
      className={cn(
        'rounded-full',
        sizeClass,
        className
      )}
    />
  );
}

/**
 * Skeleton chart component for dashboard metrics
 * @param className - Additional CSS classes
 */
export function SkeletonChart({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5 space-y-4',
        className
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-6 w-1/2 rounded" />
      </div>
      <div className="space-y-3 h-48">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-2 h-12 rounded-sm flex-shrink-0" />
            <Skeleton className="h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton row component for list items
 * @param columns - Number of columns in the row
 * @param className - Additional CSS classes
 */
export function SkeletonRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-4 items-center', className)}>
      <SkeletonAvatar size="md" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4 rounded',
            i === columns - 2 ? 'w-1/4' : 'flex-1'
          )}
        />
      ))}
    </div>
  );
}
