"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-breakpoint";

/**
 * Column priority system:
 * 1 = Always visible (all breakpoints)
 * 2 = Visible on tablet and desktop (768px+)
 * 3 = Desktop only (1024px+)
 */
export interface TableColumn {
  id: string;
  label: string;
  priority: 1 | 2 | 3;
  sortable?: boolean;
  render?: (value: any, row: Record<string, any>) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface ResponsiveTableProps {
  columns: TableColumn[];
  data: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (columnId: string) => void;
  className?: string;
  rowClassName?: string;
}

/**
 * Responsive data table component
 *
 * Desktop: Full table with all columns
 * Tablet: Priority columns with horizontal scroll
 * Mobile: Card-based layout with expandable details
 *
 * Features:
 * - Column priority system (1=always, 2=tablet+, 3=desktop)
 * - Sortable columns
 * - Sticky header
 * - Responsive layouts per breakpoint
 * - Touch-friendly on mobile
 *
 * @example
 * <ResponsiveTable
 *   columns={[
 *     { id: 'name', label: 'Name', priority: 1 },
 *     { id: 'email', label: 'Email', priority: 2 },
 *     { id: 'status', label: 'Status', priority: 3 },
 *   ]}
 *   data={tableData}
 *   sortBy="name"
 *   onSort={(columnId) => setSortBy(columnId)}
 * />
 */
export function ResponsiveTable({
  columns,
  data,
  onRowClick,
  sortBy,
  sortOrder = "asc",
  onSort,
  className,
  rowClassName,
}: ResponsiveTableProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Filter columns based on breakpoint
  const visibleColumns = useMemo(() => {
    if (isMobile) {
      return columns.filter((col) => col.priority === 1);
    }
    if (isTablet) {
      return columns.filter((col) => col.priority <= 2);
    }
    return columns;
  }, [columns, isMobile, isTablet]);

  if (isMobile) {
    return (
      <MobileTableView
        columns={visibleColumns}
        data={data}
        onRowClick={onRowClick}
        className={className}
      />
    );
  }

  if (isTablet) {
    return (
      <TabletTableView
        columns={visibleColumns}
        data={data}
        onRowClick={onRowClick}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        className={className}
        rowClassName={rowClassName}
      />
    );
  }

  return (
    <DesktopTableView
      columns={columns}
      data={data}
      onRowClick={onRowClick}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      className={className}
      rowClassName={rowClassName}
    />
  );
}

/**
 * Desktop table view with all columns
 */
function DesktopTableView({
  columns,
  data,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
  className,
  rowClassName,
}: ResponsiveTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr
            className={cn(
              "border-b border-wl-border-default",
              "bg-wl-bg-elevated/50",
              "sticky top-0 z-10",
            )}
          >
            {columns.map((col) => (
              <th
                key={col.id}
                onClick={() => col.sortable && onSort?.(col.id)}
                className={cn(
                  "px-4 py-3",
                  "text-left text-sm font-semibold",
                  "text-wl-text-secondary",
                  "whitespace-nowrap",
                  col.align === "center" && "text-center",
                  col.align === "right" && "text-right",
                  col.sortable && "cursor-pointer hover:text-wl-text-primary",
                )}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {col.sortable && sortBy === col.id && (
                    <svg
                      className={cn(
                        "w-4 h-4",
                        "transition-transform",
                        sortOrder === "desc" && "rotate-180",
                      )}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-wl-border-subtle",
                "hover:bg-wl-bg-elevated/50",
                "transition-colors duration-150",
                onRowClick && "cursor-pointer",
                rowClassName,
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    "px-4 py-3",
                    "text-sm text-wl-text-primary",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.render?.(row[col.id], row) ?? row[col.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tablet table view with horizontal scroll
 */
function TabletTableView(props: ResponsiveTableProps) {
  return (
    <div className={cn("overflow-x-auto", props.className)}>
      <div className="inline-block min-w-full">
        <table className="w-full">
          <thead>
            <tr
              className={cn(
                "border-b border-wl-border-default",
                "bg-wl-bg-elevated/50",
                "sticky top-0 z-10",
              )}
            >
              {props.columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "px-3 py-2.5",
                    "text-left text-xs font-semibold uppercase",
                    "text-wl-text-secondary",
                    "whitespace-nowrap",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => props.onRowClick?.(row)}
                className={cn(
                  "border-b border-wl-border-subtle",
                  "hover:bg-wl-bg-elevated/50",
                  "transition-colors",
                  props.onRowClick && "cursor-pointer",
                  props.rowClassName,
                )}
              >
                {props.columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-3 py-2.5",
                      "text-sm text-wl-text-primary",
                      "whitespace-nowrap",
                    )}
                  >
                    {col.render?.(row[col.id], row) ?? row[col.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Mobile table view as card-based layout
 */
function MobileTableView({
  columns,
  data,
  onRowClick,
  className,
}: ResponsiveTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const allColumns = useMemo(() => {
    // For mobile, get the primary column for display
    return columns;
  }, [columns]);

  return (
    <div className={cn("space-y-3 p-4", className)}>
      {data.map((row, idx) => (
        <div
          key={idx}
          onClick={() => {
            onRowClick?.(row);
            setExpandedId(expandedId === idx ? null : idx);
          }}
          className={cn(
            "p-4",
            "bg-wl-bg-elevated",
            "border border-wl-border-subtle",
            "rounded-lg",
            "transition-all duration-200",
            onRowClick && "cursor-pointer",
            "active:bg-wl-bg-overlay",
          )}
        >
          {/* Primary column (always visible) */}
          <div className="flex justify-between items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {allColumns[0] && (
                <div className="text-sm font-semibold text-wl-text-primary truncate">
                  {allColumns[0].render?.(row[allColumns[0].id], row) ??
                    row[allColumns[0].id]}
                </div>
              )}
            </div>
            {allColumns.length > 1 && (
              <button
                className={cn(
                  "flex-shrink-0",
                  "text-wl-text-secondary hover:text-wl-text-primary",
                  "transition-transform duration-200",
                  expandedId === idx && "rotate-180",
                )}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
            )}
          </div>

          {/* Additional columns (expandable) */}
          {expandedId === idx && allColumns.length > 1 && (
            <div className="space-y-2 pt-3 border-t border-wl-border-subtle">
              {allColumns.slice(1).map((col) => (
                <div key={col.id} className="text-xs">
                  <div className="text-wl-text-tertiary">{col.label}</div>
                  <div className="text-wl-text-primary mt-0.5">
                    {col.render?.(row[col.id], row) ?? row[col.id]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
