/**
 * SMS service - unified SMS handling
 * Supports multiple providers: Twilio, Console
 */

import type {
  SmsConfig,
  SmsMessage,
  SmsResult,
  SmsProvider,
  SmsBulkResult,
} from './types.js';
import { SmsStatus } from './types.js';
import { ConsoleSmsProvider } from './providers/console-provider.js';

export type { SmsConfig, SmsMessage, SmsResult, SmsBulkResult };
export { SmsStatus, type SmsProvider } from './types.js';
export { ConsoleSmsProvider } from './providers/console-provider.js';

/**
 * SMS service for sending SMS messages through configured provider
 */
export class SmsService {
  private config: SmsConfig;
  private provider: SmsProvider;
  private rateLimitDelay: number;

  constructor(config: SmsConfig, rateLimitDelayMs: number = 100) {
    this.config = config;
    this.rateLimitDelay = rateLimitDelayMs;
    this.provider = this.initializeProvider();
  }

  /**
   * Initialize the configured SMS provider
   */
  private initializeProvider(): SmsProvider {
    switch (this.config.provider) {
      case 'console':
        return new ConsoleSmsProvider();

      case 'twilio':
        throw new Error(
          'Twilio provider not yet implemented. Use console provider for now.',
        );

      default:
        throw new Error(`Unknown SMS provider: ${this.config.provider}`);
    }
  }

  /**
   * Send a single SMS message
   */
  async send(message: SmsMessage): Promise<SmsResult> {
    // Use configured from if not provided
    const finalMessage: SmsMessage = {
      ...message,
      from: message.from || this.config.from,
    };

    return this.provider.send(finalMessage);
  }

  /**
   * Send multiple SMS messages with rate limiting
   */
  async sendBulk(messages: SmsMessage[]): Promise<SmsBulkResult> {
    const results: SmsResult[] = [];
    const failedMessages: Array<{ message: SmsMessage; error: string }> = [];

    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);

        // Rate limiting
        await this.sleep(this.rateLimitDelay);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedMessages.push({ message, error: errorMessage });
      }
    }

    return {
      totalCount: messages.length,
      successCount: results.filter((r) => r.status === SmsStatus.SENT).length,
      failureCount: failedMessages.length,
      results,
      failedMessages,
    };
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    if (this.provider.disconnect) {
      await this.provider.disconnect();
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
