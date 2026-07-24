/**
 * SMS Channel — Send SMS via Twilio
 */

import { SMSResult } from "../types.js";

/**
 * SMS send parameters
 */
export interface SMSParams {
  to: string;
  message: string;
  from?: string;
}

/**
 * SMS Channel — handles SMS sending
 */
export class SMSChannel {
  private from: string;
  private twilioClient?: any;
  private readonly MAX_SMS_LENGTH = 160;
  private readonly MAX_CONCATENATED_SMS_LENGTH = 153; // Accounts for concatenation header

  constructor(from: string = "+1234567890", twilioClient?: any) {
    this.from = from;
    this.twilioClient = twilioClient;
  }

  /**
   * Send an SMS
   */
  async sendSMS(params: SMSParams): Promise<SMSResult> {
    try {
      // Validate input
      if (!params.to) {
        return {
          accepted: false,
          error: "Phone number (to) is required",
        };
      }

      if (!params.message) {
        return {
          accepted: false,
          error: "SMS message is required",
        };
      }

      // Validate phone number format (basic)
      if (!this.isValidPhoneNumber(params.to)) {
        return {
          accepted: false,
          error: "Invalid phone number format",
        };
      }

      // Check message length and warn if exceeds limits
      const characterCount = params.message.length;
      if (
        characterCount > this.MAX_SMS_LENGTH &&
        characterCount > this.MAX_CONCATENATED_SMS_LENGTH * 3
      ) {
        return {
          accepted: false,
          error: `Message too long (${characterCount} chars). Max 480 characters for concatenated SMS.`,
        };
      }

      // For now, log instead of sending (mock implementation)
      console.log("SMS channel - sending SMS:", {
        to: params.to,
        messageLength: characterCount,
        smsCount: Math.ceil(characterCount / this.MAX_CONCATENATED_SMS_LENGTH),
      });

      // In production, use Twilio:
      // const message = await this.twilioClient.messages.create({
      //   body: params.message,
      //   from: params.from || this.from,
      //   to: params.to,
      // });
      // return {
      //   accepted: true,
      //   messageId: message.sid,
      //   characterCount,
      // };

      // Mock response
      const mockMessageId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        accepted: true,
        messageId: mockMessageId,
        characterCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        accepted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS
   */
  async sendBulk(smsList: SMSParams[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    for (const sms of smsList) {
      const result = await this.sendSMS(sms);
      results.push(result);

      // Add delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Truncate message to fit SMS character limit
   */
  truncateMessage(
    message: string,
    maxLength: number = this.MAX_SMS_LENGTH,
  ): string {
    if (message.length <= maxLength) {
      return message;
    }

    return message.substring(0, maxLength - 3) + "...";
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic validation: should start with + or country code, contain only digits
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  /**
   * Format phone number to E.164 format
   */
  static formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");

    // If starts with 1 (US), assume US
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    // Otherwise add + prefix
    if (!phone.startsWith("+")) {
      return `+${cleaned}`;
    }

    return phone;
  }

  /**
   * Calculate SMS message count (for billing purposes)
   */
  static calculateMessageCount(message: string): number {
    if (message.length <= 160) {
      return 1;
    }

    // Each additional SMS can carry 153 characters (due to concatenation header)
    const fullMessages = Math.floor(message.length / 153);
    const remainder = message.length % 153;

    return fullMessages + (remainder > 0 ? 1 : 0);
  }

  /**
   * Build Routific-pattern delivery message
   */
  static buildDeliveryMessage(timeWindow: string, trackingUrl: string): string {
    const baseMessage = `Your delivery is scheduled between ${timeWindow}. Track here: ${trackingUrl}`;
    return baseMessage;
  }

  /**
   * Build out-for-delivery message
   */
  static buildOutForDeliveryMessage(
    driverName: string,
    trackingUrl: string,
  ): string {
    return `Your package is out for delivery! Driver: ${driverName}. Track: ${trackingUrl}`;
  }
}
