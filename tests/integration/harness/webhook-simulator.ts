/**
 * Webhook Simulator for Integration Tests
 * Delivers webhooks with signatures, tracks delivery, supports replay
 * ~250 lines
 */

import http from 'http';
import { HMACSignatureGenerator } from './auth-simulators';

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface WebhookDeliveryRecord {
  id: string;
  eventId: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  attempts: number;
  lastAttemptAt: number;
  nextRetryAt?: number;
  error?: string;
  signature?: string;
}

export interface WebhookSignatureConfig {
  provider: 'stripe' | 'shopify' | 'generic';
  secret: string;
  headerName?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// WEBHOOK SIMULATOR
// ───────────────────────────────────────────────────────────────────────────

export class WebhookSimulator {
  private registeredUrls: Map<string, WebhookSignatureConfig> = new Map();
  private deliveryRecords: Map<string, WebhookDeliveryRecord> = new Map();
  private eventPayloads: Map<string, WebhookEvent> = new Map();
  private maxRetries: number = 3;
  private retryDelayMs: number = 1000;

  /**
   * Register a webhook URL and its signature config
   */
  registerUrl(url: string, signatureConfig: WebhookSignatureConfig): void {
    this.registeredUrls.set(url, signatureConfig);
  }

  /**
   * Unregister a webhook URL
   */
  unregisterUrl(url: string): void {
    this.registeredUrls.delete(url);
  }

  /**
   * Get all registered URLs
   */
  getRegisteredUrls(): string[] {
    return Array.from(this.registeredUrls.keys());
  }

  /**
   * Fire a webhook event to all registered URLs
   */
  async fireEvent(event: WebhookEvent): Promise<void> {
    this.eventPayloads.set(event.id, event);

    const promises = Array.from(this.registeredUrls.entries()).map(([url, config]) => {
      return this.deliverToUrl(url, event, config);
    });

    await Promise.all(promises);
  }

  /**
   * Fire a webhook to a specific URL
   */
  async fireEventToUrl(event: WebhookEvent, url: string): Promise<boolean> {
    this.eventPayloads.set(event.id, event);

    const config = this.registeredUrls.get(url);
    if (!config) {
      return false;
    }

    const record = await this.deliverToUrl(url, event, config);
    return record.status === 'success';
  }

  /**
   * Deliver webhook to a specific URL with retry logic
   */
  private async deliverToUrl(url: string, event: WebhookEvent, config: WebhookSignatureConfig): Promise<WebhookDeliveryRecord> {
    const recordId = `delivery_${event.id}_${Buffer.from(url).toString('base64url')}`;
    let record = this.deliveryRecords.get(recordId);

    if (!record) {
      record = {
        id: recordId,
        eventId: event.id,
        url,
        status: 'pending',
        attempts: 0,
        lastAttemptAt: Date.now(),
      };
      this.deliveryRecords.set(recordId, record);
    }

    // Attempt delivery with retries
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      record.attempts = attempt;
      record.lastAttemptAt = Date.now();

      const success = await this.sendWebhook(url, event, config);

      if (success) {
        record.status = 'success';
        record.statusCode = 200;
        return record;
      }

      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        record.nextRetryAt = Date.now() + delay;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        record.status = 'failed';
        record.error = 'Max retries exceeded';
      }
    }

    return record;
  }

  /**
   * Send webhook HTTP request
   */
  private sendWebhook(url: string, event: WebhookEvent, config: WebhookSignatureConfig): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const payload = JSON.stringify(event);
        const signature = this.generateSignature(payload, config);
        const headerName = config.headerName || this.getDefaultHeaderName(config.provider);

        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            [headerName]: signature,
            'User-Agent': 'WitylogixWebhookSimulator/1.0',
          },
        };

        const req = http.request(options, (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204);
        });

        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });

        req.write(payload);
        req.end();
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Generate webhook signature based on provider
   */
  private generateSignature(payload: string, config: WebhookSignatureConfig): string {
    switch (config.provider) {
      case 'stripe':
        return HMACSignatureGenerator.generateStripeSignature(payload, config.secret);
      case 'shopify':
        return HMACSignatureGenerator.generateShopifySignature(payload, config.secret);
      case 'generic':
      default:
        return HMACSignatureGenerator.generateStripeSignature(payload, config.secret);
    }
  }

  /**
   * Get default signature header name for provider
   */
  private getDefaultHeaderName(provider: string): string {
    switch (provider) {
      case 'stripe':
        return 'x-stripe-signature';
      case 'shopify':
        return 'x-shopify-hmac-sha256';
      default:
        return 'x-webhook-signature';
    }
  }

  /**
   * Replay a previously fired event to a specific URL
   */
  async replayEvent(eventId: string, url: string): Promise<boolean> {
    const event = this.eventPayloads.get(eventId);
    if (!event) {
      return false;
    }

    const config = this.registeredUrls.get(url);
    if (!config) {
      return false;
    }

    const success = await this.sendWebhook(url, event, config);
    return success;
  }

  /**
   * Get delivery record for an event
   */
  getDeliveryRecord(recordId: string): WebhookDeliveryRecord | undefined {
    return this.deliveryRecords.get(recordId);
  }

  /**
   * Get all delivery records for an event
   */
  getDeliveryRecordsForEvent(eventId: string): WebhookDeliveryRecord[] {
    return Array.from(this.deliveryRecords.values()).filter((r) => r.eventId === eventId);
  }

  /**
   * Get all delivery records
   */
  getAllDeliveryRecords(): WebhookDeliveryRecord[] {
    return Array.from(this.deliveryRecords.values());
  }

  /**
   * Clear delivery history
   */
  clearDeliveryHistory(): void {
    this.deliveryRecords.clear();
    this.eventPayloads.clear();
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(maxRetries: number, delayMs: number): void {
    this.maxRetries = maxRetries;
    this.retryDelayMs = delayMs;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// WEBHOOK EVENT FACTORY
// ───────────────────────────────────────────────────────────────────────────

export class WebhookEventFactory {
  static createEvent(type: string, data: Record<string, any> = {}): WebhookEvent {
    return {
      id: `evt_${Buffer.from(`${type}${Date.now()}`).toString('base64url').slice(0, 20)}`,
      type,
      timestamp: Date.now(),
      data: {
        ...data,
        timestamp: Date.now(),
      },
    };
  }

  static createStripeEvent(type: string, data: Record<string, any> = {}): WebhookEvent {
    return {
      id: `evt_${randomId()}`,
      type: `charge.${type}`,
      timestamp: Date.now(),
      data: {
        object: {
          id: `ch_${randomId()}`,
          ...data,
        },
      },
    };
  }

  static createShopifyEvent(topic: string, data: Record<string, any> = {}): WebhookEvent {
    return {
      id: `shopify_${randomId()}`,
      type: topic,
      timestamp: Date.now(),
      data,
    };
  }

  static createPaymentEvent(status: 'succeeded' | 'failed' | 'pending', amount: number): WebhookEvent {
    return {
      id: `evt_${randomId()}`,
      type: 'payment.status_changed',
      timestamp: Date.now(),
      data: {
        paymentId: `pay_${randomId()}`,
        status,
        amount,
      },
    };
  }

  static createShipmentEvent(status: 'created' | 'picked_up' | 'in_transit' | 'delivered' | 'failed'): WebhookEvent {
    return {
      id: `evt_${randomId()}`,
      type: 'shipment.status_changed',
      timestamp: Date.now(),
      data: {
        shipmentId: `ship_${randomId()}`,
        status,
        updatedAt: Date.now(),
      },
    };
  }
}

function randomId(): string {
  return Buffer.from(Math.random().toString()).toString('base64url').slice(0, 20);
}
