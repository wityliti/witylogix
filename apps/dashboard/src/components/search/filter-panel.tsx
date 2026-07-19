/**
 * Filter Panel — Collapsible sidebar for advanced filtering.
 *
 * Features:
 * - Collapsible filter sections
 * - Active filter chips (removable)
 * - Date range picker with shortcuts
 * - Status multi-select dropdown
 * - Driver/zone/customer selectors
 * - Clear all filters button
 * - Save filter preset
 * - Dark theme with Tailwind CSS
 */

"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

// ─── TYPES ──────────────────────────────────────────────────────────

export interface Filter {
  field: string;
  operator: string;
  value: any;
  label: string;
}

export interface FilterPanelProps {
  entityType?: "orders" | "drivers" | "deliveries";
  onFiltersChange?: (filters: Filter[]) => void;
  onSavePreset?: (name: string, filters: Filter[]) => void;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────

const STATUS_OPTIONS: Record<string, string[]> = {
  orders: ["PENDING", "ACCEPTED", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"],
  drivers: ["ACTIVE", "INACTIVE", "ON_DUTY", "OFF_DUTY"],
  deliveries: ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"],
};

const DATE_SHORTCUTS = ["Today", "This Week", "This Month", "Last 30 Days", "Custom"];

// ─── COMPONENT ──────────────────────────────────────────────────────

export function FilterPanel({
  entityType = "orders",
  onFiltersChange,
  onSavePreset,
}: FilterPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateShortcut, setSelectedDateShortcut] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[string, string]>(["", ""]);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  /**
   * Add or update filter.
   */
  const updateFilter = useCallback(
    (field: string, value: any, label: string, operator: string = "eq") => {
      setFilters((prev) => {
        const existing = prev.findIndex((f) => f.field === field);
        const newFilter = { field, value, label, operator };

        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newFilter;
          return updated;
        }

        return [...prev, newFilter];
      });
    },
    []
  );

  /**
   * Remove filter by field.
   */
  const removeFilter = useCallback((field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field));
  }, []);

  /**
   * Clear all filters.
   */
  const clearAllFilters = useCallback(() => {
    setFilters([]);
    setSelectedStatuses(new Set());
    setDateRange(["", ""]);
    setSelectedDateShortcut(null);
  }, []);

  /**
   * Handle status checkbox toggle.
   */
  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) => {
      const updated = new Set(prev);
      if (updated.has(status)) {
        updated.delete(status);
      } else {
        updated.add(status);
      }

      if (updated.size > 0) {
        updateFilter("status", Array.from(updated), "Status", "in");
      } else {
        removeFilter("status");
      }

      return updated;
    });
  }, [updateFilter, removeFilter]);

  /**
   * Handle date shortcut.
   */
  const handleDateShortcut = useCallback((shortcut: string) => {
    setSelectedDateShortcut(shortcut);
    setShowDatePicker(false);

    // Calculate date range based on shortcut
    const today = new Date();
    let startDate = new Date();

    switch (shortcut) {
      case "Today":
        startDate.setHours(0, 0, 0, 0);
        updateFilter("createdAt", [startDate.toISOString().split("T")[0], today.toISOString().split("T")[0]], "Today", "between");
        break;
      case "This Week":
        startDate.setDate(today.getDate() - today.getDay());
        updateFilter("createdAt", [startDate.toISOString().split("T")[0], today.toISOString().split("T")[0]], "This Week", "between");
        break;
      case "This Month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        updateFilter("createdAt", [startDate.toISOString().split("T")[0], today.toISOString().split("T")[0]], "This Month", "between");
        break;
      case "Last 30 Days":
        startDate.setDate(today.getDate() - 30);
        updateFilter("createdAt", [startDate.toISOString().split("T")[0], today.toISOString().split("T")[0]], "Last 30 Days", "between");
        break;
      case "Custom":
        setShowDatePicker(true);
        break;
    }
  }, [updateFilter]);

  /**
   * Apply custom date range.
   */
  const applyCustomDateRange = useCallback(() => {
    if (dateRange[0] && dateRange[1]) {
      updateFilter("createdAt", dateRange, `${dateRange[0]} to ${dateRange[1]}`, "between");
      setShowDatePicker(false);
    }
  }, [dateRange, updateFilter]);

  /**
   * Save filter preset.
   */
  const savePreset = useCallback(() => {
    if (presetName.trim()) {
      onSavePreset?.(presetName, filters);
      setPresetName("");
      setShowSavePreset(false);
    }
  }, [presetName, filters, onSavePreset]);

  // Notify parent of filter changes
  React.useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  return (
    <div className="flex h-full flex-col border-r border-wl-border-default bg-wl-bg-surface">
      {/* Header */}
      <div className="border-b border-wl-border-default p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between text-lg font-semibold text-white hover:text-wl-neutral-300"
        >
          <span>Filters</span>
          <svg
            className={cn(
              "h-5 w-5 transition-transform",
              isOpen && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      </div>

      {/* Active Filters Chips */}
      {filters.length > 0 && (
        <div className="border-b border-wl-border-default p-4">
          <div className="mb-3 text-xs font-semibold text-wl-text-secondary">ACTIVE FILTERS</div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <div
                key={filter.field}
                className="inline-flex items-center gap-2 rounded-full bg-wl-primary-500/20 px-3 py-1 text-sm text-wl-primary-400"
              >
                <span>{filter.label}</span>
                <button
                  onClick={() => removeFilter(filter.field)}
                  className="text-wl-primary-300 hover:text-wl-primary-100"
                  title="Remove filter"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Sections */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Status Filter */}
          <div className="mb-6">
            <h3 className="mb-3 font-semibold text-white">Status</h3>
            <div className="space-y-2">
              {(STATUS_OPTIONS[entityType] || []).map((status) => (
                <label key={status} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(status)}
                    onChange={() => toggleStatus(status)}
                    className="h-4 w-4 rounded border-wl-border-strong bg-wl-bg-elevated checked:bg-wl-primary-500"
                  />
                  <span className="text-sm text-wl-neutral-300">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mb-6">
            <h3 className="mb-3 font-semibold text-white">Date Range</h3>
            <div className="space-y-2">
              {DATE_SHORTCUTS.map((shortcut) => (
                <button
                  key={shortcut}
                  onClick={() => handleDateShortcut(shortcut)}
                  className={cn(
                    "w-full rounded px-3 py-2 text-left text-sm transition-colors",
                    selectedDateShortcut === shortcut
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-elevated text-wl-neutral-300 hover:bg-wl-bg-overlay"
                  )}
                >
                  {shortcut}
                </button>
              ))}
            </div>

            {showDatePicker && (
              <div className="mt-4 space-y-3 rounded bg-wl-bg-elevated p-3">
                <div>
                  <label className="block text-xs text-wl-text-secondary">From</label>
                  <input
                    type="date"
                    value={dateRange[0]}
                    onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
                    className="mt-1 w-full rounded bg-wl-bg-overlay px-2 py-1 text-sm text-wl-text-primary outline-none focus:ring-2 focus:ring-wl-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-wl-text-secondary">To</label>
                  <input
                    type="date"
                    value={dateRange[1]}
                    onChange={(e) => setDateRange([dateRange[0], e.target.value])}
                    className="mt-1 w-full rounded bg-wl-bg-overlay px-2 py-1 text-sm text-wl-text-primary outline-none focus:ring-2 focus:ring-wl-primary-500"
                  />
                </div>
                <button
                  onClick={applyCustomDateRange}
                  className="w-full rounded bg-wl-primary-500 px-3 py-2 text-sm text-wl-text-inverse hover:bg-wl-primary-600"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mb-6 border-t border-wl-border-default" />

          {/* Action Buttons */}
          {filters.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowSavePreset(true)}
                className="w-full rounded bg-wl-success-bg px-4 py-2 text-sm font-medium text-wl-success-400 hover:bg-wl-success-500/20"
              >
                Save as Preset
              </button>
              <button
                onClick={clearAllFilters}
                className="w-full rounded bg-wl-bg-elevated px-4 py-2 text-sm font-medium text-wl-neutral-300 hover:bg-wl-bg-overlay"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save Preset Modal */}
      {showSavePreset && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-lg bg-wl-bg-surface p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-white">Save Filter Preset</h2>
            <input
              type="text"
              placeholder="Preset name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="mb-4 w-full rounded bg-wl-bg-elevated px-4 py-2 text-wl-text-primary outline-none focus:ring-2 focus:ring-wl-primary-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={savePreset}
                className="flex-1 rounded bg-wl-primary-500 px-4 py-2 text-wl-text-inverse hover:bg-wl-primary-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSavePreset(false);
                  setPresetName("");
                }}
                className="flex-1 rounded bg-wl-bg-elevated px-4 py-2 text-wl-neutral-300 hover:bg-wl-bg-overlay"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
