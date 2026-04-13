"use client";

import { useState, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import {
  Search,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  Grid3x3,
  List,
  Layers,
} from "lucide-react";

export type ViewMode = "table" | "grid" | "compact";

interface Column {
  id: string;
  header: string;
}

export interface DataTableToolbarProps {
  columns: Column[];
  visibleColumns: Set<string>;
  onVisibleColumnsChange?: (visible: Set<string>) => void;
  onSearch?: (query: string) => void;
  onExport?: (format: "csv" | "json" | "clipboard") => void;
  onRefresh?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  isLoading?: boolean;
  selectedCount?: number;
  className?: string;
}

export function DataTableToolbar({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  onSearch,
  onExport,
  onRefresh,
  viewMode = "table",
  onViewModeChange,
  isLoading = false,
  selectedCount = 0,
  className,
}: DataTableToolbarProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch]
  );

  const toggleColumnVisibility = (columnId: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId);
    } else {
      newVisible.add(columnId);
    }
    onVisibleColumnsChange?.(newVisible);
  };

  const handleExport = (format: "csv" | "json" | "clipboard") => {
    onExport?.(format);
  };

  const visibleCount = visibleColumns.size;
  const totalCount = columns.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        "px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface",
        className
      )}
    >
      {/* Left side: Search and selected count */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 flex-1">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 py-2 text-sm"
          />
        </div>

        {selectedCount > 0 && (
          <span className="text-xs text-wl-text-secondary whitespace-nowrap">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap justify-end">
        {/* View mode toggle */}
        <div className="flex border border-wl-border-subtle rounded-md overflow-hidden">
          <button
            onClick={() => onViewModeChange?.("table")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-wl-primary-500 text-wl-text-inverse"
                : "bg-transparent text-wl-text-secondary hover:text-wl-text-primary"
            )}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange?.("grid")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-l border-wl-border-subtle",
              viewMode === "grid"
                ? "bg-wl-primary-500 text-wl-text-inverse"
                : "bg-transparent text-wl-text-secondary hover:text-wl-text-primary"
            )}
            title="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange?.("compact")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-l border-wl-border-subtle",
              viewMode === "compact"
                ? "bg-wl-primary-500 text-wl-text-inverse"
                : "bg-transparent text-wl-text-secondary hover:text-wl-text-primary"
            )}
            title="Compact view"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Column visibility dropdown */}
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            title="Toggle column visibility"
          >
            <Eye className="w-4 h-4" />
            <span className="text-xs">
              {visibleCount}/{totalCount}
            </span>
          </Button>

          {showColumnMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
              <div className="p-2 space-y-1">
                {columns.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 px-3 py-2 rounded hover:bg-wl-bg-surface cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(column.id)}
                      onChange={() => toggleColumnVisibility(column.id)}
                      className="w-4 h-4 rounded border-wl-border-default accent-wl-primary-500"
                    />
                    <span className="text-wl-text-primary">{column.header}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport?.("csv")}
            title="Export data"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Export</span>
          </Button>
          {/* Export menu could be expanded here */}
        </div>

        {/* Refresh button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRefresh?.()}
          disabled={isLoading}
          title="Refresh data"
        >
          <RotateCcw
            className={cn("w-4 h-4", isLoading && "animate-spin")}
          />
          <span className="text-xs hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  );
}
