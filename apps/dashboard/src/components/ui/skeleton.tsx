"use client";

import { cn } from "../../lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-wl-bg-surface rounded", className)}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4 rounded", i === lines - 1 && "w-3/4")}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }[size];

  return <Skeleton className={cn("rounded-full", sizeClass, className)} />;
}

export function SkeletonRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-4 items-center", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-6 rounded", i === 0 && "w-12", i > 0 && "flex-1")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5 space-y-4",
        className,
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
        "border border-wl-border-subtle rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="bg-wl-bg-surface border-b border-wl-border-subtle p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 flex-1 rounded" />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-wl-border-subtle">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={`row-${rowIdx}`} className="p-4 flex gap-4">
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
