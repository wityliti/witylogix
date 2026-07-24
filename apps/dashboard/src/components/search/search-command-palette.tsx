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
      action: () => {
        // Navigate to create order page
        window.location.href = "/orders/new";
      },
    },
    {
      id: "add-driver",
      label: "Add Driver",
      icon: "user-plus",
      action: () => {
        window.location.href = "/drivers/new";
      },
    },
    {
      id: "view-map",
      label: "View Map",
      icon: "map",
      action: () => {
        window.location.href = "/map";
      },
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
    (result: (typeof search.results)[0]) => {
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

      window.location.href = `${basePath}/${result.id}`;
    },
    [search],
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 hover:border-gray-600 hover:bg-gray-800"
        title="Press Cmd+K"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Search...</span>
        <kbd className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-300">
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
      <div className="w-full max-w-2xl rounded-lg bg-gray-900 shadow-xl">
        {/* Search Input */}
        <div className="border-b border-gray-700 p-4">
          <input
            {...search.register}
            autoFocus
            placeholder="Search orders, drivers, deliveries..."
            className="w-full bg-transparent text-lg text-white outline-none placeholder:text-gray-500"
          />
          {search.isLoading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
              Searching...
            </div>
          )}
          {search.error && (
            <div className="mt-2 text-sm text-red-400">
              {search.error.message}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {/* Quick Actions (when empty) */}
          {!search.query && search.recentSearches.length === 0 && (
            <div className="border-b border-gray-700 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800",
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
            <div className="border-b border-gray-700 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Recent Searches
                </div>
                <button
                  onClick={() => search.clearRecentSearches()}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {search.recentSearches.map((recent, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      search.selectSuggestion({
                        title: recent,
                        type: "recent",
                      });
                      search.search(recent);
                    }}
                    className={cn(
                      "w-full rounded-lg px-4 py-2 text-left text-sm transition-colors",
                      search.selectedIndex === index
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800",
                    )}
                  >
                    <svg
                      className="mb-1 inline-block h-3 w-3 text-gray-500"
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
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-xs text-gray-400">
                                {result.description}
                              </div>
                            )}
                          </div>
                          <div
                            className={cn(
                              "rounded px-2 py-1 text-xs font-semibold",
                              entity === "orders"
                                ? "bg-blue-900 text-blue-300"
                                : entity === "drivers"
                                  ? "bg-green-900 text-green-300"
                                  : entity === "deliveries"
                                    ? "bg-purple-900 text-purple-300"
                                    : "bg-gray-700 text-gray-300",
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
          {search.query &&
            Object.keys(groupedResults).length === 0 &&
            !search.isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-600"
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
                  <p className="mt-2 text-sm text-gray-400">No results found</p>
                  <p className="text-xs text-gray-500">
                    Try a different search term
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-4">
              <div>
                <kbd className="rounded border border-gray-700 bg-gray-800 px-2 py-1">
                  ↑↓
                </kbd>{" "}
                to navigate
              </div>
              <div>
                <kbd className="rounded border border-gray-700 bg-gray-800 px-2 py-1">
                  ↵
                </kbd>{" "}
                to select
              </div>
              <div>
                <kbd className="rounded border border-gray-700 bg-gray-800 px-2 py-1">
                  esc
                </kbd>{" "}
                to close
              </div>
            </div>
            {search.results.length > 0 && (
              <div className="text-gray-600">
                {search.results.length} result
                {search.results.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchCommandPalette;
