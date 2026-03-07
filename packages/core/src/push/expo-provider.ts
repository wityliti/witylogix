// @ts-nocheck

/**
 * Expo Push Notifications Provider
 * 
 * For React Native applications using Expo.
 * Supports:
 * - Single and multicast delivery
 * - Receipt tracking
 * - BYOK pattern with tenant and deployer credentials
 */

import {
  PushProvider,
  PushPayload,
  PushResult,
  MulticastPushResult,
  TenantPushConfig,
  DeployerPushConfig,
} from './types';

interface ExpoConfig {
  accessToken: string;
}

interface ExpoMessage {
  to: string | string[];
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  badge?: number;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Expo Push Notifications Provider
 */
export class ExpoProvider implements PushProvider {
  private accessToken: string;
  private baseUrl = 'https://exp.host/--/api/v2/push/send';
  private receiptUrl = 'https://exp.host/--/api/v2/push/getReceipts';

  constructor(config: ExpoConfig) {
    this.accessToken = config.accessToken;
  }

  /**
   * Send push notification to a single device
   */
  async sendPush(token: string, payload: PushPayload): Promise<PushResult> {
    try {
      const message = this.buildExpoMessage(token, payload);

      // In production: call Expo API
      // const response = await fetch(this.baseUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Accept': 'application/json',
      //     'Accept-Encoding': 'gzip, deflate',
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.accessToken}`,
      //   },
      //   body: JSON.stringify(message),
      // });
      //
      // const data = await response.json();

      // Mock implementation
      const messageId = `expo-${Buffer.from(token).toString('hex').substring(0, 16)}`;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send push notification to multiple devices (batched)
   */
  async sendMulticast(tokens: string[], payload: PushPayload): Promise<MulticastPushResult> {
    const results: PushResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      // Build messages for all tokens
      const messages = tokens.map((token) => this.buildExpoMessage(token, payload));

      // In production: call Expo API
      // const response = await fetch(this.baseUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Accept': 'application/json',
      //     'Accept-Encoding': 'gzip, deflate',
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.accessToken}`,
      //   },
      //   body: JSON.stringify(messages),
      // });
      //
      // const data = await response.json();

      // Mock: assume success for all tokens
      for (const token of tokens) {
        results.push({
          success: true,
          messageId: `expo-${Buffer.from(token).toString('hex').substring(0, 12)}`,
        });
        successCount++;
      }
    } catch (error) {
      for (const token of tokens) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Subscribe a device token to a topic
   * Note: Expo doesn't have native topic subscriptions like FCM
   * This would be handled by application-level logic
   */
  async subscribeTopic(token: string, topic: string): Promise<void> {
    // For Expo, topic subscriptions are typically managed by the app
    console.log(`Expo: ${token} subscribed to topic ${topic} (application-managed)`);
  }

  /**
   * Unsubscribe a device token from a topic
   */
  async unsubscribeTopic(token: string, topic: string): Promise<void> {
    console.log(`Expo: ${token} unsubscribed from topic ${topic} (application-managed)`);
  }

  /**
   * Send push to all devices in a topic
   * For Expo, this requires application-level topic management
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<PushResult> {
    // This would need to query a database to get all tokens subscribed to the topic
    throw new Error(
      'Expo topic delivery requires application-level topic tracking. Use sendMulticast with topic tokens instead.'
    );
  }

  /**
   * Check receipt status for sent messages
   */
  async checkReceipts(ticketIds: string[]): Promise<Record<string, any>> {
    try {
      // In production: call Expo receipt API
      // const response = await fetch(this.receiptUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Accept': 'application/json',
      //     'Accept-Encoding': 'gzip, deflate',
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.accessToken}`,
      //   },
      //   body: JSON.stringify({ ids: ticketIds }),
      // });
      //
      // const data = await response.json();
      // return data.data;

      // Mock implementation
      const receipts: Record<string, any> = {};
      for (const id of ticketIds) {
        receipts[id] = {
          status: 'ok',
        };
      }
      return receipts;
    } catch (error) {
      throw new Error(`Failed to check receipts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate Expo push token format
   */
  static isValidExpoToken(token: string): boolean {
    // Expo tokens typically start with ExponentPushToken and are wrapped in brackets
    return /^ExponentPushToken\[[a-zA-Z0-9_-]+\]$/.test(token);
  }

  /**
   * Build Expo message object from payload
   */
  private buildExpoMessage(token: string, payload: PushPayload): ExpoMessage {
    const message: ExpoMessage = {
      to: token,
      title: payload.title,
      body: payload.body,
      sound: payload.notification?.sound || 'default',
      badge: payload.notification?.badge || 1,
      ttl: payload.android?.ttl || 86400,
      priority: 'high',
    };

    if (payload.data) {
      message.data = payload.data;
    }

    return message;
  }
}

/**
 * Resolve Expo credentials from tenant config with deployer fallback
 */
export function resolveExpoCredentials(
  tenantConfig?: TenantPushConfig,
  deployerConfig?: DeployerPushConfig
): ExpoConfig | null {
  // Tenant config takes precedence
  if (tenantConfig?.expo) {
    return {
      accessToken: tenantConfig.expo.accessToken,
    };
  }

  // Fall back to deployer config
  if (deployerConfig?.expo) {
    return {
      accessToken: deployerConfig.expo.accessToken,
    };
  }

  return null;
}
