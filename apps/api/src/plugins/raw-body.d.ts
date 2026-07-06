/**
 * Raw body plugin — captures the raw request body for webhook HMAC verification.
 * Shopify webhooks require the raw body to compute the HMAC signature.
 */
import type { FastifyInstance } from "fastify";
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}
declare function rawBodyPlugin(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof rawBodyPlugin;
export default _default;
//# sourceMappingURL=raw-body.d.ts.map
