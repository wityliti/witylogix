// @ts-nocheck
/**
 * Webhook Processing Worker
 * Processes pending webhook deliveries, handles retries, and manages circuit breakers
 */

import { WebhookManager, getWebhookManager } from "./webhook-manager";
import {
  WebhookDeliveryService,
  getWebhookDeliveryService,
} from "./webhook-delivery";

/**
 * Webhook processor configuration
 */
export interface WebhookProcessorConfig {
  batchSize?: number;
  processingIntervalMs?: number;
  maxConcurrentDeliveries?: number;
}

/**
 * Webhook Processor
 * Runs as a background job to process pending deliveries
 */
export class WebhookProcessor {
  private webhookManager: WebhookManager;
  private deliveryService: WebhookDeliveryService;
  private prisma: any;
  private isRunning: boolean = false;
  private processingIntervalMs: number;
  private batchSize: number;
  private maxConcurrentDeliveries: number;
  private processingTimer?: NodeJS.Timeout;

  /**
   * Initialize the webhook processor
   */
  constructor(prisma: any, config: WebhookProcessorConfig = {}) {
    this.prisma = prisma;
    this.webhookManager = getWebhookManager(prisma);
    this.deliveryService = getWebhookDeliveryService(
      this.webhookManager,
      prisma,
    );
    this.processingIntervalMs = config.processingIntervalMs || 5000; // 5 seconds
    this.batchSize = config.batchSize || 10;
    this.maxConcurrentDeliveries = config.maxConcurrentDeliveries || 5;
  }

  /**
   * Start the webhook processor
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Webhook processor is already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `Starting webhook processor (interval: ${this.processingIntervalMs}ms, batch: ${this.batchSize})`,
    );

    // Run processing loop
    this.processLoop();
  }

  /**
   * Stop the webhook processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    console.log("Webhook processor stopped");
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processPendingDeliveries();
        await this.resetCircuitBreakers();
      } catch (error) {
        console.error(
          "Error in webhook processor:",
          error instanceof Error ? error.message : String(error),
        );
      }

      // Schedule next run
      if (this.isRunning) {
        await new Promise(
          (resolve) =>
            (this.processingTimer = setTimeout(
              resolve,
              this.processingIntervalMs,
            )),
        );
      }
    }
  }

  /**
   * Process pending deliveries across all tenants
   */
  private async processPendingDeliveries(): Promise<void> {
    // Get all tenants with pending deliveries
    const tenants = await (this.prisma as any).webhookDelivery.findMany({
      where: { status: "pending" },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });

    // Process each tenant's deliveries
    for (const { tenantId } of tenants) {
      try {
        await this.deliveryService.processPendingDeliveries(
          tenantId,
          this.batchSize,
        );
      } catch (error) {
        console.error(
          `Error processing deliveries for tenant ${tenantId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Reset circuit breakers that have timed out
   */
  private async resetCircuitBreakers(): Promise<void> {
    const circuitBreakerResetTimeMs = 60 * 60 * 1000; // 1 hour
    const resetBefore = new Date(Date.now() - circuitBreakerResetTimeMs);

    // Find circuit breakers that can be reset
    const endpoints = await (this.prisma as any).webhookEndpoint.findMany({
      where: {
        circuitBreakerOpen: true,
        lastFailureAt: { lt: resetBefore },
      },
    });

    // Reset each circuit breaker
    for (const endpoint of endpoints) {
      try {
        console.log(
          `Resetting circuit breaker for endpoint ${endpoint.id} (last failure: ${endpoint.lastFailureAt})`,
        );

        await this.webhookManager.resetCircuitBreaker(endpoint.id);
      } catch (error) {
        console.error(
          `Failed to reset circuit breaker for ${endpoint.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Process deliveries for a specific tenant (manual trigger)
   */
  async processForTenant(
    tenantId: string,
    batchSize?: number,
  ): Promise<number> {
    return await this.deliveryService.processPendingDeliveries(
      tenantId,
      batchSize || this.batchSize,
    );
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean;
    processingIntervalMs: number;
    batchSize: number;
    maxConcurrentDeliveries: number;
  } {
    return {
      isRunning: this.isRunning,
      processingIntervalMs: this.processingIntervalMs,
      batchSize: this.batchSize,
      maxConcurrentDeliveries: this.maxConcurrentDeliveries,
    };
  }
}

/**
 * Singleton instance
 */
let processorInstance: WebhookProcessor | null = null;

/**
 * Get or initialize the webhook processor
 */
export function getWebhookProcessor(
  prisma: any,
  config?: WebhookProcessorConfig,
): WebhookProcessor {
  if (!processorInstance) {
    processorInstance = new WebhookProcessor(prisma, config);
  }
  return processorInstance;
}

/**
 * Initialize and start the webhook processor at application startup
 */
export function initializeWebhookProcessor(
  prisma: any,
  config?: WebhookProcessorConfig,
): WebhookProcessor {
  const processor = getWebhookProcessor(prisma, config);
  processor.start();
  return processor;
}
