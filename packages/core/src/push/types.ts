// @ts-nocheck

/**
 * Push Notification Provider Types and Interfaces
 *
 * Defines contracts for push notification implementations.
 * Supports Firebase Cloud Messaging (FCM) and Expo Push Notifications.
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  notification?: {
    title?: string;
    body?: string;
    sound?: string;
    badge?: number;
  };
  android?: {
    priority?: string;
    ttl?: number;
  };
  apns?: {
    payload?: {
      aps?: {
        alert?: {
          title?: string;
          body?: string;
        };
        sound?: string;
        badge?: number;
      };
    };
  };
  webpush?: {
    headers?: Record<string, string>;
    data?: Record<string, string>;
  };
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MulticastPushResult {
  successCount: number;
  failureCount: number;
  results: PushResult[];
}

export interface PushProvider {
  /**
   * Send push notification to a single device
   */
  sendPush(token: string, payload: PushPayload): Promise<PushResult>;

  /**
   * Send push notification to multiple devices (batched)
   */
  sendMulticast(
    tokens: string[],
    payload: PushPayload,
  ): Promise<MulticastPushResult>;

  /**
   * Subscribe a device token to a topic
   */
  subscribeTopic(token: string, topic: string): Promise<void>;

  /**
   * Unsubscribe a device token from a topic
   */
  unsubscribeTopic(token: string, topic: string): Promise<void>;

  /**
   * Send push to all devices in a topic
   */
  sendToTopic(topic: string, payload: PushPayload): Promise<PushResult>;
}

export interface TenantPushConfig {
  fcm?: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  expo?: {
    accessToken: string;
  };
}

export interface DeployerPushConfig {
  defaultProvider: "fcm" | "expo" | "none";
  fcm?: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  expo?: {
    accessToken: string;
  };
}
