/**
 * Vite client-only stub for `@witylogix/db`.
 * Server-side route code imports @witylogix/db for Prisma access;
 * the browser bundle must not resolve the real package.
 * Server/SSR resolves the real package via the externals plugin.
 */

export const prisma = {} as Record<string, unknown>;
export default prisma;
