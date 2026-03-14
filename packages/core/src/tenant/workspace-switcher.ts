/**
 * Workspace Switcher — Multi-workspace context management.
 *
 * Allows users to switch between multiple workspaces (shops/divisions)
 * they have access to. Each workspace is typically a Shop within an Org.
 *
 * Features:
 * - List all accessible workspaces for a user
 * - Switch active workspace (updates session/context)
 * - Get current workspace context
 * - Validate access before switching
 */

import { prisma } from "@witylogix/db";

// ─── TYPES ─────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  orgId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  userRole: string; // Role in this workspace (may differ from org role)
}

// ─── LIST WORKSPACES ───────────────────────────────────────────────────

/**
 * Get all workspaces accessible to a user.
 *
 * User must be an OrgMember to access workspaces in their organization.
 * If user has no shopIds restriction, they can access all shops in the org.
 * If user has shopIds specified, they can only access those shops.
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @returns Array of workspaces user can access
 */
export async function listWorkspaces(
  userId: string,
  orgId: string
): Promise<Workspace[]> {
  // Get user's org membership
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });

  if (!membership) {
    return []; // User not a member of this org
  }

  // If user has no shop restrictions, return all shops in org
  if (!membership.shopIds || membership.shopIds.length === 0) {
    const shops = await prisma.shop.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        orgId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return shops as any;
  }

  // Otherwise, return only assigned shops
  const shops = await prisma.shop.findMany({
    where: {
      id: { in: membership.shopIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      orgId: true,
      isActive: true,
      createdAt: true,
    },
  });

  return shops as any;
}

// ─── SWITCH WORKSPACE ──────────────────────────────────────────────────

/**
 * Switch active workspace for a user.
 *
 * Validates:
 * - User is member of organization
 * - Workspace exists and is active
 * - User has access to workspace (via shopIds or no restriction)
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param workspaceId - Shop/workspace ID to switch to
 * @returns Updated workspace context
 */
export async function switchWorkspace(
  userId: string,
  orgId: string,
  workspaceId: string
): Promise<WorkspaceContext> {
  // Verify user is org member
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });

  if (!membership) {
    throw new Error(`User ${userId} is not a member of org ${orgId}`);
  }

  // Verify workspace exists and belongs to org
  const workspace = await prisma.shop.findFirst({
    where: { id: workspaceId, orgId },
  });

  if (!workspace) {
    throw new Error(
      `Workspace ${workspaceId} not found in organization ${orgId}`
    );
  }

  if (!workspace.isActive) {
    throw new Error(`Workspace ${workspaceId} is not active`);
  }

  // Verify user has access to this workspace
  const hasAccess =
    !membership.shopIds ||
    membership.shopIds.length === 0 ||
    membership.shopIds.includes(workspaceId);

  if (!hasAccess) {
    throw new Error(
      `User ${userId} does not have access to workspace ${workspaceId}`
    );
  }

  // Store in session/cache (implementation depends on session strategy)
  // This would typically update req.session or similar
  // For now, just return the context

  return {
    workspaceId,
    workspaceName: workspace.name,
    orgId,
    userRole: membership.role,
  };
}

// ─── GET ACTIVE WORKSPACE ──────────────────────────────────────────────

/**
 * Get current active workspace for a user.
 *
 * Retrieves from session/cache. If none set, returns first accessible workspace.
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param activeWorkspaceId - Currently active workspace ID (from session)
 * @returns Current workspace context
 */
export async function getActiveWorkspace(
  userId: string,
  orgId: string,
  activeWorkspaceId?: string
): Promise<WorkspaceContext | null> {
  // If active workspace specified, validate and return it
  if (activeWorkspaceId) {
    try {
      return await switchWorkspace(userId, orgId, activeWorkspaceId);
    } catch (err) {
      // Fall through to get first accessible
    }
  }

  // Get first accessible workspace
  const workspaces = await listWorkspaces(userId, orgId);

  if (workspaces.length === 0) {
    return null; // User has no accessible workspaces
  }

  const workspace = workspaces[0];
  const membership = await prisma.orgMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId, userId } },
  });

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    orgId,
    userRole: membership.role,
  };
}

// ─── VALIDATE WORKSPACE ACCESS ─────────────────────────────────────────

/**
 * Check if user has access to a specific workspace.
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param workspaceId - Workspace to check
 * @returns true if user can access workspace
 */
export async function canAccessWorkspace(
  userId: string,
  orgId: string,
  workspaceId: string
): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });

  if (!membership) {
    return false;
  }

  // Owner/Admin can access all workspaces in org
  if (membership.role !== "MEMBER") {
    return true;
  }

  // Regular member must have workspace in their shopIds
  return (
    !membership.shopIds ||
    membership.shopIds.length === 0 ||
    membership.shopIds.includes(workspaceId)
  );
}

// ─── GET MEMBER WORKSPACES ────────────────────────────────────────────

/**
 * Get all workspaces a member has explicit access to.
 *
 * Only returns shopIds if member has restrictions.
 * For unrestricted members (OWNER, ADMIN, or MEMBER with no shopIds),
 * returns empty array (meaning all workspaces).
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @returns shopIds if restricted, empty array if unrestricted
 */
export async function getMemberWorkspaces(
  userId: string,
  orgId: string
): Promise<string[]> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });

  if (!membership) {
    return [];
  }

  return membership.shopIds || [];
}

// ─── UPDATE MEMBER WORKSPACE ACCESS ────────────────────────────────────

/**
 * Restrict a member's workspace access.
 *
 * Updates the shopIds array. Pass empty array for unrestricted access.
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param shopIds - Array of shop IDs user can access (empty = all)
 */
export async function updateMemberWorkspaceAccess(
  userId: string,
  orgId: string,
  shopIds: string[]
): Promise<void> {
  // Verify all shops exist in this org
  const shops = await prisma.shop.findMany({
    where: { id: { in: shopIds }, orgId },
  });

  if (shops.length !== shopIds.length) {
    throw new Error("Some shop IDs do not exist in this organization");
  }

  // Update membership
  await prisma.orgMember.update({
    where: { orgId_userId: { orgId, userId } },
    data: { shopIds },
  });
}
