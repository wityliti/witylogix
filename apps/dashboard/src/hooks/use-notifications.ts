'use client';

import { useState } from 'react';
import { useApiList, useApiQuery, useApiMutation, ApiFilters, UseApiListResult, UseApiQueryResult, UseApiMutationResult } from './use-api';

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

/** Base list hook */
export function useNotificationsList(filters?: ApiFilters): UseApiListResult<Notification> {
  return useApiList<Notification>('/api/v4/notifications', filters);
}

/** Rich composite hook used by the notifications inbox page */
export function useNotifications(filters?: ApiFilters) {
  const listResult = useApiList<Notification>('/api/v4/notifications', filters);
  const markReadMutation = useApiMutation<Notification>('PATCH', '/api/v4/notifications/:id/read');
  const markUnreadMutation = useApiMutation<Notification>('PATCH', '/api/v4/notifications/:id/unread');
  const deleteMutation = useApiMutation<void>('DELETE', '/api/v4/notifications/:id');
  const markAllReadMutation = useApiMutation<void>('POST', '/api/v4/notifications/mark-all-read');
  const deleteBulkMutation = useApiMutation<void>('POST', '/api/v4/notifications/delete-bulk');

  const unreadCount = listResult.items.filter((n) => n.status === 'UNREAD').length;
  const hasMore = listResult.pagination.page < listResult.pagination.totalPages;

  return {
    notifications: listResult.items,
    isLoading: listResult.loading,
    error: listResult.error,
    hasMore,
    unreadCount,
    pagination: listResult.pagination,
    refetch: listResult.refetch,
    loadMore: async () => { listResult.setPage(listResult.pagination.page + 1); },
    markAsRead: async (id: string) => { await markReadMutation.execute({ id }); listResult.refetch(); },
    markAsUnread: async (id: string) => { await markUnreadMutation.execute({ id }); listResult.refetch(); },
    markAllAsRead: async () => { await markAllReadMutation.execute({}); listResult.refetch(); },
    deleteNotification: async (id: string) => { await deleteMutation.execute({ id }); listResult.refetch(); },
    deleteBulk: async (ids: string[]) => { await deleteBulkMutation.execute({ ids }); listResult.refetch(); },
  };
}

export function useNotificationDetail(id: string | null): UseApiQueryResult<Notification> {
  return useApiQuery<Notification>(id ? `/api/v4/notifications/${id}` : null);
}

export function useMarkNotificationAsRead(id: string): UseApiMutationResult<Notification> {
  return useApiMutation<Notification>('PATCH', `/api/v4/notifications/${id}/read`);
}

export function useDeleteNotification(id: string): UseApiMutationResult<void> {
  return useApiMutation<void>('DELETE', `/api/v4/notifications/${id}`);
}

/** Base query hook for preferences */
export function useNotificationPreferencesQuery(): UseApiQueryResult<NotificationPreferences> {
  return useApiQuery<NotificationPreferences>('/api/v4/notification-preferences');
}

/** Rich composite hook used by the notification preferences page */
export function useNotificationPreferences() {
  const queryResult = useApiQuery<NotificationPreferences>('/api/v4/notification-preferences');
  const updateMutation = useApiMutation<NotificationPreferences>('PATCH', '/api/v4/notification-preferences');
  const [isSaving, setIsSaving] = useState(false);

  const updatePreferences = async (prefs: Partial<NotificationPreferences>) => {
    setIsSaving(true);
    try {
      await updateMutation.execute(prefs);
      queryResult.refetch();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChannelCategory = async (channel: NotificationChannel, category: NotificationCategory) => {
    const current = queryResult.data;
    if (!current) return;
    const existing = current.channelMatrix.find(
      (p) => p.channel === channel && p.category === category
    );
    await updatePreferences({
      channelMatrix: existing
        ? current.channelMatrix.map((p) =>
            p.channel === channel && p.category === category ? { ...p, enabled: !p.enabled } : p
          )
        : [...current.channelMatrix, { channel, category, enabled: true }],
    });
  };

  return {
    preferences: queryResult.data,
    isLoading: queryResult.loading,
    isSaving,
    error: queryResult.error,
    refetch: queryResult.refetch,
    updatePreferences,
    toggleChannelCategory,
  };
}

export function useUpdateNotificationPreferences(): UseApiMutationResult<NotificationPreferences> {
  return useApiMutation<NotificationPreferences>('PATCH', '/api/v4/notification-preferences');
}

/** Base list hook */
export function useDeliveryLogList(filters?: ApiFilters): UseApiListResult<DeliveryLogEntry> {
  return useApiList<DeliveryLogEntry>('/api/v4/notifications/delivery-log', filters);
}

/** Rich composite hook used by the delivery log page */
export function useDeliveryLog(filters?: ApiFilters) {
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilters, setFilters] = useState<ApiFilters>(filters ?? {});
  const listResult = useApiList<DeliveryLogEntry>('/api/v4/notifications/delivery-log', {
    ...logFilters,
    search: searchQuery,
  });
  const exportMutation = useApiMutation<{ url: string }>('POST', '/api/v4/notifications/delivery-log/export');

  const hasMore = listResult.pagination.page < listResult.pagination.totalPages;

  return {
    entries: listResult.items,
    isLoading: listResult.loading,
    error: listResult.error,
    hasMore,
    pagination: listResult.pagination,
    searchQuery,
    filters: logFilters,
    setSearchQuery,
    setFilters,
    refetch: listResult.refetch,
    loadMore: () => { listResult.setPage(listResult.pagination.page + 1); },
    exportCSV: async () => { await exportMutation.execute({}); },
  };
}
