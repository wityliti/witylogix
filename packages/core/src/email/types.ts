/**
 * Email service types and interfaces
 * No external dependencies - provider-agnostic design
 */

/**
 * Supported email providers
 */
export type EmailProviderType = 'sendgrid' | 'smtp' | 'console';

/**
 * Email status enumeration
 */
export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
}

/**
 * Attachment structure for emails
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Core email message structure
 */
export interface EmailMessage {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  metadata?: Record<string, any>;
}

/**
 * Result returned after sending an email
 */
export interface EmailResult {
  id: string;
  status: EmailStatus;
  provider: EmailProviderType;
  timestamp: Date;
  error?: string;
}

/**
 * Email template for reusable content
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: Record<string, any>;
}

/**
 * Email service configuration
 */
export interface EmailConfig {
  provider: EmailProviderType;
  from: string;
  apiKey?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  timeout?: number;
}

/**
 * Provider interface that all email providers must implement
 */
export interface EmailProvider {
  /**
   * Send an email message
   */
  send(message: EmailMessage): Promise<EmailResult>;

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
export interface EmailBulkResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: EmailResult[];
  failedMessages: Array<{
    message: EmailMessage;
    error: string;
  }>;
}

/**
 * Template variables for rendering
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean | Date | TemplateVariables | any[];
}
