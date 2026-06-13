"use client";

import { useState, useCallback } from "react";
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
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Download,
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  X,
} from "lucide-react";
import {
  useDeliveryLog,
  type NotificationChannel,
  type DeliveryStatus,
} from "@/hooks/use-notifications";

// ─── Config maps ────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  SENT:      "info",
  DELIVERED: "success",
  READ:      "success",
  FAILED:    "danger",
  BOUNCED:   "danger",
  PENDING:   "warning",
  QUEUED:    "warning",
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  EMAIL:    <Mail    size={14} />,
  SMS:      <MessageSquare size={14} />,
  PUSH:     <Bell    size={14} />,
  WHATSAPP: <MessageCircle size={14} />,
};

function ChannelIcon({ channel }: { channel: string }) {
  return (
    <span className="text-wl-text-tertiary">
      {CHANNEL_ICON[channel] ?? <Bell size={14} />}
    </span>
  );
}

// ─── Detail Panel ────────────────────────────────────────────

function DetailPanel({ entry, onClose }: { entry: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Delivery Detail</CardTitle>
          <button onClick={onClose} className="text-wl-text-tertiary hover:text-wl-text-primary">
            <X size={18} />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase mb-1">Recipient</p>
              <p className="text-wl-text-primary break-all">{entry.recipient}</p>
            </div>
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase mb-1">Channel</p>
              <div className="flex items-center gap-1.5">
                <ChannelIcon channel={entry.channel} />
                <span className="text-wl-text-primary capitalize">{entry.channel.toLowerCase()}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase mb-1">Status</p>
              <Badge variant={STATUS_VARIANTS[entry.status] ?? "default"}>{entry.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase mb-1">Sent</p>
              <p className="text-wl-text-primary">
                {new Date(entry.timestamp).toLocaleString()}
              </p>
            </div>
            {entry.deliveredAt && (
              <div>
                <p className="text-xs text-wl-text-tertiary uppercase mb-1">Delivered</p>
                <p className="text-wl-text-primary">{new Date(entry.deliveredAt).toLocaleString()}</p>
              </div>
            )}
            {entry.orderNumber && (
              <div>
                <p className="text-xs text-wl-text-tertiary uppercase mb-1">Order</p>
                <p className="text-wl-text-primary">{entry.orderNumber}</p>
              </div>
            )}
          </div>
          {entry.message && (
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-xs text-wl-text-tertiary uppercase mb-2">Message</p>
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-white/[0.06]">
                <p className="text-wl-text-secondary whitespace-pre-wrap">{entry.message}</p>
              </div>
            </div>
          )}
          {entry.error && (
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-xs text-wl-danger-400 uppercase mb-1">Error</p>
              <p className="text-wl-danger-300 text-xs">{entry.error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

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
    refetch,
  } = useDeliveryLog();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const selectedEntry = entries.find((e) => e.id === expandedId);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportCSV();
    } finally {
      setIsExporting(false);
    }
  }, [exportCSV]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadMore]);

  return (
    <>
      <Header
        title="Notification Log"
        subtitle="Outbound message delivery history"
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={isExporting}>
            <Download size={14} className="mr-1" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Filters */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search by recipient…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={(filters as any).channel ?? ""}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value || undefined })}
                className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
              >
                <option value="">All Channels</option>
                {["EMAIL", "SMS", "WHATSAPP", "PUSH"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={(filters as any).status ?? ""}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
              >
                <option value="">All Statuses</option>
                {["QUEUED", "SENT", "DELIVERED", "FAILED", "BOUNCED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={(filters as any).dateFrom ?? ""}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
                />
                <input
                  type="date"
                  value={(filters as any).dateTo ?? ""}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6"><TableSkeleton rows={8} columns={5} /></div>
            ) : error ? (
              <div className="p-6"><ErrorState message={error.message} onRetry={refetch} /></div>
            ) : entries.length === 0 ? (
              <EmptyState
                title="No delivery logs"
                description="Outbound notification events will appear here."
              />
            ) : (
              <>
                {/* Header */}
                <div className="hidden md:grid grid-cols-12 px-6 py-3 border-b border-[#1e1e2e] bg-white/[0.02]">
                  {['Message', 'Channel', 'Recipient', 'Status', 'Sent', ''].map((h, i) => (
                    <div key={i} className={cn(
                      'text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider',
                      i === 0 ? 'col-span-4' : i === 2 ? 'col-span-2' : i === 4 ? 'col-span-2' : 'col-span-1',
                      i === 5 ? 'col-span-1' : ''
                    )}>
                      {h}
                    </div>
                  ))}
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(entry.id)}
                    >
                      <div className="col-span-4 text-sm text-wl-text-secondary truncate">
                        {entry.message}
                      </div>
                      <div className="col-span-1 flex items-center gap-1.5">
                        <ChannelIcon channel={entry.channel} />
                        <span className="text-xs text-wl-text-tertiary uppercase">{entry.channel}</span>
                      </div>
                      <div className="col-span-2 text-sm text-wl-text-primary truncate">{entry.recipient}</div>
                      <div className="col-span-2">
                        <Badge variant={STATUS_VARIANTS[entry.status] ?? "default"} className="text-xs">
                          {entry.status}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-xs text-wl-text-tertiary">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ChevronDown size={14} className="text-wl-text-tertiary" />
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center p-4 border-t border-white/[0.06]">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? "Loading…" : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail panel */}
      {expandedId && selectedEntry && (
        <DetailPanel entry={selectedEntry} onClose={() => setExpandedId(null)} />
      )}
    </>
  );
}
