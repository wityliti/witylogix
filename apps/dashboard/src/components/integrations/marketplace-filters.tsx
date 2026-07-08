"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   MARKETPLACE FILTERS COMPONENT
   Category sidebar with search and active filter pills
   ═══════════════════════════════════════════════════════════ */

type AuthType = "oauth2" | "api_key" | "basic_auth" | "custom" | "all";
type ConnectStatus = "all" | "connected" | "available";

export interface FilterCategory {
  key: string;
  label: string;
  count: number;
}

export interface MarketplaceFiltersProps {
  categories: FilterCategory[];
  selectedCategories: string[];
  onCategoryChange: (category: string, selected: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  authTypes?: AuthType[];
  selectedAuthType?: AuthType;
  onAuthTypeChange?: (authType: AuthType) => void;
  connectStatus?: ConnectStatus;
  onConnectStatusChange?: (status: ConnectStatus) => void;
  onClearFilters?: () => void;
}

/**
 * Sidebar filter component for marketplace
 * Includes category checkboxes, search input, auth type filter, and status filter
 */
export function MarketplaceFilters({
  categories,
  selectedCategories,
  onCategoryChange,
  searchValue,
  onSearchChange,
  authTypes = [],
  selectedAuthType = "all",
  onAuthTypeChange,
  connectStatus = "all",
  onConnectStatusChange,
  onClearFilters,
}: MarketplaceFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const activeFilterCount = selectedCategories.length + (searchValue ? 1 : 0);
  const displayedCategories = showAllCategories
    ? categories
    : categories.slice(0, 8);

  return (
    <aside className={cn("w-56 flex-shrink-0")}>
      <div className={cn("sticky top-4 space-y-4")}>
        {/* Search Input */}
        <div>
          <div className={cn("relative")}>
            <Search className="w-4 h-4 absolute left-3 top-3 text-wl-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 bg-wl-bg-overlay border border-wl-border-default rounded-lg",
                "text-wl-text-primary text-sm",
                "focus:border-wl-primary-500 outline-none",
                "transition-all duration-fast",
              )}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange("")}
                className={cn(
                  "absolute right-2 top-2 p-1 hover:bg-wl-bg-surface rounded transition-all",
                )}
              >
                <X className="w-4 h-4 text-wl-text-tertiary" />
              </button>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <div className={cn("space-y-2")}>
            {searchValue && (
              <Badge variant="primary" className="text-xs">
                Search: {searchValue}
                <button
                  onClick={() => onSearchChange("")}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {selectedCategories.map((cat) => (
              <Badge key={cat} variant="info" className="text-xs">
                {cat.replace(/_/g, " ")}
                <button
                  onClick={() => onCategoryChange(cat, false)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs w-full"
              onClick={onClearFilters}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Categories Filter */}
        <div>
          <div
            className={cn(
              "flex items-center justify-between cursor-pointer p-2 rounded hover:bg-wl-bg-overlay transition-all",
              "mb-2",
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
              Categories
            </h3>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-wl-text-tertiary transition-transform",
                !isExpanded && "-rotate-90",
              )}
            />
          </div>

          {isExpanded && (
            <div className={cn("space-y-2")}>
              {displayedCategories.map((cat) => (
                <label
                  key={cat.key}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-wl-bg-overlay transition-all",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.key)}
                    onChange={(e) =>
                      onCategoryChange(cat.key, e.target.checked)
                    }
                    className={cn(
                      "w-4 h-4 rounded border-wl-border-default bg-wl-bg-surface",
                      "checked:bg-wl-primary-500 checked:border-wl-primary-500",
                      "cursor-pointer",
                    )}
                  />
                  <span className={cn("text-sm text-wl-text-primary flex-1")}>
                    {cat.label}
                  </span>
                  <span className={cn("text-xs text-wl-text-tertiary")}>
                    {cat.count}
                  </span>
                </label>
              ))}

              {categories.length > 8 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs w-full mt-2"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                >
                  {showAllCategories ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Auth Type Filter */}
        {authTypes.length > 0 && onAuthTypeChange && (
          <div>
            <h3
              className={cn("text-sm font-semibold text-wl-text-primary mb-2")}
            >
              Authentication
            </h3>
            <div className={cn("space-y-2")}>
              {(["all", ...authTypes] as const).map((authType) => (
                <label
                  key={authType}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-wl-bg-overlay transition-all",
                  )}
                >
                  <input
                    type="radio"
                    name="auth-type"
                    checked={selectedAuthType === authType}
                    onChange={() => onAuthTypeChange(authType)}
                    className={cn(
                      "w-4 h-4 rounded-full border-wl-border-default bg-wl-bg-surface",
                      "checked:bg-wl-primary-500 checked:border-wl-primary-500",
                      "cursor-pointer",
                    )}
                  />
                  <span className={cn("text-sm text-wl-text-primary")}>
                    {authType === "all"
                      ? "All Types"
                      : authType.replace(/_/g, " ")}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Connection Status Filter */}
        {onConnectStatusChange && (
          <div>
            <h3
              className={cn("text-sm font-semibold text-wl-text-primary mb-2")}
            >
              Status
            </h3>
            <div className={cn("space-y-2")}>
              {(["all", "connected", "available"] as const).map((status) => (
                <label
                  key={status}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-wl-bg-overlay transition-all",
                  )}
                >
                  <input
                    type="radio"
                    name="connect-status"
                    checked={connectStatus === status}
                    onChange={() =>
                      onConnectStatusChange(status as ConnectStatus)
                    }
                    className={cn(
                      "w-4 h-4 rounded-full border-wl-border-default bg-wl-bg-surface",
                      "checked:bg-wl-primary-500 checked:border-wl-primary-500",
                      "cursor-pointer",
                    )}
                  />
                  <span className={cn("text-sm text-wl-text-primary")}>
                    {status === "all"
                      ? "All"
                      : status === "connected"
                        ? "Connected"
                        : "Available"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {(selectedCategories.length > 0 || searchValue) && (
          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={onClearFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Clear all filters
          </Button>
        )}
      </div>
    </aside>
  );
}

/**
 * Horizontal filter pills (for mobile or compact layouts)
 */
export interface FilterPillsProps {
  filters: {
    type: "search" | "category" | "auth" | "status";
    label: string;
    value: string;
  }[];
  onRemove: (index: number) => void;
  onClearAll?: () => void;
}

export function FilterPills({
  filters,
  onRemove,
  onClearAll,
}: FilterPillsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 mb-4")}>
      {filters.map((filter, idx) => (
        <Badge key={idx} variant="primary" className="text-xs">
          {filter.label}: {filter.value}
          <button
            onClick={() => onRemove(idx)}
            className="ml-1 hover:opacity-70"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      {filters.length > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
