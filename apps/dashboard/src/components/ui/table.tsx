"use client";

import { type ReactNode, type CSSProperties, useState } from "react";
import { cn } from "../../lib/utils";

type SortDirection = "asc" | "desc" | null;
type TextAlign = "left" | "center" | "right";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  width?: string | number;
  align?: TextAlign;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  selectedId?: string;
  emptyMessage?: string;
  stickyHeader?: boolean;
  striped?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Table<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  selectedId,
  emptyMessage = "No data available",
  stickyHeader = true,
  striped = true,
  style,
  className,
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: SortDirection;
  }>({ key: "", direction: null });

  const handleSort = (columnKey: string) => {
    if (sortConfig.key === columnKey) {
      if (sortConfig.direction === "asc") {
        setSortConfig({ key: columnKey, direction: "desc" });
      } else if (sortConfig.direction === "desc") {
        setSortConfig({ key: columnKey, direction: null });
      }
    } else {
      setSortConfig({ key: columnKey, direction: "asc" });
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.direction || !sortConfig.key) return 0;

    const aVal = a[sortConfig.key as keyof T];
    const bVal = b[sortConfig.key as keyof T];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison = 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === "number" && typeof bVal === "number") {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  if (sortedData.length === 0) {
    return (
      <div
        className={cn("px-8 py-6 text-center text-wl-text-secondary", className)}
        style={style}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto border border-wl-border-subtle rounded-lg",
        className
      )}
      style={style}
    >
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr
            className={cn(
              "bg-wl-bg-surface border-b border-wl-border-subtle",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => column.sortable && handleSort(column.key)}
                className={cn(
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wider",
                  "text-wl-text-secondary transition-colors duration-fast ease-default",
                  column.sortable && "cursor-pointer hover:text-wl-text-primary"
                )}
                style={{
                  textAlign: column.align || "left",
                  width: column.width,
                  userSelect: "none",
                }}
              >
                <div
                  className={cn(
                    "flex items-center gap-2",
                    column.align === "center" && "justify-center",
                    column.align === "right" && "justify-end"
                  )}
                >
                  {column.header}
                  {column.sortable && sortConfig.key === column.key && (
                    <span className="text-xs inline-block transition-transform duration-fast">
                      {sortConfig.direction === "asc" ? (
                        <svg
                          className="w-3 h-3 inline"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M7 14l5-5 5 5z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3 inline"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M7 10l5 5 5-5z" />
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => {
            const rowId = (row as any).id;
            const isSelected = selectedId && rowId === selectedId;
            return (
              <tr
                key={rowId || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-wl-border-subtle transition-colors duration-fast ease-default group",
                  isSelected && "bg-wl-primary-500/10",
                  !isSelected && striped && rowIndex % 2 === 1 && "bg-wl-bg-surface",
                  onRowClick && !isSelected && "hover:bg-white/[0.02]",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((column) => {
                  const cellValue = row[column.key as keyof T];
                  const rendered = column.render ? column.render(row) : cellValue;
                  const isMonoContent =
                    typeof cellValue === "string" && /^[A-Za-z0-9_-]+$/.test(cellValue);

                  return (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3 text-sm text-wl-text-primary",
                        isMonoContent && "font-mono"
                      )}
                      style={{
                        textAlign: column.align || "left",
                        width: column.width,
                      }}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
