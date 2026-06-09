"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConflicts, type SyncPlatform, type SyncConflict } from "@/hooks/use-order-sync";
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   CONFLICT RESOLUTION PAGE — Side-by-side diff view with
   bulk resolve, filtering, and conflict management
   ═══════════════════════════════════════════════════════════ */

const PLATFORMS: Record<SyncPlatform, { name: string; icon: string }> = {
  shopify: { name: "Shopify", icon: "🛍️" },
  woocommerce: { name: "WooCommerce", icon: "📦" },
  bigcommerce: { name: "BigCommerce", icon: "🏪" },
  magento: { name: "Magento", icon: "⚙️" },
  etsy: { name: "Etsy", icon: "🎨" },
  ebay: { name: "eBay", icon: "🏷️" },
  square: { name: "Square", icon: "⬜" },
  amazon: { name: "Amazon", icon: "🔶" },
};

export default function ConflictsPage() {
  const [filterPlatform, setFilterPlatform] = useState<SyncPlatform | "all">("all");
  const [filterField, setFilterField] = useState<string | "all">("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [bulkResolvingField, setBulkResolvingField] = useState<string | null>(null);

  const { conflicts, isLoading, error, resolveConflict, bulkResolveByType } = useConflicts();

  // Filter conflicts
  const filteredConflicts = useMemo(() => {
    return conflicts.filter((conflict) => {
      // Platform filter
      if (filterPlatform !== "all" && conflict.platform !== filterPlatform) {
        return false;
      }

      // Field filter
      if (filterField !== "all" && conflict.field !== filterField) {
        return false;
      }

      // Date range filter
      const createdDate = new Date(conflict.createdAt);
      const now = new Date();
      const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

      if (filterDateRange === "today" && daysDiff > 1) return false;
      if (filterDateRange === "week" && daysDiff > 7) return false;
      if (filterDateRange === "month" && daysDiff > 30) return false;

      return !conflict.resolved;
    });
  }, [conflicts, filterPlatform, filterField, filterDateRange]);

  // Get unique fields from conflicts
  const uniqueFields = useMemo(() => {
    return Array.from(new Set(conflicts.map((c) => c.field)));
  }, [conflicts]);

  // Conflict stats by field
  const conflictsByField = useMemo(() => {
    const stats: Record<string, number> = {};
    conflicts.forEach((c) => {
      if (!c.resolved) {
        stats[c.field] = (stats[c.field] || 0) + 1;
      }
    });
    return stats;
  }, [conflicts]);

  // Handle conflict resolution
  const handleResolveConflict = async (
    conflictId: string,
    action: "external" | "internal" | "skip",
    manualValue?: string
  ) => {
    try {
      setResolving((prev) => new Set(prev).add(conflictId));
      await resolveConflict(conflictId, action, manualValue);
    } catch (err) {
      console.error("Resolution failed:", err);
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(conflictId);
        return next;
      });
    }
  };

  // Handle bulk resolve by field
  const handleBulkResolveByField = async (field: string, action: "external" | "internal") => {
    try {
      setBulkResolvingField(field);
      await bulkResolveByType(field, action);
    } catch (err) {
      console.error("Bulk resolution failed:", err);
    } finally {
      setBulkResolvingField(null);
    }
  };

  const unresolved = conflicts.filter((c) => !c.resolved).length;

  const headerActions = (
    <Button variant="primary" size="md" onClick={() => window.location.reload()}>
      🔄 Refresh
    </Button>
  );

  return (
    <>
      <Header
        title="Order Conflicts"
        subtitle={`${unresolved} unresolved conflicts requiring attention`}
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
        {/* Conflict Stats */}
        <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
          <h2 className="text-lg font-bold text-white mb-4">Conflict Summary</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-wl-bg-root border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Conflicts
              </p>
              <p className="text-3xl font-bold font-mono text-white">
                {unresolved}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                across {uniqueFields.length} fields
              </p>
            </div>

            <div className="p-4 rounded-lg bg-wl-bg-root border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Affected Platforms
              </p>
              <p className="text-3xl font-bold font-mono text-white">
                {Array.from(new Set(conflicts.filter((c) => !c.resolved).map((c) => c.platform))).length}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                platforms with conflicts
              </p>
            </div>

            <div className="p-4 rounded-lg bg-wl-bg-root border border-wl-border-default">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Resolution Rate
              </p>
              <p className="text-3xl font-bold font-mono text-white">
                {conflicts.length > 0
                  ? Math.round(
                      ((conflicts.length - unresolved) / conflicts.length) * 100
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {conflicts.length - unresolved} resolved
              </p>
            </div>
          </div>
        </Card>

        {/* Conflicts by Field */}
        {Object.keys(conflictsByField).length > 0 && (
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-bold text-white mb-4">Conflicts by Field</h2>

            <div className="space-y-2">
              {Object.entries(conflictsByField).map(([field, count]) => (
                <div
                  key={field}
                  className="flex items-center justify-between p-3 rounded-lg bg-wl-bg-root border border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div>
                      <p className="font-medium text-white">{field}</p>
                      <p className="text-xs text-gray-400">
                        {count} conflict{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleBulkResolveByField(field, "external")
                      }
                      disabled={bulkResolvingField === field}
                    >
                      {bulkResolvingField === field ? "⟳" : "→"} External
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleBulkResolveByField(field, "internal")
                      }
                      disabled={bulkResolvingField === field}
                    >
                      {bulkResolvingField === field ? "⟳" : "←"} Internal
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
          <h2 className="text-lg font-bold text-white mb-4">Filters</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Platform Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Platform
              </label>
              <select
                value={filterPlatform}
                onChange={(e) =>
                  setFilterPlatform(e.target.value as SyncPlatform | "all")
                }
                className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-gray-300 outline-none focus:border-blue-500"
              >
                <option value="all">All Platforms</option>
                {Object.entries(PLATFORMS).map(([key, { name }]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Field
              </label>
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-gray-300 outline-none focus:border-blue-500"
              >
                <option value="all">All Fields</option>
                {uniqueFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date Range
              </label>
              <select
                value={filterDateRange}
                onChange={(e) =>
                  setFilterDateRange(
                    e.target.value as "all" | "today" | "week" | "month"
                  )
                }
                className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-gray-300 outline-none focus:border-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Conflicts List */}
        {filteredConflicts.length === 0 ? (
          <Card className="p-12 text-center bg-wl-bg-surface border border-wl-border-default">
            <p className="text-gray-400 text-lg font-medium">
              {unresolved === 0
                ? "✓ All conflicts resolved!"
                : "No conflicts match your filters"}
            </p>
          </Card>
        ) : (
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-bold text-white mb-4">
              Unresolved Conflicts ({filteredConflicts.length})
            </h2>

            <div className="space-y-4">
              {filteredConflicts.map((conflict) => {
                const platform = PLATFORMS[conflict.platform];
                const isExpanded = expandedConflict === conflict.id;

                return (
                  <div
                    key={conflict.id}
                    className={cn(
                      "rounded-lg border transition-all",
                      isExpanded
                        ? "border-blue-500 bg-[rgba(59,82,255,0.08)]"
                        : "border-wl-border-default bg-wl-bg-root hover:border-blue-500"
                    )}
                  >
                    {/* Header */}
                    <div
                      className="p-4 cursor-pointer flex items-center justify-between"
                      onClick={() =>
                        setExpandedConflict(
                          isExpanded ? null : conflict.id
                        )
                      }
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg">{platform?.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            {platform?.name} • Order {conflict.orderId}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="info">{conflict.field}</Badge>
                            <span className="text-xs text-gray-400">
                              {new Date(conflict.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-400 text-lg">
                        {isExpanded ? "▼" : "▶"}
                      </p>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <>
                        <div className="border-t border-wl-border-default p-4">
                          {/* Side-by-side Diff View */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* External (Platform) Value */}
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                {platform?.name} Value
                              </p>
                              <div className="p-3 rounded-lg bg-wl-bg-root border border-emerald-500/30 font-mono text-sm text-gray-300 break-words max-h-32 overflow-y-auto">
                                {conflict.externalValue || "(empty)"}
                              </div>
                              <p className="text-xs text-emerald-500 mt-2 font-medium">
                                Source: External
                              </p>
                            </div>

                            {/* Internal (Witylogix) Value */}
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Witylogix Value
                              </p>
                              <div className="p-3 rounded-lg bg-wl-bg-root border border-blue-500/30 font-mono text-sm text-gray-300 break-words max-h-32 overflow-y-auto">
                                {conflict.internalValue || "(empty)"}
                              </div>
                              <p className="text-xs text-blue-500 mt-2 font-medium">
                                Source: Internal
                              </p>
                            </div>
                          </div>

                          {/* Manual Edit Option */}
                          <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              Manual Resolution
                            </label>
                            <input
                              type="text"
                              placeholder="Enter custom value (optional)"
                              className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-gray-300 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-wl-border-default p-4 flex gap-2 flex-wrap">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              handleResolveConflict(conflict.id, "external")
                            }
                            disabled={resolving.has(conflict.id)}
                          >
                            {resolving.has(conflict.id)
                              ? "⟳"
                              : "✓"}{" "}
                            Accept {platform?.name}
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              handleResolveConflict(conflict.id, "internal")
                            }
                            disabled={resolving.has(conflict.id)}
                          >
                            {resolving.has(conflict.id)
                              ? "⟳"
                              : "✓"}{" "}
                            Accept Internal
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleResolveConflict(conflict.id, "skip")
                            }
                            disabled={resolving.has(conflict.id)}
                          >
                            {resolving.has(conflict.id)
                              ? "⟳"
                              : "○"}{" "}
                            Skip
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-4 border-red-500/20 bg-[rgba(255,69,69,0.05)] border border-red-500/20">
            <div className="flex items-center gap-2 text-red-500">
              <span>⚠️</span>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
