/**
 * SMS service types and interfaces
 * No external dependencies - provider-agnostic design
 */

/**
 * Supported SMS providers
 */
export type SmsProviderType = 'twilio' | 'console';

/**
 * SMS status enumeration
 */
export enum SmsStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNDELIVERABLE = 'undeliverable',
}

/**
 * Core SMS message structure
 */
export interface SmsMessage {
  to: string | string[];
  body: string;
  from?: string;
  metadata?: Record<string, any>;
}

/**
 * Result returned after sending an SMS
 */
export interface SmsResult {
  id: string;
  status: SmsStatus;
  provider: SmsProviderType;
  segments: number;
  timestamp: Date;
  error?: string;
}

/**
 * SMS service configuration
 */
export interface SmsConfig {
  provider: SmsProviderType;
  from?: string;
  accountSid?: string;
  authToken?: string;
  timeout?: number;
}

/**
 * Provider interface that all SMS providers must implement
 */
export interface SmsProvider {
  /**
   * Send an SMS message
   */
  send(message: SmsMessage): Promise<SmsResult>;

  /**
   * Check if provider is configured correctly
   */
  isConfigured?(): boolean;

  /**
   * Close/cleanup connections if needed
   */
  disconnect?(): Promise<void>;
}

/**
 * Bulk send result with individual message results
 */
export interface SmsBulkResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: SmsResult[];
  failedMessages: Array<{
    message: SmsMessage;
    error: string;
  }>;
}
