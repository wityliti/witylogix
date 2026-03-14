/**
 * Onboarding Module — Export all public APIs
 */

// Services
export { OnboardingService, onboardingService } from "./onboarding-service";
export { WorkspaceProvisioner, workspaceProvisioner } from "./workspace-provisioner";
export { EmailVerificationService, emailVerificationService } from "./email-verification-service";
export { InvitationService, invitationService } from "./invitation-service";

// Types
export type {
  OnboardingState,
  StartOnboardingInput,
  StepProgressionInput,
  CompleteOnboardingInput,
  WorkspaceConfig,
  WorkspaceProvisionResult,
  IndustryDefaults,
  InvitationRequest,
  InvitationResponse,
  AcceptInvitationInput,
  AcceptInvitationResult,
  VerifyOTPInput,
  GenerateOTPResult,
  VerifyOTPResult,
  OnboardingEvent,
} from "./types";

export {
  OnboardingStep,
  EmailVerificationSubStep,
  BasicInfoSubStep,
  WorkspaceConfigSubStep,
  IntegrationSetupSubStep,
  TeamSetupSubStep,
  DeploymentType,
  Industry,
  Goal,
  DistanceUnit,
  WeightUnit,
  InvitationStatus,
  OnboardingEventType,
  OnboardingError,
  OnboardingErrorCodes,
} from "./types";

// Tenant Isolation
export {
  TenantContext,
  createTenantContext,
  withTenantScope,
  validateTenantAccess,
  tenantMiddleware,
  requireTenantContext,
  checkTenantPermission,
} from "./tenant-isolation";

export type { TenantPermission } from "./tenant-isolation";

// API
export { createOnboardingRouter } from "./onboarding-api";
