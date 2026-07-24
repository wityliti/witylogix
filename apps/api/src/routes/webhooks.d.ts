/**
 * Shopify Webhook Ingestion — verified via HMAC.
 *
 * Handles:
 *   POST /orders/create    New order from Shopify
 *   POST /orders/updated   Order updated in Shopify
 *   POST /orders/cancelled Order cancelled in Shopify
 *   POST /app/uninstalled  App uninstalled from shop
 *   POST /customers/redact Customer data redact request (GDPR)
 *   POST /shop/redact      Shop data redact request (GDPR)
 *   POST /customers/data_request  Customer data request (GDPR)
 */
import type { FastifyInstance } from "fastify";
declare function webhooksRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof webhooksRoutes;
export default _default;
//# sourceMappingURL=webhooks.d.ts.map
