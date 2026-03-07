/**
 * Authentication middleware — four auth flows converge here:
 *
 * 1. Shopify Embedded App: Session token from App Bridge (Bearer token)
 * 2. Dashboard User: JWT from email/password login
 * 3. Driver App: JWT from phone/password login
 * 4. Org Dashboard: JWT with orgId for cross-shop access
 *
 * All flows extract shop_id (and optionally org_id) to set the RLS context.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
export interface AuthContext {
    shopId: string;
    orgId?: string;
    userId?: string;
    driverId?: string;
    role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "VIEWER" | "DRIVER";
    orgRole?: "OWNER" | "ADMIN" | "MEMBER";
    shopDomain?: string;
}
declare module "fastify" {
    interface FastifyRequest {
        auth: AuthContext;
    }
}
export declare function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function requireRole(...allowedRoles: AuthContext["role"][]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
export declare function requireOrgRole(...allowedOrgRoles: NonNullable<AuthContext["orgRole"]>[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
export declare function verifyShopifyWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function verifyCarrierRequest(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map