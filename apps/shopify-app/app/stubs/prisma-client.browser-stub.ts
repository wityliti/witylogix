/**
 * Vite client-only stub for `@prisma/client`.
 * Route modules import `~/lib/shopify.server`, which pulls Prisma session storage;
 * the browser bundle must not load Prisma's `index-browser` (generated `.prisma/client`
 * is not present for that entry). Server/SSR resolves the real package.
 */

export class PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options?: unknown) {}
}

/** Session storage imports `Prisma` for error codes; unused in the stub. */
export const Prisma = {} as Record<string, unknown>;
