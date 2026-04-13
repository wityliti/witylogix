"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circle" | "rect" | "card";
  /** Alias for variant */
  type?: "text" | "circle" | "rect" | "card" | "list" | "table" | "form";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rect",
  type,
  width,
  height,
  className,
  ...props
}: SkeletonProps) {
  const effectiveVariant = variant ?? (type && ["text", "circle", "rect", "card"].includes(type) ? type as "text" | "circle" | "rect" | "card" : "rect");
  const baseClasses = "animate-pulse bg-gradient-to-r from-wl-bg-surface via-wl-bg-elevated to-wl-bg-surface";

  const variantClasses = {
    text: "h-4 rounded",
    circle: "rounded-full aspect-square",
    rect: "rounded-md",
    card: "rounded-lg",
  };

  const widthClass = width ? (typeof width === "number" ? `w-[${width}px]` : `w-${width}`) : "w-full";
  const heightClass = height ? (typeof height === "number" ? `h-[${height}px]` : `h-${height}`) : "h-6";

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[effectiveVariant],
        effectiveVariant !== "circle" && widthClass,
        effectiveVariant !== "circle" && heightClass,
        effectiveVariant === "circle" && (width || "w-12"),
        className
      )}
      {...props}
    />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="bg-wl-bg-surface border-b border-wl-border-subtle p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              variant="text"
              className="h-4 flex-1"
            />
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
                variant="text"
                className="h-5 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Alias for pages that import LoadingSkeleton directly
export const LoadingSkeleton = Skeleton;

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5 space-y-4",
        className
      )}
    >
      <Skeleton variant="text" className="h-6 w-1/3" />
      <Skeleton variant="rect" className="h-12 w-full" />
      <div className="space-y-2">
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="text" className="h-3 w-5/6" />
      </div>
    </div>
  );
}
