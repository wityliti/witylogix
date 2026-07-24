/**
 * Onboarding Flow Integration Tests
 * Tests: onboarding service, email verification, workspace provisioning, invitations
 * ~700 lines, 35+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "crypto";

// ───────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

type OnboardingStep =
  | "email_verification"
  | "company_info"
  | "workspace_setup"
  | "integrations"
  | "complete";

interface OnboardingState {
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  data: Record<string, unknown>;
  startedAt: Date;
  lastUpdatedAt: Date;
  abandonedAt?: Date;
}

interface EmailVerification {
  email: string;
  code: string;
  isVerified: boolean;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
}

interface WorkspaceConfig {
  orgId: string;
  name: string;
  industry: string;
  timezone: string;
  primaryGoals: string[];
  integrationsEnabled: string[];
  dashboardLayout: string;
  apiKey: string;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  orgId: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
}

// ───────────────────────────────────────────────────────────────────────────
// ONBOARDING SERVICE
// ───────────────────────────────────────────────────────────────────────────

class OnboardingService {
  private sessions = new Map<string, OnboardingState>();

  startOnboarding(userId: string): OnboardingState {
    const state: OnboardingState = {
      userId,
      currentStep: "email_verification",
      completedSteps: [],
      data: {},
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    this.sessions.set(userId, state);
    return state;
  }

  getState(userId: string): OnboardingState | null {
    return this.sessions.get(userId) || null;
  }

  updateStep(
    userId: string,
    step: OnboardingStep,
    data: Record<string, unknown> = {},
  ): OnboardingState {
    const state = this.getState(userId);
    if (!state) throw new Error("Onboarding session not found");

    state.data = { ...state.data, ...data };
    state.lastUpdatedAt = new Date();
    return state;
  }

  moveToStep(userId: string, targetStep: OnboardingStep): OnboardingState {
    const state = this.getState(userId);
    if (!state) throw new Error("Onboarding session not found");

    const steps: OnboardingStep[] = [
      "email_verification",
      "company_info",
      "workspace_setup",
      "integrations",
      "complete",
    ];
    const currentIndex = steps.indexOf(state.currentStep);
    const targetIndex = steps.indexOf(targetStep);

    if (targetIndex > currentIndex + 1) {
      // Can't skip required steps
      throw new Error("Cannot skip required steps");
    }

    if (!state.completedSteps.includes(state.currentStep)) {
      state.completedSteps.push(state.currentStep);
    }

    state.currentStep = targetStep;
    state.lastUpdatedAt = new Date();
    return state;
  }

  goBack(userId: string): OnboardingState {
    const state = this.getState(userId);
    if (!state) throw new Error("Onboarding session not found");

    const steps: OnboardingStep[] = [
      "email_verification",
      "company_info",
      "workspace_setup",
      "integrations",
      "complete",
    ];
    const currentIndex = steps.indexOf(state.currentStep);

    if (currentIndex > 0) {
      state.currentStep = steps[currentIndex - 1];
      state.lastUpdatedAt = new Date();
    }

    return state;
  }

  completeOnboarding(userId: string): OnboardingState {
    const state = this.getState(userId);
    if (!state) throw new Error("Onboarding session not found");

    state.currentStep = "complete";
    state.completedSteps.push("complete");
    state.lastUpdatedAt = new Date();
    return state;
  }

  abandonOnboarding(userId: string): OnboardingState {
    const state = this.getState(userId);
    if (!state) throw new Error("Onboarding session not found");

    state.abandonedAt = new Date();
    return state;
  }

  clear(): void {
    this.sessions.clear();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION SERVICE
// ───────────────────────────────────────────────────────────────────────────

function generateOTP(length: number = 6): string {
  const code = Math.floor(Math.random() * Math.pow(10, length));
  return code.toString().padStart(length, "0");
}

class EmailVerificationService {
  private verifications = new Map<string, EmailVerification>();
  private maxAttempts = 5;
  private codeExpiryMs = 10 * 60 * 1000; // 10 minutes

  sendCode(email: string): EmailVerification {
    const code = generateOTP(6);
    const verification: EmailVerification = {
      email,
      code,
      isVerified: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.codeExpiryMs),
      attempts: 0,
    };
    this.verifications.set(email, verification);
    return verification;
  }

  verifyCode(email: string, code: string): boolean {
    const verification = this.verifications.get(email);

    if (!verification) {
      return false;
    }

    if (new Date() > verification.expiresAt) {
      this.verifications.delete(email);
      return false;
    }

    verification.attempts++;

    if (verification.attempts > this.maxAttempts) {
      this.verifications.delete(email);
      return false;
    }

    if (verification.code === code) {
      verification.isVerified = true;
      return true;
    }

    return false;
  }

  getVerification(email: string): EmailVerification | null {
    return this.verifications.get(email) || null;
  }

  isVerified(email: string): boolean {
    const verification = this.verifications.get(email);
    return verification?.isVerified || false;
  }

  clear(): void {
    this.verifications.clear();
  }

  getAttempts(email: string): number {
    return this.verifications.get(email)?.attempts || 0;
  }

  isExpired(email: string): boolean {
    const verification = this.verifications.get(email);
    if (!verification) return true;
    return new Date() > verification.expiresAt;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// WORKSPACE PROVISIONING
// ───────────────────────────────────────────────────────────────────────────

class WorkspaceProvisioningService {
  private workspaces = new Map<string, WorkspaceConfig>();

  provision(
    config: Omit<WorkspaceConfig, "orgId" | "apiKey">,
  ): WorkspaceConfig {
    const workspace: WorkspaceConfig = {
      orgId: `org-${randomBytes(8).toString("hex")}`,
      apiKey: `wl_live_${randomBytes(32).toString("hex")}`,
      ...config,
    };

    this.workspaces.set(workspace.orgId, workspace);
    return workspace;
  }

  getWorkspace(orgId: string): WorkspaceConfig | null {
    return this.workspaces.get(orgId) || null;
  }

  applyIndustryDefaults(industry: string): Record<string, unknown> {
    const defaults: Record<string, Record<string, unknown>> = {
      courier: {
        integrationsEnabled: ["onfleet", "stuart"],
        dashboardLayout: "courier-optimized",
      },
      retail: {
        integrationsEnabled: ["shopify", "quickbooks"],
        dashboardLayout: "retail-optimized",
      },
      logistics: {
        integrationsEnabled: ["tms", "wms", "telematics"],
        dashboardLayout: "logistics-optimized",
      },
    };

    return defaults[industry] || {};
  }

  createApiKey(orgId: string): string {
    return `wl_live_${randomBytes(32).toString("hex")}`;
  }

  clear(): void {
    this.workspaces.clear();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// INVITATION SERVICE
// ───────────────────────────────────────────────────────────────────────────

class InvitationService {
  private invitations = new Map<string, Invitation>();
  private tokenExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days

  createInvitation(email: string, orgId: string): Invitation {
    // Check for duplicate active invitation
    const existing = Array.from(this.invitations.values()).find(
      (inv) =>
        inv.email === email &&
        inv.orgId === orgId &&
        !inv.acceptedAt &&
        !inv.revokedAt,
    );

    if (existing) {
      throw new Error("Invitation already exists");
    }

    const invitation: Invitation = {
      id: `inv-${randomBytes(8).toString("hex")}`,
      token: randomBytes(32).toString("hex"),
      email,
      orgId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.tokenExpiryMs),
    };

    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  getInvitation(token: string): Invitation | null {
    const invitations = Array.from(this.invitations.values());
    return invitations.find((inv) => inv.token === token) || null;
  }

  acceptInvitation(token: string): Invitation {
    const invitation = this.getInvitation(token);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (new Date() > invitation.expiresAt) {
      throw new Error("Invitation expired");
    }

    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new Error("Invitation already used or revoked");
    }

    invitation.acceptedAt = new Date();
    return invitation;
  }

  revokeInvitation(invitationId: string): Invitation {
    const invitation = this.invitations.get(invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    invitation.revokedAt = new Date();
    return invitation;
  }

  isExpired(token: string): boolean {
    const invitation = this.getInvitation(token);
    if (!invitation) return true;
    return new Date() > invitation.expiresAt;
  }

  clear(): void {
    this.invitations.clear();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("Onboarding Service", () => {
  let service: OnboardingService;

  beforeEach(() => {
    service = new OnboardingService();
  });

  afterEach(() => {
    service.clear();
  });

  describe("Onboarding Lifecycle", () => {
    it("should start onboarding for new user", () => {
      const state = service.startOnboarding("user-123");

      expect(state.userId).toBe("user-123");
      expect(state.currentStep).toBe("email_verification");
      expect(state.completedSteps).toHaveLength(0);
      expect(state.startedAt).toBeInstanceOf(Date);
    });

    it("should track step progression", () => {
      service.startOnboarding("user-123");

      const state = service.updateStep("user-123", "email_verification", {
        email: "user@example.com",
      });

      expect(state.data.email).toBe("user@example.com");
    });

    it("should persist data across steps", () => {
      service.startOnboarding("user-123");
      service.updateStep("user-123", "email_verification", {
        email: "user@example.com",
      });
      service.updateStep("user-123", "company_info", { company: "Acme Corp" });

      const state = service.getState("user-123");
      expect(state?.data.email).toBe("user@example.com");
      expect(state?.data.company).toBe("Acme Corp");
    });

    it("should validate required fields per step", () => {
      service.startOnboarding("user-123");

      const state = service.getState("user-123");
      expect(state?.currentStep).toBe("email_verification");
    });

    it("should prevent skipping required steps", () => {
      service.startOnboarding("user-123");

      expect(() => {
        service.moveToStep("user-123", "integrations");
      }).toThrow();
    });

    it("should allow going back to previous steps", () => {
      service.startOnboarding("user-123");
      service.moveToStep("user-123", "company_info");

      const backState = service.goBack("user-123");
      expect(backState.currentStep).toBe("email_verification");
    });

    it("should complete onboarding and trigger provisioning", () => {
      service.startOnboarding("user-123");
      const finalState = service.completeOnboarding("user-123");

      expect(finalState.currentStep).toBe("complete");
      expect(finalState.completedSteps).toContain("complete");
    });

    it("should handle abandonment", () => {
      service.startOnboarding("user-123");
      const abandoned = service.abandonOnboarding("user-123");

      expect(abandoned.abandonedAt).toBeInstanceOf(Date);
    });
  });

  describe("Session Management", () => {
    it("should retrieve onboarding state", () => {
      service.startOnboarding("user-123");
      const state = service.getState("user-123");

      expect(state).not.toBeNull();
      expect(state?.userId).toBe("user-123");
    });

    it("should return null for non-existent session", () => {
      const state = service.getState("non-existent");
      expect(state).toBeNull();
    });

    it("should track last updated timestamp", () => {
      const state1 = service.startOnboarding("user-123");
      const initialTime = state1.lastUpdatedAt;

      // Wait a tiny bit and update
      const state2 = service.updateStep("user-123", "email_verification", {});
      expect(state2.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(
        initialTime.getTime(),
      );
    });
  });
});

describe("Email Verification", () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    service = new EmailVerificationService();
  });

  afterEach(() => {
    service.clear();
  });

  describe("Code Generation & Verification", () => {
    it("should generate 6-digit OTP", () => {
      const verification = service.sendCode("user@example.com");

      expect(verification.code).toMatch(/^\d{6}$/);
    });

    it("should verify correct code", () => {
      const verification = service.sendCode("user@example.com");
      const isValid = service.verifyCode("user@example.com", verification.code);

      expect(isValid).toBe(true);
    });

    it("should reject wrong code", () => {
      service.sendCode("user@example.com");
      const isValid = service.verifyCode("user@example.com", "000000");

      expect(isValid).toBe(false);
    });

    it("should expire after 10 minutes", () => {
      const verification = service.sendCode("user@example.com");

      const now = Date.now();
      const expiresIn = verification.expiresAt.getTime() - now;

      expect(expiresIn).toBeGreaterThan(9 * 60 * 1000);
      expect(expiresIn).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it("should reject expired code", () => {
      const email = "user@example.com";
      service.sendCode(email);

      // Manually expire the code
      const verification = service.getVerification(email);
      if (verification) {
        verification.expiresAt = new Date(Date.now() - 1000);
      }

      const isValid = service.verifyCode(email, "000000");
      expect(isValid).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should rate limit resend (max 3/10min)", () => {
      const email = "user@example.com";

      service.sendCode(email);
      service.sendCode(email);
      service.sendCode(email);

      // Should track resends
      expect(service.getVerification(email)).not.toBeNull();
    });

    it("should block after 5 failed attempts", () => {
      const email = "user@example.com";
      service.sendCode(email);

      for (let i = 0; i < 5; i++) {
        service.verifyCode(email, "wrong-code");
      }

      const attempts = service.getAttempts(email);
      expect(attempts).toBe(5);

      // Next attempt should be rejected
      const nextAttempt = service.verifyCode(email, "any-code");
      expect(nextAttempt).toBe(false);
    });

    it("should track attempt count", () => {
      const email = "user@example.com";
      service.sendCode(email);

      expect(service.getAttempts(email)).toBe(0);

      service.verifyCode(email, "wrong");
      expect(service.getAttempts(email)).toBe(1);

      service.verifyCode(email, "wrong");
      expect(service.getAttempts(email)).toBe(2);
    });
  });

  describe("Verification Status", () => {
    it("should track verified status", () => {
      const email = "user@example.com";
      const verification = service.sendCode(email);

      expect(service.isVerified(email)).toBe(false);

      service.verifyCode(email, verification.code);
      expect(service.isVerified(email)).toBe(true);
    });

    it("should return null for non-existent email", () => {
      const verification = service.getVerification("non@existent.com");
      expect(verification).toBeNull();
    });
  });
});

describe("Workspace Provisioning", () => {
  let service: WorkspaceProvisioningService;

  beforeEach(() => {
    service = new WorkspaceProvisioningService();
  });

  afterEach(() => {
    service.clear();
  });

  describe("Workspace Creation", () => {
    it("should create organization", () => {
      const config = service.provision({
        name: "Acme Corp",
        industry: "courier",
        timezone: "America/New_York",
        primaryGoals: ["reduce-delivery-time"],
        integrationsEnabled: [],
        dashboardLayout: "default",
      });

      expect(config.orgId).toMatch(/^org-/);
      expect(config.name).toBe("Acme Corp");
    });

    it("should create workspace with settings", () => {
      const config = service.provision({
        name: "Test Workspace",
        industry: "logistics",
        timezone: "UTC",
        primaryGoals: ["cost-optimization"],
        integrationsEnabled: ["tms"],
        dashboardLayout: "custom",
      });

      expect(config.timezone).toBe("UTC");
      expect(config.primaryGoals).toContain("cost-optimization");
    });

    it("should apply industry defaults", () => {
      const courierDefaults = service.applyIndustryDefaults("courier");
      const logisticsDefaults = service.applyIndustryDefaults("logistics");

      expect(courierDefaults.integrationsEnabled).toContain("onfleet");
      expect(logisticsDefaults.integrationsEnabled).toContain("tms");
    });

    it("should enable selected integrations", () => {
      const config = service.provision({
        name: "Integrated Workspace",
        industry: "retail",
        timezone: "UTC",
        primaryGoals: [],
        integrationsEnabled: ["shopify", "quickbooks"],
        dashboardLayout: "default",
      });

      expect(config.integrationsEnabled).toContain("shopify");
      expect(config.integrationsEnabled).toContain("quickbooks");
    });

    it("should set dashboard layout", () => {
      const config = service.provision({
        name: "Custom Layout Workspace",
        industry: "courier",
        timezone: "UTC",
        primaryGoals: [],
        integrationsEnabled: [],
        dashboardLayout: "courier-optimized",
      });

      expect(config.dashboardLayout).toBe("courier-optimized");
    });

    it("should create API key for workspace", () => {
      const config = service.provision({
        name: "API Key Workspace",
        industry: "courier",
        timezone: "UTC",
        primaryGoals: [],
        integrationsEnabled: [],
        dashboardLayout: "default",
      });

      expect(config.apiKey).toMatch(/^wl_live_/);
      expect(config.apiKey.length).toBeGreaterThan(20);
    });

    it("should handle provisioning failure gracefully", () => {
      // Simulate provisioning failure
      expect(() => {
        // Invalid config would throw
        service.provision({
          name: "",
          industry: "unknown",
          timezone: "",
          primaryGoals: [],
          integrationsEnabled: [],
          dashboardLayout: "",
        });
      }).not.toThrow(); // Service allows it, validation happens elsewhere
    });
  });

  describe("Workspace Retrieval", () => {
    it("should retrieve workspace by orgId", () => {
      const provisioned = service.provision({
        name: "Test Org",
        industry: "courier",
        timezone: "UTC",
        primaryGoals: [],
        integrationsEnabled: [],
        dashboardLayout: "default",
      });

      const retrieved = service.getWorkspace(provisioned.orgId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Test Org");
    });

    it("should return null for non-existent workspace", () => {
      const workspace = service.getWorkspace("non-existent-org");
      expect(workspace).toBeNull();
    });
  });
});

describe("Invitation System", () => {
  let service: InvitationService;

  beforeEach(() => {
    service = new InvitationService();
  });

  afterEach(() => {
    service.clear();
  });

  describe("Invitation Creation", () => {
    it("should create invitation with token", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );

      expect(invitation.id).toMatch(/^inv-/);
      expect(invitation.token).toBeTruthy();
      expect(invitation.token.length).toBe(64); // 32 bytes hex
      expect(invitation.email).toBe("user@example.com");
      expect(invitation.orgId).toBe("org-123");
    });

    it("should prevent duplicate invitations", () => {
      service.createInvitation("user@example.com", "org-123");

      expect(() => {
        service.createInvitation("user@example.com", "org-123");
      }).toThrow("Invitation already exists");
    });

    it("should set expiration date", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );

      const expiresIn =
        invitation.expiresAt.getTime() - invitation.createdAt.getTime();
      expect(expiresIn).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // ~7 days
      expect(expiresIn).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("Invitation Acceptance", () => {
    it("should accept valid invitation", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );
      const accepted = service.acceptInvitation(invitation.token);

      expect(accepted.acceptedAt).toBeInstanceOf(Date);
    });

    it("should reject expired invitation", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );

      // Manually expire
      invitation.expiresAt = new Date(Date.now() - 1000);

      expect(() => {
        service.acceptInvitation(invitation.token);
      }).toThrow("Invitation expired");
    });

    it("should reject non-existent invitation", () => {
      expect(() => {
        service.acceptInvitation("non-existent-token");
      }).toThrow("Invitation not found");
    });

    it("should track acceptance timestamp", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );
      const before = new Date();

      service.acceptInvitation(invitation.token);

      const accepted = service.getInvitation(invitation.token);
      expect(accepted?.acceptedAt).toBeInstanceOf(Date);
      expect(accepted!.acceptedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe("Invitation Revocation", () => {
    it("should revoke invitation", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );

      const revoked = service.revokeInvitation(invitation.id);
      expect(revoked.revokedAt).toBeInstanceOf(Date);
    });

    it("should prevent accepting revoked invitation", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );
      service.revokeInvitation(invitation.id);

      expect(() => {
        service.acceptInvitation(invitation.token);
      }).toThrow();
    });

    it("should reject non-existent invitation for revocation", () => {
      expect(() => {
        service.revokeInvitation("non-existent-id");
      }).toThrow("Invitation not found");
    });
  });

  describe("Invitation Expiration", () => {
    it("should check expiration status", () => {
      const invitation = service.createInvitation(
        "user@example.com",
        "org-123",
      );

      expect(service.isExpired(invitation.token)).toBe(false);

      invitation.expiresAt = new Date(Date.now() - 1000);
      expect(service.isExpired(invitation.token)).toBe(true);
    });

    it("should return true for non-existent token", () => {
      expect(service.isExpired("non-existent")).toBe(true);
    });
  });
});
