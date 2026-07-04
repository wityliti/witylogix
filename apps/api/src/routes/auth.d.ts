/**
 * Authentication routes — JWT token issuance and management.
 *
 * Three auth flows:
 *   1. Dashboard user: email + password → JWT (shop-scoped, optionally org-scoped)
 *   2. Driver app: phone + password → JWT (shop-scoped)
 *   3. Token refresh: refresh token → new JWT pair
 *
 * Shopify session token verification happens in the embedded app
 * via App Bridge, not through these routes. These routes are for
 * the standalone dashboard and driver app.
 *
 * Routes:
 *   POST /login           Dashboard user login (email + password)
 *   POST /driver/login    Driver login (phone + password)
 *   POST /refresh         Refresh access token
 *   POST /logout          Invalidate refresh token
 *   POST /forgot-password Request password reset
 *   POST /reset-password  Reset password with token
 */
import type { FastifyInstance } from "fastify";
declare function authRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof authRoutes;
export default _default;
//# sourceMappingURL=auth.d.ts.map
