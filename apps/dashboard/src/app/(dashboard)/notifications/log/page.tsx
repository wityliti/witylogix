"use client";

import { useState } from "react";
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
import { useApiList } from '@/hooks/use-api';
  Download,
  Eye,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

type Channel = "email" | "sms" | "whatsapp" | "push";
type EventType =
  | "order_confirmed"
  | "delivery_scheduled"
  | "out_for_delivery"
  | "delivery_arriving"
  | "delivered"
  | "delivery_failed"
  | "rescheduled";
type NotificationStatus = "sent" | "delivered" | "failed" | "bounced" | "pending";

interface DeliveryAttempt {
  timestamp: Date;
  status: NotificationStatus;
  errorCode?: string;
  errorMessage?: string;
}

interface NotificationLog {
  id: string;
  timestamp: Date;
  recipient: string;
  channel: Channel;
  eventType: EventType;
  templateName: string;
  status: NotificationStatus;
  messageId?: string;
  messagePreview: string;
  cost: number;
  attempts: DeliveryAttempt[];
}

const NOTIFICATION_LOGS: NotificationLog[] = [
  {
    id: "nlog1",
    timestamp: new Date("2026-03-11T14:30:00"),
    recipient: "customer@example.com",
    channel: "email",
    eventType: "order_confirmed",
    templateName: "Order Confirmation",
    status: "delivered",
    messageId: "msg_1234567890",
    messagePreview: "Your order #ORD-123456 has been confirmed",
    cost: 0.01,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:30:05"),
        status: "delivered",
      },
    ],
  },
  {
    id: "nlog2",
    timestamp: new Date("2026-03-11T14:25:00"),
    recipient: "+1234567890",
    channel: "sms",
    eventType: "out_for_delivery",
    templateName: "Out for Delivery SMS",
    status: "delivered",
    messageId: "msg_1234567891",
    messagePreview: "Your delivery is on the way! Track: https://track.example.com",
    cost: 0.05,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:25:10"),
        status: "delivered",
      },
    ],
  },
  {
    id: "nlog3",
    timestamp: new Date("2026-03-11T14:20:00"),
    recipient: "+201012345678",
    channel: "whatsapp",
    eventType: "delivery_scheduled",
    templateName: "Delivery Scheduled",
    status: "delivered",
    messageId: "msg_1234567892",
    messagePreview: "Your delivery is scheduled for March 12, 2026",
    cost: 0.02,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:20:15"),
        status: "delivered",
      },
    ],
  },
  {
    id: "nlog4",
    timestamp: new Date("2026-03-11T14:15:00"),
    recipient: "customer2@example.com",
    channel: "email",
    eventType: "delivery_failed",
    templateName: "Delivery Failed",
    status: "failed",
    messageId: "msg_1234567893",
    messagePreview: "Unfortunately, we couldn't deliver your package",
    cost: 0.01,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:15:00"),
        status: "failed",
        errorCode: "INVALID_EMAIL",
        errorMessage: "Email address not found",
      },
    ],
  },
  {
    id: "nlog5",
    timestamp: new Date("2026-03-11T14:10:00"),
    recipient: "push-token-xyz",
    channel: "push",
    eventType: "delivered",
    templateName: "Delivery Confirmation",
    status: "sent",
    messageId: "msg_1234567894",
    messagePreview: "Your order has been delivered successfully",
    cost: 0,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:10:05"),
        status: "sent",
      },
    ],
  },
  {
    id: "nlog6",
    timestamp: new Date("2026-03-11T14:05:00"),
    recipient: "+9876543210",
    channel: "sms",
    eventType: "order_confirmed",
    templateName: "Order Confirmation SMS",
    status: "bounced",
    messageId: "msg_1234567895",
    messagePreview: "Order confirmed! Track: https://track.example.com",
    cost: 0.05,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:05:00"),
        status: "bounced",
        errorCode: "INVALID_NUMBER",
        errorMessage: "Phone number no longer valid",
      },
    ],
  },
  {
    id: "nlog7",
    timestamp: new Date("2026-03-11T14:00:00"),
    recipient: "customer3@example.com",
    channel: "email",
    eventType: "rescheduled",
    templateName: "Rescheduled Notification",
    status: "pending",
    messageId: "msg_1234567896",
    messagePreview: "Your delivery has been rescheduled",
    cost: 0.01,
    attempts: [
      {
        timestamp: new Date("2026-03-11T14:00:00"),
        status: "pending",
      },
    ],
  },
];

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  push: <Bell className="w-4 h-4" />,
};

const STATUS_ICONS: Record<NotificationStatus, React.ReactNode> = {
  sent: <CheckCircle className="w-4 h-4 text-[var(--wl-success)]" />,
  delivered: <CheckCircle className="w-4 h-4 text-[var(--wl-success)]" />,
  failed: <AlertCircle className="w-4 h-4 text-[var(--wl-danger)]" />,
  bounced: <AlertCircle className="w-4 h-4 text-[var(--wl-warning)]" />,
  pending: <Clock className="w-4 h-4 text-[var(--wl-text-secondary)]" />,
};

const getStatusVariant = (status: NotificationStatus) => {
  switch (status) {
    case "delivered":
    case "sent":
      return "success";
    case "failed":
      return "danger";
    case "bounced":
      return "warning";
    case "pending":
      return "info";
  }
};

interface DetailModalProps {
  log?: NotificationLog;
  isOpen: boolean;
  onClose: () => void;
}

const DetailModal = ({ log, isOpen, onClose }: DetailModalProps) => {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="border border-[var(--wl-border)] w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <CardHeader>
          <CardTitle>Notification Details</CardTitle>
          <CardDescription>Message ID: {log.messageId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-1">
                Recipient
              </p>
              <p className="text-sm text-[var(--wl-text-primary)]">{log.recipient}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-1">
                Channel
              </p>
              <p className="text-sm text-[var(--wl-text-primary)] capitalize">
                {log.channel}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-1">
                Status
              </p>
              <Badge variant={getStatusVariant(log.status) as any}>
                {log.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-1">
                Cost
              </p>
              <p className="text-sm text-[var(--wl-text-primary)]">
                ${log.cost.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--wl-border)] pt-4">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-3">
              Message Preview
            </p>
            <div className="p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
              <p className="text-sm text-[var(--wl-text-primary)] whitespace-pre-wrap">
                {log.messagePreview}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--wl-border)] pt-4">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-3">
              Delivery Attempts ({log.attempts.length})
            </p>
            <div className="space-y-2">
              {log.attempts.map((attempt, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {STATUS_ICONS[attempt.status]}
                      <div>
                        <p className="text-sm font-medium text-[var(--wl-text-primary)] capitalize">
                          {attempt.status}
                        </p>
                        <p className="text-xs text-[var(--wl-text-secondary)]">
                          {attempt.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {attempt.errorMessage && (
                    <div className="mt-2 text-xs">
                      <p className="text-[var(--wl-danger)]">
                        Error: {attempt.errorMessage}
                      </p>
                      <p className="text-[var(--wl-text-secondary)]">
                        Code: {attempt.errorCode}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] rounded-lg hover:bg-[var(--wl-bg-tertiary)] transition-colors"
          >
            Close
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default function NotificationLogPage() {
  const [logs, setLogs] = useState<NotificationLog[]>(NOTIFICATION_LOGS);
  const [selectedLog, setSelectedLog] = useState<NotificationLog>();
  const [showDetail, setShowDetail] = useState(false);
  const [filterChannel, setFilterChannel] = useState<Channel | "all">("all");
  const [filterStatus, setFilterStatus] = useState<NotificationStatus | "all">(
    "all"
  );
  const [filterDateRange, setFilterDateRange] = useState({ from: "", to: "" });

  const filteredLogs = logs.filter((log) => {
    if (filterChannel !== "all" && log.channel !== filterChannel) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    totalSent: logs.length,
    deliveryRate:
      logs.length > 0
        ? (
            ((logs.filter((l) => l.status === "delivered" || l.status === "sent")
              .length /
              logs.length) *
              100)
          ).toFixed(1)
        : "0",
    bounceRate:
      logs.length > 0
        ? (((logs.filter((l) => l.status === "bounced").length / logs.length) * 100).toFixed(1))
        : "0",
    totalCost: logs.reduce((sum, log) => sum + log.cost, 0).toFixed(2),
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Notification Log"
        subtitle="Track sent notifications and delivery status"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Total Sent
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {stats.totalSent}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Delivery Rate
              </p>
              <p className="text-2xl font-bold text-[var(--wl-success)]">
                {stats.deliveryRate}%
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Bounce Rate
              </p>
              <p className="text-2xl font-bold text-[var(--wl-warning)]">
                {stats.bounceRate}%
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Total Cost
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                ${stats.totalCost}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-[var(--wl-border)] mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase block mb-2">
                  Channel
                </label>
                <select
                  value={filterChannel}
                  onChange={(e) =>
                    setFilterChannel(e.target.value as typeof filterChannel)
                  }
                  className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
                >
                  <option value="all">All Channels</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="push">Push</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase block mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(e.target.value as typeof filterStatus)
                  }
                  className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="bounced">Bounced</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase block mb-2">
                  From Date
                </label>
                <Input
                  type="date"
                  value={filterDateRange.from}
                  onChange={(e) =>
                    setFilterDateRange({
                      ...filterDateRange,
                      from: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase block mb-2">
                  To Date
                </label>
                <Input
                  type="date"
                  value={filterDateRange.to}
                  onChange={(e) =>
                    setFilterDateRange({
                      ...filterDateRange,
                      to: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>
                  {filteredLogs.length} Notification
                  {filteredLogs.length !== 1 ? "s" : ""}
                </CardTitle>
              </div>
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-[var(--wl-text-secondary)] text-sm">
                          No notifications found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs text-[var(--wl-text-secondary)]">
                            <Clock className="w-3 h-3" />
                            {log.timestamp.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-primary)] truncate max-w-xs">
                            {log.recipient}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--wl-text-secondary)]">
                              {CHANNEL_ICONS[log.channel]}
                            </span>
                            <span className="text-sm capitalize text-[var(--wl-text-primary)]">
                              {log.channel}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-primary)]">
                            {log.eventType
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-secondary)]">
                            {log.templateName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {STATUS_ICONS[log.status]}
                            <Badge variant={getStatusVariant(log.status) as any}>
                              {log.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-primary)]">
                            ${log.cost.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetail(true);
                            }}
                            className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 text-[var(--wl-text-secondary)]" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <DetailModal
          log={selectedLog}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
        />
      </main>
    </div>
  );
}
