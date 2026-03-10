"use client";

import { useState, useMemo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ColumnDefinition, SortConfig } from "./types";

interface DataTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyText?: string;
}

/**
 * Data table with sortable columns, pagination, and row hover highlight
 */
export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  pageSize = 10,
  onRowClick,
  loading = false,
  emptyText = "No data available",
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Sort data
  const sortedData = useMemo(() => {
    let sorted = [...data];

    if (sortConfig) {
      sorted.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        return 0;
      });
    }

    return sorted;
  }, [data, sortConfig]);

  // Paginate
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(0);
  };

  // Loading skeleton
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-wl-bg-surface rounded-md animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  // Empty state
  if (sortedData.length === 0) {
    return (
      <Card>
        <div className="p-12 text-center">
          <p className="text-sm text-wl-text-tertiary">{emptyText}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Header */}
            <thead>
              <tr className="border-b border-wl-border-subtle bg-wl-bg-surface">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      "px-4 py-3 text-left font-semibold text-wl-text-secondary",
                      "text-xs uppercase tracking-wider",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right"
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable !== false ? (
                      <button
                        onClick={() => handleSort(String(col.key))}
                        className={cn(
                          "inline-flex items-center gap-1",
                          "hover:text-wl-text-primary transition-colors",
                          sortConfig?.key === String(col.key) &&
                            "text-wl-primary-400"
                        )}
                      >
                        {col.label}
                        {sortConfig?.key === String(col.key) && (
                          <span className="text-xs">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {paginatedData.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={() => setHoveredRow(rowIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={cn(
                    "border-b border-wl-border-subtle",
                    "transition-colors duration-fast",
                    hoveredRow === rowIndex && "bg-wl-bg-surface",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const formatted = col.formatter
                      ? col.formatter(value)
                      : String(value ?? "");

                    return (
                      <td
                        key={String(col.key)}
                        className={cn(
                          "px-4 py-3 text-wl-text-primary",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-wl-text-tertiary">
            Showing {currentPage * pageSize + 1} to{" "}
            {Math.min((currentPage + 1) * pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </Button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                variant={currentPage === i ? "primary" : "ghost"}
                size="sm"
                onClick={() => setCurrentPage(i)}
              >
                {i + 1}
              </Button>
            ))}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
