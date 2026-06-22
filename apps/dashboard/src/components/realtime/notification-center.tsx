"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Package,
  Truck,
  AlertTriangle,
  Settings,
  CheckCheck as CheckAll,
  X,
} from "lucide-react";
import {
  useNotifications,
  type Notification,
} from "@/hooks/use-notifications";

interface NotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ORDERS:     <Package className="w-4 h-4" />,
  DELIVERIES: <Truck className="w-4 h-4" />,
  ALERTS:     <AlertTriangle className="w-4 h-4" />,
  SYSTEM:     <Settings className="w-4 h-4" />,
  DRIVERS:    <Truck className="w-4 h-4" />,
  PAYMENTS:   <Package className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  ORDERS:     "bg-wl-primary-500/12 text-wl-primary-400",
  DELIVERIES: "bg-wl-info-bg text-wl-info-400",
  ALERTS:     "bg-wl-warning-bg text-wl-warning-400",
  SYSTEM:     "bg-wl-bg-surface text-wl-text-secondary",
  DRIVERS:    "bg-wl-info-bg text-wl-info-400",
  PAYMENTS:   "bg-wl-success-bg text-wl-success-400",
};

function timeAgo(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
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
      <div className={cn("mt-1 p-2 rounded-lg flex-shrink-0", colorCls)}>
        {icon}
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
          <span className="text-xs text-wl-text-secondary">
            {timeAgo(notification.timestamp)}
          </span>
          {isUnread && (
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } =
    useNotifications();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      onNotificationClick?.(notification);
    }
    setIsOpen(false);
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
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full text-xs p-0"
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
            <h3 className="font-semibold text-sm text-wl-text-primary">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded hover:bg-wl-bg-surface text-wl-text-secondary transition-colors"
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
                  onClick={() => handleClick(n)}
                  onMarkAsRead={() => markAsRead(n.id)}
                />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-wl-border-subtle">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsOpen(false)}
                asChild
              >
                <a href="/notifications">View All Notifications</a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
