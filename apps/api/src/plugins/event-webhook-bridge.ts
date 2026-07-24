// @ts-nocheck
/**
 * Fastify Plugin: Event Webhook Bridge
 * Initializes and manages the EventWebhookBridge lifecycle
 * Decorates the Fastify instance with eventWebhookBridge accessor
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { EventWebhookBridge } from "@witylogix/core/webhooks";
import type { EventWebhookBridgeConfig } from "@witylogix/core/webhooks";
import { TypedEventBus } from "@witylogix/core/event-bus";
import { WebhookManager } from "@witylogix/core/webhooks";

/**
 * Event Webhook Bridge Plugin Configuration
 */
interface EventWebhookBridgePluginOptions {
  /** Bridge configuration */
  config?: EventWebhookBridgeConfig;

  /** Enable plugin (default: true) */
  enabled?: boolean;
}

/**
 * Plugin to initialize and manage EventWebhookBridge
 */
const eventWebhookBridgePlugin: FastifyPluginAsync<
  EventWebhookBridgePluginOptions
> = async (fastify: FastifyInstance, options) => {
  const { config = {}, enabled = true } = options;

  if (!enabled) {
    fastify.log.info("[EventWebhookBridge] Plugin is disabled");
    return;
  }

  try {
    // Get dependencies from Fastify decorators
    const eventBus: TypedEventBus<any> = fastify.eventBus;
    const prisma: any = fastify.prisma;

    if (!eventBus) {
      throw new Error("EventBus is not available on Fastify instance");
    }

    if (!prisma) {
      throw new Error("Prisma is not available on Fastify instance");
    }

    // Initialize webhook manager
    const webhookManager = new WebhookManager(prisma);

    // Create EventWebhookBridge instance
    const bridge = new EventWebhookBridge(eventBus, webhookManager, prisma, {
      consumerGroup: config.consumerGroup ?? "webhook-bridge",
      replay: config.replay ?? false,
      batchSize: config.batchSize ?? 10,
      verbose: config.verbose ?? false,
      tags: config.tags,
    });

    // Start the bridge
    await bridge.start();

    fastify.log.info("[EventWebhookBridge] Bridge started successfully");

    // Decorate Fastify instance with bridge accessor
    fastify.decorate("eventWebhookBridge", bridge);

    // Register graceful shutdown hook
    fastify.addHook("onClose", async (instance) => {
      try {
        fastify.log.info("[EventWebhookBridge] Shutting down bridge...");
        await bridge.stop();
        fastify.log.info("[EventWebhookBridge] Bridge shut down successfully");
      } catch (error) {
        fastify.log.error(
          "[EventWebhookBridge] Error during shutdown:",
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    // Log metrics periodically (optional)
    const metricsInterval = setInterval(() => {
      if (bridge.isActive()) {
        const metrics = bridge.getMetrics();
        fastify.log.debug("[EventWebhookBridge] Metrics:", {
          eventsProcessed: metrics.eventsProcessed,
          webhooksTriggered: metrics.webhooksTriggered,
          deliveryErrors: metrics.deliveryErrors,
          deliverySuccesses: metrics.deliverySuccesses,
          subscriptionsCount: metrics.subscriptionsCount,
          uptimeMs: metrics.uptimeMs,
        });
      }
    }, 60000); // Log every minute

    // Clean up metrics interval on close
    fastify.addHook("onClose", async () => {
      clearInterval(metricsInterval);
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    fastify.log.error(
      "[EventWebhookBridge] Plugin initialization failed:",
      errorMsg,
    );
    throw error;
  }
};

// Wrap with fastify-plugin to auto-expose decorator
export default fp(eventWebhookBridgePlugin, {
  name: "event-webhook-bridge",
  dependencies: ["event-bus", "prisma"],
});

// Type augmentation is now centralized in types/fastify.d.ts
