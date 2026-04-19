/**
 * Onboarding Module — Export all public APIs
 */

// Services
export { OnboardingService, onboardingService } from "./onboarding-service.js";
export { WorkspaceProvisioner, workspaceProvisioner } from "./workspace-provisioner.js";
export { EmailVerificationService, emailVerificationService } from "./email-verification-service.js";
export { InvitationService, invitationService } from "./invitation-service.js";
export {
  TenantProvisioner,
  tenantProvisioner,
  TenantAlreadyExistsError,
} from "./tenant-provisioner.js";
export type {
  CreateTenantInput,
  CreateTenantResult,
} from "./tenant-provisioner.js";

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
} from "./types.js";

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
} from "./types.js";

// Tenant Isolation
export {
  TenantContext,
  createTenantContext,
  withTenantScope,
  validateTenantAccess,
  tenantMiddleware,
  requireTenantContext,
  checkTenantPermission,
} from "./tenant-isolation.js";

export type { TenantPermission } from "./tenant-isolation.js";

// API
export { createOnboardingRouter } from "./onboarding-api.js";
