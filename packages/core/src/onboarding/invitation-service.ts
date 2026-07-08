/**
 * Invitation Service — Manages team member invitations during onboarding.
 *
 * This service handles:
 * - Creating invitations with URL-safe tokens
 * - Accepting invitations and creating OrgMember records
 * - Revoking invitations
 * - Listing invitations with status
 * - Cleaning up expired invitations
 * - Sending invitation emails
 */

import crypto from "crypto";
import { db, prisma } from "@witylogix/db";
import {
  InvitationRequest,
  InvitationResponse,
  InvitationStatus,
  AcceptInvitationInput,
  AcceptInvitationResult,
  OnboardingError,
  OnboardingErrorCodes,
} from "./types";

/**
 * InvitationService manages team member invitations.
 */
export class InvitationService {
  // Configuration
  private readonly INVITATION_EXPIRY_DAYS = 7;
  private readonly TOKEN_LENGTH = 32; // bytes

  /**
   * Creates an invitation for a team member.
   *
   * Generates a unique token, stores the invitation, and sends email
   * (email sending delegated to external service).
   *
   * @param input - Invitation request data
   * @returns Invitation response with details
   * @throws OnboardingError if organization not found or email already invited
   */
  async createInvitation(
    input: InvitationRequest,
  ): Promise<InvitationResponse> {
    const { orgId, email, role, invitedBy } = input;

    // Validate organization exists
    const org = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `Organization ${orgId} not found`,
        404,
      );
    }

    // Check for existing invitation
    const existing = await db.invitation.findUnique({
      where: { orgId_email: { orgId, email } },
    });

    if (existing && existing.status === InvitationStatus.PENDING) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `Pending invitation already exists for ${email}`,
        409,
      );
    }

    // Check if user already exists in org
    const existingMember = await db.orgMember.findMany({
      where: {
        orgId,
        user: { email },
      },
    });

    if (existingMember.length > 0) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `User ${email} is already a member of this organization`,
        409,
      );
    }

    // Generate token
    const token = this.generateToken();

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.INVITATION_EXPIRY_DAYS);

    // Create invitation
    const invitation = await db.invitation.create({
      data: {
        orgId,
        email,
        role,
        invitedBy,
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    // TODO: Send invitation email with link
    // await emailService.sendInvitationEmail({
    //   to: email,
    //   invitationLink: this.buildInvitationLink(token),
    //   organizationName: org.name,
    //   role,
    // });

    return this.mapToResponse(invitation);
  }

  /**
   * Accepts an invitation and creates an OrgMember record.
   *
   * @param input - Accept invitation input with token
   * @returns Result with organization and role details
   * @throws OnboardingError if token invalid or expired
   */
  async acceptInvitation(
    input: AcceptInvitationInput,
  ): Promise<AcceptInvitationResult> {
    const { token, userId } = input;

    // Find invitation by token
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_INVITATION_TOKEN,
        "Invalid invitation link",
        400,
      );
    }

    // Check status
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_INVITATION_TOKEN,
        `Invitation has already been ${invitation.status.toLowerCase()}`,
        400,
      );
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.EXPIRED,
          updatedAt: new Date(),
        },
      });

      throw new OnboardingError(
        OnboardingErrorCodes.INVITATION_EXPIRED,
        "Invitation has expired. Request a new one.",
        400,
      );
    }

    // Create or update OrgMember
    let orgMember = await db.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: invitation.orgId,
          userId,
        },
      },
    });

    if (orgMember) {
      // Update existing member's role if needed
      orgMember = await db.orgMember.update({
        where: { id: orgMember.id },
        data: {
          role: invitation.role,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new member
      orgMember = await db.orgMember.create({
        data: {
          orgId: invitation.orgId,
          userId,
          role: invitation.role,
          isActive: true,
        },
      });
    }

    // Mark invitation as accepted
    const now = new Date();
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: now,
        acceptedBy: userId,
        updatedAt: now,
      },
    });

    return {
      orgId: invitation.orgId,
      orgName: invitation.organization.name,
      userRole: orgMember.role,
      acceptedAt: now,
      redirectUrl: this.buildRedirectUrl(invitation.organization.slug),
    };
  }

  /**
   * Revokes an invitation, making it unusable.
   *
   * @param invitationId - Invitation to revoke
   * @returns Updated invitation
   * @throws OnboardingError if invitation not found
   */
  async revokeInvitation(invitationId: string): Promise<InvitationResponse> {
    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVITATION_NOT_FOUND,
        `Invitation ${invitationId} not found`,
        404,
      );
    }

    const updated = await db.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Lists all invitations for an organization with their statuses.
   *
   * @param orgId - Organization ID
   * @param status - Optional filter by status
   * @returns Array of invitations
   */
  async listInvitations(
    orgId: string,
    status?: InvitationStatus,
  ): Promise<InvitationResponse[]> {
    const invitations = await db.invitation.findMany({
      where: {
        orgId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((inv: any) => this.mapToResponse(inv));
  }

  /**
   * Gets a single invitation by ID.
   *
   * @param invitationId - Invitation ID
   * @returns Invitation response
   * @throws OnboardingError if not found
   */
  async getInvitation(invitationId: string): Promise<InvitationResponse> {
    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVITATION_NOT_FOUND,
        `Invitation ${invitationId} not found`,
        404,
      );
    }

    return this.mapToResponse(invitation);
  }

  /**
   * Batch cleanup of expired invitations.
   * Should be run periodically (e.g., daily cron).
   *
   * @returns Count of expired invitations marked
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const result = await db.invitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: InvitationStatus.EXPIRED,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Batch delete of fully processed invitations (expired/revoked).
   * Can be run less frequently for archival cleanup.
   *
   * @param olderThanDays - Delete records processed more than N days ago
   * @returns Count of deleted records
   */
  async archiveProcessedInvitations(
    olderThanDays: number = 90,
  ): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await db.invitation.deleteMany({
      where: {
        status: { in: [InvitationStatus.EXPIRED, InvitationStatus.REVOKED] },
        updatedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Generates a cryptographically secure token.
   *
   * @returns URL-safe base64 token
   */
  private generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString("base64url");
  }

  /**
   * Maps a database record to InvitationResponse interface.
   */
  private mapToResponse(record: any): InvitationResponse {
    return {
      id: record.id,
      orgId: record.orgId,
      email: record.email,
      role: record.role,
      status: record.status,
      invitedAt: record.createdAt,
      expiresAt: record.expiresAt,
      acceptedAt: record.acceptedAt,
      revokedAt: record.revokedAt,
    };
  }

  /**
   * Builds the invitation acceptance link.
   *
   * @param token - Invitation token
   * @returns Full invitation URL
   */
  private buildInvitationLink(token: string): string {
    const baseUrl = process.env.APP_BASE_URL || "https://app.witylogix.com";
    return `${baseUrl}/invitations/${token}/accept`;
  }

  /**
   * Builds the redirect URL after accepting an invitation.
   *
   * @param orgSlug - Organization slug
   * @returns Redirect URL
   */
  private buildRedirectUrl(orgSlug: string): string {
    const baseUrl = process.env.APP_BASE_URL || "https://app.witylogix.com";
    return `${baseUrl}/orgs/${orgSlug}/dashboard`;
  }

  /**
   * Gets invitation statistics (for monitoring).
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    totalInvitations: number;
    pendingInvitations: number;
    acceptedInvitations: number;
    expiredInvitations: number;
    revokedInvitations: number;
  }> {
    const [total, pending, accepted, expired, revoked] = await Promise.all([
      db.invitation.count(),
      db.invitation.count({ where: { status: InvitationStatus.PENDING } }),
      db.invitation.count({
        where: { status: InvitationStatus.ACCEPTED },
      }),
      db.invitation.count({
        where: { status: InvitationStatus.EXPIRED },
      }),
      db.invitation.count({
        where: { status: InvitationStatus.REVOKED },
      }),
    ]);

    return {
      totalInvitations: total,
      pendingInvitations: pending,
      acceptedInvitations: accepted,
      expiredInvitations: expired,
      revokedInvitations: revoked,
    };
  }
}

// Export singleton instance
export const invitationService = new InvitationService();
