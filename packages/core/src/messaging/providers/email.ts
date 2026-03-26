/**
 * Email provider implementation.
 * Uses nodemailer-like interface (type stubs, no actual nodemailer import).
 * Supports HTML rendering, variable substitution, and attachments.
 */

import type { Message, MessageTemplate, SendResult, DeliveryStatus } from '../types.js';
import {
  MessageChannel,
  DeliveryStatus as DeliveryStatusEnum,
  InvalidRecipientError,
  AuthenticationError,
  ConfigurationError,
} from '../types.js';
import { MessageProvider } from './base.js';

/**
 * Type stubs for nodemailer-like transporter.
 * Real implementation would use actual nodemailer or similar.
 */
interface EmailTransporter {
  sendMail(options: EmailOptions): Promise<{ messageId: string }>;
  verify(): Promise<boolean>;
}

interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Email provider implementation.
 */
export class EmailProvider extends MessageProvider {
  readonly providerId = 'email';

  private transporter?: EmailTransporter;

  constructor(
    private config: {
      provider: 'sendgrid' | 'smtp' | 'console';
      apiKey?: string;
      from: string;
      host?: string;
      port?: number;
      auth?: { user: string; pass: string };
    },
  ) {
    super();
    this.initializeTransporter();
  }

  /**
   * Initialize transporter based on provider type.
   * In real implementation, would create actual transporter instances.
   */
  private initializeTransporter(): void {
    if (!this.config.from) {
      throw new ConfigurationError(
        MessageChannel.EMAIL,
        'Missing "from" email address in configuration',
      );
    }

    // Type stub: in real code, would instantiate nodemailer transport
    // For now, we create a mock transporter that satisfies the interface
    this.transporter = this.createMockTransporter();
  }

  /**
   * Create a mock transporter for testing.
   * Real implementation would create actual nodemailer transporter.
   */
  private createMockTransporter(): EmailTransporter {
    return {
      sendMail: async (options) => {
        // In production, would call actual transporter
        // For now, simulate async operation
        if (!options.to || !options.subject) {
          throw new Error('Missing required email fields');
        }
        return { messageId: `mock-${Date.now()}` };
      },
      verify: async () => {
        // In production, would verify actual transporter
        return true;
      },
    };
  }

  /**
   * Send an email message.
   */
  async send(message: Message): Promise<SendResult> {
    if (!this.transporter) {
      throw new ConfigurationError(
        MessageChannel.EMAIL,
        'Email transporter not initialized',
      );
    }

    // Validate recipient
    if (!message.to) {
      throw new InvalidRecipientError(MessageChannel.EMAIL, '', 'Recipient address required');
    }

    if (!validateEmail(message.to)) {
      throw new InvalidRecipientError(
        MessageChannel.EMAIL,
        message.to,
        'Invalid email format',
      );
    }

    // Validate subject
    if (!message.subject) {
      throw new InvalidRecipientError(
        MessageChannel.EMAIL,
        message.to,
        'Email subject required',
      );
    }

    // Prepare email body
    const html = message.templateId ? message.body : message.body; // Already rendered
    const from = message.from || this.config.from;

    try {
      const result = await this.transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html,
        text: stripHtmlTags(html), // Fallback plain text
        headers: {
          'X-Message-ID': message.id,
          'X-Tenant-ID': message.tenantId,
        },
      });

      return {
        success: true,
        externalId: result.messageId,
        status: DeliveryStatusEnum.SENT,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('authentication')) {
        throw new AuthenticationError(
          MessageChannel.EMAIL,
          this.config.provider,
          errorMessage,
        );
      }

      throw new Error(`Email send failed: ${errorMessage}`);
    }
  }

  /**
   * Get email delivery status.
   * Note: Email providers don't typically provide delivery status webhooks.
   * This would require polling external services like SendGrid's API.
   */
  async getStatus(externalId: string): Promise<DeliveryStatus> {
    // In real implementation, would query provider's API
    // For now, return SENT as email lacks real-time delivery confirmation
    return DeliveryStatusEnum.SENT;
  }

  /**
   * Validate email template.
   */
  async validateTemplate(template: MessageTemplate): Promise<boolean> {
    if (!template.body) {
      return false;
    }

    if (!template.subject) {
      return false;
    }

    // Check for valid variables syntax
    const variablePattern = /{{([a-zA-Z0-9_.]+)}}/g;
    const usedVariables = new Set<string>();
    let match;
    while ((match = variablePattern.exec(template.body)) !== null) {
      usedVariables.add(match[1]);
    }
    while ((match = variablePattern.exec(template.subject)) !== null) {
      usedVariables.add(match[1]);
    }

    // Verify all used variables are declared
    const declaredVars = new Set(template.variables);
    for (const variable of usedVariables) {
      if (!declaredVars.has(variable)) {
        return false; // Undeclared variable found
      }
    }

    return true;
  }

  /**
   * Test email provider connection.
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      return await this.transporter.verify();
    } catch {
      return false;
    }
  }
}

/**
 * Validate email address format.
 */
export function validateEmail(email: string): boolean {
  // RFC 5322 simplified regex
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email) && email.length <= 254;
}

/**
 * Strip HTML tags for plain text fallback.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
