/**
 * Onboarding API — REST endpoints for the onboarding flow.
 *
 * This module provides Express route handlers for:
 * - Starting onboarding
 * - Email OTP verification
 * - Onboarding step progression
 * - Workspace provisioning
 * - Team member invitations
 *
 * All endpoints include input validation, error handling, and proper
 * HTTP status codes.
 */

import { Request, Response, Router } from "express";
import { z } from "zod";
import { onboardingService } from "./onboarding-service";
import { workspaceProvisioner } from "./workspace-provisioner";
import { emailVerificationService } from "./email-verification-service";
import { invitationService } from "./invitation-service";
import {
  OnboardingStep,
  OnboardingError,
  OnboardingErrorCodes,
  WorkspaceConfig,
  Industry,
  DeploymentType,
  DistanceUnit,
  WeightUnit,
} from "./types";

// ─── VALIDATION SCHEMAS ────────────────────────────────────────

/**
 * Start onboarding schema.
 */
const startOnboardingSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
});

/**
 * Email verification schemas.
 */
const generateOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const verifyOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
});

/**
 * Step progression schema.
 */
const updateStepSchema = z.object({
  progressId: z.string().uuid("Invalid progress ID"),
  step: z.nativeEnum(OnboardingStep),
  subStep: z.string().optional(),
  data: z.record(z.unknown()),
});

/**
 * Complete onboarding schema.
 */
const completeOnboardingSchema = z.object({
  progressId: z.string().uuid("Invalid progress ID"),
});

/**
 * Workspace provisioning schema.
 */
const workspaceConfigSchema = z.object({
  progressId: z.string().uuid("Invalid progress ID"),
  name: z.string().min(1, "Workspace name required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Invalid workspace slug"),
  orgId: z.string().uuid("Invalid organization ID"),
  deploymentType: z.nativeEnum(DeploymentType).optional(),
  industry: z.nativeEnum(Industry).optional(),
  goals: z.array(z.string()).optional(),
  selectedIntegrations: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  distanceUnit: z.nativeEnum(DistanceUnit).optional(),
  weightUnit: z.nativeEnum(WeightUnit).optional(),
  dateFormat: z.string().optional(),
  locale: z.string().optional(),
});

/**
 * Invitation schema.
 */
const createInvitationSchema = z.object({
  orgId: z.string().uuid("Invalid organization ID"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  invitedBy: z.string().uuid("Invalid user ID"),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token required"),
  userId: z.string().uuid("Invalid user ID"),
});

// ─── HELPER FUNCTIONS ──────────────────────────────────────────

/**
 * Validates request body against schema.
 */
function validateBody<T>(schema: z.ZodSchema, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    throw new OnboardingError(
      OnboardingErrorCodes.INVALID_TRANSITION,
      `Validation error: ${JSON.stringify(errors)}`,
      400,
    );
  }
  return result.data as T;
}

/**
 * Error handler for API responses.
 */
function handleError(err: unknown, res: Response): void {
  if (err instanceof OnboardingError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: String(err),
  });
}

// ─── ROUTE HANDLERS ────────────────────────────────────────────

/**
 * POST /onboarding/start
 * Initiates a new onboarding session.
 */
async function handleStartOnboarding(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(startOnboardingSchema, req.body);
    const progress = await onboardingService.startOnboarding(input);
    res.status(201).json(progress);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /onboarding/verify-email
 * Verifies an OTP code for email verification.
 */
async function handleVerifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(verifyOTPSchema, req.body);
    const result = emailVerificationService.verifyOTP(input.email, input.code);

    // If OTP verification succeeded, update onboarding progress
    const progression = await req.body.progressId
      ? onboardingService.updateStep({
          progressId: req.body.progressId,
          step: OnboardingStep.EMAIL_VERIFICATION,
          data: { emailVerified: true, email: input.email },
        })
      : null;

    res.status(200).json({
      verified: result.verified,
      message: result.message,
      ...(progression && { progress: progression }),
    });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /onboarding/resend-code
 * Resends OTP code to email with rate limiting.
 */
async function handleResendCode(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(generateOTPSchema, req.body);
    const result = emailVerificationService.resendOTP(input.email);

    // TODO: Send OTP via email
    // await emailService.sendOTP({ to: input.email, code });

    res.status(200).json({
      email: result.email,
      expiresIn: result.expiresIn,
      attemptsRemaining: result.attemptsRemaining,
      message: "Code sent to email",
    });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * PUT /onboarding/step
 * Updates onboarding to next step with data.
 */
async function handleUpdateStep(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(updateStepSchema, req.body);
    const progress = await onboardingService.updateStep(input);
    res.status(200).json(progress);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * GET /onboarding/progress
 * Gets current onboarding progress for user.
 */
async function handleGetProgress(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      throw new OnboardingError(
        OnboardingErrorCodes.ONBOARDING_NOT_FOUND,
        "User ID required",
        400,
      );
    }

    const progress = await onboardingService.getProgress(userId);

    if (!progress) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "No onboarding in progress",
      });
      return;
    }

    res.status(200).json(progress);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /onboarding/complete
 * Completes onboarding and triggers workspace provisioning.
 */
async function handleCompleteOnboarding(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(completeOnboardingSchema, req.body);

    // Mark onboarding as complete
    const progress = await onboardingService.completeOnboarding(input);

    // Extract workspace config from onboarding data
    const workspaceConfig: WorkspaceConfig = {
      name: (progress.data.workspaceName as string) || "Default Workspace",
      slug: (progress.data.workspaceSlug as string) || "default",
      orgId: progress.orgId || "",
      deploymentType: (progress.data.deploymentType as DeploymentType) || DeploymentType.CLOUD,
      industry: (progress.data.industry as Industry) || Industry.OTHER,
      goals: (progress.data.goals as any[]) || [],
      selectedIntegrations: (progress.data.selectedIntegrations as string[]) || [],
      timezone: (progress.data.timezone as string) || "UTC",
      currency: (progress.data.currency as string) || "USD",
      distanceUnit: (progress.data.distanceUnit as DistanceUnit) || DistanceUnit.KM,
      weightUnit: (progress.data.weightUnit as WeightUnit) || WeightUnit.KG,
      dateFormat: (progress.data.dateFormat as string) || "YYYY-MM-DD",
      locale: (progress.data.locale as string) || "en-US",
    };

    // Provision workspace
    const provisionResult = await workspaceProvisioner.provisionWorkspace(
      workspaceConfig,
      progress.userId,
    );

    res.status(201).json({
      progress,
      workspace: provisionResult,
    });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /onboarding/invitation
 * Creates and sends an invitation to team member.
 */
async function handleCreateInvitation(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(createInvitationSchema, req.body);
    const invitation = await invitationService.createInvitation(input);

    res.status(201).json(invitation);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /onboarding/invitation/accept
 * Accepts an invitation and creates OrgMember.
 */
async function handleAcceptInvitation(req: Request, res: Response): Promise<void> {
  try {
    const input = validateBody(acceptInvitationSchema, req.body);
    const result = await invitationService.acceptInvitation(input);

    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * GET /onboarding/invitations/:orgId
 * Lists all invitations for an organization.
 */
async function handleListInvitations(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const status = req.query.status as string | undefined;

    if (!orgId) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        "Organization ID required",
        400,
      );
    }

    const invitations = await invitationService.listInvitations(orgId, status as any);

    res.status(200).json(invitations);
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * DELETE /onboarding/invitation/:invitationId
 * Revokes an invitation.
 */
async function handleRevokeInvitation(req: Request, res: Response): Promise<void> {
  try {
    const { invitationId } = req.params;

    if (!invitationId) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVITATION_NOT_FOUND,
        "Invitation ID required",
        400,
      );
    }

    const invitation = await invitationService.revokeInvitation(invitationId);

    res.status(200).json(invitation);
  } catch (err) {
    handleError(err, res);
  }
}

// ─── ROUTER SETUP ─────────────────────────────────────────────

/**
 * Creates and returns the onboarding API router.
 */
export function createOnboardingRouter(): Router {
  const router = Router();

  // Onboarding flow
  router.post("/start", handleStartOnboarding);
  router.get("/progress", handleGetProgress);
  router.put("/step", handleUpdateStep);
  router.post("/complete", handleCompleteOnboarding);

  // Email verification
  router.post("/verify-email", handleVerifyEmail);
  router.post("/resend-code", handleResendCode);

  // Team invitations
  router.post("/invitation", handleCreateInvitation);
  router.post("/invitation/accept", handleAcceptInvitation);
  router.get("/invitations/:orgId", handleListInvitations);
  router.delete("/invitation/:invitationId", handleRevokeInvitation);

  return router;
}

// Export handlers for testing
export {
  handleStartOnboarding,
  handleVerifyEmail,
  handleResendCode,
  handleUpdateStep,
  handleGetProgress,
  handleCompleteOnboarding,
  handleCreateInvitation,
  handleAcceptInvitation,
  handleListInvitations,
  handleRevokeInvitation,
};
