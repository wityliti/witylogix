/**
 * User management routes — tenant-scoped CRUD for dashboard users.
 *
 * These routes allow shop admins to invite, list, update, and deactivate
 * dashboard users within their shop. Org-level user management is handled
 * separately via the /orgs/me/members routes.
 *
 * Role hierarchy (shop-level):
 *   SUPER_ADMIN > ADMIN > DISPATCHER > VIEWER
 *
 * Rules:
 *   - Only SUPER_ADMIN can create other SUPER_ADMINs
 *   - Users can only manage users with equal or lower roles
 *   - A shop must always have at least one SUPER_ADMIN
 *   - Users cannot deactivate themselves (prevents lockout)
 *
 * Routes:
 *   GET    /              List users in current shop
 *   GET    /:id           Get single user
 *   POST   /              Invite (create) a new user
 *   PATCH  /:id           Update user (name, role)
 *   PATCH  /:id/password  Change user password (admin or self)
 *   DELETE /:id           Deactivate user (soft delete)
 */
import type { FastifyInstance } from "fastify";
declare function usersRoutes(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof usersRoutes;
export default _default;
//# sourceMappingURL=users.d.ts.map
