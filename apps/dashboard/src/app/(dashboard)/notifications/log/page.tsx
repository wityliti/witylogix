"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Download,
  Eye,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useDeliveryLog, type DeliveryLogEntry } from "@/hooks/use-notifications";

type Channel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type LogStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED";

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  EMAIL: <Mail className="w-4 h-4" />,
  SMS: <MessageSquare className="w-4 h-4" />,
  WHATSAPP: <MessageSquare className="w-4 h-4" />,
  PUSH: <Bell className="w-4 h-4" />,
};

const getStatusVariant = (status: string): "success" | "danger" | "warning" | "info" | "default" => {
  switch (status) {
    case "DELIVERED": return "success";
    case "SENT": return "info";
    case "FAILED": return "danger";
    case "BOUNCED": return "warning";
    default: return "default";
  }
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "DELIVERED" || status === "SENT")
    return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === "FAILED")
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (status === "BOUNCED")
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  return <Clock className="w-4 h-4 text-gray-400" />;
};

interface DetailModalProps {
  entry: DeliveryLogEntry | null;
  onClose: () => void;
}

function DetailModal({ entry, onClose }: DetailModalProps) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="bg-[#12121a] border border-[#1e1e2e] w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base">Notification Detail</CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Recipient</p>
              <p className="text-white break-all">{entry.recipient}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Channel</p>
              <p className="text-white capitalize">{entry.channel}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Status</p>
              <Badge variant={getStatusVariant(entry.status)}>{entry.status}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Sent</p>
              <p className="text-white">{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
            {entry.deliveredAt && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Delivered</p>
                <p className="text-white">{new Date(entry.deliveredAt).toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Retries</p>
              <p className="text-white">{entry.retryCount}</p>
            </div>
          </div>

          {entry.message && (
            <div className="border-t border-[#1e1e2e] pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Event Type</p>
              <p className="text-sm text-white">{entry.message}</p>
            </div>
          )}

          {entry.error && (
            <div className="border-t border-[#1e1e2e] pt-4">
              <p className="text-xs font-semibold text-red-400 uppercase mb-2">Error</p>
              <p className="text-sm text-red-400">{entry.error}</p>
            </div>
          )}

          <Button variant="secondary" onClick={onClose} className="w-full mt-2">
            Close
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="border-b border-white/[0.04]">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 rounded" style={{ width: `${60 + (i % 3) * 20}px` }} />
        </td>
      ))}
    </tr>
  );
}

export default function NotificationLogPage() {
  const [filterChannel, setFilterChannel] = useState<Channel | "">("");
  const [filterStatus, setFilterStatus] = useState<LogStatus | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DeliveryLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    entries,
    isLoading,
    hasMore,
    searchQuery,
    setSearchQuery,
    setFilters,
    loadMore,
    exportCSV,
    pagination,
  } = useDeliveryLog({
    channel: filterChannel || undefined,
    status: filterStatus || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  } as any);

  const applyFilters = () => {
    setFilters({
      channel: filterChannel || undefined,
      status: filterStatus || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    } as any);
  };

  const total = pagination?.total ?? 0;
  const delivered = useMemo(
    () => entries.filter((e) => e.status === "DELIVERED").length,
    [entries]
  );
  const failed = useMemo(
    () => entries.filter((e) => e.status === "FAILED" || e.status === "BOUNCED").length,
    [entries]
  );
  const deliveryRate = entries.length > 0
    ? (((entries.length - failed) / entries.length) * 100).toFixed(1)
    : "—";

  const handleExport = async () => {
    setIsExporting(true);
    try { await exportCSV(); } finally { setIsExporting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Notification Log"
        subtitle="Track outbound notification delivery by channel and status"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total", value: isLoading ? null : total, color: "text-white" },
            { label: "Delivered", value: isLoading ? null : delivered, color: "text-emerald-400" },
            { label: "Failed / Bounced", value: isLoading ? null : failed, color: "text-red-400" },
            { label: "Delivery Rate", value: isLoading ? null : `${deliveryRate}%`, color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border border-[#1e1e2e] bg-[#12121a]">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                {value === null ? (
                  <Skeleton className="h-8 w-16 rounded" />
                ) : (
                  <p className={cn("text-2xl font-bold", color)}>{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border border-[#1e1e2e] bg-[#12121a] mb-6">
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-gray-400 uppercase block mb-1.5">Search</label>
                <Input
                  placeholder="Recipient, event…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#1a1a2e] border-[#1e1e2e] text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase block mb-1.5">Channel</label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value as Channel | "")}
                  className="w-full px-3 py-2 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm"
                >
                  <option value="">All Channels</option>
                  {["EMAIL", "SMS", "WHATSAPP", "PUSH"].map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase block mb-1.5">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as LogStatus | "")}
                  className="w-full px-3 py-2 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm"
                >
                  <option value="">All Status</option>
                  {["SENT", "DELIVERED", "FAILED", "BOUNCED", "QUEUED"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase block mb-1.5">From Date</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="bg-[#1a1a2e] border-[#1e1e2e] text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase block mb-1.5">To Date</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="bg-[#1a1a2e] border-[#1e1e2e] text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={applyFilters}>Apply Filters</Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilterChannel("");
                  setFilterStatus("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setFilters({});
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border border-[#1e1e2e] bg-[#12121a]">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-sm">
                {isLoading ? "Loading…" : `${total.toLocaleString()} entries`}
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-gray-400 uppercase tracking-wide">
                    {["Timestamp", "Recipient", "Channel", "Event", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
                    : entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          No notification logs found
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-white truncate max-w-[180px] block">{entry.recipient}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300">
                              <span>{CHANNEL_ICONS[entry.channel as Channel]}</span>
                              <span className="capitalize text-xs">{entry.channel}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-300 text-xs">{entry.message}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusIcon status={entry.status} />
                              <Badge variant={getStatusVariant(entry.status)}>{entry.status}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedEntry(entry)}
                              className="p-1.5 hover:bg-white/[0.06] rounded transition-colors"
                              aria-label="View details"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasMore && !isLoading && (
              <div className="p-4 flex justify-center border-t border-white/[0.04]">
                <Button variant="secondary" size="sm" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}
