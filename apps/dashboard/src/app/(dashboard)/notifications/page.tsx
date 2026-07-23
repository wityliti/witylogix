"use client";

import { useState, useMemo, useCallback, ReactNode } from "react";
import dynamic from "next/dynamic";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";
import {
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  Webhook,
  Slack,
  Trash2,
  Check,
  ChevronDown,
  LayoutList,
  Map,
} from "lucide-react";
import Link from "next/link";
import {
  useNotifications,
  type Notification,
  type NotificationCategory,
  type NotificationChannel,
} from "@/hooks/use-notifications";
import { ErrorState } from "@/components/ui/error-state";

const NotificationsCoverageMap = dynamic(
  () =>
    import("./components/notifications-coverage-map").then(
      (m) => m.NotificationsCoverageMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-xl bg-wl-bg-overlay border border-wl-border-default animate-pulse" />
    ),
  },
);

/**
 * Notification Inbox Page - Professional Dark Theme
 * Manages notifications with read/unread status, category filters, bulk actions
 */

export default function NotificationsPage() {
  const {
    notifications,
    isLoading,
    error,
    hasMore,
    unreadCount,
    loadMore,
    refetch: refetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    deleteBulk,
  } = useNotifications();

  const [view, setView] = useState<"inbox" | "coverage">("inbox");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");
  const [selectedCategory, setSelectedCategory] = useState<
    NotificationCategory | "ALL"
  >("ALL");
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === "unread" && n.status !== "UNREAD") return false;
      if (activeTab === "read" && n.status !== "READ") return false;
      if (selectedCategory !== "ALL" && n.category !== selectedCategory)
        return false;
      return true;
    });
  }, [notifications, activeTab, selectedCategory]);

  // Calculate counts
  const readCount = notifications.filter(
    (n) => n.status === "READ"
  ).length;
  const allCount = notifications.length;

  // Tab configuration
  const tabs = [
    { id: "all", label: `All (${allCount})` },
    { id: "unread", label: `Unread (${unreadCount})` },
    { id: "read", label: `Read (${readCount})` },
  ];

  // Category chips
  const categories: { id: NotificationCategory | "ALL"; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "ORDERS", label: "Orders" },
    { id: "DELIVERIES", label: "Deliveries" },
    { id: "DRIVERS", label: "Drivers" },
    { id: "PAYMENTS", label: "Payments" },
    { id: "SYSTEM", label: "System" },
  ];

  // Handle bulk actions
  const handleSelectAll = useCallback(() => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(
        new Set(filteredNotifications.map((n) => n.id))
      );
    }
  }, [filteredNotifications, selectedNotifications]);

  const handleToggleNotification = useCallback((id: string) => {
    setSelectedNotifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkMarkAsRead = useCallback(async () => {
    const ids = Array.from(selectedNotifications);
    for (const id of ids) {
      await markAsRead(id);
    }
    setSelectedNotifications(new Set());
  }, [selectedNotifications, markAsRead]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedNotifications);
    await deleteBulk(ids);
    setSelectedNotifications(new Set());
  }, [selectedNotifications, deleteBulk]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  }, [loadMore]);

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-root">
        <Header
          title="Notifications"
          subtitle="Manage and view all your notifications"
          actions={
            <Link href="/notifications/preferences">
              <Button variant="secondary" size="sm">Preferences</Button>
            </Link>
          }
        />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState
            message={error instanceof Error ? error.message : "Failed to load notifications"}
            onRetry={refetchNotifications}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Notifications"
        subtitle="Manage and view all your notifications"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
              <button
                onClick={() => setView("inbox")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "inbox"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-muted hover:text-wl-text-primary",
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Inbox
              </button>
              <button
                onClick={() => setView("coverage")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "coverage"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-muted hover:text-wl-text-primary",
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Coverage Map
              </button>
            </div>
            <Link href="/notifications/preferences">
              <Button variant="secondary" size="sm">
                Preferences
              </Button>
            </Link>
          </div>
        }
      />

      {/* Coverage Map view */}
      {view === "coverage" && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-wl-text-primary">Notification Coverage Map</h2>
            <p className="text-sm text-wl-text-secondary mt-0.5">
              Geographic heatmap of where notifications were sent, based on delivery addresses of associated orders.
            </p>
          </div>
          <NotificationsCoverageMap />
        </main>
      )}

      {view === "inbox" && (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Tab Navigation */}
          <Tabs
            tabs={tabs as any}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
            variant="pills"
            size="md"
          />

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  "transition-colors duration-200",
                  "border cursor-pointer",
                  selectedCategory === cat.id
                    ? "border-wl-info-500 bg-wl-info-500/20 text-wl-info-400"
                    : "border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Bulk Actions Bar */}
          {selectedNotifications.size > 0 && (
            <Card className={cn("border-wl-info-500/30 bg-wl-info-bg")}>
              <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm text-wl-text-secondary">
                  {selectedNotifications.size} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkMarkAsRead}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Mark as Read
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications List */}
          <Card className={cn("bg-wl-bg-surface border-wl-border-default")}>
            <CardContent className="p-0">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="w-12 h-12 text-wl-text-secondary mb-3" />
                  <p className="text-wl-text-secondary">
                    No notifications to display
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-wl-border-default">
                  {/* Header Row */}
                  <div className="flex items-center gap-4 px-6 py-3 bg-wl-bg-elevated border-b border-wl-border-default">
                    <Checkbox
                      checked={
                        selectedNotifications.size ===
                        filteredNotifications.length
                      }
                      onChange={handleSelectAll}
                    />
                    <span className="flex-1 text-xs font-semibold uppercase text-wl-text-secondary tracking-wide">
                      Message
                    </span>
                    <span className="w-24 text-xs font-semibold uppercase text-wl-text-secondary tracking-wide">
                      Channel
                    </span>
                    <span className="w-24 text-xs font-semibold uppercase text-wl-text-secondary tracking-wide">
                      Time
                    </span>
                  </div>

                  {/* Notification Rows */}
                  {filteredNotifications.map((notif) => {
                    const isExpanded = expandedId === notif.id;
                    const isSelected = selectedNotifications.has(notif.id);

                    return (
                      <div key={notif.id}>
                        <div
                          className={cn(
                            "flex items-center gap-4 px-6 py-4",
                            "hover:bg-wl-bg-elevated cursor-pointer transition-colors",
                            isSelected && "bg-wl-bg-elevated",
                            notif.status === "UNREAD" &&
                              "bg-wl-info-bg border-l-2 border-wl-info-500"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() =>
                              handleToggleNotification(notif.id)
                            }
                          />

                          {/* Read/Unread Indicator */}
                          <div className="flex-shrink-0 w-2 h-2">
                            {notif.status === "UNREAD" && (
                              <div className="w-2 h-2 rounded-full bg-wl-info-500" />
                            )}
                          </div>

                          {/* Channel Icon */}
                          <div className="flex-shrink-0">
                            {getChannelIcon(notif.channel)}
                          </div>

                          {/* Message Content */}
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() =>
                              setExpandedId(
                                isExpanded ? null : notif.id
                              )
                            }
                          >
                            <div className="font-medium text-wl-text-primary">
                              {notif.title}
                            </div>
                            <div className="text-sm text-wl-text-secondary truncate">
                              {notif.message}
                            </div>
                          </div>

                          {/* Category Badge */}
                          <div className="w-24">
                            <Badge
                              variant="info"
                              className="text-xs"
                            >
                              {notif.category}
                            </Badge>
                          </div>

                          {/* Timestamp */}
                          <div className="w-24 text-sm text-wl-text-tertiary text-right">
                            {formatTime(notif.timestamp)}
                          </div>

                          {/* Expand Icon */}
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-wl-text-tertiary transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="bg-wl-bg-elevated px-6 py-4 border-t border-wl-border-default">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-semibold text-wl-text-primary mb-2">
                                  Details
                                </h4>
                                <p className="text-sm text-wl-text-secondary">
                                  {notif.message}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-wl-text-secondary uppercase tracking-wide font-semibold">
                                    Status
                                  </p>
                                  <Badge
                                    variant={
                                      notif.status === "UNREAD"
                                        ? "warning"
                                        : "success"
                                    }
                                  >
                                    {notif.status}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-wl-text-secondary uppercase tracking-wide font-semibold">
                                    Timestamp
                                  </p>
                                  <p className="text-sm text-wl-text-secondary">
                                    {new Date(
                                      notif.timestamp
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {notif.actionUrl && (
                                <div className="pt-2 border-t border-wl-border-default">
                                  <Link href={notif.actionUrl}>
                                    <Button variant="primary" size="sm">
                                      View Details
                                    </Button>
                                  </Link>
                                </div>
                              )}

                              <div className="flex gap-2 pt-2 border-t border-wl-border-default">
                                {notif.status === "UNREAD" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      markAsRead(notif.id)
                                    }
                                  >
                                    Mark as Read
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      markAsUnread(notif.id)
                                    }
                                  >
                                    Mark as Unread
                                  </Button>
                                )}
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() =>
                                    deleteNotification(notif.id)
                                  }
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <Card className={cn("bg-wl-bg-surface border-wl-border-default")}>
              <CardContent className="space-y-3 py-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-5 h-5 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="w-16 h-4" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      )}
    </div>
  );
}

// Helpers

function getChannelIcon(channel: NotificationChannel): ReactNode {
  const iconProps = "w-5 h-5 text-wl-text-secondary";

  switch (channel) {
    case "EMAIL":
      return <Mail className={iconProps} />;
    case "SMS":
      return <MessageSquare className={iconProps} />;
    case "PUSH":
      return <Bell className={iconProps} />;
    case "WHATSAPP":
      return <MessageCircle className={iconProps} />;
    case "WEBHOOK":
      return <Webhook className={iconProps} />;
    case "SLACK":
      return <Slack className={iconProps} />;
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
