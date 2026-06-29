"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Download, ChevronDown, Calendar } from "lucide-react";
import Link from "next/link";
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import {
  useDeliveryLog,
  type DeliveryStatus,
  type NotificationChannel,
} from "@/hooks/use-notifications";

/**
 * Delivery Log Page
 * Features:
 * - Table: message, channel, recipient, status, timestamp
 * - Status badges (SENT, DELIVERED, READ, FAILED, BOUNCED)
 * - Debounced search (300ms)
 * - Filter by channel, status, date range
 * - Click row to see delivery details (timing, retries, error)
 * - CSV export
 */

export default function DeliveryLogPage() {
  const {
    entries,
    isLoading,
    error,
    hasMore,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    loadMore,
    exportCSV,
  } = useDeliveryLog();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const channels: NotificationChannel[] = [
    "EMAIL",
    "SMS",
    "PUSH",
    "WHATSAPP",
    "WEBHOOK",
    "SLACK",
  ];
  const statuses: DeliveryStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
    "FAILED",
    "BOUNCED",
    "PENDING",
  ];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(debouncedQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedQuery, setSearchQuery]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  }, [loadMore]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportCSV();
    } finally {
      setIsExporting(false);
    }
  }, [exportCSV]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = entries.length;
    const delivered = entries.filter(
      (e) => e.status === "DELIVERED" || e.status === "READ"
    ).length;
    const failed = entries.filter((e) => e.status === "FAILED").length;
    const bounced = entries.filter((e) => e.status === "BOUNCED").length;
    const rate =
      total > 0 ? Math.round((delivered / total) * 100) : 0;

    return { total, delivered, failed, bounced, rate };
  }, [entries]);

  if (isLoading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-wl-bg-root">
        <Header title="Delivery Log" subtitle="Track notification delivery status and history" />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSkeleton />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-root">
        <Header title="Delivery Log" subtitle="Track notification delivery status and history" />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState message={error.message} onRetry={() => window.location.reload()} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Delivery Log"
        subtitle="Track notification delivery status and history"
        actions={
          <Link href="/notifications">
            <Button variant="secondary" size="sm">
              Back
            </Button>
          </Link>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {stats.total}
                  </div>
                  <p className="text-sm text-wl-neutral-300 mt-1">
                    Total Sent
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">
                    {stats.delivered}
                  </div>
                  <p className="text-sm text-wl-neutral-300 mt-1">
                    Delivered
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {stats.failed}
                  </div>
                  <p className="text-sm text-wl-neutral-300 mt-1">
                    Failed
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">
                    {stats.rate}%
                  </div>
                  <p className="text-sm text-wl-neutral-300 mt-1">
                    Success Rate
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Search
                  </label>
                  <Input
                    placeholder="Search by message, recipient..."
                    value={debouncedQuery}
                    onChange={(e) => setDebouncedQuery(e.target.value)}
                    className="bg-wl-bg-elevated border-wl-border-default text-white placeholder-gray-500"
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Channel
                    </label>
                    <select
                      value={(filters.channel as string) || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          channel: e.target.value ? (e.target.value as NotificationChannel) : undefined,
                        })
                      }
                      className={cn(
                        "w-full px-4 py-2 rounded-md",
                        "bg-wl-bg-elevated border border-wl-border-default",
                        "text-white",
                        "focus:outline-none focus:border-blue-500",
                        "transition-colors duration-fast"
                      )}
                    >
                      <option value="">All Channels</option>
                      {channels.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Status
                    </label>
                    <select
                      value={(filters.status as string) || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          status: e.target.value ? (e.target.value as DeliveryStatus) : undefined,
                        })
                      }
                      className={cn(
                        "w-full px-4 py-2 rounded-md",
                        "bg-wl-bg-elevated border border-wl-border-default",
                        "text-white",
                        "focus:outline-none focus:border-blue-500",
                        "transition-colors duration-fast"
                      )}
                    >
                      <option value="">All Statuses</option>
                      {statuses.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setFilters({
                          channel: undefined,
                          status: undefined,
                          startDate: undefined,
                          endDate: undefined,
                        })
                      }
                    >
                      Clear Filters
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleExport}
                      disabled={isExporting || entries.length === 0}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {isExporting ? "Exporting..." : "Export"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Log Table */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-wl-text-secondary mb-3" />
                  <p className="text-wl-neutral-300">
                    No delivery logs found
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-default bg-wl-bg-root">
                        <th className="text-left py-3 px-6 font-semibold text-wl-text-secondary text-xs uppercase tracking-wide">
                          Message
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-wl-text-secondary text-xs uppercase tracking-wide">
                          Channel
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-wl-text-secondary text-xs uppercase tracking-wide">
                          Recipient
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-wl-text-secondary text-xs uppercase tracking-wide">
                          Status
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-wl-text-secondary text-xs uppercase tracking-wide">
                          Timestamp
                        </th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const isExpanded = expandedId === entry.id;

                        return (
                          <tr
                            key={entry.id}
                            className={cn(
                              "border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors cursor-pointer",
                              isExpanded && "bg-wl-bg-surface"
                            )}
                          >
                            <td className="py-4 px-6 text-white font-medium">
                              {entry.message}
                            </td>
                            <td className="py-4 px-6 text-wl-neutral-300">
                              <Badge variant="info">{entry.channel}</Badge>
                            </td>
                            <td className="py-4 px-6 text-wl-neutral-300 text-xs font-mono">
                              {truncate(entry.recipient, 30)}
                            </td>
                            <td className="py-4 px-6">
                              <Badge variant={getStatusVariant(entry.status)}>
                                {entry.status}
                              </Badge>
                            </td>
                            <td className="py-4 px-6 text-wl-neutral-300 text-sm">
                              {formatDateTime(entry.timestamp)}
                            </td>
                            <td
                              className="py-4 px-6 text-center"
                              onClick={() =>
                                setExpandedId(
                                  isExpanded ? null : entry.id
                                )
                              }
                            >
                              <ChevronDown
                                className={cn(
                                  "w-4 h-4 text-wl-text-secondary transition-transform inline",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            {/* Expanded Details */}
            {entries.map((entry) => {
              if (expandedId !== entry.id) return null;

              return (
                <div
                  key={`${entry.id}-details`}
                  className="bg-wl-bg-surface border-t border-wl-border-default px-6 py-4"
                >
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                        Full Recipient
                      </p>
                      <p className="font-mono text-wl-neutral-300 break-all">
                        {entry.recipient}
                      </p>
                    </div>

                    <div>
                      <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                        Sent At
                      </p>
                      <p className="text-wl-neutral-300">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {entry.deliveredAt && (
                      <div>
                        <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                          Delivered At
                        </p>
                        <p className="text-emerald-500">
                          {new Date(
                            entry.deliveredAt
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {entry.readAt && (
                      <div>
                        <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                          Read At
                        </p>
                        <p className="text-emerald-500">
                          {new Date(entry.readAt).toLocaleString()}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                        Retries
                      </p>
                      <p className="text-wl-neutral-300">
                        {entry.retryCount}
                      </p>
                    </div>

                    {entry.error && (
                      <div>
                        <p className="text-wl-text-secondary uppercase text-xs font-semibold tracking-wide mb-1">
                          Error
                        </p>
                        <p className="text-red-500">{entry.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={isLoadingMore || isLoading}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────

function getStatusVariant(
  status: DeliveryStatus
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "SENT":
    case "PENDING":
      return "info";
    case "DELIVERED":
    case "READ":
      return "success";
    case "FAILED":
      return "danger";
    case "BOUNCED":
      return "warning";
  }
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleDateString();
}

function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + "..." : str;
}
