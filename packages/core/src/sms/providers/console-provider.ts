/**
 * Console SMS provider for development
 * Logs SMS messages to console instead of sending
 */

import type {
  SmsProvider,
  SmsMessage,
  SmsResult,
  SmsProviderType,
} from "../types.js";
import { SmsStatus } from "../types.js";

/**
 * Calculate number of SMS segments (160 chars per segment, 153 for multi-part)
 */
function calculateSegments(message: string): number {
  const length = message.length;
  if (length === 0) return 0;
  if (length <= 160) return 1;
  // Multi-part messages get 153 characters per segment
  return Math.ceil(length / 153);
}

/**
 * Console-based SMS provider for development/testing
 * Logs SMS messages to console with formatted output
 */
export class ConsoleSmsProvider implements SmsProvider {
  private provider: SmsProviderType = "console";

  async send(message: SmsMessage): Promise<SmsResult> {
    const messageId = this.generateMessageId();
    const timestamp = new Date();
    const segments = calculateSegments(message.body);

    console.log(
      "\n" +
        "═══════════════════════════════════════════════════════════════\n" +
        "                     SMS MESSAGE (CONSOLE)\n" +
        "═══════════════════════════════════════════════════════════════",
    );

    console.log(`ID: ${messageId}`);

    if (message.from) {
      console.log(`From: ${message.from}`);
    }

    console.log(
      `To: ${Array.isArray(message.to) ? message.to.join(", ") : message.to}`,
    );

    console.log(`Segments: ${segments} (${message.body.length} characters)`);
    console.log(
      `───────────────────────────────────────────────────────────────`,
    );
    console.log(message.body);

    if (message.metadata) {
      console.log("\nMetadata:", JSON.stringify(message.metadata, null, 2));
    }

    console.log(
      "═══════════════════════════════════════════════════════════════\n",
    );

    return {
      id: messageId,
      status: SmsStatus.SENT,
      provider: this.provider,
      segments,
      timestamp,
    };
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `sms-${timestamp}-${random}`;
  }
}
