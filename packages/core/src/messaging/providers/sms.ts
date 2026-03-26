/**
 * SMS provider implementation.
 * Uses Twilio-like interface (type stubs).
 * Handles GSM character encoding and SMS segmentation.
 */

import type { Message, MessageTemplate, SendResult, DeliveryStatus } from '../types.js';
import {
  MessageChannel,
  DeliveryStatus as DeliveryStatusEnum,
  InvalidRecipientError,
  AuthenticationError,
  ConfigurationError,
  RateLimitError,
} from '../types.js';
import { MessageProvider } from './base.js';

/**
 * Type stubs for Twilio-like client.
 */
interface SmsClient {
  messages: {
    create(options: SmsOptions): Promise<{ sid: string; error_code?: string; error_message?: string }>;
  };
}

interface SmsOptions {
  from: string;
  to: string;
  body: string;
}

/**
 * SMS provider implementation using Twilio-like interface.
 */
export class SmsProvider extends MessageProvider {
  readonly providerId = 'sms_twilio';

  private client?: SmsClient;

  constructor(
    private config: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    },
  ) {
    super();

    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      throw new ConfigurationError(
        MessageChannel.SMS,
        'Missing SMS configuration: accountSid, authToken, or fromNumber',
      );
    }

    this.initializeClient();
  }

  /**
   * Initialize Twilio-like SMS client.
   */
  private initializeClient(): void {
    this.client = this.createMockSmsClient();
  }

  /**
   * Create mock SMS client for testing.
   */
  private createMockSmsClient(): SmsClient {
    return {
      messages: {
        create: async (options) => {
          // Mock implementation
          if (!options.to || !options.body) {
            return {
              sid: '',
              error_code: '400',
              error_message: 'Missing required fields',
            };
          }

          return {
            sid: `SM${Date.now()}`,
          };
        },
      },
    };
  }

  /**
   * Send an SMS message.
   */
  async send(message: Message): Promise<SendResult> {
    if (!this.client) {
      throw new ConfigurationError(MessageChannel.SMS, 'SMS client not initialized');
    }

    // Validate recipient (E.164 format)
    if (!validatePhoneE164(message.to)) {
      throw new InvalidRecipientError(
        MessageChannel.SMS,
        message.to,
        'Phone number must be in E.164 format (+[country][number])',
      );
    }

    // Validate body
    if (!message.body || message.body.length === 0) {
      throw new InvalidRecipientError(
        MessageChannel.SMS,
        message.to,
        'Message body is required',
      );
    }

    // Check SMS length and segment count
    const { segmentCount, totalCharacters } = calculateSmsLength(message.body);
    if (segmentCount > 10) {
      // Limit to 10 segments (1600 chars)
      throw new InvalidRecipientError(
        MessageChannel.SMS,
        message.to,
        'Message too long (max 10 segments, 1600 characters)',
      );
    }

    try {
      const result = await this.client.messages.create({
        from: message.from || this.config.fromNumber,
        to: message.to,
        body: message.body,
      });

      if (result.error_code) {
        if (result.error_code === '429' || result.error_code === '20429') {
          throw new RateLimitError(MessageChannel.SMS, 'SMS rate limit exceeded');
        }

        if (result.error_code === '401' || result.error_code === '20003') {
          throw new AuthenticationError(
            MessageChannel.SMS,
            'twilio',
            'Invalid Twilio credentials',
          );
        }

        return {
          success: false,
          status: DeliveryStatusEnum.FAILED,
          error: result.error_message || `Error code: ${result.error_code}`,
        };
      }

      return {
        success: true,
        externalId: result.sid,
        status: DeliveryStatusEnum.SENT,
        cost: calculateSmsCost(segmentCount),
      };
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof AuthenticationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`SMS send failed: ${errorMessage}`);
    }
  }

  /**
   * Get SMS delivery status.
   */
  async getStatus(externalId: string): Promise<DeliveryStatus> {
    // SMS delivery status typically comes from webhooks
    // Real implementation would query Twilio API
    return DeliveryStatusEnum.SENT;
  }

  /**
   * Validate SMS template.
   */
  async validateTemplate(template: MessageTemplate): Promise<boolean> {
    if (!template.body) {
      return false;
    }

    // Check message length
    const { segmentCount } = calculateSmsLength(template.body);
    if (segmentCount > 10) {
      return false;
    }

    // Check for valid variables syntax
    const variablePattern = /{{([a-zA-Z0-9_.]+)}}/g;
    const usedVariables = new Set<string>();
    let match;
    while ((match = variablePattern.exec(template.body)) !== null) {
      usedVariables.add(match[1]);
    }

    // Verify all used variables are declared
    const declaredVars = new Set(template.variables);
    for (const variable of usedVariables) {
      if (!declaredVars.has(variable)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Test SMS connection.
   */
  async testConnection(): Promise<boolean> {
    return Boolean(this.client && this.config.accountSid && this.config.authToken);
  }
}

/**
 * Validate phone number in E.164 format.
 */
export function validatePhoneE164(phone: string): boolean {
  const pattern = /^\+[1-9]\d{1,14}$/;
  return pattern.test(phone);
}

/**
 * Calculate SMS length considering GSM 7-bit and UTF-16 encoding.
 *
 * GSM 7-bit alphabet: 160 chars per segment
 * UTF-16 (unicode): 70 chars per segment
 * Extended GSM: some chars count as 2
 */
interface SmsLengthResult {
  segmentCount: number;
  totalCharacters: number;
  encoding: 'gsm7' | 'utf16';
}

export function calculateSmsLength(text: string): SmsLengthResult {
  const gsmExtendedChars = new Set<string>(['[', ']', '{', '}', '\\', '|', '^', '~', '€']);
  const gsmSingleChars = new Set<string>(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ{}\\[~]|^€ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ¡¿§¶ß¢¤¥ª«º»àáâãäåæçñòóôõöÙÚûüý '.split(
        '',
      ),
  );

  let isGsm = true;
  let charCount = 0;

  for (const char of text) {
    if (!gsmSingleChars.has(char)) {
      isGsm = false;
      charCount++;
    } else {
      charCount += gsmExtendedChars.has(char) ? 2 : 1;
    }
  }

  if (!isGsm) {
    // UTF-16 for unicode content
    return {
      segmentCount: Math.ceil(text.length / 70),
      totalCharacters: text.length,
      encoding: 'utf16',
    };
  }

  // GSM 7-bit encoding
  return {
    segmentCount: Math.ceil(charCount / 160),
    totalCharacters: charCount,
    encoding: 'gsm7',
  };
}

/**
 * Calculate SMS cost based on segment count.
 * Typical rate: $0.0075 USD per segment
 */
function calculateSmsCost(segmentCount: number): number {
  const costPerSegment = 0.0075;
  return segmentCount * costPerSegment;
}
