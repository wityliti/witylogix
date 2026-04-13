"use client";

import {
  useState,
  useMemo,
  useCallback,
  ReactNode,
  CSSProperties,
  useRef,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./checkbox";
import { Button } from "./button";
import { SkeletonTable } from "./skeleton-enhanced";
import {
  ChevronUp,
  ChevronDown,
  GripHorizontal,
  Eye,
  EyeOff,
  Download,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

export type SortDirection = "asc" | "desc" | null;
type TextAlign = "left" | "center" | "right";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (value: any, row: T) => ReactNode;
  width?: number;
  align?: TextAlign;
  sortable?: boolean;
  resizable?: boolean;
  visible?: boolean;
}

export interface DataTableProps<T extends { id?: string | number }> {
  columns: ColumnDef<T>[];
  data: T[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  onBulkAction?: (action: string, selectedIds: (string | number)[]) => void;
  onSort?: (columnId: string, direction: SortDirection) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  pagination?: {
    pageSize: number;
    onPageSizeChange?: (size: number) => void;
    onPageChange?: (page: number) => void;
    totalCount?: number;
    currentPage?: number;
  };
  className?: string;
  enableRowSelection?: boolean;
  enableBulkActions?: boolean;
  enableColumnVisibility?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id?: string | number }>({
  columns: initialColumns,
  data,
  onSelectionChange,
  onBulkAction,
  onSort,
  emptyMessage = "No data available",
  isLoading = false,
  pagination,
  className,
  enableRowSelection = true,
  enableBulkActions = true,
  enableColumnVisibility = true,
  enableSorting = true,
  enablePagination = true,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set()
  );
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(initialColumns.map((col) => col.id))
  );
  const [sortConfig, setSortConfig] = useState<{
    columnId: string;
    direction: SortDirection;
  }>({ columnId: "", direction: null });
  const [editingCell, setEditingCell] = useState<{
    rowId: string | number;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const displayColumns = useMemo(
    () => initialColumns.filter((col) => visibleColumns.has(col.id)),
    [initialColumns, visibleColumns]
  );

  const sortedData = useMemo(() => {
    let sorted = [...data];
    if (sortConfig.direction && sortConfig.columnId) {
      sorted.sort((a, b) => {
        const column = initialColumns.find((col) => col.id === sortConfig.columnId);
        if (!column || !column.accessorKey) return 0;

        const aVal = a[column.accessorKey];
        const bVal = b[column.accessorKey];

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
    }
    return sorted;
  }, [data, sortConfig, initialColumns]);

  const paginatedData = useMemo(() => {
    if (!enablePagination || !pagination) return sortedData;

    const start = ((pagination.currentPage || 1) - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, pagination, enablePagination]);

  const handleSort = useCallback(
    (columnId: string) => {
      let newDirection: SortDirection = "asc";
      if (sortConfig.columnId === columnId) {
        if (sortConfig.direction === "asc") {
          newDirection = "desc";
        } else if (sortConfig.direction === "desc") {
          newDirection = null;
        }
      }
      setSortConfig({ columnId, direction: newDirection });
      onSort?.(columnId, newDirection);
    },
    [sortConfig, onSort]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const newSelected = new Set<string | number>();
      if (checked) {
        paginatedData.forEach((row) => {
          if (row.id) newSelected.add(row.id);
        });
      }
      setSelectedRows(newSelected);
      onSelectionChange?.(Array.from(newSelected));
    },
    [paginatedData, onSelectionChange]
  );

  const handleSelectRow = useCallback(
    (rowId: string | number, checked: boolean) => {
      const newSelected = new Set(selectedRows);
      if (checked) {
        newSelected.add(rowId);
      } else {
        newSelected.delete(rowId);
      }
      setSelectedRows(newSelected);
      onSelectionChange?.(Array.from(newSelected));
    },
    [selectedRows, onSelectionChange]
  );

  const handleResizeStart = (
    columnId: string,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    setResizingColumn(columnId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnId] || 150;
  };

  const handleResizeMove = useCallback(
    (e: React.MouseEvent<HTMLTableElement>) => {
      if (!resizingColumn) return;
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    },
    [resizingColumn]
  );

  const handleResizeEnd = () => {
    setResizingColumn(null);
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => row.id && selectedRows.has(row.id));
  const isIndeterminate =
    selectedRows.size > 0 && selectedRows.size < paginatedData.length;

  if (isLoading) {
    return <SkeletonTable rows={5} columns={displayColumns.length} />;
  }

  if (data.length === 0) {
    return (
      <div className={cn("px-8 py-12 text-center text-wl-text-secondary", className)}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {enableBulkActions && selectedRows.size > 0 && (
        <div className="bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-wl-text-primary">
            {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onBulkAction?.("export", Array.from(selectedRows))
              }
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onBulkAction?.("delete", Array.from(selectedRows))}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div
        className="border border-wl-border-subtle rounded-lg overflow-hidden"
        onMouseMove={handleResizeMove}
        onMouseUp={handleResizeEnd}
        onMouseLeave={handleResizeEnd}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="bg-wl-bg-surface border-b border-wl-border-subtle sticky top-0 z-10">
                {enableRowSelection && (
                  <th className="px-4 py-3 w-12">
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={(e) =>
                        handleSelectAll((e.target as HTMLInputElement).checked)
                      }
                    />
                  </th>
                )}
                {displayColumns.map((column, idx) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wider",
                      "text-wl-text-secondary transition-colors duration-fast ease-default",
                      "border-b border-wl-border-subtle",
                      column.sortable && "cursor-pointer hover:text-wl-text-primary",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right"
                    )}
                    style={{
                      width: columnWidths[column.id],
                      userSelect: "none",
                    }}
                    onClick={() =>
                      column.sortable && enableSorting && handleSort(column.id)
                    }
                  >
                    <div className="flex items-center gap-2 justify-between group">
                      <span className="flex-1">{column.header}</span>
                      <div className="flex items-center gap-1">
                        {column.sortable && enableSorting && (
                          <div className="w-4 h-4 flex items-center justify-center">
                            {sortConfig.columnId === column.id &&
                              sortConfig.direction && (
                                <>
                                  {sortConfig.direction === "asc" ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </>
                              )}
                          </div>
                        )}
                        {column.resizable && idx !== displayColumns.length - 1 && (
                          <div
                            className={cn(
                              "w-1 h-4 bg-wl-border-subtle rounded opacity-0 group-hover:opacity-100",
                              "cursor-col-resize hover:bg-wl-primary-500 transition-colors",
                              resizingColumn === column.id && "opacity-100 bg-wl-primary-500"
                            )}
                            onMouseDown={(e) => handleResizeStart(column.id, e)}
                          />
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-wl-border-subtle">
              {paginatedData.map((row, rowIdx) => {
                const rowId = row.id;
                const isSelected = rowId && selectedRows.has(rowId);

                return (
                  <tr
                    key={rowId || rowIdx}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors duration-fast ease-default group",
                      isSelected && "bg-wl-primary-500/10",
                      !isSelected && rowIdx % 2 === 1 && "bg-wl-bg-surface",
                      onRowClick && !isSelected && "hover:bg-white/[0.02]",
                      onRowClick && "cursor-pointer",
                      rowClassName?.(row)
                    )}
                  >
                    {enableRowSelection && (
                      <td className="px-4 py-3 w-12">
                        <Checkbox
                          checked={isSelected || false}
                          onChange={(e) =>
                            rowId &&
                            handleSelectRow(
                              rowId,
                              (e.target as HTMLInputElement).checked
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {displayColumns.map((column) => {
                      const value =
                        column.accessorKey && row[column.accessorKey];
                      const rendered: import("react").ReactNode = column.cell
                        ? column.cell(value, row)
                        : (value as import("react").ReactNode);
                      const isEditing =
                        editingCell?.rowId === rowId &&
                        editingCell?.columnId === column.id;

                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "px-4 py-3 text-sm text-wl-text-primary",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right"
                          )}
                          style={{
                            width: columnWidths[column.id],
                          }}
                          onDoubleClick={() => {
                            setEditingCell({ rowId: rowId!, columnId: column.id });
                            setEditValue(String(value || ""));
                          }}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setEditingCell(null);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              onBlur={() => setEditingCell(null)}
                              className="w-full px-2 py-1 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
                            />
                          ) : (
                            rendered
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {enablePagination && pagination && (
        <div className="flex items-center justify-between px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface">
          <div className="flex items-center gap-2">
            <span className="text-xs text-wl-text-secondary">Show</span>
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                pagination.onPageSizeChange?.(Number(e.target.value))
              }
              className="px-2 py-1 text-xs border border-wl-border-default rounded bg-wl-bg-elevated text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs text-wl-text-secondary">entries</span>
          </div>

          <span className="text-xs text-wl-text-secondary">
            {pagination.totalCount
              ? `${((pagination.currentPage || 1) - 1) * pagination.pageSize + 1}-${Math.min((pagination.currentPage || 1) * pagination.pageSize, pagination.totalCount)} of ${pagination.totalCount}`
              : ""}
          </span>

          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={(pagination.currentPage || 1) === 1}
              onClick={() =>
                pagination.onPageChange?.((pagination.currentPage || 1) - 1)
              }
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={
                !pagination.totalCount ||
                (pagination.currentPage || 1) * pagination.pageSize >=
                  pagination.totalCount
              }
              onClick={() =>
                pagination.onPageChange?.((pagination.currentPage || 1) + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
