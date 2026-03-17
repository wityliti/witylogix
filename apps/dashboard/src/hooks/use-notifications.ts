/**
 * Notification hooks — Core notification management
 *
 * Handles:
 * - useNotifications: paginated list with real-time prepend
 * - useNotificationPreferences: get/update preferences matrix
 * - useDeliveryLog: filterable, searchable delivery history
 * - useNotificationCount: unread badge count via WebSocket
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── TYPES ──────────────────────────────────────────────────────────

export type NotificationChannel =
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "PUSH"
  | "WEBHOOK"
  | "SLACK";

export type NotificationCategory =
  | "ORDERS"
  | "DELIVERIES"
  | "DRIVERS"
  | "PAYMENTS"
  | "SYSTEM"
  | "ALERTS";

export type NotificationStatus =
  | "UNREAD"
  | "READ"
  | "ARCHIVED"
  | "DISMISSED";

export type DeliveryStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "BOUNCED"
  | "PENDING";

export type DigestFrequency = "IMMEDIATE" | "HOURLY" | "DAILY";

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  status: NotificationStatus;
  iconChannel: NotificationChannel;
  timestamp: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreference {
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface DigestSettings {
  enabled: boolean;
  frequency: DigestFrequency;
  time?: string;
}

export interface NotificationPreferences {
  channelMatrix: NotificationPreference[];
  quietHours: QuietHours;
  digestSettings: DigestSettings;
}

export interface DeliveryLogEntry {
  id: string;
  message: string;
  channel: NotificationChannel;
  recipient: string;
  status: DeliveryStatus;
  timestamp: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
  retryCount: number;
}

export interface UseNotificationsOptions {
  pageSize?: number;
  autoSubscribe?: boolean;
}

export interface UseNotificationsState {
  notifications: Notification[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;
  totalCount: number;
  unreadCount: number;
  loadMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAsUnread: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteBulk: (notificationIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseDeliveryLogOptions {
  pageSize?: number;
  initialFilters?: {
    channel?: NotificationChannel;
    status?: DeliveryStatus;
    startDate?: string;
    endDate?: string;
  };
}

export interface UseDeliveryLogState {
  entries: DeliveryLogEntry[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;
  searchQuery: string;
  filters: {
    channel?: NotificationChannel;
    status?: DeliveryStatus;
    startDate?: string;
    endDate?: string;
  };
  setSearchQuery: (query: string) => void;
  setFilters: (
    filters: UseDeliveryLogOptions["initialFilters"]
  ) => void;
  loadMore: () => Promise<void>;
  exportCSV: () => Promise<Blob>;
}

// ─── MOCK DATA ──────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    title: "Order #ORD-5234 Confirmed",
    message: "Your order has been confirmed and is being processed",
    category: "ORDERS",
    channel: "EMAIL",
    status: "UNREAD",
    iconChannel: "EMAIL",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    actionUrl: "/orders/ORD-5234",
    metadata: { orderId: "ORD-5234" },
  },
  {
    id: "notif-2",
    title: "Shipment #SHP-8932 Delivered",
    message: "Your shipment has been successfully delivered",
    category: "DELIVERIES",
    channel: "SMS",
    status: "UNREAD",
    iconChannel: "SMS",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    actionUrl: "/shipments/SHP-8932",
  },
  {
    id: "notif-3",
    title: "Driver #DRV-441 Assigned",
    message: "Driver John Doe has been assigned to your delivery",
    category: "DRIVERS",
    channel: "PUSH",
    status: "READ",
    iconChannel: "PUSH",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "notif-4",
    title: "Payment Received",
    message: "$2,450.00 received from Invoice #INV-2341",
    category: "PAYMENTS",
    channel: "EMAIL",
    status: "READ",
    iconChannel: "EMAIL",
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "notif-5",
    title: "System Maintenance",
    message: "Scheduled maintenance on March 20, 2025 at 2:00 AM UTC",
    category: "SYSTEM",
    channel: "EMAIL",
    status: "READ",
    iconChannel: "EMAIL",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

const MOCK_DELIVERY_LOG: DeliveryLogEntry[] = [
  {
    id: "del-1",
    message: "Order #ORD-5234 Confirmed",
    channel: "EMAIL",
    recipient: "customer@example.com",
    status: "DELIVERED",
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    deliveredAt: new Date(Date.now() - 28 * 60000).toISOString(),
    retryCount: 0,
  },
  {
    id: "del-2",
    message: "Shipment #SHP-8932 Delivered",
    channel: "SMS",
    recipient: "+1-555-0123",
    status: "DELIVERED",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    deliveredAt: new Date(Date.now() - 1.9 * 3600000).toISOString(),
    retryCount: 0,
  },
  {
    id: "del-3",
    message: "Payment Reminder",
    channel: "EMAIL",
    recipient: "merchant@example.com",
    status: "BOUNCED",
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    error: "Invalid email address",
    retryCount: 2,
  },
  {
    id: "del-4",
    message: "Delivery Update",
    channel: "PUSH",
    recipient: "device_token_abc123",
    status: "SENT",
    timestamp: new Date(Date.now() - 10 * 3600000).toISOString(),
    retryCount: 1,
  },
  {
    id: "del-5",
    message: "Invoice #INV-2341",
    channel: "EMAIL",
    recipient: "accounting@example.com",
    status: "READ",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
    deliveredAt: new Date(Date.now() - 1 * 86400000 + 5 * 60000).toISOString(),
    readAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    retryCount: 0,
  },
];

// ─── HOOKS ──────────────────────────────────────────────────────────

/**
 * Hook for managing paginated notification list with real-time updates
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsState {
  const { pageSize = 20, autoSubscribe = true } = options;

  const [notifications, setNotifications] = useState<Notification[]>(
    MOCK_NOTIFICATIONS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const totalCount = 47;
  const unreadCount = notifications.filter(
    (n) => n.status === "UNREAD"
  ).length;
  const hasMore = page * pageSize < totalCount;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPage((p) => p + 1);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
      setIsLoading(false);
    }
  }, [isLoading, hasMore]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, status: "READ" } : n
      )
    );
  }, []);

  const markAsUnread = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, status: "UNREAD" } : n
      )
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: "READ" }))
    );
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const deleteBulk = useCallback(async (notificationIds: string[]) => {
    setNotifications((prev) =>
      prev.filter((n) => !notificationIds.includes(n.id))
    );
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPage(1);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
      setIsLoading(false);
    }
  }, []);

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!autoSubscribe) return;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/api/notifications/stream`
        );

        ws.onmessage = (event) => {
          try {
            const newNotif = JSON.parse(event.data) as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
          } catch (e) {
            console.error("Failed to parse notification:", e);
          }
        };

        ws.onerror = () => {
          setError("WebSocket connection failed");
        };

        wsRef.current = ws;
      } catch (err) {
        // WebSocket not available, silently fail
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoSubscribe]);

  return {
    notifications,
    isLoading,
    hasMore,
    page,
    error,
    totalCount,
    unreadCount,
    loadMore,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    deleteBulk,
    refresh,
  };
}

/**
 * Hook for managing notification preferences
 */
export function useNotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPreferences({
          channelMatrix: generateChannelMatrix(),
          quietHours: {
            enabled: true,
            startTime: "22:00",
            endTime: "08:00",
            timezone: "America/New_York",
          },
          digestSettings: {
            enabled: true,
            frequency: "DAILY",
            time: "09:00",
          },
        });
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preferences");
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      setIsSaving(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setPreferences((prev) => prev ? { ...prev, ...updates } : null);
        setIsSaving(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save preferences");
        setIsSaving(false);
      }
    },
    []
  );

  const toggleChannelCategory = useCallback(
    async (channel: NotificationChannel, category: NotificationCategory) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          channelMatrix: prev.channelMatrix.map((pref) =>
            pref.channel === channel && pref.category === category
              ? { ...pref, enabled: !pref.enabled }
              : pref
          ),
        };
      });
    },
    []
  );

  return {
    preferences,
    isLoading,
    isSaving,
    error,
    updatePreferences,
    toggleChannelCategory,
  };
}

/**
 * Hook for managing delivery log with filtering and search
 */
export function useDeliveryLog(
  options: UseDeliveryLogOptions = {}
): UseDeliveryLogState {
  const { pageSize = 20, initialFilters = {} } = options;

  const [entries, setEntries] = useState<DeliveryLogEntry[]>(
    MOCK_DELIVERY_LOG
  );
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  const totalCount = 142;
  const hasMore = page * pageSize < totalCount;

  const filteredEntries = entries.filter((entry) => {
    if (
      searchQuery &&
      !entry.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !entry.recipient.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (filters.channel && entry.channel !== filters.channel) {
      return false;
    }
    if (filters.status && entry.status !== filters.status) {
      return false;
    }
    return true;
  });

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPage((p) => p + 1);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
      setIsLoading(false);
    }
  }, [isLoading, hasMore]);

  const exportCSV = useCallback(async (): Promise<Blob> => {
    const csv = [
      ["Message", "Channel", "Recipient", "Status", "Timestamp", "Retries"],
      ...filteredEntries.map((e) => [
        e.message,
        e.channel,
        e.recipient,
        e.status,
        new Date(e.timestamp).toISOString(),
        e.retryCount.toString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    return new Blob([csv], { type: "text/csv" });
  }, [filteredEntries]);

  return {
    entries: filteredEntries,
    isLoading,
    hasMore,
    page,
    error,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    loadMore,
    exportCSV,
  };
}

/**
 * Hook for unread notification count via WebSocket
 */
export function useNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<"connected" | "disconnected">(
    "disconnected"
  );
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/api/notifications/count`
        );

        ws.onopen = () => {
          setStatus("connected");
        };

        ws.onmessage = (event) => {
          try {
            const { count } = JSON.parse(event.data);
            setUnreadCount(count);
          } catch (e) {
            console.error("Failed to parse count:", e);
          }
        };

        ws.onerror = () => {
          setStatus("disconnected");
        };

        wsRef.current = ws;
      } catch {
        // WebSocket not available
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { unreadCount, status };
}

// ─── HELPERS ────────────────────────────────────────────────────────

function generateChannelMatrix(): NotificationPreference[] {
  const channels: NotificationChannel[] = [
    "EMAIL",
    "SMS",
    "PUSH",
    "WHATSAPP",
    "WEBHOOK",
    "SLACK",
  ];
  const categories: NotificationCategory[] = [
    "ORDERS",
    "DELIVERIES",
    "DRIVERS",
    "PAYMENTS",
    "SYSTEM",
    "ALERTS",
  ];

  return channels.flatMap((channel) =>
    categories.map((category) => ({
      channel,
      category,
      enabled: true,
    }))
  );
}
