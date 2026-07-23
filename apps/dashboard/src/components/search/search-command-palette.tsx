/**
 * Search Command Palette — Cmd+K global search interface.
 *
 * Features:
 * - Cmd+K hotkey to open
 * - Search across all entities
 * - Grouped results (Orders, Drivers, Deliveries, etc.)
 * - Recent searches section
 * - Quick actions (Create Order, Add Driver, View Map)
 * - Keyboard navigation with visual feedback
 * - Dark theme with Tailwind CSS
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "@/hooks/use-search";
import { cn } from "@/lib/utils";

// ─── TYPES ──────────────────────────────────────────────────────────

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

// ─── COMPONENT ──────────────────────────────────────────────────────

export function SearchCommandPalette(): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const search = useSearch({ limit: 20 });

  // Group results by entity type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, typeof search.results> = {};
    search.results.forEach((result) => {
      if (!groups[result.entity]) {
        groups[result.entity] = [];
      }
      groups[result.entity].push(result);
    });
    return groups;
  }, [search.results]);

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: "create-order",
      label: "Create Order",
      icon: "plus",
      action: () => { setIsOpen(false); router.push("/orders/new"); },
    },
    {
      id: "add-driver",
      label: "Add Driver",
      icon: "user-plus",
      action: () => { setIsOpen(false); router.push("/drivers/new"); },
    },
    {
      id: "view-map",
      label: "View Map",
      icon: "map",
      action: () => { setIsOpen(false); router.push("/map"); },
    },
  ];

  /**
   * Handle Cmd+K hotkey.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  /**
   * Handle backdrop click to close.
   */
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  }, []);

  /**
   * Handle result selection.
   */
  const handleSelectResult = useCallback(
    (result: typeof search.results[0]) => {
      search.saveSearch(search.query);
      setIsOpen(false);

      // Navigate to result
      const basePath =
        result.entity === "orders"
          ? "/orders"
          : result.entity === "drivers"
            ? "/drivers"
            : result.entity === "deliveries"
              ? "/deliveries"
              : result.entity === "integrations"
                ? "/integrations"
                : "/customers";

      router.push(`${basePath}/${result.id}`);
    },
    [search]
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-wl-border-default bg-wl-bg-surface px-3 py-2 text-sm text-wl-text-secondary hover:border-wl-border-strong hover:bg-wl-bg-elevated"
        title="Press Cmd+K"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Search...</span>
        <kbd className="rounded border border-wl-border-strong bg-wl-bg-elevated px-2 py-1 text-xs font-semibold text-wl-text-secondary">
          Cmd K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-lg bg-wl-bg-surface shadow-xl">
        {/* Search Input */}
        <div className="border-b border-wl-border-default p-4">
          <input
            {...search.register}
            autoFocus
            placeholder="Search orders, drivers, deliveries..."
            className="w-full bg-transparent text-lg text-wl-text-primary outline-none placeholder:text-wl-text-tertiary"
          />
          {search.isLoading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-wl-text-secondary">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-wl-border-strong border-t-gray-300" />
              Searching...
            </div>
          )}
          {search.error && (
            <div className="mt-2 text-sm text-wl-danger-400">{search.error.message}</div>
          )}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {/* Quick Actions (when empty) */}
          {!search.query && search.recentSearches.length === 0 && (
            <div className="border-b border-wl-border-default p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-wl-text-tertiary">
                Quick Actions
              </div>
              <div className="space-y-2">
                {quickActions.map((action, index) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      setIsOpen(false);
                      action.action();
                    }}
                    className={cn(
                      "w-full rounded-lg px-4 py-2 text-left text-sm transition-colors",
                      search.selectedIndex === index
                        ? "bg-wl-primary-500 text-wl-text-inverse"
                        : "text-wl-text-secondary hover:bg-wl-bg-elevated"
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Searches (when empty query) */}
          {!search.query && search.recentSearches.length > 0 && (
            <div className="border-b border-wl-border-default p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-wl-text-tertiary">
                  Recent Searches
                </div>
                <button
                  onClick={() => search.clearRecentSearches()}
                  className="text-xs text-wl-text-tertiary hover:text-wl-text-secondary"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {search.recentSearches.map((recent, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      search.selectSuggestion({ title: recent, type: "recent" });
                      search.search(recent);
                    }}
                    className={cn(
                      "w-full rounded-lg px-4 py-2 text-left text-sm transition-colors",
                      search.selectedIndex === index
                        ? "bg-wl-primary-500 text-wl-text-inverse"
                        : "text-wl-text-secondary hover:bg-wl-bg-elevated"
                    )}
                  >
                    <svg
                      className="mb-1 inline-block h-3 w-3 text-wl-text-tertiary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {recent}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results (grouped by entity) */}
          {search.query && Object.keys(groupedResults).length > 0 && (
            <div className="p-4">
              {Object.entries(groupedResults).map(([entity, results]) => (
                <div key={entity} className="mb-4 last:mb-0">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-wl-text-tertiary">
                    {entity === "orders"
                      ? "Orders"
                      : entity === "drivers"
                        ? "Drivers"
                        : entity === "deliveries"
                          ? "Deliveries"
                          : entity === "integrations"
                            ? "Integrations"
                            : "Customers"}
                  </div>
                  <div className="space-y-1">
                    {results.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelectResult(result)}
                        className={cn(
                          "w-full rounded-lg px-4 py-2 text-left transition-colors",
                          search.selectedIndex === index
                            ? "bg-wl-primary-500 text-wl-text-inverse"
                            : "hover:bg-wl-bg-elevated"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-wl-text-primary">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-xs text-wl-text-secondary">
                                {result.description}
                              </div>
                            )}
                          </div>
                          <div
                            className={cn(
                              "rounded px-2 py-1 text-xs font-semibold",
                              entity === "orders"
                                ? "bg-wl-info-500/20 text-wl-info-400"
                                : entity === "drivers"
                                  ? "bg-wl-success-500/20 text-wl-success-400"
                                  : entity === "deliveries"
                                    ? "bg-wl-primary-500/20 text-wl-primary-400"
                                    : "bg-wl-bg-overlay text-wl-text-secondary"
                            )}
                          >
                            {entity}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {search.query && Object.keys(groupedResults).length === 0 && !search.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-wl-text-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="mt-2 text-sm text-wl-text-secondary">No results found</p>
                <p className="text-xs text-wl-text-tertiary">Try a different search term</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-wl-border-default px-4 py-3">
          <div className="flex items-center justify-between text-xs text-wl-text-tertiary">
            <div className="flex gap-4">
              <div>
                <kbd className="rounded border border-wl-border-default bg-wl-bg-elevated px-2 py-1">
                  ↑↓
                </kbd>
                {" "}to navigate
              </div>
              <div>
                <kbd className="rounded border border-wl-border-default bg-wl-bg-elevated px-2 py-1">
                  ↵
                </kbd>
                {" "}to select
              </div>
              <div>
                <kbd className="rounded border border-wl-border-default bg-wl-bg-elevated px-2 py-1">
                  esc
                </kbd>
                {" "}to close
              </div>
            </div>
            {search.results.length > 0 && (
              <div className="text-wl-text-tertiary">
                {search.results.length} result{search.results.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchCommandPalette;
