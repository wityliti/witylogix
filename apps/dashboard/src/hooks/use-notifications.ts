'use client';

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

export function useNotifications(filters?: ApiFilters): UseApiListResult<Notification> {
  return useApiList<Notification>('/api/v4/notifications', filters);
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

export function useNotificationPreferences(): UseApiQueryResult<NotificationPreferences> {
  return useApiQuery<NotificationPreferences>('/api/v4/notification-preferences');
}

export function useUpdateNotificationPreferences(): UseApiMutationResult<NotificationPreferences> {
  return useApiMutation<NotificationPreferences>('PATCH', '/api/v4/notification-preferences');
}

export function useDeliveryLog(filters?: ApiFilters): UseApiListResult<DeliveryLogEntry> {
  return useApiList<DeliveryLogEntry>('/api/v4/notifications/delivery-log', filters);
}
