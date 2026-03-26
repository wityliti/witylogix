/**
 * Notification API
 *
 * RESTful endpoints for notification management:
 * - POST /api/notifications/send — send notification (single or batch)
 * - GET /api/notifications — list notifications (paginated, filterable)
 * - GET /api/notifications/:id — get notification with delivery status
 * - PUT /api/notifications/:id/read — mark as read
 * - GET /api/notifications/preferences — get recipient preferences
 * - PUT /api/notifications/preferences — update preferences
 * - POST /api/notifications/templates — create template
 * - GET /api/notifications/templates — list templates
 * - GET /api/notifications/analytics — delivery stats
 * - POST /api/notifications/test — send test notification
 *
 * All inputs validated with Zod schemas
 */

import { z } from "zod";
import type {
  NotificationRequest,
  BatchNotificationRequest,
  NotificationTemplate,
  RecipientPreferences,
} from "./notification-types.js";
import {
  NotificationRequestSchema,
  BatchNotificationRequestSchema,
  NotificationTemplateSchema,
  RecipientPreferencesSchema,
} from "./notification-types.js";

// ─── REQUEST SCHEMAS ────────────────────────────────────────────────────

/**
 * Send notification request
 */
export const SendNotificationRequestSchema = NotificationRequestSchema;

/**
 * Send batch notification request
 */
export const SendBatchNotificationRequestSchema = BatchNotificationRequestSchema;

/**
 * List notifications query
 */
export const ListNotificationsQuerySchema = z.object({
  tenantId: z.string(),
  recipientId: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "DELIVERED", "READ", "FAILED"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

/**
 * Get notification request
 */
export const GetNotificationRequestSchema = z.object({
  tenantId: z.string(),
  notificationId: z.string(),
});

/**
 * Mark as read request
 */
export const MarkAsReadRequestSchema = z.object({
  tenantId: z.string(),
  notificationId: z.string(),
});

/**
 * Update preferences request
 */
export const UpdatePreferencesRequestSchema = RecipientPreferencesSchema;

/**
 * Create template request
 */
export const CreateTemplateRequestSchema = NotificationTemplateSchema;

/**
 * List templates query
 */
export const ListTemplatesQuerySchema = z.object({
  tenantId: z.string(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/**
 * Analytics query
 */
export const AnalyticsQuerySchema = z.object({
  tenantId: z.string(),
  channel: z.string().optional(),
  category: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  groupBy: z.enum(["CHANNEL", "CATEGORY", "STATUS", "DAY"]).default("CHANNEL"),
});

/**
 * Test notification request
 */
export const TestNotificationRequestSchema = z.object({
  tenantId: z.string(),
  recipientId: z.string(),
  templateId: z.string(),
  variables: z.record(z.unknown()).optional(),
});

// ─── RESPONSE TYPES ─────────────────────────────────────────────────────

/**
 * API response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Notification list item
 */
export interface NotificationListItem {
  id: string;
  tenantId: string;
  recipientId: string;
  templateId: string;
  category: string;
  priority: string;
  subject?: string;
  body: string;
  channels: string[];
  status: string;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
}

/**
 * Notification detail response
 */
export interface NotificationDetail {
  id: string;
  tenantId: string;
  recipientId: string;
  templateId: string;
  category: string;
  priority: string;
  subject?: string;
  body: string;
  channels: string[];
  receipts: Array<{
    channel: string;
    status: string;
    timestamp: Date;
    providerMessageId?: string;
    error?: string;
    retryCount: number;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
}

/**
 * Analytics result
 */
export interface AnalyticsResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  groupBy: string;
  data: Array<{
    key: string;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
    pending: number;
    successRate: number;
  }>;
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalRead: number;
    overallSuccessRate: number;
  };
}

// ─── API HANDLER FACTORIES ──────────────────────────────────────────────

/**
 * Create API handlers for notification endpoints
 */
export function createNotificationApiHandlers() {
  return {
    /**
     * Handler: POST /api/notifications/send
     * Send single or batch notification
     */
    async sendNotification(
      body: unknown
    ): Promise<ApiResponse<{ messageIds: string[] }>> {
      try {
        // Try batch first
        const batchValidation = SendBatchNotificationRequestSchema.safeParse(body);
        if (batchValidation.success) {
          const batchRequest = batchValidation.data;
          const messageIds = batchRequest.recipients.map(() =>
            `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          );
          return {
            success: true,
            data: { messageIds },
          };
        }

        // Try single
        const singleValidation = SendNotificationRequestSchema.safeParse(body);
        if (singleValidation.success) {
          const singleRequest = singleValidation.data;
          const messageId =
            singleRequest.id ||
            `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return {
            success: true,
            data: { messageIds: [messageId] },
          };
        }

        return {
          success: false,
          error: `Invalid request: ${singleValidation.error?.message || batchValidation.error?.message}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: GET /api/notifications
     * List notifications with pagination
     */
    async listNotifications(
      query: unknown
    ): Promise<ApiResponse<PaginatedResponse<NotificationListItem>>> {
      try {
        const validation = ListNotificationsQuerySchema.safeParse(query);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid query: ${validation.error.message}`,
          };
        }

        const params = validation.data;
        // In production, fetch from database
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            limit: params.limit,
            offset: params.offset,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: GET /api/notifications/:id
     * Get notification with delivery status
     */
    async getNotification(
      id: string,
      tenantId: string
    ): Promise<ApiResponse<NotificationDetail>> {
      try {
        const validation = GetNotificationRequestSchema.safeParse({
          tenantId,
          notificationId: id,
        });
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid request: ${validation.error.message}`,
          };
        }

        // In production, fetch from database
        return {
          success: false,
          error: "Notification not found",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: PUT /api/notifications/:id/read
     * Mark notification as read
     */
    async markAsRead(
      id: string,
      tenantId: string
    ): Promise<ApiResponse<{ success: true }>> {
      try {
        const validation = MarkAsReadRequestSchema.safeParse({
          tenantId,
          notificationId: id,
        });
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid request: ${validation.error.message}`,
          };
        }

        // In production, update database
        return {
          success: true,
          data: { success: true },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: GET /api/notifications/preferences
     * Get recipient preferences
     */
    async getPreferences(
      tenantId: string,
      recipientId: string
    ): Promise<ApiResponse<RecipientPreferences>> {
      try {
        // In production, fetch from database
        return {
          success: false,
          error: "Preferences not found",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: PUT /api/notifications/preferences
     * Update recipient preferences
     */
    async updatePreferences(
      body: unknown
    ): Promise<ApiResponse<RecipientPreferences>> {
      try {
        const validation = UpdatePreferencesRequestSchema.safeParse(body);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid request: ${validation.error.message}`,
          };
        }

        const preferences = validation.data;
        // In production, save to database
        return {
          success: true,
          data: preferences,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: POST /api/notifications/templates
     * Create notification template
     */
    async createTemplate(
      body: unknown
    ): Promise<ApiResponse<NotificationTemplate>> {
      try {
        const validation = CreateTemplateRequestSchema.safeParse(body);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid request: ${validation.error.message}`,
          };
        }

        const template = validation.data;
        // In production, save to database
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: GET /api/notifications/templates
     * List notification templates
     */
    async listTemplates(
      query: unknown
    ): Promise<ApiResponse<PaginatedResponse<NotificationTemplate>>> {
      try {
        const validation = ListTemplatesQuerySchema.safeParse(query);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid query: ${validation.error.message}`,
          };
        }

        const params = validation.data;
        // In production, fetch from database
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            limit: params.limit,
            offset: params.offset,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: GET /api/notifications/analytics
     * Get delivery analytics
     */
    async getAnalytics(
      query: unknown
    ): Promise<ApiResponse<AnalyticsResult>> {
      try {
        const validation = AnalyticsQuerySchema.safeParse(query);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid query: ${validation.error.message}`,
          };
        }

        const params = validation.data;
        // In production, fetch and aggregate from database
        return {
          success: true,
          data: {
            period: {
              startDate: params.startDate,
              endDate: params.endDate,
            },
            groupBy: params.groupBy,
            data: [],
            summary: {
              totalSent: 0,
              totalDelivered: 0,
              totalFailed: 0,
              totalRead: 0,
              overallSuccessRate: 0,
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },

    /**
     * Handler: POST /api/notifications/test
     * Send test notification
     */
    async sendTest(body: unknown): Promise<ApiResponse<{ messageId: string }>> {
      try {
        const validation = TestNotificationRequestSchema.safeParse(body);
        if (!validation.success) {
          return {
            success: false,
            error: `Invalid request: ${validation.error.message}`,
          };
        }

        const testRequest = validation.data;
        const messageId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // In production, send actual test notification
        return {
          success: true,
          data: { messageId },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message,
        };
      }
    },
  };
}

/**
 * Singleton instance of API handlers
 */
let apiHandlers: ReturnType<typeof createNotificationApiHandlers> | null = null;

/**
 * Get notification API handlers
 */
export function getNotificationApiHandlers() {
  if (!apiHandlers) {
    apiHandlers = createNotificationApiHandlers();
  }
  return apiHandlers;
}
