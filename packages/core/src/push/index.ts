// @ts-nocheck

/**
 * Push Notification Service
 * 
 * Unified push notification system supporting:
 * - Firebase Cloud Messaging (FCM)
 * - Expo Push Notifications
 * - Multi-tenant support with BYOK pattern
 * - Single and multicast delivery
 * - Topic subscriptions
 *
 * Usage:
 * const pushService = createPushService({
 *   type: 'fcm',
 *   tenantConfig: { fcm: { projectId, clientEmail, privateKey } }
 * });
 * await pushService.sendPush('device-token', { title: 'Hello', body: 'World' });
 */

export type {
  PushPayload,
  PushResult,
  MulticastPushResult,
  PushProvider,
  TenantPushConfig,
  DeployerPushConfig,
} from './types';

export { FCMProvider, resolveFCMCredentials } from './fcm-provider';
export { ExpoProvider, resolveExpoCredentials } from './expo-provider';

import type { PushProvider, PushPayload, PushResult, MulticastPushResult, TenantPushConfig, DeployerPushConfig } from './types';
import { FCMProvider, resolveFCMCredentials } from './fcm-provider';
import { ExpoProvider, resolveExpoCredentials } from './expo-provider';

export interface PushServiceConfig {
  type?: 'fcm' | 'expo' | 'none';
  tenantConfig?: TenantPushConfig;
  deployerConfig?: DeployerPushConfig;
}

/**
 * No-op push provider for when push is disabled
 */
class NoOpPushProvider implements PushProvider {
  async sendPush(token: string, payload: PushPayload): Promise<PushResult> {
    return { success: false, error: 'Push notifications disabled' };
  }

  async sendMulticast(tokens: string[], payload: PushPayload): Promise<MulticastPushResult> {
    return {
      successCount: 0,
      failureCount: tokens.length,
      results: tokens.map(() => ({ success: false, error: 'Push notifications disabled' })),
    };
  }

  async subscribeTopic(token: string, topic: string): Promise<void> {
    console.log('Push notifications disabled');
  }

  async unsubscribeTopic(token: string, topic: string): Promise<void> {
    console.log('Push notifications disabled');
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<PushResult> {
    return { success: false, error: 'Push notifications disabled' };
  }
}

/**
 * Create a push notification service with automatic provider detection
 * 
 * Priority:
 * 1. Explicit type if provided
 * 2. Tenant FCM credentials → FCMProvider
 * 3. Tenant Expo credentials → ExpoProvider
 * 4. Deployer default provider
 * 5. No-op provider
 */
export function createPushService(config: PushServiceConfig): PushProvider {
  // Explicit type provided
  if (config.type === 'fcm') {
    const fcmConfig = resolveFCMCredentials(config.tenantConfig, config.deployerConfig);
    if (fcmConfig) {
      return new FCMProvider(fcmConfig);
    }
    throw new Error('FCM type requested but no FCM credentials found');
  }

  if (config.type === 'expo') {
    const expoConfig = resolveExpoCredentials(config.tenantConfig, config.deployerConfig);
    if (expoConfig) {
      return new ExpoProvider(expoConfig);
    }
    throw new Error('Expo type requested but no Expo credentials found');
  }

  if (config.type === 'none') {
    return new NoOpPushProvider();
  }

  // Auto-detect: try FCM first
  const fcmConfig = resolveFCMCredentials(config.tenantConfig, config.deployerConfig);
  if (fcmConfig) {
    return new FCMProvider(fcmConfig);
  }

  // Try Expo
  const expoConfig = resolveExpoCredentials(config.tenantConfig, config.deployerConfig);
  if (expoConfig) {
    return new ExpoProvider(expoConfig);
  }

  // Check deployer config for default type
  if (config.deployerConfig?.defaultProvider === 'fcm') {
    const deployerFcm = resolveFCMCredentials(undefined, config.deployerConfig);
    if (deployerFcm) {
      return new FCMProvider(deployerFcm);
    }
  }

  if (config.deployerConfig?.defaultProvider === 'expo') {
    const deployerExpo = resolveExpoCredentials(undefined, config.deployerConfig);
    if (deployerExpo) {
      return new ExpoProvider(deployerExpo);
    }
  }

  // Fall back to no-op
  console.warn('No push provider credentials configured. Using no-op provider.');
  return new NoOpPushProvider();
}

/**
 * Push notification service class for dependency injection
 */
export class PushNotificationService {
  private provider: PushProvider;

  constructor(provider: PushProvider) {
    this.provider = provider;
  }

  /**
   * Send a push notification to a single device
   */
  async send(token: string, payload: PushPayload): Promise<PushResult> {
    return this.provider.sendPush(token, payload);
  }

  /**
   * Send a push notification to multiple devices
   */
  async sendMulticast(tokens: string[], payload: PushPayload): Promise<MulticastPushResult> {
    return this.provider.sendMulticast(tokens, payload);
  }

  /**
   * Subscribe a device to a topic
   */
  async subscribeTopic(token: string, topic: string): Promise<void> {
    return this.provider.subscribeTopic(token, topic);
  }

  /**
   * Unsubscribe a device from a topic
   */
  async unsubscribeTopic(token: string, topic: string): Promise<void> {
    return this.provider.unsubscribeTopic(token, topic);
  }

  /**
   * Send a push notification to all devices in a topic
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<PushResult> {
    return this.provider.sendToTopic(topic, payload);
  }
}
