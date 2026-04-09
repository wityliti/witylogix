import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Creates a Shopify HMAC verification middleware
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param secret - Shopify API secret key from app config
 * @returns Fastify preHandler hook for HMAC verification
 */
export function verifyShopifyHmac(secret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const hmacHeader = request.headers['x-shopify-hmac-sha256'];
    const rawBody = request.rawBody;

    // Validate required headers and body
    if (!hmacHeader || typeof hmacHeader !== 'string') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing X-Shopify-Hmac-SHA256 header',
      });
      return;
    }

    if (!rawBody) {
      reply.code(400).send({
        error: 'Bad Request',
        message: 'Request body is empty',
      });
      return;
    }

    // Compute HMAC-SHA256 of the raw request body
    const bodyStr = typeof rawBody === 'string' ? rawBody : (rawBody as Buffer).toString('utf-8');
    const computed = crypto
      .createHmac('sha256', secret)
      .update(bodyStr, 'utf-8')
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(computed, 'utf-8');
    const actualBuffer = Buffer.from(hmacHeader, 'utf-8');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid HMAC signature',
      });
      return;
    }
  };
}

/**
 * Alternative HMAC verification function (for manual validation)
 * Returns true if HMAC is valid, false otherwise
 * 
 * @param rawBody - Raw request body as string or buffer
 * @param hmacHeader - X-Shopify-Hmac-SHA256 header value
 * @param secret - Shopify API secret key
 * @returns Boolean indicating if HMAC is valid
 */
export function validateShopifyHmac(
  rawBody: string | Buffer,
  hmacHeader: string,
  secret: string
): boolean {
  const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
  
  const computed = crypto
    .createHmac('sha256', secret)
    .update(bodyString, 'utf-8')
    .digest('base64');

  const expectedBuffer = Buffer.from(computed, 'utf-8');
  const actualBuffer = Buffer.from(hmacHeader, 'utf-8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

// ─── WooCommerce HMAC ─────────────────────────────────────

/**
 * Verify a WooCommerce HMAC-SHA256 webhook signature.
 * WooCommerce computes: base64_encode(hash_hmac('sha256', rawBody, secret, true))
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param rawBody - Raw request body (before JSON parse)
 * @param signature - X-WC-Webhook-Signature header value
 * @param secret - Per-tenant WooCommerce webhook secret
 */
export function validateWooCommerceHmac(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const bodyStr =
    typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');

  const computed = crypto
    .createHmac('sha256', secret)
    .update(bodyStr, 'utf-8')
    .digest('base64');

  const expectedBuffer = Buffer.from(computed, 'utf-8');
  const actualBuffer = Buffer.from(signature, 'utf-8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Fastify preHandler that verifies WooCommerce HMAC-SHA256 signatures.
 *
 * Lookup flow:
 *   1. Read X-WC-Webhook-Signature header → reject with 401 if missing
 *   2. Read X-WC-Webhook-Source header to identify the shop
 *   3. Query DB for the shop's woocommerceWebhookSecret
 *   4. Compute HMAC-SHA256 of the raw body and compare (timingSafeEqual)
 *   5. Reject with 401 on mismatch; pass through on success
 *
 * @param fastify - Fastify instance (needs fastify.db access)
 */
export function verifyWooCommerceHmac(fastify: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const signature = request.headers['x-wc-webhook-signature'];
    const siteUrl = request.headers['x-wc-webhook-source'] as string | undefined;

    if (!signature || typeof signature !== 'string') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing X-WC-Webhook-Signature header',
      });
      return;
    }

    const db = (fastify as any).db;
    if (!db) {
      fastify.log.error('verifyWooCommerceHmac: DB not available');
      reply.code(500).send({ error: 'Internal Server Error' });
      return;
    }

    // Look up shop by site URL to retrieve per-tenant secret
    const shop = siteUrl
      ? await db.shop.findFirst({
          where: {
            OR: [{ woocommerceSiteUrl: siteUrl }, { domain: siteUrl }],
          },
          select: { woocommerceWebhookSecret: true },
        })
      : null;

    if (!shop?.woocommerceWebhookSecret) {
      fastify.log.warn({ siteUrl }, 'WooCommerce webhook: unknown shop or missing secret');
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Unknown shop or webhook secret not configured',
      });
      return;
    }

    const rawBody = (request as any).rawBody ?? JSON.stringify(request.body ?? '');
    const isValid = validateWooCommerceHmac(rawBody, signature, shop.woocommerceWebhookSecret);

    if (!isValid) {
      fastify.log.warn({ siteUrl }, 'WooCommerce webhook signature mismatch');
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }
  };
}
