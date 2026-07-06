"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useBreakpoint,
  type Breakpoint,
  BREAKPOINTS,
} from "@/hooks/use-breakpoint";

interface GridConfig {
  /** Minimum column width in pixels */
  minWidth?: number;
  /** Gap between grid items in rem or px */
  gap?: string | number;
  /** Enable masonry layout */
  masonry?: boolean;
}

interface ResponsiveGridProps extends GridConfig {
  children: React.ReactNode;
  className?: string;
  /** Custom column counts per breakpoint */
  columns?: Partial<Record<Breakpoint, number>>;
  /** Custom gap per breakpoint */
  gaps?: Partial<Record<Breakpoint, string | number>>;
}

const DEFAULT_COLUMNS: Record<Breakpoint, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  "2xl": 4,
};

const DEFAULT_GAP = "1rem";

/**
 * Responsive grid system with auto-responsive columns
 *
 * Features:
 * - Auto-responsive grid using CSS Grid minmax
 * - Breakpoint-specific column counts
 * - Gap control per breakpoint
 * - Masonry layout option
 * - Mobile-first approach
 *
 * @example
 * <ResponsiveGrid
 *   columns={{ sm: 1, md: 2, lg: 3 }}
 *   gap="1rem"
 * >
 *   <GridItem />
 *   <GridItem />
 * </ResponsiveGrid>
 */
export function ResponsiveGrid({
  children,
  minWidth = 280,
  gap = DEFAULT_GAP,
  masonry = false,
  columns: customColumns,
  gaps: customGaps,
  className,
}: ResponsiveGridProps) {
  const breakpoint = useBreakpoint();

  const columnCount =
    customColumns?.[breakpoint] ?? DEFAULT_COLUMNS[breakpoint];
  const currentGap = customGaps?.[breakpoint] ?? gap;

  const gridStyle = useMemo(() => {
    const gapValue =
      typeof currentGap === "number" ? `${currentGap}rem` : currentGap;

    if (masonry) {
      return {
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: gapValue,
        gridAutoRows: "max-content",
      } as React.CSSProperties;
    }

    return {
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
      gap: gapValue,
      alignItems: "start",
    } as React.CSSProperties;
  }, [columnCount, minWidth, masonry, currentGap]);

  return (
    <div
      style={gridStyle}
      className={cn("w-full", masonry && "auto-rows-min", className)}
    >
      {children}
    </div>
  );
}

interface GridItemProps {
  span?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Grid item component with optional spanning
 *
 * @example
 * <GridItem span={2}>
 *   <Card />
 * </GridItem>
 */
export function GridItem({ span = 1, className, children }: GridItemProps) {
  return (
    <div
      style={{
        gridColumn: `span ${Math.min(span, 4)}`,
      }}
      className={cn("min-w-0", "transition-all duration-200", className)}
    >
      {children}
    </div>
  );
}

/**
 * Hook to get current column count for custom layout calculations
 *
 * @example
 * const cols = useGridColumns({ sm: 1, md: 2 });
 */
export function useGridColumns(
  customColumns?: Partial<Record<Breakpoint, number>>,
): number {
  const breakpoint = useBreakpoint();
  return customColumns?.[breakpoint] ?? DEFAULT_COLUMNS[breakpoint];
}

interface AutoGridProps {
  children: React.ReactNode;
  minWidth?: number;
  gap?: string | number;
  className?: string;
}

/**
 * Simple auto-responsive grid with consistent behavior
 * Uses CSS Grid's auto-fit for responsive columns
 *
 * @example
 * <AutoGrid minWidth={280} gap="1rem">
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </AutoGrid>
 */
export function AutoGrid({
  children,
  minWidth = 280,
  gap = DEFAULT_GAP,
  className,
}: AutoGridProps) {
  const gapValue = typeof gap === "number" ? `${gap}rem` : gap;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap: gapValue,
      }}
      className={cn("w-full", className)}
    >
      {children}
    </div>
  );
}

/**
 * Masonry grid layout with responsive columns
 *
 * @example
 * <MasonryGrid columns={{ sm: 1, md: 2, lg: 3 }} gap="1.5rem">
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </MasonryGrid>
 */
export function MasonryGrid({
  children,
  columns: customColumns,
  gap = DEFAULT_GAP,
  className,
}: ResponsiveGridProps) {
  const breakpoint = useBreakpoint();
  const columnCount =
    customColumns?.[breakpoint] ?? DEFAULT_COLUMNS[breakpoint];
  const gapValue = typeof gap === "number" ? `${gap}rem` : gap;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: gapValue,
        gridAutoRows: "max-content",
      }}
      className={cn("w-full", className)}
    >
      {children}
    </div>
  );
}
