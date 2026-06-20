"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApiList } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Package,
  Truck,
  AlertTriangle,
  Settings,
  Check,
  CheckCheck as CheckAll,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

interface Notification {
  id: string;
  type: "order" | "delivery" | "alert" | "system";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
  timestamp: Date;
  actionUrl?: string;
}

interface NotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

const notificationIcons: Record<Notification["type"], React.ReactNode> = {
  order: <Package className="w-4 h-4" />,
  delivery: <Truck className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
};

const notificationTypeLabels: Record<Notification["type"], string> = {
  order: "Order",
  delivery: "Delivery",
  alert: "Alert",
  system: "System",
};

const notificationTypeColors: Record<Notification["type"], string> = {
  order: "bg-wl-primary-500/12 text-wl-primary-400 border-wl-primary-500/20",
  delivery: "bg-wl-info-bg text-wl-info-400",
  alert: "bg-wl-warning-bg text-wl-warning-400",
  system: "bg-wl-bg-surface text-wl-text-secondary",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
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
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 border-b border-wl-border-subtle",
        "transition-colors duration-fast",
        !notification.read && "bg-wl-bg-surface",
        "hover:bg-wl-bg-overlay cursor-pointer",
        "flex items-start gap-3"
      )}
    >
      <div className={cn(
        "mt-1 p-2 rounded-lg flex-shrink-0",
        notificationTypeColors[notification.type]
      )}>
        {notificationIcons[notification.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
            {notificationTypeLabels[notification.type]}
          </span>
          {!notification.read && (
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
          <span className="text-xs text-wl-text-secondary">
            {timeAgo(notification.timestamp)}
          </span>
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead?.();
              }}
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

const CATEGORY_TYPE_MAP: Record<string, Notification["type"]> = {
  order: "order",
  delivery: "delivery",
  alert: "alert",
  system: "system",
  driver: "alert",
  payment: "system",
};

const PRIORITY_SEVERITY_MAP: Record<string, Notification["severity"]> = {
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "info",
  CRITICAL: "critical",
};

export function NotificationCenter({
  className,
  onNotificationClick,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [readOverrides, setReadOverrides] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { items: rawNotifications } = useApiList<any>("/api/v4/notifications", { limit: 20 });

  const notifications = useMemo<Notification[]>(
    () =>
      rawNotifications.map((n) => ({
        id: n.id,
        type: CATEGORY_TYPE_MAP[(n.category ?? "system").toLowerCase()] ?? "system",
        title: n.title ?? n.subject ?? "",
        message: n.body ?? n.message ?? "",
        severity: PRIORITY_SEVERITY_MAP[n.priority ?? "LOW"] ?? "info",
        read: readOverrides.has(n.id) ? true : n.readAt != null,
        timestamp: new Date(n.createdAt ?? Date.now()),
        actionUrl: n.actionUrl ?? undefined,
      })),
    [rawNotifications, readOverrides]
  );

  // Close dropdown when clicking outside
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

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setReadOverrides((prev) => new Set([...prev, id]));
  };

  const markAllAsRead = () => {
    setReadOverrides(new Set(rawNotifications.map((n: any) => n.id)));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      onNotificationClick?.(notification);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Bell Button */}
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
            className={cn(
              "absolute -top-1 -right-1 h-5 w-5",
              "flex items-center justify-center rounded-full",
              "text-xs p-0"
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute right-0 top-12 w-96 max-w-[calc(100vw-1rem)]",
            "bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-xl",
            "z-50 flex flex-col max-h-96 overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-wl-border-subtle">
            <h3 className="font-semibold text-sm text-wl-text-primary">
              Notifications
            </h3>
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
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className={cn(
                    "p-1.5 rounded transition-colors duration-fast",
                    "hover:bg-wl-bg-surface text-wl-text-secondary"
                  )}
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

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center">
                <div>
                  <Bell className="w-6 h-6 text-wl-text-secondary mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-wl-text-secondary">
                    No notifications
                  </p>
                </div>
              </div>
            ) : (
              notifications.slice(0, 20).map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onMarkAsRead={() => markAsRead(notification.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-wl-border-subtle">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsOpen(false)}
              >
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div
          className={cn(
            "fixed bottom-4 right-4 max-w-sm",
            "bg-wl-danger-bg border border-wl-danger-500/30 rounded-lg",
            "px-4 py-3 flex items-center gap-2",
            "text-wl-danger-400 text-sm font-medium",
            "animate-slide-up shadow-lg z-50"
          )}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
