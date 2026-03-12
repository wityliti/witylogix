/**
 * E-Commerce Integration API Routes
 * Handles multi-platform e-commerce operations: connect, sync, orders, webhooks
 */

import { Router } from "express";
import type { Request, Response } from "express";
import {
  createMagentoClient,
  createBigCommerceClient,
  createSyncEngine,
  type ECommerceAdapterConfig,
  type SyncOptions,
} from "../../../packages/core/src/integrations/ecommerce/index.js";

interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userId?: string;
}

/**
 * Create e-commerce router
 */
export function createECommerceRouter(): Router {
  const router = Router();
  const syncEngines = new Map<string, ReturnType<typeof createSyncEngine>>();

  /**
   * GET /ecommerce/status
   * Get sync status for all platforms or a specific platform
   */
  router.get("/status", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;
      const platform = req.query.platform as string | undefined;

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      if (platform) {
        const status = syncEngine.getSyncStatus(platform);
        return res.json({ status });
      }

      const allStatus = syncEngine.getAllSyncStatus();
      const statusArray = Array.from(allStatus.entries()).map(([p, s]) => ({ platform: p, ...s }));

      return res.json({ statuses: statusArray });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /ecommerce/connect
   * Connect a new e-commerce platform
   */
  router.post("/connect", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { platform, config } = req.body as {
        platform: "magento" | "bigcommerce";
        config: ECommerceAdapterConfig;
      };

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      if (!platform || !config) {
        return res.status(400).json({ error: "platform and config are required" });
      }

      // Initialize sync engine if needed
      if (!syncEngines.has(tenantId)) {
        syncEngines.set(tenantId, createSyncEngine());
      }

      const syncEngine = syncEngines.get(tenantId)!;

      // Create appropriate adapter
      let adapter;
      switch (platform) {
        case "magento":
          adapter = createMagentoClient(config);
          break;
        case "bigcommerce":
          adapter = createBigCommerceClient(config);
          break;
        default:
          return res.status(400).json({ error: `Unsupported platform: ${platform}` });
      }

      // Validate connection
      const isValid = await adapter.validateConnection();
      if (!isValid) {
        return res.status(400).json({ error: "Failed to validate connection to platform" });
      }

      // Register adapter
      syncEngine.registerAdapter(platform, adapter);

      // Return success
      return res.status(201).json({
        message: `Successfully connected to ${platform}`,
        platform,
        status: "connected",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /ecommerce/orders/:platform
   * Get orders from a specific platform
   */
  router.get("/orders/:platform", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;
      const { platform } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      // Get adapter
      const adapters = syncEngine["adapters"] as Map<string, any>;
      const adapter = adapters.get(platform);
      if (!adapter) {
        return res.status(404).json({ error: `No adapter registered for ${platform}` });
      }

      // Parse query parameters
      const since = req.query.since ? new Date(req.query.since as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const options: SyncOptions = {
        since,
        limit,
      };

      // Fetch orders
      const orders = await adapter.getOrders(options);

      return res.json({
        platform,
        count: orders.length,
        orders,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /ecommerce/products/:platform
   * Get products from a specific platform
   */
  router.get("/products/:platform", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;
      const { platform } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      // Get adapter
      const adapters = syncEngine["adapters"] as Map<string, any>;
      const adapter = adapters.get(platform);
      if (!adapter) {
        return res.status(404).json({ error: `No adapter registered for ${platform}` });
      }

      // Parse query parameters
      const since = req.query.since ? new Date(req.query.since as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const options: SyncOptions = {
        since,
        limit,
      };

      // Fetch products
      const products = await adapter.getProducts(options);

      return res.json({
        platform,
        count: products.length,
        products,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /ecommerce/sync/:platform
   * Trigger manual sync for a platform
   */
  router.post("/sync/:platform", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { platform } = req.params;
      const { entityType, since, limit, chunkSize } = req.body as {
        entityType?: "order" | "product" | "customer" | "all";
        since?: string;
        limit?: number;
        chunkSize?: number;
      };

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      // Check if adapter is registered
      const adapters = syncEngine["adapters"] as Map<string, any>;
      if (!adapters.has(platform)) {
        return res.status(404).json({ error: `No adapter registered for ${platform}` });
      }

      const options: SyncOptions = {
        limit,
        chunkSize,
        since: since ? new Date(since) : undefined,
      };

      const results: Record<string, any> = {};

      // Sync based on entity type
      switch (entityType) {
        case "order":
          results.orders = await syncEngine.syncOrders(platform, options);
          break;
        case "product":
          results.products = await syncEngine.syncProducts(platform, options);
          break;
        case "customer":
          results.customers = await syncEngine.syncCustomers(platform, options);
          break;
        case "all":
        default:
          results.orders = await syncEngine.syncOrders(platform, options);
          results.products = await syncEngine.syncProducts(platform, options);
          results.customers = await syncEngine.syncCustomers(platform, options);
          break;
      }

      return res.json({
        message: `Sync completed for ${platform}`,
        platform,
        results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /ecommerce/webhooks/:platform
   * Receive webhook events from platforms
   */
  router.post("/webhooks/:platform", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;
      const { platform } = req.params;
      const { signature } = req.headers as {
        signature?: string;
        "x-bc-webhook-signature"?: string;
        "x-magento-webhook-signature"?: string;
      };

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      // Get adapter
      const adapters = syncEngine["adapters"] as Map<string, any>;
      const adapter = adapters.get(platform);
      if (!adapter) {
        return res.status(404).json({ error: `No adapter registered for ${platform}` });
      }

      // Verify webhook signature
      const sig = signature || req.headers["x-bc-webhook-signature"] || req.headers["x-magento-webhook-signature"];
      const payload = JSON.stringify(req.body);

      if (sig && !adapter.verifyWebhookSignature(payload, sig as string)) {
        console.warn(`[Webhook] Signature verification failed for ${platform}`);
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Parse webhook event
      const event = await adapter.parseWebhookEvent(req.body);

      // Log webhook event
      console.info(`[Webhook] Received ${event.event} event from ${platform}`);

      // Handle webhook based on topic
      switch (event.event) {
        case "order.created":
        case "order.updated":
          // You would typically sync the order here
          break;
        case "product.created":
        case "product.updated":
          // You would typically sync the product here
          break;
        case "customer.created":
        case "customer.updated":
          // You would typically sync the customer here
          break;
      }

      return res.json({
        message: "Webhook received and processed",
        platform,
        event: event.event,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Webhook] Error processing webhook:`, message);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /ecommerce/health
   * Health check all registered adapters
   */
  router.get("/health", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      const health = await syncEngine.healthCheckAll();
      const allHealthy = Array.from(health.values()).every((h) => h);

      return res.json({
        healthy: allHealthy,
        adapters: Object.fromEntries(health),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /ecommerce/metrics/:platform
   * Get metrics and statistics for a platform
   */
  router.get("/metrics/:platform", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.query.tenantId as string;
      const { platform } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const syncEngine = syncEngines.get(tenantId);
      if (!syncEngine) {
        return res.status(404).json({ error: "No sync engine found for tenant" });
      }

      const statistics = syncEngine.getSyncStatistics(platform);
      const recentJobs = syncEngine.getRecentSyncJobs(platform, 10);
      const auditLog = syncEngine.getAuditLog(platform, 50);

      return res.json({
        platform,
        statistics,
        recentJobs,
        auditLog: auditLog.slice(-10),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  return router;
}

/**
 * Export router
 */
export const ecommerceRouter = createECommerceRouter();
