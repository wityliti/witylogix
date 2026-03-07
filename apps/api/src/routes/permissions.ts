/**
 * Permissions & RBAC API — Role-based access control management
 *
 * Routes (all require OWNER/ADMIN role):
 *   GET    /roles                  List all roles
 *   GET    /roles/:id              Get role detail with permissions
 *   POST   /roles                  Create custom role
 *   PATCH  /roles/:id              Update role permissions
 *   DELETE /roles/:id              Delete custom role (not system)
 *   GET    /users/:userId/permissions  Get user's effective permissions
 *   POST   /users/:userId/roles    Assign role to user
 *   DELETE /users/:userId/roles/:roleId  Remove role from user
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────

const createRoleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

// System roles that cannot be deleted
const SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "DISPATCHER", "VIEWER", "DRIVER"];

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function permissionsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth, tenant context, and owner/admin role
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);
  fastify.addHook("preHandler", requireRole("ADMIN", "SUPER_ADMIN"));

  // ── LIST ROLES ──────────────────────────────────────────────

  fastify.get(
    "/roles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page = 1, limit = 50, custom } = request.query as {
          page?: number;
          limit?: number;
          custom?: boolean;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE shop_id = $1::uuid";
        const params: any[] = [(request as any).shopId];
        let paramCount = 1;

        if (custom !== undefined && custom === true) {
          paramCount++;
          whereClause += ` AND is_system_role = false`;
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM roles ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, shop_id, name, description, is_system_role,
              permissions, metadata, created_at, updated_at
            FROM roles
            ${whereClause}
            ORDER BY is_system_role DESC, name ASC
            LIMIT $${paramCount + 1}::int
            OFFSET $${paramCount + 2}::int
          `,
          ...params,
          pageSize,
          skip
        );

        return {
          data: result,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to list roles");
        return reply.code(500).send({ error: "Failed to list roles" });
      }
    }
  );

  // ── GET SINGLE ROLE ─────────────────────────────────────────

  fastify.get(
    "/roles/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const role: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT *
            FROM roles
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!role || role.length === 0) {
          throw new NotFoundError("Role", id);
        }

        return role[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get role");
        return reply.code(500).send({ error: "Failed to get role" });
      }
    }
  );

  // ── CREATE ROLE ─────────────────────────────────────────────

  fastify.post(
    "/roles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createRoleSchema.parse(request.body);

        // Check if role name already exists
        const existing: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM roles
            WHERE shop_id = $1::uuid AND name = $2::text
          `,
          (request as any).shopId,
          body.name
        );

        if (existing && existing.length > 0) {
          throw new ConflictError("Role with this name already exists");
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            INSERT INTO roles (
              shop_id, name, description, is_system_role, permissions, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `,
          (request as any).shopId,
          body.name,
          body.description || null,
          false,
          JSON.stringify(body.permissions),
          body.metadata ? JSON.stringify(body.metadata) : "{}"
        );

        return reply.code(201).send(result[0]);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to create role");
        return reply.code(500).send({ error: "Failed to create role" });
      }
    }
  );

  // ── UPDATE ROLE ─────────────────────────────────────────────

  fastify.patch(
    "/roles/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateRoleSchema.parse(request.body);

        // Check if role exists
        const role: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, is_system_role FROM roles
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!role || role.length === 0) {
          throw new NotFoundError("Role", id);
        }

        // System roles cannot be updated
        if (role[0].is_system_role) {
          throw new ConflictError("Cannot modify system roles");
        }

        const fields: string[] = [];
        const values: any[] = [id, (request as any).shopId];
        let paramCount = 2;

        if (body.name !== undefined) {
          paramCount++;
          fields.push(`name = $${paramCount}`);
          values.push(body.name);
        }

        if (body.description !== undefined) {
          paramCount++;
          fields.push(`description = $${paramCount}`);
          values.push(body.description);
        }

        if (body.permissions !== undefined) {
          paramCount++;
          fields.push(`permissions = $${paramCount}`);
          values.push(JSON.stringify(body.permissions));
        }

        if (body.metadata !== undefined) {
          paramCount++;
          fields.push(`metadata = $${paramCount}`);
          values.push(JSON.stringify(body.metadata));
        }

        if (fields.length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            UPDATE roles
            SET ${fields.join(", ")}, updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          ...values
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        fastify.log.error({ err: error }, "Failed to update role");
        return reply.code(500).send({ error: "Failed to update role" });
      }
    }
  );

  // ── DELETE ROLE ─────────────────────────────────────────────

  fastify.delete(
    "/roles/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const role: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, name, is_system_role FROM roles
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!role || role.length === 0) {
          throw new NotFoundError("Role", id);
        }

        // Prevent deletion of system roles
        if (role[0].is_system_role) {
          throw new ConflictError("Cannot delete system roles");
        }

        // Check if role is assigned to any users
        const assignments: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT COUNT(*) as count FROM user_roles
            WHERE role_id = $1::uuid
          `,
          id
        );

        if (Number(assignments[0]?.count || 0) > 0) {
          throw new ConflictError(
            "Cannot delete role that is assigned to users. Remove all assignments first."
          );
        }

        await (request as any).tenantDb.$queryRawUnsafe(
          `
            DELETE FROM roles
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to delete role");
        return reply.code(500).send({ error: "Failed to delete role" });
      }
    }
  );

  // ── GET USER PERMISSIONS ────────────────────────────────────

  fastify.get(
    "/users/:userId/permissions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string };

        // Verify user exists
        const user: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM users
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          userId,
          (request as any).shopId
        );

        if (!user || user.length === 0) {
          throw new NotFoundError("User", userId);
        }

        // Get user's roles and their permissions
        const userRoles: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT r.id, r.name, r.permissions
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1::uuid
          `,
          userId
        );

        // Aggregate permissions from all roles
        const allPermissions = new Set<string>();
        userRoles.forEach((role) => {
          if (Array.isArray(role.permissions)) {
            role.permissions.forEach((perm: string) => allPermissions.add(perm));
          } else if (typeof role.permissions === "string") {
            const perms = JSON.parse(role.permissions);
            if (Array.isArray(perms)) {
              perms.forEach((perm: string) => allPermissions.add(perm));
            }
          }
        });

        return {
          userId,
          roles: userRoles,
          permissions: Array.from(allPermissions).sort(),
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get user permissions");
        return reply.code(500).send({ error: "Failed to get user permissions" });
      }
    }
  );

  // ── ASSIGN ROLE TO USER ─────────────────────────────────────

  fastify.post(
    "/users/:userId/roles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string };
        const body = assignRoleSchema.parse(request.body);

        // Verify user exists
        const user: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM users
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          userId,
          (request as any).shopId
        );

        if (!user || user.length === 0) {
          throw new NotFoundError("User", userId);
        }

        // Verify role exists
        const role: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM roles
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          body.roleId,
          (request as any).shopId
        );

        if (!role || role.length === 0) {
          throw new NotFoundError("Role", body.roleId);
        }

        // Check if already assigned
        const existing: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM user_roles
            WHERE user_id = $1::uuid AND role_id = $2::uuid
          `,
          userId,
          body.roleId
        );

        if (existing && existing.length > 0) {
          throw new ConflictError("User already has this role");
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1::uuid, $2::uuid)
            RETURNING *
          `,
          userId,
          body.roleId
        );

        fastify.log.info(
          { userId, roleId: body.roleId },
          "Role assigned to user"
        );

        return reply.code(201).send(result[0]);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        fastify.log.error({ err: error }, "Failed to assign role");
        return reply.code(500).send({ error: "Failed to assign role" });
      }
    }
  );

  // ── REMOVE ROLE FROM USER ───────────────────────────────────

  fastify.delete(
    "/users/:userId/roles/:roleId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, roleId } = request.params as {
          userId: string;
          roleId: string;
        };

        // Verify assignment exists
        const assignment: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM user_roles
            WHERE user_id = $1::uuid AND role_id = $2::uuid
          `,
          userId,
          roleId
        );

        if (!assignment || assignment.length === 0) {
          throw new NotFoundError("Role assignment");
        }

        // Prevent removing the last admin role if user is the only admin
        const adminRole: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM roles
            WHERE shop_id = $1::uuid AND name = 'ADMIN'
          `,
          (request as any).shopId
        );

        if (adminRole && adminRole[0].id === roleId) {
          const otherAdmins: any[] = await (request as any).tenantDb.$queryRawUnsafe(
            `
              SELECT COUNT(*) as count FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id != $1::uuid AND r.name = 'ADMIN'
              AND r.shop_id = $2::uuid
            `,
            userId,
            (request as any).shopId
          );

          if (Number(otherAdmins[0]?.count || 0) === 0) {
            throw new ConflictError(
              "Cannot remove the last admin role from the shop"
            );
          }
        }

        await (request as any).tenantDb.$queryRawUnsafe(
          `
            DELETE FROM user_roles
            WHERE user_id = $1::uuid AND role_id = $2::uuid
          `,
          userId,
          roleId
        );

        fastify.log.info(
          { userId, roleId },
          "Role removed from user"
        );

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to remove role");
        return reply.code(500).send({ error: "Failed to remove role" });
      }
    }
  );
}

export default permissionsRoutes;
