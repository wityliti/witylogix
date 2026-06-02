"use client";

import { useState, useEffect, useRef } from "react";
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
  Volume2,
  VolumeX,
  X,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useNotifications, type Notification } from "@/hooks/use-notifications";

type NotifType = "ORDERS" | "DELIVERIES" | "DRIVERS" | "PAYMENTS" | "SYSTEM" | "ALERTS";

interface NotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ORDERS: <Package className="w-4 h-4" />,
  DELIVERIES: <Truck className="w-4 h-4" />,
  DRIVERS: <Truck className="w-4 h-4" />,
  ALERTS: <AlertTriangle className="w-4 h-4" />,
  SYSTEM: <Settings className="w-4 h-4" />,
  PAYMENTS: <Package className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  ORDERS: "bg-wl-primary-500/12 text-wl-primary-400",
  DELIVERIES: "bg-wl-info-bg text-wl-info-400",
  DRIVERS: "bg-wl-info-bg text-wl-info-400",
  ALERTS: "bg-wl-warning-bg text-wl-warning-400",
  SYSTEM: "bg-wl-bg-surface text-wl-text-secondary",
  PAYMENTS: "bg-emerald-500/12 text-emerald-400",
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
  const category = notification.category as string;

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 border-b border-wl-border-subtle transition-colors",
        isUnread && "bg-wl-bg-surface",
        "hover:bg-wl-bg-overlay cursor-pointer flex items-start gap-3"
      )}
    >
      <div className={cn("mt-1 p-2 rounded-lg flex-shrink-0", TYPE_COLORS[category] ?? "bg-wl-bg-surface text-wl-text-secondary")}>
        {TYPE_ICONS[category] ?? <Bell className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
            {category}
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
          {isUnread && (
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

export function NotificationCenter({ className, onNotificationClick }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevCountRef = useRef<number>(0);

  const {
    notifications: rawNotifications,
    isLoading,
    markAsRead: apiMarkAsRead,
    markAllAsRead: apiMarkAllAsRead,
  } = useNotifications({ limit: 20 });

  // Overlay client-side read state on top of server data
  const notifications = rawNotifications.map((n) =>
    readIds.has(n.id) ? { ...n, status: "READ" as const } : n
  );

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

  // Notify when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current > 0) {
      setToastMessage("New notification received");
      setShowToast(true);
      if (soundEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 800;
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
        } catch { /* audio not supported */ }
      }
      setTimeout(() => setShowToast(false), 4000);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, soundEnabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
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

  const markAsRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
    apiMarkAsRead(id).catch(() => {});
  };

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
    apiMarkAllAsRead().catch(() => {});
  };

  return (
    <div className={cn("relative", className)}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-wl-bg-overlay active:bg-wl-bg-surface",
          isOpen && "bg-wl-bg-overlay"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
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

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute right-0 top-12 w-96 max-w-[calc(100vw-1rem)]",
            "bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-xl",
            "z-50 flex flex-col max-h-[28rem] overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-wl-border-subtle flex-shrink-0">
            <h3 className="font-semibold text-sm text-wl-text-primary">Notifications</h3>
            <div className="flex items-center gap-1.5">
              {isLoading && <RefreshCw className="w-3.5 h-3.5 text-wl-text-secondary animate-spin" />}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  soundEnabled
                    ? "bg-wl-primary-500/20 text-wl-primary-400"
                    : "hover:bg-wl-bg-surface text-wl-text-secondary"
                )}
                aria-label={soundEnabled ? "Mute notifications" : "Unmute notifications"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
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

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 text-wl-text-secondary animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                <Bell className="w-6 h-6 text-wl-text-secondary opacity-40" />
                <p className="text-xs text-wl-text-secondary">No recent notifications</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => {
                    markAsRead(n.id);
                    onNotificationClick?.(n);
                    if (n.actionUrl) setIsOpen(false);
                  }}
                  onMarkAsRead={() => markAsRead(n.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-wl-border-subtle flex-shrink-0">
              <Link href="/notifications" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View All Notifications
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className={cn(
          "fixed bottom-4 right-4 max-w-sm",
          "bg-wl-bg-elevated border border-wl-border-default rounded-lg",
          "px-4 py-3 flex items-center gap-2",
          "text-wl-text-primary text-sm font-medium shadow-xl z-50"
        )}>
          <Bell className="w-4 h-4 text-wl-primary-400 flex-shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
