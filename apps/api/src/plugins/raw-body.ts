/**
 * Raw body plugin — captures the raw request body for webhook HMAC verification.
 * Shopify webhooks require the raw body to compute the HMAC signature.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

async function rawBodyPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: any, body: Buffer, done: any) => {
      // Store raw body on the request for HMAC verification
      (req as any).rawBody = body;

      try {
        const json = JSON.parse(body.toString());
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}

export default fp(rawBodyPlugin, {
  name: "raw-body",
});
