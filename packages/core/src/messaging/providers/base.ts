/**
 * Abstract base class for all messaging providers.
 * Defines the contract that each provider (Email, SMS, WhatsApp, Push) must implement.
 */

import type {
  Message,
  MessageTemplate,
  SendResult,
  DeliveryStatus,
} from "../types.js";

/**
 * Abstract provider interface.
 * Each concrete provider (SendGrid, Twilio, Meta, Firebase, etc.) extends this.
 */
export abstract class MessageProvider {
  /**
   * Provider identifier (e.g., "sendgrid", "twilio", "meta", "firebase").
   */
  abstract readonly providerId: string;

  /**
   * Send a message through this provider.
   * Must validate the message and handle all error cases.
   *
   * @param message The message to send
   * @returns Send result with external ID and initial status
   * @throws MessagingError or subclasses for validation/auth/rate-limit errors
   */
  abstract send(message: Message): Promise<SendResult>;

  /**
   * Get current delivery status of a message.
   * Used for polling/reconciliation with provider.
   *
   * @param externalId Provider-specific message ID
   * @returns Current delivery status
   * @throws AuthenticationError, ConfigurationError, or other MessagingError
   */
  abstract getStatus(externalId: string): Promise<DeliveryStatus>;

  /**
   * Validate a message template before it's saved.
   * Checks syntax, required variables, provider limits, etc.
   *
   * @param template Template to validate
   * @returns true if valid, false if invalid
   * @throws MessagingError if validation fails
   */
  abstract validateTemplate(template: MessageTemplate): Promise<boolean>;

  /**
   * Test provider connectivity and credentials.
   * Used during setup/configuration.
   *
   * @returns true if credentials are valid and provider is reachable
   */
  abstract testConnection(): Promise<boolean>;
}
