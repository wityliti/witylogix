"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Download,
  Eye,
  Mail,
  MessageSquare,
  Bell,
  Webhook,
  Slack,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Bell as BellIcon,
} from "lucide-react";
import {
  useDeliveryLog,
  type DeliveryStatus,
  type NotificationChannel,
} from "@/hooks/use-notifications";

type Channel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK" | "SLACK";

function ChannelIcon({ channel }: { channel: Channel }) {
  const cls = "w-4 h-4 text-gray-400";
  switch (channel) {
    case "EMAIL": return <Mail className={cls} />;
    case "SMS": return <MessageSquare className={cls} />;
    case "WHATSAPP": return <MessageCircle className={cls} />;
    case "PUSH": return <BellIcon className={cls} />;
    case "WEBHOOK": return <Webhook className={cls} />;
    case "SLACK": return <Slack className={cls} />;
    default: return <Bell className={cls} />;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case "FAILED":
    case "BOUNCED":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusVariant(
  status: string
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "success";
    case "FAILED":
      return "danger";
    case "BOUNCED":
      return "warning";
    default:
      return "info";
  }
}

function formatDateTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

interface DetailModalProps {
  entry?: ReturnType<typeof useDeliveryLog>["entries"][number];
  onClose: () => void;
}

function DetailModal({ entry, onClose }: DetailModalProps) {
  if (!entry) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <Card
        className="border border-[#1e1e2e] bg-[#12121a] w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle>Notification Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Recipient</p>
              <p className="text-white font-mono break-all">{entry.recipient}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Channel</p>
              <div className="flex items-center gap-2">
                <ChannelIcon channel={entry.channel as Channel} />
                <span className="text-white capitalize">{entry.channel}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Status</p>
              <Badge variant={getStatusVariant(entry.status)}>{entry.status}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Sent At</p>
              <p className="text-white">{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
            {entry.deliveredAt && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Delivered At</p>
                <p className="text-emerald-400">{new Date(entry.deliveredAt).toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Retries</p>
              <p className="text-white">{entry.retryCount}</p>
            </div>
            {entry.error && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Error</p>
                <p className="text-red-400 text-sm">{entry.error}</p>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-[#1e1e2e]">
            <Button variant="secondary" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NotificationLogPage() {
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

  const [selectedEntry, setSelectedEntry] = useState<
    (typeof entries)[number] | undefined
  >();
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(debouncedQuery), 300);
    return () => clearTimeout(t);
  }, [debouncedQuery, setSearchQuery]);

  // Sync dropdown filters
  useEffect(() => {
    setFilters({
      channel: filterChannel ? (filterChannel as NotificationChannel) : undefined,
      status: filterStatus ? (filterStatus as DeliveryStatus) : undefined,
    });
  }, [filterChannel, filterStatus, setFilters]);

  const stats = useMemo(() => {
    const total = entries.length;
    const delivered = entries.filter(
      (e) => e.status === "DELIVERED" || e.status === "READ"
    ).length;
    const failed = entries.filter((e) => e.status === "FAILED").length;
    const bounced = entries.filter((e) => e.status === "BOUNCED").length;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { total, delivered, failed, bounced, rate };
  }, [entries]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try { await exportCSV(); } finally { setIsExporting(false); }
  }, [exportCSV]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Notification Log"
        subtitle="Track sent notifications and delivery status"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || entries.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border border-[#1e1e2e] bg-[#12121a]">
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card className="border border-[#1e1e2e] bg-[#12121a]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                    <p className="text-sm text-gray-400 mt-1">Total Sent</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#1e1e2e] bg-[#12121a]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold text-emerald-500">{stats.delivered}</p>
                    <p className="text-sm text-gray-400 mt-1">Delivered</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#1e1e2e] bg-[#12121a]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                    <p className="text-sm text-gray-400 mt-1">Failed</p>
                  </CardContent>
                </Card>
                <Card className="border border-[#1e1e2e] bg-[#12121a]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold text-amber-500">{stats.rate}%</p>
                    <p className="text-sm text-gray-400 mt-1">Success Rate</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Filters */}
          <Card className="border border-[#1e1e2e] bg-[#12121a]">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                    Search
                  </label>
                  <Input
                    placeholder="Recipient, event type…"
                    value={debouncedQuery}
                    onChange={(e) => setDebouncedQuery(e.target.value)}
                    className="bg-[#1a1a2e] border-[#1e1e2e] text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                    Channel
                  </label>
                  <select
                    value={filterChannel}
                    onChange={(e) => setFilterChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] text-white rounded-md text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Channels</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="PUSH">Push</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] text-white rounded-md text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="SENT">Sent</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="FAILED">Failed</option>
                    <option value="BOUNCED">Bounced</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border border-[#1e1e2e] bg-[#12121a]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {isLoading ? "Loading…" : `${entries.length} Notification${entries.length !== 1 ? "s" : ""}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                  <p className="text-red-400 font-medium">Failed to load notification log</p>
                  <p className="text-gray-500 text-sm mt-1">{String(error)}</p>
                </div>
              ) : isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="w-4 h-4 rounded-full" />
                      <Skeleton className="flex-1 h-4" />
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-16 h-4" />
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 font-medium">No notification logs found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Notifications will appear here once sent
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e] bg-[#0a0a0f]">
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Timestamp
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Event
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Channel
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Recipient
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors"
                        >
                          <td className="py-4 px-6 text-gray-400 text-xs">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(entry.timestamp)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-white font-medium max-w-xs">
                            <span className="truncate block">{entry.message}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <ChannelIcon channel={entry.channel as Channel} />
                              <span className="text-gray-300 text-xs capitalize">
                                {entry.channel}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                            {truncate(entry.recipient, 32)}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <StatusIcon status={entry.status} />
                              <Badge variant={getStatusVariant(entry.status)}>
                                {entry.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedEntry(entry)}
                              className="p-1.5 hover:bg-[#252541] rounded-lg transition-colors"
                              aria-label="View details"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={isLoadingMore || isLoading}
              >
                {isLoadingMore ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </main>

      <DetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(undefined)}
      />
    </div>
  );
}
