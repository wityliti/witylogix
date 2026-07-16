"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiList } from "@/hooks/use-api";
import {
  Bell,
  Package,
  Truck,
  AlertTriangle,
  Settings,
  CheckCheck as CheckAll,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

interface ApiNotification {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  recipient: string;
  createdAt: string;
}

interface Notification {
  id: string;
  type: "order" | "delivery" | "alert" | "system";
  category: "ORDERS" | "DELIVERIES" | "ALERTS" | "SYSTEM" | "DRIVERS" | "PAYMENTS";
  channel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  status: "READ" | "UNREAD";
  read: boolean;
  timestamp: Date | string;
  actionUrl?: string;
}

interface NotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

function inferType(eventType: string): Notification["type"] {
  const ev = eventType.toLowerCase();
  if (ev.includes("order")) return "order";
  if (ev.includes("delivery") || ev.includes("dispatch")) return "delivery";
  if (ev.includes("alert") || ev.includes("violation") || ev.includes("fail")) return "alert";
  return "system";
}

function inferTitle(eventType: string, channel: string): string {
  const ev = eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${ev} via ${channel}`;
}

function toNotification(raw: ApiNotification): Notification {
  return {
    id: raw.id,
    type: inferType(raw.eventType),
    category: "SYSTEM",
    channel: (raw.channel ?? "EMAIL") as Notification["channel"],
    title: inferTitle(raw.eventType, raw.channel),
    message: `Sent to ${raw.recipient}`,
    severity: raw.status === "FAILED" || raw.status === "BOUNCED" ? "warning" : "info",
    status: raw.status === "DELIVERED" || raw.status === "SENT" ? "READ" : "UNREAD",
    read: raw.status === "DELIVERED" || raw.status === "SENT",
    timestamp: new Date(raw.createdAt),
  };
}

const notificationIcons: Record<Notification["type"], React.ReactNode> = {
  order: <Package className="w-4 h-4" />,
  delivery: <Truck className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ORDERS: <Package className="w-4 h-4" />,
  DELIVERIES: <Truck className="w-4 h-4" />,
  ALERTS: <AlertTriangle className="w-4 h-4" />,
  SYSTEM: <Settings className="w-4 h-4" />,
  DRIVERS: <Truck className="w-4 h-4" />,
  PAYMENTS: <Bell className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  ORDERS:     "bg-wl-primary-500/12 text-wl-primary-400",
  DELIVERIES: "bg-wl-info-bg text-wl-info-400",
  ALERTS:     "bg-wl-warning-bg text-wl-warning-400",
  SYSTEM:     "bg-wl-bg-surface text-wl-text-secondary",
  DRIVERS:    "bg-wl-info-bg text-wl-info-400",
  PAYMENTS:   "bg-wl-success-bg text-wl-success-400",
};

const notificationTypeColors: Record<Notification["type"], string> = {
  order: "bg-wl-primary-500/12 text-wl-primary-400 border-wl-primary-500/20",
  delivery: "bg-wl-info-bg text-wl-info-400",
  alert: "bg-wl-warning-bg text-wl-warning-400",
  system: "bg-wl-bg-surface text-wl-text-secondary",
};

function mapApiNotification(n: ApiNotification): Notification {
  const raw = n as any;
  const rawType = raw.category?.toLowerCase() ?? "system";
  const type: Notification["type"] = (
    ["order", "delivery", "alert", "system"].includes(rawType)
      ? rawType
      : "system"
  ) as Notification["type"];

  const rawSeverity = raw.severity?.toLowerCase() ?? "info";
  const severity: Notification["severity"] = (
    ["info", "warning", "critical"].includes(rawSeverity)
      ? rawSeverity
      : "info"
  ) as Notification["severity"];

  return {
    id: n.id,
    type,
    category: (raw.category ?? "SYSTEM") as Notification["category"],
    channel: (n.channel ?? "EMAIL") as Notification["channel"],
    title: raw.title ?? "",
    message: raw.message ?? "",
    severity,
    status: n.status === "UNREAD" ? "UNREAD" : "READ",
    read: n.status !== "UNREAD",
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(n.createdAt),
    actionUrl: raw.actionUrl,
  };
}

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
}: {
  notification: Notification;
  onClick?: () => void;
  onMarkAsRead?: () => void;
}) {
  const isUnread = notification.status === "UNREAD";
  const icon = CATEGORY_ICON[notification.category] ?? <Bell className="w-4 h-4" />;
  const colorCls = CATEGORY_COLORS[notification.category] ?? "bg-wl-bg-surface text-wl-text-secondary";

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 border-b border-wl-border-subtle flex items-start gap-3",
        "transition-colors duration-fast hover:bg-wl-bg-overlay cursor-pointer",
        isUnread && "bg-wl-bg-surface"
      )}
    >
      <div className={cn("mt-1 p-2 rounded-lg flex-shrink-0", notificationTypeColors[notification.type])}>
        {notificationIcons[notification.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
            {notification.category}
          </span>
          {isUnread && (
            <div className="w-2 h-2 rounded-full bg-wl-primary-500 flex-shrink-0 mt-1" />
          )}
        </div>
        <h4 className="text-sm font-semibold text-wl-text-primary mb-1 line-clamp-1">
          {notification.title}
        </h4>
        <p className="text-xs text-wl-text-secondary line-clamp-2 mb-2">
          {notification.message}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-wl-text-secondary">{timeAgo(notification.timestamp)}</span>
          {!notification.read && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkAsRead?.(); }}
              className="text-xs font-semibold text-wl-primary-400 hover:text-wl-primary-500 transition-colors"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const CATEGORY_MAP: Record<string, string> = {
  order: "ORDERS", shipment: "DELIVERIES", delivery: "DELIVERIES",
  driver: "DRIVERS", system: "SYSTEM", webhook: "SYSTEM", workflow: "SYSTEM",
};

export function NotificationCenter({
  className,
  onNotificationClick,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { items: rawNotifs, loading: isLoading, refetch } = useApiList<any>('/api/v4/notifications', { limit: 20 });

  const apiNotifs = useMemo<Notification[]>(() =>
    rawNotifs.map((n): Notification => ({
      id: n.id,
      type: inferType(n.eventType ?? n.type ?? ""),
      category: (CATEGORY_MAP[n.type ?? n.category] ?? n.category ?? "SYSTEM") as Notification["category"],
      channel: (n.channel ?? "EMAIL") as Notification["channel"],
      title: n.title ?? n.action ?? "Notification",
      message: n.message ?? n.description ?? "",
      severity: "info",
      status: ((n.read ?? n.status === "READ") ? "READ" : "UNREAD") as Notification["status"],
      read: !!(n.read ?? n.status === "READ"),
      timestamp: typeof n.timestamp === "string" ? n.timestamp : (n.createdAt ?? new Date().toISOString()),
      actionUrl: n.actionUrl,
    })),
  [rawNotifs]);

  const notifications = useMemo(() =>
    apiNotifs
      .filter((n) => !deletedIds.has(n.id))
      .map((n) => readIds.has(n.id) ? { ...n, status: "READ" as Notification["status"] } : n),
  [apiNotifs, readIds, deletedIds]);

  // Poll for new notifications every 60 seconds
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => { refetch(); }, 60_000);
    return () => clearInterval(interval);
  }, [isOpen, refetch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => (n as Notification).status === "UNREAD").length;

  const markAsRead = (id: string) => setReadIds((prev) => new Set([...prev, id]));
  const markAllAsRead = () => setReadIds(new Set(rawNotifs.map((r: any) => r.id)));

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) onNotificationClick?.(notification);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors duration-fast",
          "hover:bg-wl-bg-overlay active:bg-wl-bg-surface",
          isOpen && "bg-wl-bg-overlay"
        )}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-wl-text-secondary" />
        {unreadCount > 0 && (
          <Badge
            variant="danger"
            className={cn("absolute -top-1 -right-1 h-5 w-5", "flex items-center justify-center rounded-full", "text-xs p-0")}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute right-0 top-12 w-96 max-w-[calc(100vw-1rem)]",
            "bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-xl",
            "z-50 flex flex-col max-h-[28rem] overflow-hidden"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-wl-border-subtle">
            <h3 className="font-semibold text-sm text-wl-text-primary">Notifications</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  "p-1.5 rounded transition-colors duration-fast",
                  soundEnabled
                    ? "bg-wl-primary-500/20 text-wl-primary-400 hover:bg-wl-primary-500/30"
                    : "hover:bg-wl-bg-surface text-wl-text-secondary"
                )}
                aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded transition-colors duration-fast hover:bg-wl-bg-surface text-wl-text-secondary"
                  aria-label="Mark all as read"
                >
                  <CheckAll className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded hover:bg-wl-bg-surface text-wl-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Bell className="w-5 h-5 text-wl-text-secondary animate-pulse" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center">
                <div>
                  <Bell className="w-6 h-6 text-wl-text-secondary mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-wl-text-secondary">No notifications</p>
                </div>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleNotificationClick(n)}
                  onMarkAsRead={() => markAsRead(n.id)}
                />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-wl-border-subtle">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setIsOpen(false)}>
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
