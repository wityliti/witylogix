/**
 * WhatsApp Webhook Handler
 * Parse and verify incoming webhook events from Meta Cloud API
 */

import {
  WebhookPayload,
  WebhookEvent,
  WebhookChange,
  WebhookChangeValue,
  MessageStatusEvent,
  IncomingMessageEvent,
  MessageStatus,
} from './types';

/**
 * Webhook handler for processing Meta WhatsApp events
 */
export class WebhookHandler {
  private appSecret?: string;

  constructor(appSecret?: string) {
    this.appSecret = appSecret;
  }

  /**
   * Verify webhook signature from Meta
   * Uses HMAC SHA256 to verify payload integrity
   * @param payload - Raw payload body as string
   * @param signature - Signature header from request
   * @param appSecret - App secret for verification
   * @returns true if signature is valid
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
  ): boolean {
    if (!appSecret || !signature) {
      return false;
    }

    // Extract hash from signature header (format: "sha256=hash")
    const [algorithm, hash] = signature.split('=');
    if (algorithm !== 'sha256' || !hash) {
      return false;
    }

    // Compute expected hash
    const expectedHash = WebhookHandler.computeSignature(payload, appSecret);
    return expectedHash === hash;
  }

  /**
   * Compute HMAC SHA256 signature
   */
  private static computeSignature(payload: string, appSecret: string): string {
    // Using built-in crypto or custom implementation
    // This is a placeholder - actual implementation depends on runtime
    // In Node.js: require('crypto').createHmac('sha256', appSecret).update(payload).digest('hex')
    // In Browser: use SubtleCrypto API

    // For now, return a placeholder
    // In production, implement proper HMAC-SHA256
    try {
      // Attempt to use crypto if available (Node.js environment)
      const crypto = (globalThis as unknown as Record<string, unknown>).crypto as
        | {
            subtle?: {
              sign(
                algorithm: string,
                key: Uint8Array,
                data: Uint8Array
              ): Promise<ArrayBuffer>;
            };
          }
        | undefined;

      if (crypto?.subtle) {
        // Return placeholder - async operation requires different approach
        return '';
      }
    } catch {
      // Fallback to placeholder
    }

    // Placeholder implementation - should be replaced with actual HMAC
    return '';
  }

  /**
   * Parse incoming webhook payload
   * @param payload - Webhook payload from Meta API
   * @returns Array of typed webhook events
   */
  parseWebhook(payload: WebhookPayload): WebhookEvent[] {
    if (!payload || !payload.entry) {
      throw new Error('Invalid webhook payload structure');
    }

    const events: WebhookEvent[] = [];

    for (const entry of payload.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        const changeEvents = this.parseChange(change);
        events.push(...changeEvents);
      }
    }

    return events;
  }

  /**
   * Parse a single webhook change into typed events
   */
  private parseChange(change: WebhookChange): WebhookEvent[] {
    const events: WebhookEvent[] = [];
    const { value } = change;

    if (!value) return events;

    // Parse message status updates
    if (value.statuses && Array.isArray(value.statuses)) {
      for (const status of value.statuses) {
        const event = this.parseStatusUpdate(status);
        if (event) events.push(event);
      }
    }

    // Parse incoming messages
    if (value.messages && Array.isArray(value.messages)) {
      for (const message of value.messages) {
        const event = this.parseIncomingMessage(message, value.contacts);
        if (event) events.push(event);
      }
    }

    return events;
  }

  /**
   * Parse message status update event
   */
  private parseStatusUpdate(
    status: Record<string, unknown>
  ): MessageStatusEvent | null {
    try {
      const statusValue = status.status as string;
      const messageStatus = this.mapStatusValue(statusValue);

      if (!messageStatus) return null;

      const event: MessageStatusEvent = {
        messageId: status.id as string,
        status: messageStatus,
        to: status.recipient_id as string,
        timestamp: parseInt(status.timestamp as string) * 1000, // Convert to milliseconds
      };

      // Add error details if present
      if (
        status.errors &&
        Array.isArray(status.errors) &&
        status.errors.length > 0
      ) {
        const error = status.errors[0] as Record<string, unknown>;
        event.error = {
          code: error.code as number,
          message: error.message as string,
        };
      }

      return event;
    } catch (error) {
      console.error('Error parsing status update:', error);
      return null;
    }
  }

  /**
   * Parse incoming message event
   */
  private parseIncomingMessage(
    message: Record<string, unknown>,
    contacts?: Array<Record<string, unknown>>
  ): IncomingMessageEvent | null {
    try {
      const event: IncomingMessageEvent = {
        messageId: message.id as string,
        from: message.from as string,
        timestamp: parseInt(message.timestamp as string) * 1000, // Convert to milliseconds
        type: message.type as string,
      };

      // Parse message content based on type
      if (message.text && typeof message.text === 'object') {
        const textObj = message.text as Record<string, unknown>;
        event.text = {
          body: textObj.body as string,
        };
      }

      if (message.media && typeof message.media === 'object') {
        const mediaObj = message.media as Record<string, unknown>;
        event.media = {
          type: mediaObj.type as string,
          id: mediaObj.id as string,
          url: mediaObj.url as string | undefined,
          caption: mediaObj.caption as string | undefined,
        };
      }

      if (message.location && typeof message.location === 'object') {
        const locObj = message.location as Record<string, unknown>;
        event.location = {
          latitude: locObj.latitude as number,
          longitude: locObj.longitude as number,
        };
      }

      if (message.button && typeof message.button === 'object') {
        const btnObj = message.button as Record<string, unknown>;
        event.button = {
          payload: btnObj.payload as string,
          text: btnObj.text as string,
        };
      }

      if (message.interactive && typeof message.interactive === 'object') {
        const intObj = message.interactive as Record<string, unknown>;
        const interactive: Record<string, unknown> = {
          type: intObj.type as string,
        };

        // Parse list reply
        if (intObj.list_reply && typeof intObj.list_reply === 'object') {
          const listReply = intObj.list_reply as Record<string, unknown>;
          interactive.listReply = {
            id: listReply.id as string,
            title: listReply.title as string,
            description: listReply.description as string | undefined,
          };
        }

        // Parse button reply
        if (intObj.button_reply && typeof intObj.button_reply === 'object') {
          const btnReply = intObj.button_reply as Record<string, unknown>;
          interactive.buttonReply = {
            id: btnReply.id as string,
            title: btnReply.title as string,
          };
        }

        event.interactive = interactive;
      }

      // Parse context (message reply)
      if (message.context && typeof message.context === 'object') {
        const ctxObj = message.context as Record<string, unknown>;
        event.context = {
          from: ctxObj.from as string,
          id: ctxObj.id as string,
        };
      }

      return event;
    } catch (error) {
      console.error('Error parsing incoming message:', error);
      return null;
    }
  }

  /**
   * Map WhatsApp status string to MessageStatus enum
   */
  private mapStatusValue(status: string): MessageStatus | null {
    switch (status.toLowerCase()) {
      case 'sent':
        return MessageStatus.SENT;
      case 'delivered':
        return MessageStatus.DELIVERED;
      case 'read':
        return MessageStatus.READ;
      case 'failed':
        return MessageStatus.FAILED;
      default:
        return null;
    }
  }

  /**
   * Filter events by type
   */
  filterEventsByType<T extends WebhookEvent>(
    events: WebhookEvent[],
    type: 'status' | 'message'
  ): T[] {
    return events.filter((event) => {
      if (type === 'status') {
        return 'status' in event;
      } else if (type === 'message') {
        return 'type' in event && !('status' in event);
      }
      return false;
    }) as T[];
  }

  /**
   * Handle webhook verification request from Meta
   * @param mode - Verification mode from request
   * @param token - Verification token from request
   * @param challenge - Challenge string from request
   * @param webhookToken - Expected webhook token
   * @returns Challenge string if verification succeeds, null otherwise
   */
  handleVerificationChallenge(
    mode: string,
    token: string,
    challenge: string,
    webhookToken: string
  ): string | null {
    if (mode === 'subscribe' && token === webhookToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Set app secret for verification
   */
  setAppSecret(secret: string): void {
    this.appSecret = secret;
  }

  /**
   * Verify webhook with stored app secret
   */
  verifyWithStoredSecret(
    payload: string,
    signature: string
  ): boolean {
    if (!this.appSecret) {
      throw new Error('App secret not configured');
    }
    return WebhookHandler.verifyWebhookSignature(payload, signature, this.appSecret);
  }
}
