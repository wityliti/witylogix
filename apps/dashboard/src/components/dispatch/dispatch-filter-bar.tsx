"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type OrderStatus = "all" | "pending" | "in-transit" | "delivered";
export type SortOption = "time" | "distance" | "priority";
export type ViewMode = "map" | "list" | "timeline";

export interface DispatchFilterBarProps {
  onSearchChange?: (search: string) => void;
  onStatusChange?: (status: OrderStatus) => void;
  onSortChange?: (sort: SortOption) => void;
  onViewChange?: (view: ViewMode) => void;
  className?: string;
}

const statusOptions: Array<{ value: OrderStatus; label: string; icon: string }> = [
  { value: "all", label: "All Orders", icon: "📦" },
  { value: "pending", label: "Pending", icon: "⏳" },
  { value: "in-transit", label: "In Transit", icon: "🚚" },
  { value: "delivered", label: "Delivered", icon: "✓" },
];

const sortOptions: Array<{ value: SortOption; label: string; icon: string }> = [
  { value: "time", label: "By Time", icon: "⏰" },
  { value: "distance", label: "By Distance", icon: "📍" },
  { value: "priority", label: "By Priority", icon: "⭐" },
];

const viewOptions: Array<{ value: ViewMode; label: string; icon: string }> = [
  { value: "map", label: "Map", icon: "🗺️" },
  { value: "list", label: "List", icon: "📋" },
  { value: "timeline", label: "Timeline", icon: "📊" },
];

export function DispatchFilterBar({
  onSearchChange,
  onStatusChange,
  onSortChange,
  onViewChange,
  className,
}: DispatchFilterBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("all");
  const [selectedSort, setSelectedSort] = useState<SortOption>("time");
  const [selectedView, setSelectedView] = useState<ViewMode>("map");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const handleStatusChange = (status: OrderStatus) => {
    setSelectedStatus(status);
    onStatusChange?.(status);
  };

  const handleSortChange = (sort: SortOption) => {
    setSelectedSort(sort);
    onSortChange?.(sort);
  };

  const handleViewChange = (view: ViewMode) => {
    setSelectedView(view);
    onViewChange?.(view);
  };

  return (
    <div
      className={cn(
        "space-y-3 p-4 bg-wl-bg-secondary rounded-lg border border-wl-border-subtle",
        className
      )}
    >
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search order ID, customer name, address..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg",
            "bg-wl-bg-elevated border border-wl-border-default",
            "text-wl-text-primary placeholder:text-wl-text-tertiary",
            "focus:outline-none focus:ring-2 focus:ring-wl-primary-500 focus:border-transparent",
            "transition-all duration-200"
          )}
          aria-label="Search orders"
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-wl-text-tertiary">
          🔍
        </span>
      </div>

      {/* Filter, Sort, and View controls */}
      <div className="flex gap-2 flex-wrap">
        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => setExpandedSection(expandedSection === "status" ? null : "status")}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium",
              "bg-wl-bg-elevated border border-wl-border-default",
              "text-wl-text-secondary hover:text-wl-text-primary",
              "transition-all duration-200",
              expandedSection === "status" && "ring-2 ring-wl-primary-500"
            )}
            aria-haspopup="menu"
            aria-expanded={expandedSection === "status"}
          >
            📊 Status
          </button>

          {expandedSection === "status" && (
            <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg shadow-lg z-20 min-w-40">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    handleStatusChange(option.value);
                    setExpandedSection(null);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm",
                    "border-b border-wl-border-subtle last:border-b-0",
                    "hover:bg-wl-bg-secondary transition-colors",
                    selectedStatus === option.value && "bg-wl-primary-100 dark:bg-wl-primary-900"
                  )}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort option */}
        <div className="relative">
          <button
            onClick={() => setExpandedSection(expandedSection === "sort" ? null : "sort")}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium",
              "bg-wl-bg-elevated border border-wl-border-default",
              "text-wl-text-secondary hover:text-wl-text-primary",
              "transition-all duration-200",
              expandedSection === "sort" && "ring-2 ring-wl-primary-500"
            )}
            aria-haspopup="menu"
            aria-expanded={expandedSection === "sort"}
          >
            🔀 Sort
          </button>

          {expandedSection === "sort" && (
            <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg shadow-lg z-20 min-w-40">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    handleSortChange(option.value);
                    setExpandedSection(null);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm",
                    "border-b border-wl-border-subtle last:border-b-0",
                    "hover:bg-wl-bg-secondary transition-colors",
                    selectedSort === option.value && "bg-wl-primary-100 dark:bg-wl-primary-900"
                  )}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-wl-bg-elevated border border-wl-border-default rounded-lg p-1">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleViewChange(option.value)}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium",
                "transition-all duration-200",
                selectedView === option.value
                  ? "bg-wl-primary-500 text-white shadow-sm"
                  : "text-wl-text-secondary hover:text-wl-text-primary"
              )}
              aria-pressed={selectedView === option.value}
              title={option.label}
            >
              {option.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Active filters summary */}
      {(searchValue || selectedStatus !== "all") && (
        <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
          <span>Active filters:</span>
          {searchValue && (
            <span className="bg-wl-primary-100 dark:bg-wl-primary-900 text-wl-primary-700 dark:text-wl-primary-200 px-2 py-1 rounded">
              Search: {searchValue}
            </span>
          )}
          {selectedStatus !== "all" && (
            <span className="bg-wl-primary-100 dark:bg-wl-primary-900 text-wl-primary-700 dark:text-wl-primary-200 px-2 py-1 rounded">
              {statusOptions.find((s) => s.value === selectedStatus)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
