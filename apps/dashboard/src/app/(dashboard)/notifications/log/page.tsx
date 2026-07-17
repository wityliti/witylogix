"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  Download,
  Eye,
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import { useApiList } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";
import Link from "next/link";

// ── API types matching notifications-v2 /log response ─────────────────────

interface ApiNotificationLog {
  id: string;
  channel: string;
  eventType: string;
  recipient: string;
  status: string;
  providerMsgId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  orderId: string | null;
  orderNumber: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="w-4 h-4" />,
  SMS: <MessageSquare className="w-4 h-4" />,
  WHATSAPP: <MessageCircle className="w-4 h-4" />,
  PUSH: <Bell className="w-4 h-4" />,
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  SENT: <CheckCircle className="w-4 h-4 text-wl-info-400" />,
  DELIVERED: <CheckCircle className="w-4 h-4 text-wl-success-400" />,
  FAILED: <XCircle className="w-4 h-4 text-wl-danger-400" />,
  BOUNCED: <AlertCircle className="w-4 h-4 text-wl-warning-400" />,
  PENDING: <Clock className="w-4 h-4 text-wl-text-secondary" />,
};

function statusVariant(s: string): "success" | "danger" | "warning" | "info" | "default" {
  switch (s) {
    case "DELIVERED": return "success";
    case "SENT": return "info";
    case "FAILED": return "danger";
    case "BOUNCED": return "warning";
    default: return "default";
  }
}

function fmtEvent(e: string): string {
  return e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTs(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── Detail Modal ───────────────────────────────────────────────────────────

function DetailModal({ log, onClose }: { log: ApiNotificationLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <Card
        className="border border-wl-border-default bg-wl-bg-surface w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle className="text-base">Notification Details</CardTitle>
          {log.providerMsgId && (
            <CardDescription className="font-mono text-xs">{log.providerMsgId}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel" value={log.channel} />
            <Field label="Event" value={fmtEvent(log.eventType)} />
            <Field label="Recipient" value={log.recipient} mono />
            <Field label="Status">
              <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
            </Field>
            {log.orderId && (
              <Field label="Order">
                <Link
                  href={`/orders/${log.orderId}`}
                  className="text-wl-info-400 hover:text-wl-info-400 font-mono text-xs"
                >
                  {log.orderNumber ?? log.orderId.slice(0, 8)}
                </Link>
              </Field>
            )}
            <Field label="Sent" value={log.sentAt ? fmtTs(log.sentAt) : log.createdAt ? fmtTs(log.createdAt) : "—"} />
            {log.deliveredAt && <Field label="Delivered" value={fmtTs(log.deliveredAt)} />}
          </div>
          {log.errorMessage && (
            <div className="rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/20 p-3">
              <p className="text-xs font-semibold text-wl-danger-400 uppercase tracking-wide mb-1">Error</p>
              <p className="text-xs text-wl-danger-400">{log.errorMessage}</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-2 bg-wl-bg-elevated text-wl-text-primary rounded-lg hover:bg-wl-bg-overlay transition-colors text-sm"
          >
            Close
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide mb-1">{label}</p>
      {children ?? (
        <p className={cn("text-sm text-wl-text-primary", mono && "font-mono text-xs break-all")}>
          {value}
        </p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NotificationLogPage() {
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<ApiNotificationLog | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (filterChannel) f.channel = filterChannel;
    if (filterStatus) f.status = filterStatus;
    if (filterDateFrom) f.dateFrom = filterDateFrom;
    if (filterDateTo) f.dateTo = filterDateTo;
    return f;
  }, [filterChannel, filterStatus, filterDateFrom, filterDateTo]);

  const { items: logs, loading, error, refetch, pagination } = useApiList<ApiNotificationLog>(
    "/api/v4/notifications/log",
    { ...filters, limit: 50 },
  );

  // derive stats from loaded page
  const stats = useMemo(() => {
    const total = pagination.total ?? logs.length;
    const delivered = logs.filter((l) => l.status === "DELIVERED" || l.status === "SENT").length;
    const failed = logs.filter((l) => l.status === "FAILED").length;
    const bounced = logs.filter((l) => l.status === "BOUNCED").length;
    const deliveryRate = logs.length > 0 ? ((delivered / logs.length) * 100).toFixed(1) : "—";
    const bounceRate = logs.length > 0 ? ((bounced / logs.length) * 100).toFixed(1) : "—";
    return { total, deliveryRate, bounceRate, pending: logs.filter((l) => l.status === "PENDING").length };
  }, [logs, pagination.total]);

  function exportCSV() {
    const rows = [
      ["Timestamp", "Recipient", "Channel", "Event", "Status", "Provider ID", "Order"],
      ...logs.map((l) => [
        l.createdAt,
        l.recipient,
        l.channel,
        l.eventType,
        l.status,
        l.providerMsgId ?? "",
        l.orderNumber ?? l.orderId ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `notification-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Notification Log"
        subtitle="Track sent notifications and delivery status"
        actions={
          <Button variant="secondary" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total (this page)", value: String(logs.length), sub: `of ${(pagination.total ?? 0).toLocaleString()} total` },
            { label: "Delivery Rate", value: `${stats.deliveryRate}%`, accent: "text-wl-success-400" },
            { label: "Bounce Rate", value: `${stats.bounceRate}%`, accent: "text-wl-warning-400" },
            { label: "Pending", value: String(stats.pending), accent: "text-wl-text-secondary" },
          ].map(({ label, value, sub, accent }) => (
            <Card key={label} className="border border-wl-border-default bg-wl-bg-surface">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide mb-1">{label}</p>
                <p className={cn("text-2xl font-bold", accent ?? "text-wl-text-primary")}>{loading ? "—" : value}</p>
                {sub && <p className="text-xs text-wl-text-tertiary mt-0.5">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border border-wl-border-default bg-wl-bg-surface">
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-wl-text-tertiary uppercase block mb-2">Channel</label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-wl-bg-surface text-wl-text-primary border border-wl-border-default rounded-md text-sm focus:outline-none focus:border-wl-border-strong"
                >
                  <option value="">All Channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-wl-text-tertiary uppercase block mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-wl-bg-surface text-wl-text-primary border border-wl-border-default rounded-md text-sm focus:outline-none focus:border-wl-border-strong"
                >
                  <option value="">All Statuses</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                  <option value="BOUNCED">Bounced</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-wl-text-tertiary uppercase block mb-2">From Date</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="bg-wl-bg-surface border-wl-border-default text-wl-text-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-wl-text-tertiary uppercase block mb-2">To Date</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="bg-wl-bg-surface border-wl-border-default text-wl-text-primary"
                />
              </div>
            </div>
            {(filterChannel || filterStatus || filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setFilterChannel(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); }}
                className="mt-3 text-xs text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
              >
                Clear filters
              </button>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border border-wl-border-default bg-wl-bg-surface">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                {loading ? "Loading…" : `${logs.length} notification${logs.length !== 1 ? "s" : ""}`}
              </CardTitle>
              <Button variant="secondary" size="sm" onClick={exportCSV} disabled={loading || logs.length === 0}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={8} columns={6} />
              </div>
            ) : error ? (
              <div className="p-6">
                <ErrorState message={error.message} onRetry={refetch} />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Package className="w-10 h-10 text-wl-text-tertiary" />
                <p className="text-sm text-wl-text-tertiary">No notifications found</p>
                {(filterChannel || filterStatus || filterDateFrom || filterDateTo) && (
                  <p className="text-xs text-wl-text-tertiary">Try clearing your filters</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="border-b border-wl-border-default bg-wl-bg-root/50">
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Timestamp</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Recipient</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Channel</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Event</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Order</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-wl-text-secondary py-3 px-4">Status</TableHead>
                      <TableHead className="py-3 px-4 w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="border-b border-wl-border-default/50 hover:bg-wl-bg-surface/50 transition-colors"
                      >
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-wl-text-tertiary">
                            <Clock className="w-3 h-3 shrink-0" />
                            {fmtTs(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-xs text-wl-text-secondary font-mono truncate max-w-[160px] block">
                            {log.recipient}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2 text-wl-text-secondary">
                            {CHANNEL_ICON[log.channel] ?? <Bell className="w-4 h-4" />}
                            <span className="text-xs">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-xs text-wl-text-primary">{fmtEvent(log.eventType)}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {log.orderId ? (
                            <Link
                              href={`/orders/${log.orderId}`}
                              className="text-xs text-wl-info-400 hover:text-wl-info-400 font-mono"
                            >
                              {log.orderNumber ?? log.orderId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-wl-text-tertiary text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {STATUS_ICON[log.status] ?? <Clock className="w-4 h-4 text-wl-text-tertiary" />}
                            <Badge variant={statusVariant(log.status)} className="text-xs">
                              {log.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            aria-label="View details"
                            className="p-1.5 hover:bg-wl-bg-elevated rounded transition-colors text-wl-text-tertiary hover:text-wl-text-primary"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {selectedLog && (
        <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
