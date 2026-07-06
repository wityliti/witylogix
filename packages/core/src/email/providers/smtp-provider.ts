/**
 * SMTP email provider
 * Stub implementation defining interface for SMTP sending
 * To be implemented with actual SMTP library (nodemailer, etc.)
 */

import type {
  EmailProvider,
  EmailMessage,
  EmailResult,
  EmailConfig,
  EmailProviderType,
} from "../types.js";
import { EmailStatus } from "../types.js";

/**
 * SMTP Transport interface for email delivery
 */
export interface SmtpTransport {
  connect(): Promise<void>;
  send(message: EmailMessage): Promise<string>;
  disconnect(): Promise<void>;
}

/**
 * SMTP-based email provider
 * This is a stub implementation. In production, this would use
 * libraries like nodemailer or similar SMTP clients.
 */
export class SmtpEmailProvider implements EmailProvider {
  private provider: EmailProviderType = "smtp";
  private config: EmailConfig;
  private transport: SmtpTransport | null = null;

  constructor(config: EmailConfig) {
    this.config = config;

    if (!this.isConfigured()) {
      throw new Error("SMTP provider requires host and port configuration");
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const timestamp = new Date();

    try {
      if (!this.transport) {
        throw new Error("SMTP transport not initialized");
      }

      await this.transport.connect();
      const messageId = await this.transport.send(message);
      await this.transport.disconnect();

      return {
        id: messageId,
        status: EmailStatus.SENT,
        provider: this.provider,
        timestamp,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        id: this.generateMessageId(),
        status: EmailStatus.FAILED,
        provider: this.provider,
        timestamp,
        error: errorMessage,
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.config.host && this.config.port);
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
    }
  }

  /**
   * Set the transport implementation
   * This allows injecting real transport implementations
   */
  setTransport(transport: SmtpTransport): void {
    this.transport = transport;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `smtp-${timestamp}-${random}@witylogix.local`;
  }
}
