import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';

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
