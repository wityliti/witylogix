/**
 * Courier Dispatcher Service
 *
 * Orchestrates multi-courier operations:
 * - Compare quotes from multiple providers
 * - Auto-select best courier (cheapest, fastest, or preferred)
 * - Dispatch deliveries with fallback support
 * - Handle webhooks from multiple providers
 * - Track delivery status across providers
 */

import { CourierAdapter } from "./courier-adapter.js";
import { CourierNormalizer, QuoteComparator, StatusTracker } from "./courier-normalizer.js";
import { WebhookEvent, DeliveryStatus } from "./types.js";
import type {
  QuoteRequest,
  CreateDeliveryRequest,
  DispatchRequest,
  DispatchResult,
  DispatchStrategy,
  CourierQuote,
  NormalizedQuote,
  CourierDelivery,
  WebhookPayload,
} from "./types.js";

/**
 * Courier dispatcher service.
 * Manages multiple courier adapters and coordinates operations.
 */
export class CourierDispatcher {
  private adapters: Map<string, CourierAdapter> = new Map();

  private statusTracker = new StatusTracker();

  private webhookHandlers: Map<WebhookEvent, Array<(payload: WebhookPayload) => Promise<void>>> = new Map();

  /**
   * Register a courier adapter.
   *
   * @param adapter Courier adapter instance
   */
  registerAdapter(adapter: CourierAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  /**
   * Get a registered adapter by provider name.
   *
   * @param provider Provider name (onfleet, stuart, uber)
   * @returns Adapter or undefined if not registered
   */
  getAdapter(provider: string): CourierAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * List all registered adapters.
   *
   * @returns Array of provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get quotes from multiple couriers for comparison.
   *
   * @param request Quote request
   * @param providers Specific providers to quote (all registered if undefined)
   * @param exchangeRates Exchange rates for normalization
   * @returns Array of quotes and comparison analysis
   */
  async getQuotes(
    request: QuoteRequest,
    providers?: string[],
    exchangeRates?: Record<string, number>,
  ): Promise<{
    quotes: CourierQuote[];
    normalized: ReturnType<typeof QuoteComparator.compare>;
    errors: Array<{ provider: string; error: string }>;
  }> {
    const providersToQuote = providers || this.getAvailableProviders();
    const quotes: CourierQuote[] = [];
    const errors: Array<{ provider: string; error: string }> = [];

    // Fetch quotes in parallel
    const promises = providersToQuote.map(async (provider) => {
      const adapter = this.getAdapter(provider);
      if (!adapter) {
        errors.push({ provider, error: "Adapter not registered" });
        return;
      }

      try {
        const quote = await adapter.getQuote(request);
        quotes.push(quote);
      } catch (error) {
        errors.push({
          provider,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    await Promise.all(promises);

    return {
      quotes,
      normalized: QuoteComparator.compare(quotes, exchangeRates),
      errors,
    };
  }

  /**
   * Dispatch a delivery with intelligent courier selection.
   *
   * @param request Dispatch request
   * @param exchangeRates Exchange rates for quote comparison
   * @returns Dispatch result with created delivery
   * @throws Error if dispatch fails
   */
  async dispatch(
    request: DispatchRequest,
    exchangeRates?: Record<string, number>,
  ): Promise<DispatchResult> {
    // Get quotes for selection
    const { quotes, normalized, errors } = await this.getQuotes(
      {
        pickup: request.pickup,
        dropoff: request.dropoff,
        package: request.package,
        scheduledFor: request.scheduledFor,
      },
      request.preferredCourier ? [request.preferredCourier] : undefined,
      exchangeRates,
    );

    if (quotes.length === 0) {
      throw new Error(`No quotes available. Errors: ${errors.map((e) => `${e.provider}: ${e.error}`).join("; ")}`);
    }

    // Select courier based on strategy
    let selectedCourier: string | undefined;
    let selectedNormalized: NormalizedQuote | undefined;
    let selectedQuote: CourierQuote | undefined;

    if (request.preferredCourier) {
      selectedCourier = request.preferredCourier;
      selectedQuote = quotes.find((q) => q.provider === request.preferredCourier);
      if (!selectedQuote) {
        throw new Error(`Preferred courier ${request.preferredCourier} did not provide a quote`);
      }
    } else {
      const strategy = request.strategy || "auto";

      switch (strategy) {
        case "cheapest":
          selectedNormalized = normalized.cheapest;
          break;
        case "fastest":
          selectedNormalized = normalized.fastest;
          break;
        case "preferred": {
          // Weighted scoring: 60% price, 40% time
          const scored = this.scoreQuotesForDispatch(quotes, exchangeRates);
          selectedQuote = scored[0]?.quote;
          break;
        }
        case "auto":
        default:
          // Auto: prefer fastest if within 20% of cheapest price
          if (normalized.cheapest && normalized.fastest) {
            const cheapestPrice = normalized.cheapest.priceUsd;
            const fastestPrice = normalized.fastest.priceUsd;
            const threshold = cheapestPrice * 1.2;

            if (fastestPrice <= threshold) {
              selectedNormalized = normalized.fastest;
            } else {
              selectedNormalized = normalized.cheapest;
            }
          } else {
            selectedNormalized = normalized.cheapest || normalized.fastest;
          }
          break;
      }

      if (!selectedQuote && selectedNormalized) {
        // Convert NormalizedQuote to CourierQuote
        selectedQuote = quotes.find((q) => q.provider === selectedNormalized!.provider);
      }

      if (!selectedQuote) {
        throw new Error("Failed to select courier based on strategy");
      }

      selectedCourier = selectedQuote.provider;
    }

    // Create delivery with selected courier
    const adapter = this.getAdapter(selectedCourier);
    if (!adapter) {
      throw new Error(`Adapter not found for selected courier: ${selectedCourier}`);
    }

    const delivery = await adapter.createDelivery({
      pickup: request.pickup,
      dropoff: request.dropoff,
      package: request.package,
      recipient: request.recipient,
      scheduledFor: request.scheduledFor,
      orderId: request.orderId,
    });

    // Track delivery status
    this.statusTracker.trackStatus(delivery.id, delivery.status);

    return {
      courier: selectedCourier,
      delivery,
      quote: selectedQuote,
      deliveryId: delivery.id,
      trackingUrl: delivery.trackingUrl,
    };
  }

  /**
   * Handle webhook payload from a courier.
   *
   * @param provider Provider name
   * @param payload Webhook payload
   * @throws Error if provider not recognized
   */
  async handleWebhook(provider: string, payload: unknown): Promise<void> {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Parse and process webhook based on provider
    const webhookPayload = this.parseWebhook(provider, payload as Record<string, unknown>);

    // Update delivery status tracker
    this.statusTracker.trackStatus(webhookPayload.deliveryId, webhookPayload.data.status as DeliveryStatus);

    // Call registered handlers for this event type
    const handlers = this.webhookHandlers.get(webhookPayload.event) || [];
    for (const handler of handlers) {
      try {
        await handler(webhookPayload);
      } catch (error) {
        console.error(`Webhook handler error for ${webhookPayload.event}:`, error);
      }
    }
  }

  /**
   * Register a webhook event handler.
   *
   * @param event Event type to listen for
   * @param handler Handler function
   */
  onWebhookEvent(event: WebhookEvent, handler: (payload: WebhookPayload) => Promise<void>): void {
    if (!this.webhookHandlers.has(event)) {
      this.webhookHandlers.set(event, []);
    }
    this.webhookHandlers.get(event)!.push(handler);
  }

  /**
   * Get current delivery status.
   *
   * @param deliveryId Delivery ID
   * @param provider Provider name
   * @returns Current delivery status
   * @throws Error if delivery not found
   */
  async getDeliveryStatus(deliveryId: string, provider: string) {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const status = await adapter.getDeliveryStatus(deliveryId);
    this.statusTracker.trackStatus(deliveryId, status.status);

    return status;
  }

  /**
   * Cancel a delivery.
   *
   * @param deliveryId Delivery ID
   * @param provider Provider name
   * @returns Updated delivery status
   * @throws Error if cancellation fails
   */
  async cancelDelivery(deliveryId: string, provider: string) {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const status = await adapter.cancelDelivery(deliveryId);
    this.statusTracker.trackStatus(deliveryId, status.status);

    return status;
  }

  /**
   * Get driver location for active delivery.
   *
   * @param deliveryId Delivery ID
   * @param provider Provider name
   * @returns Driver position
   * @throws Error if location unavailable
   */
  async getDriverLocation(deliveryId: string, provider: string) {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return adapter.getDriverLocation(deliveryId);
  }

  /**
   * Register webhook for delivery events.
   *
   * @param provider Provider name
   * @param webhookUrl URL to receive webhook callbacks
   * @param events Events to subscribe to
   * @returns Webhook registration info
   */
  async registerWebhook(provider: string, webhookUrl: string, events: WebhookEvent[]) {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return adapter.registerWebhook({
      url: webhookUrl,
      events,
    });
  }

  /**
   * Check health of all registered adapters.
   *
   * @returns Map of provider -> health status
   */
  async healthCheck(): Promise<Map<string, { healthy: boolean; error?: string }>> {
    const results = new Map<string, { healthy: boolean; error?: string }>();

    for (const [provider, adapter] of this.adapters.entries()) {
      try {
        const healthy = await adapter.healthCheck();
        results.set(provider, { healthy });
      } catch (error) {
        results.set(provider, {
          healthy: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Parse webhook payload based on provider.
   */
  private parseWebhook(provider: string, payload: Record<string, unknown>): WebhookPayload {
    switch (provider) {
      case "onfleet":
        return this.parseOnfleetWebhook(payload);
      case "stuart":
        return this.parseStuartWebhook(payload);
      case "uber":
        return this.parseUberWebhook(payload);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Parse Onfleet webhook.
   */
  private parseOnfleetWebhook(payload: Record<string, unknown>): WebhookPayload {
    const event = payload.action as string;
    const taskId = (payload.data as Record<string, unknown>)?.id as string;

    return {
      event: this.mapOnfleetEvent(event),
      deliveryId: taskId,
      providerId: taskId,
      data: (payload.data as Record<string, unknown>) || {},
      timestamp: new Date(),
    };
  }

  /**
   * Parse Stuart webhook.
   */
  private parseStuartWebhook(payload: Record<string, unknown>): WebhookPayload {
    const jobId = (payload.data as Record<string, unknown>)?.id as string;

    return {
      event: this.mapStuartEvent(payload.event as string),
      deliveryId: jobId,
      providerId: jobId,
      data: (payload.data as Record<string, unknown>) || {},
      timestamp: new Date(payload.created_at as string),
    };
  }

  /**
   * Parse Uber webhook.
   */
  private parseUberWebhook(payload: Record<string, unknown>): WebhookPayload {
    const deliveryId = (payload.data as Record<string, unknown>)?.delivery_id as string;

    return {
      event: this.mapUberEvent(payload.event_type as string),
      deliveryId,
      providerId: deliveryId,
      data: (payload.data as Record<string, unknown>) || {},
      timestamp: new Date(),
    };
  }

  private mapOnfleetEvent(action: string): WebhookEvent {
    switch (action) {
      case "task_created":
        return WebhookEvent.DELIVERY_CREATED;
      case "task_updated":
        return WebhookEvent.DELIVERY_IN_TRANSIT;
      case "task_completed":
        return WebhookEvent.DELIVERY_DELIVERED;
      case "task_failed":
        return WebhookEvent.DELIVERY_FAILED;
      default:
        return WebhookEvent.DELIVERY_IN_TRANSIT;
    }
  }

  private mapStuartEvent(event: string): WebhookEvent {
    switch (event) {
      case "job_created":
        return WebhookEvent.DELIVERY_CREATED;
      case "job_accepted":
        return WebhookEvent.DELIVERY_PICKED_UP;
      case "job_in_progress":
        return WebhookEvent.DELIVERY_IN_TRANSIT;
      case "job_completed":
        return WebhookEvent.DELIVERY_DELIVERED;
      case "job_failed":
        return WebhookEvent.DELIVERY_FAILED;
      case "job_cancelled":
        return WebhookEvent.DELIVERY_CANCELLED;
      default:
        return WebhookEvent.DELIVERY_IN_TRANSIT;
    }
  }

  private mapUberEvent(eventType: string): WebhookEvent {
    switch (eventType) {
      case "delivery_scheduled":
        return WebhookEvent.DELIVERY_CREATED;
      case "delivery_pickup_completed":
        return WebhookEvent.DELIVERY_PICKED_UP;
      case "delivery_dropoff_estimated_arrival":
        return WebhookEvent.DELIVERY_IN_TRANSIT;
      case "delivery_completed":
        return WebhookEvent.DELIVERY_DELIVERED;
      case "delivery_failed":
        return WebhookEvent.DELIVERY_FAILED;
      case "delivery_cancelled":
        return WebhookEvent.DELIVERY_CANCELLED;
      case "delivery_courier_location_updated":
        return WebhookEvent.DRIVER_LOCATION_UPDATED;
      default:
        return WebhookEvent.DELIVERY_IN_TRANSIT;
    }
  }

  /**
   * Score quotes and return sorted by quality.
   */
  private scoreQuotesForDispatch(quotes: CourierQuote[], exchangeRates?: Record<string, number>) {
    const scored = QuoteComparator.scoreQuotes(quotes, 0.6, 0.4, exchangeRates);
    return scored.sort((a, b) => b.score - a.score).map((q) => ({
      quote: quotes.find((cq) => cq.provider === q.provider) as CourierQuote,
    }));
  }
}

/**
 * Singleton instance of courier dispatcher.
 */
export const courierDispatcher = new CourierDispatcher();
