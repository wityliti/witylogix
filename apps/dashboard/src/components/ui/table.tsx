"use client";

import { type ReactNode, type CSSProperties, useState } from "react";

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
        style={{
          padding: "var(--wl-space-8)",
          textAlign: "center",
          color: "var(--wl-text-secondary)",
          ...style,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid var(--wl-border-subtle)",
        borderRadius: "var(--wl-radius-lg)",
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--wl-font-sans)",
          fontSize: "var(--wl-text-sm)",
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--wl-bg-surface)",
              borderBottom: "1px solid var(--wl-border-subtle)",
              ...(stickyHeader
                ? {
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                  }
                : {}),
            }}
          >
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => column.sortable && handleSort(column.key)}
                style={{
                  padding: "var(--wl-space-3) var(--wl-space-4)",
                  textAlign: column.align || "left",
                  color: "var(--wl-text-secondary)",
                  fontWeight: 600,
                  fontSize: "var(--wl-text-xs)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  cursor: column.sortable ? "pointer" : undefined,
                  userSelect: "none",
                  width: column.width,
                  transition: `color var(--wl-duration-fast) var(--wl-ease-default)`,
                }}
                onMouseEnter={(e) => {
                  if (column.sortable) {
                    e.currentTarget.style.color = "var(--wl-text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (column.sortable) {
                    e.currentTarget.style.color = "var(--wl-text-secondary)";
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--wl-space-2)",
                    justifyContent: column.align === "center" ? "center" : column.align === "right" ? "flex-end" : "flex-start",
                  }}
                >
                  {column.header}
                  {column.sortable && sortConfig.key === column.key && (
                    <span style={{ fontSize: "10px" }}>
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
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
                style={{
                  background:
                    isSelected
                      ? "rgba(245, 166, 35, 0.08)"
                      : striped && rowIndex % 2 === 1
                        ? "var(--wl-bg-surface)"
                        : "transparent",
                  borderBottom: "1px solid var(--wl-border-subtle)",
                  cursor: onRowClick ? "pointer" : undefined,
                  transition: `background-color var(--wl-duration-fast) var(--wl-ease-default)`,
                }}
                onMouseEnter={(e) => {
                  if (onRowClick && !isSelected) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.background = isSelected
                      ? "rgba(245, 166, 35, 0.08)"
                      : striped && rowIndex % 2 === 1
                        ? "var(--wl-bg-surface)"
                        : "transparent";
                  }
                }}
              >
                {columns.map((column) => {
                  const cellValue = row[column.key as keyof T];
                  const rendered = column.render ? column.render(row) : cellValue;
                  const isMonoContent = typeof cellValue === "string" && /^[A-Za-z0-9_-]+$/.test(cellValue);

                  return (
                    <td
                      key={column.key}
                      style={{
                        padding: "var(--wl-space-3) var(--wl-space-4)",
                        textAlign: column.align || "left",
                        color: "var(--wl-text-primary)",
                        fontFamily: isMonoContent ? "var(--wl-font-mono)" : "var(--wl-font-sans)",
                        fontSize: "var(--wl-text-sm)",
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
