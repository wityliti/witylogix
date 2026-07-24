/**
 * Consent Manager
 * Manages user consent records per GDPR Article 7
 * Tracks consent grants, revocations, and maintains audit trail
 */

import { ConsentRecord } from "./types";

/**
 * Consent Manager
 * Handles recording, tracking, and validation of user consent
 */
export class ConsentManager {
  private consents = new Map<string, ConsentRecord[]>();

  /**
   * Record consent for a specific purpose
   * Creates a new consent record with timestamp and versioning
   *
   * @param userId - The user ID granting consent
   * @param purpose - Purpose of the consent (e.g., 'marketing', 'analytics')
   * @param granted - Whether consent is granted
   * @param source - Source of the consent record
   * @param metadata - Additional metadata (IP address, user agent, etc.)
   * @returns Created ConsentRecord
   */
  recordConsent(
    userId: string,
    purpose: string,
    granted: boolean,
    source: string,
    metadata?: Partial<ConsentRecord>,
  ): ConsentRecord {
    if (!userId || !purpose) {
      throw new Error("userId and purpose are required");
    }

    const consentRecord: ConsentRecord = {
      id: `consent_${userId}_${purpose}_${Date.now()}`,
      userId,
      purpose,
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: !granted ? new Date() : undefined,
      source,
      version: this.getNextConsentVersion(userId, purpose),
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadata: metadata?.metadata,
    };

    if (!this.consents.has(userId)) {
      this.consents.set(userId, []);
    }

    this.consents.get(userId)!.push(consentRecord);
    return consentRecord;
  }

  /**
   * Revoke consent for a specific purpose
   *
   * @param userId - User ID revoking consent
   * @param purpose - Purpose to revoke consent for
   * @param reason - Optional reason for revocation
   * @returns Updated ConsentRecord or null if not found
   */
  revokeConsent(
    userId: string,
    purpose: string,
    reason?: string,
  ): ConsentRecord | null {
    const userConsents = this.consents.get(userId);
    if (!userConsents) {
      return null;
    }

    // Find most recent consent for this purpose
    const consentIndex = userConsents.findIndex(
      (c) => c.purpose === purpose && !c.revokedAt,
    );

    if (consentIndex === -1) {
      return null;
    }

    const consent = userConsents[consentIndex];
    consent.revokedAt = new Date();

    if (reason) {
      consent.metadata = { ...consent.metadata, revocationReason: reason };
    }

    return consent;
  }

  /**
   * Get current consent status for a user
   * Returns active and revoked consents
   *
   * @param userId - User ID to get consents for
   * @returns Object with active and revoked consents
   */
  getConsentStatus(userId: string): {
    active: Record<string, boolean>;
    revoked: Record<string, Date>;
  } {
    const userConsents = this.consents.get(userId) || [];
    const active: Record<string, boolean> = {};
    const revoked: Record<string, Date> = {};

    // Group by purpose and get most recent record
    const byPurpose = new Map<string, ConsentRecord[]>();
    for (const consent of userConsents) {
      if (!byPurpose.has(consent.purpose)) {
        byPurpose.set(consent.purpose, []);
      }
      byPurpose.get(consent.purpose)!.push(consent);
    }

    for (const [purpose, consentRecords] of byPurpose.entries()) {
      // Sort by ID (which includes timestamp) and take most recent
      const mostRecent = consentRecords.sort((a, b) =>
        b.id.localeCompare(a.id),
      )[0];
      if (mostRecent.revokedAt) {
        revoked[purpose] = mostRecent.revokedAt;
      } else if (mostRecent.granted) {
        active[purpose] = true;
      }
    }

    return { active, revoked };
  }

  /**
   * Validate that valid consent exists for a purpose
   * Checks if user has granted and not revoked consent
   *
   * @param userId - User ID to validate
   * @param purpose - Purpose to validate consent for
   * @returns true if valid consent exists, false otherwise
   */
  validateConsent(userId: string, purpose: string): boolean {
    const status = this.getConsentStatus(userId);
    return status.active[purpose] === true && !status.revoked[purpose];
  }

  /**
   * Get complete consent history for a user
   * Provides full audit trail of all consent changes
   *
   * @param userId - User ID to get history for
   * @returns Array of all consent records in chronological order
   */
  getConsentHistory(userId: string): ConsentRecord[] {
    const userConsents = this.consents.get(userId) || [];
    // Sort by ID to maintain chronological order
    return [...userConsents].sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Export consent records for data subject access requests
   * Returns all consent records for a user
   *
   * @param userId - User ID to export consents for
   * @returns Array of ConsentRecords suitable for export
   */
  exportConsentRecords(userId: string): ConsentRecord[] {
    return this.getConsentHistory(userId);
  }

  /**
   * Get consent summary for a user
   * @param userId - User ID
   * @returns Summary object with consent counts and status
   */
  getConsentSummary(userId: string): {
    totalConsents: number;
    activeConsents: number;
    revokedConsents: number;
    purposes: string[];
  } {
    const history = this.getConsentHistory(userId);
    const status = this.getConsentStatus(userId);

    const purposes = Array.from(new Set(history.map((c) => c.purpose)));

    return {
      totalConsents: history.length,
      activeConsents: Object.keys(status.active).length,
      revokedConsents: Object.keys(status.revoked).length,
      purposes,
    };
  }

  /**
   * Get next version number for a purpose
   * @private
   */
  private getNextConsentVersion(userId: string, purpose: string): number {
    const userConsents = this.consents.get(userId) || [];
    const purposeConsents = userConsents.filter((c) => c.purpose === purpose);
    return purposeConsents.length + 1;
  }

  /**
   * Bulk check consent for multiple purposes
   * @param userId - User ID
   * @param purposes - Array of purposes to check
   * @returns Object mapping purpose to consent status
   */
  validateMultipleConsents(
    userId: string,
    purposes: string[],
  ): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const purpose of purposes) {
      result[purpose] = this.validateConsent(userId, purpose);
    }
    return result;
  }

  /**
   * Clear all consent records (for testing only)
   * @internal
   */
  clearAllConsents(): void {
    this.consents.clear();
  }

  /**
   * Get users with consent for a specific purpose
   * Useful for targeted communications based on consent
   *
   * @param purpose - Purpose to find users for
   * @returns Array of user IDs with active consent for purpose
   */
  getUsersWithConsent(purpose: string): string[] {
    const users: string[] = [];

    for (const [userId] of this.consents.entries()) {
      if (this.validateConsent(userId, purpose)) {
        users.push(userId);
      }
    }

    return users;
  }
}
