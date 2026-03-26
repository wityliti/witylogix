/**
 * Onboarding Types — Enums, interfaces, and types for the onboarding flow.
 *
 * This module defines the contract for:
 * - Onboarding steps and sub-steps progression
 * - Onboarding state and data models
 * - Workspace configuration and provisioning
 * - Invitation management
 * - Deployment and regional settings
 */

// ─── ONBOARDING STEPS ──────────────────────────────────────────

/**
 * Main onboarding steps that users progress through.
 * Step order matters — users must complete steps sequentially.
 */
export enum OnboardingStep {
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  BASIC_INFO = "BASIC_INFO",
  WORKSPACE_CONFIG = "WORKSPACE_CONFIG",
  INTEGRATION_SETUP = "INTEGRATION_SETUP",
  TEAM_SETUP = "TEAM_SETUP",
  COMPLETION = "COMPLETION",
}

/**
 * Sub-steps for EMAIL_VERIFICATION. Email verification can be
 * split into OTP generation and OTP verification.
 */
export enum EmailVerificationSubStep {
  OTP_SENT = "OTP_SENT",
  OTP_VERIFIED = "OTP_VERIFIED",
}

/**
 * Sub-steps for BASIC_INFO. Collecting organization details.
 */
export enum BasicInfoSubStep {
  ORG_DETAILS = "ORG_DETAILS",
  USER_PROFILE = "USER_PROFILE",
}

/**
 * Sub-steps for WORKSPACE_CONFIG. Workspace setup and settings.
 */
export enum WorkspaceConfigSubStep {
  INDUSTRY_SELECTION = "INDUSTRY_SELECTION",
  GOALS_SELECTION = "GOALS_SELECTION",
  SETTINGS_CONFIG = "SETTINGS_CONFIG",
}

/**
 * Sub-steps for INTEGRATION_SETUP. Integration marketplace navigation.
 */
export enum IntegrationSetupSubStep {
  BROWSE_INTEGRATIONS = "BROWSE_INTEGRATIONS",
  CONFIGURE_INTEGRATION = "CONFIGURE_INTEGRATION",
}

/**
 * Sub-steps for TEAM_SETUP. Adding team members.
 */
export enum TeamSetupSubStep {
  INVITE_TEAM = "INVITE_TEAM",
  REVIEW_TEAM = "REVIEW_TEAM",
}

/**
 * Combined union type for all sub-steps.
 */
export type OnboardingSubStep =
  | EmailVerificationSubStep
  | BasicInfoSubStep
  | WorkspaceConfigSubStep
  | IntegrationSetupSubStep
  | TeamSetupSubStep;

// ─── ONBOARDING STATE ─────────────────────────────────────────

/**
 * Onboarding state interface — represents the complete onboarding
 * progress record retrieved from database.
 */
export interface OnboardingState {
  id: string;
  userId: string;
  orgId: string | null;
  currentStep: OnboardingStep;
  currentSubStep: string | null;
  completedSteps: string[];
  data: Record<string, unknown>; // Form data, configurations, etc.
  startedAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input to start onboarding — minimal user info to initialize.
 */
export interface StartOnboardingInput {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Step progression request — user is advancing to next step with data.
 */
export interface StepProgressionInput {
  progressId: string;
  step: OnboardingStep;
  subStep?: string;
  data: Record<string, unknown>; // Step-specific form data
}

/**
 * Completion request — triggers workspace provisioning.
 */
export interface CompleteOnboardingInput {
  progressId: string;
}

// ─── WORKSPACE CONFIGURATION ──────────────────────────────────

/**
 * Deployment type for the workspace.
 */
export enum DeploymentType {
  CLOUD = "CLOUD",
  SELF_MANAGED = "SELF_MANAGED",
}

/**
 * Industry classification for default settings mapping.
 */
export enum Industry {
  LOGISTICS = "LOGISTICS",
  RETAIL = "RETAIL",
  ECOMMERCE = "ECOMMERCE",
  FOOD_DELIVERY = "FOOD_DELIVERY",
  HEALTHCARE = "HEALTHCARE",
  MANUFACTURING = "MANUFACTURING",
  OTHER = "OTHER",
}

/**
 * Business goals selected during onboarding.
 */
export enum Goal {
  OPTIMIZE_ROUTES = "OPTIMIZE_ROUTES",
  REDUCE_DELIVERY_COST = "REDUCE_DELIVERY_COST",
  IMPROVE_CUSTOMER_SATISFACTION = "IMPROVE_CUSTOMER_SATISFACTION",
  INCREASE_DELIVERY_SPEED = "INCREASE_DELIVERY_SPEED",
  REAL_TIME_TRACKING = "REAL_TIME_TRACKING",
  TEAM_COLLABORATION = "TEAM_COLLABORATION",
}

/**
 * Distance unit preference.
 */
export enum DistanceUnit {
  KM = "KM",
  MILES = "MILES",
}

/**
 * Weight unit preference.
 */
export enum WeightUnit {
  KG = "KG",
  LBS = "LBS",
}

/**
 * Complete workspace configuration collected during onboarding.
 */
export interface WorkspaceConfig {
  // Basic info
  name: string;
  slug: string;
  orgId: string;
  deploymentType: DeploymentType;

  // Industry and goals
  industry: Industry;
  goals: Goal[];

  // Integrations
  selectedIntegrations: string[]; // Integration app slugs

  // Regional settings
  timezone: string; // e.g., "America/New_York"
  currency: string; // ISO 4217, e.g., "USD"
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
  dateFormat: string; // e.g., "YYYY-MM-DD"
  locale: string; // BCP 47, e.g., "en-US"

  // Optional dashboard layout
  dashboardLayout?: Record<string, unknown>;

  // Additional settings
  additionalSettings?: Record<string, unknown>;
}

/**
 * Result of successful workspace provisioning.
 */
export interface WorkspaceProvisionResult {
  workspaceId: string;
  orgId: string;
  workspaceName: string;
  slug: string;
  apiKey: string; // For the workspace to call APIs
  apiKeyPrefix: string; // Public identifier for key rotation
  integrations: Array<{
    slug: string;
    name: string;
    isConfigured: boolean;
  }>;
  dashboardUrl: string;
  welcomeEmailSent: boolean;
  provisionedAt: Date;
}

/**
 * Default settings per industry.
 */
export interface IndustryDefaults {
  timezone: string;
  currency: string;
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
  dateFormat: string;
  locale: string;
  suggestedIntegrations: string[]; // Suggested integration slugs
  dashboardLayout?: Record<string, unknown>;
}

// ─── INVITATION ────────────────────────────────────────────────

/**
 * Status of an invitation.
 */
export enum InvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
}

/**
 * Invitation request input.
 */
export interface InvitationRequest {
  orgId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER"; // OrgRole enum
  invitedBy: string; // User ID
}

/**
 * Invitation response with all details.
 */
export interface InvitationResponse {
  id: string;
  orgId: string;
  email: string;
  role: string;
  status: InvitationStatus;
  invitedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitationLink?: string; // Full link if needed
}

/**
 * Accept invitation input.
 */
export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

/**
 * Accept invitation result.
 */
export interface AcceptInvitationResult {
  orgId: string;
  orgName: string;
  userRole: string;
  acceptedAt: Date;
  redirectUrl: string;
}

// ─── EMAIL VERIFICATION ────────────────────────────────────────

/**
 * OTP verification input.
 */
export interface VerifyOTPInput {
  email: string;
  code: string;
}

/**
 * OTP generation result.
 */
export interface GenerateOTPResult {
  email: string;
  expiresIn: number; // Seconds
  attemptsRemaining: number;
}

/**
 * OTP verification result.
 */
export interface VerifyOTPResult {
  email: string;
  verified: boolean;
  message: string;
}

// ─── EVENTS ────────────────────────────────────────────────────

/**
 * Events emitted during onboarding for external listeners.
 */
export enum OnboardingEventType {
  STARTED = "onboarding.started",
  STEP_COMPLETED = "onboarding.step_completed",
  EMAIL_VERIFIED = "onboarding.email_verified",
  WORKSPACE_PROVISIONED = "onboarding.workspace_provisioned",
  COMPLETED = "onboarding.completed",
  ABANDONED = "onboarding.abandoned",
  INVITATION_SENT = "onboarding.invitation_sent",
  INVITATION_ACCEPTED = "onboarding.invitation_accepted",
}

/**
 * Onboarding event payload.
 */
export interface OnboardingEvent {
  type: OnboardingEventType;
  progressId: string;
  userId: string;
  orgId?: string;
  workspaceId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

// ─── ERRORS ────────────────────────────────────────────────────

/**
 * Custom error for onboarding operations.
 */
export class OnboardingError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

/**
 * Common onboarding error codes.
 */
export const OnboardingErrorCodes = {
  INVALID_STEP: "INVALID_STEP",
  STEP_NOT_COMPLETED: "STEP_NOT_COMPLETED",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  ONBOARDING_NOT_FOUND: "ONBOARDING_NOT_FOUND",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_MAX_ATTEMPTS: "OTP_MAX_ATTEMPTS",
  OTP_RESEND_RATE_LIMITED: "OTP_RESEND_RATE_LIMITED",
  WORKSPACE_PROVISIONING_FAILED: "WORKSPACE_PROVISIONING_FAILED",
  INVITATION_EXPIRED: "INVITATION_EXPIRED",
  INVITATION_NOT_FOUND: "INVITATION_NOT_FOUND",
  INVALID_INVITATION_TOKEN: "INVALID_INVITATION_TOKEN",
  WORKSPACE_ALREADY_EXISTS: "WORKSPACE_ALREADY_EXISTS",
} as const;
