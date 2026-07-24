/**
 * Onboarding Service — Manages user onboarding progression and state.
 *
 * This service handles:
 * - Starting new onboarding sessions
 * - Tracking step-by-step progression
 * - Validating step transitions
 * - Persisting onboarding data
 * - Triggering completion and abandonment
 * - Emitting events for listeners
 */

import { EventEmitter } from "events";
import { db, prisma } from "@witylogix/db";
import {
  OnboardingStep,
  OnboardingState,
  StepProgressionInput,
  CompleteOnboardingInput,
  OnboardingError,
  OnboardingErrorCodes,
  OnboardingEvent,
  OnboardingEventType,
  StartOnboardingInput,
} from "./types";

/**
 * OnboardingService manages the complete onboarding workflow.
 * Validates step transitions, persists progress, and emits events.
 */
export class OnboardingService {
  private eventEmitter: EventEmitter;

  // Step dependency map — which steps must be completed before advancing
  private readonly requiredPriorSteps: Record<
    OnboardingStep,
    OnboardingStep[]
  > = {
    [OnboardingStep.EMAIL_VERIFICATION]: [],
    [OnboardingStep.BASIC_INFO]: [OnboardingStep.EMAIL_VERIFICATION],
    [OnboardingStep.WORKSPACE_CONFIG]: [OnboardingStep.BASIC_INFO],
    [OnboardingStep.INTEGRATION_SETUP]: [OnboardingStep.WORKSPACE_CONFIG],
    [OnboardingStep.TEAM_SETUP]: [OnboardingStep.INTEGRATION_SETUP],
    [OnboardingStep.COMPLETION]: [OnboardingStep.TEAM_SETUP],
  };

  constructor(eventEmitter: EventEmitter = new EventEmitter()) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Starts a new onboarding session for a user.
   *
   * @param input - User ID and basic info
   * @returns Onboarding progress record
   * @throws OnboardingError if user already has active onboarding
   */
  async startOnboarding(input: StartOnboardingInput): Promise<OnboardingState> {
    const { userId, email, name } = input;

    // Check for existing active onboarding
    const existing = await db.onboardingProgress.findUnique({
      where: { userId },
    });

    if (existing && existing.isActive) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_TRANSITION,
        `User ${userId} already has an active onboarding session`,
        409,
      );
    }

    // Create new progress record
    const progress = await db.onboardingProgress.create({
      data: {
        userId,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        currentSubStep: null,
        completedSteps: [],
        data: {
          email,
          name: name || null,
          startedAt: new Date(),
        },
        isActive: true,
      },
    });

    // Emit event
    this.emitEvent({
      type: OnboardingEventType.STARTED,
      progressId: progress.id,
      userId,
      data: { email, name },
      timestamp: new Date(),
    });

    return this.mapToState(progress);
  }

  /**
   * Updates onboarding progress to a new step with data.
   *
   * Validates that:
   * - All prior steps have been completed
   * - The transition is valid
   * - The data is provided
   *
   * @param input - Progress update input
   * @returns Updated onboarding state
   * @throws OnboardingError if validation fails
   */
  async updateStep(input: StepProgressionInput): Promise<OnboardingState> {
    const { progressId, step, subStep, data } = input;

    // Fetch current progress
    const progress = await db.onboardingProgress.findUnique({
      where: { id: progressId },
    });

    if (!progress) {
      throw new OnboardingError(
        OnboardingErrorCodes.ONBOARDING_NOT_FOUND,
        `Onboarding progress ${progressId} not found`,
        404,
      );
    }

    if (!progress.isActive) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_TRANSITION,
        `Onboarding is not active (completed or abandoned)`,
        400,
      );
    }

    // Validate step transition
    this.validateStepTransition(progress.completedSteps, step);

    // Update progress record
    const updatedProgress = await db.onboardingProgress.update({
      where: { id: progressId },
      data: {
        currentStep: step,
        currentSubStep: subStep || null,
        completedSteps: {
          set: Array.from(new Set([...progress.completedSteps, step])),
        },
        data: {
          ...progress.data,
          ...data,
          lastUpdated: new Date(),
        },
        updatedAt: new Date(),
      },
    });

    // Emit event
    this.emitEvent({
      type: OnboardingEventType.STEP_COMPLETED,
      progressId,
      userId: progress.userId,
      orgId: progress.orgId || undefined,
      data: {
        step,
        subStep,
        completedCount: updatedProgress.completedSteps.length,
      },
      timestamp: new Date(),
    });

    return this.mapToState(updatedProgress);
  }

  /**
   * Retrieves the current onboarding state for a user.
   *
   * @param userId - User ID
   * @returns Current onboarding state or null if none exists
   */
  async getProgress(userId: string): Promise<OnboardingState | null> {
    const progress = await db.onboardingProgress.findUnique({
      where: { userId },
    });

    return progress ? this.mapToState(progress) : null;
  }

  /**
   * Retrieves onboarding progress by progress ID.
   *
   * @param progressId - Progress record ID
   * @returns Onboarding state
   * @throws OnboardingError if not found
   */
  async getProgressById(progressId: string): Promise<OnboardingState> {
    const progress = await db.onboardingProgress.findUnique({
      where: { id: progressId },
    });

    if (!progress) {
      throw new OnboardingError(
        OnboardingErrorCodes.ONBOARDING_NOT_FOUND,
        `Onboarding progress ${progressId} not found`,
        404,
      );
    }

    return this.mapToState(progress);
  }

  /**
   * Completes onboarding, marking it as done and triggering workspace provisioning.
   * Called after all steps are complete and ready to finalize.
   *
   * @param input - Completion input
   * @returns Updated onboarding state
   * @throws OnboardingError if not all steps are complete
   */
  async completeOnboarding(
    input: CompleteOnboardingInput,
  ): Promise<OnboardingState> {
    const { progressId } = input;

    const progress = await this.getProgressById(progressId);

    // Verify all steps are complete
    const allSteps = Object.values(OnboardingStep);
    const missingSteps = allSteps.filter(
      (s) => !progress.completedSteps.includes(s),
    );

    if (missingSteps.length > 0) {
      throw new OnboardingError(
        OnboardingErrorCodes.STEP_NOT_COMPLETED,
        `Cannot complete onboarding: missing steps ${missingSteps.join(", ")}`,
        400,
      );
    }

    // Mark as complete
    const completed = await db.onboardingProgress.update({
      where: { id: progressId },
      data: {
        isActive: false,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Emit completion event
    this.emitEvent({
      type: OnboardingEventType.COMPLETED,
      progressId,
      userId: progress.userId,
      orgId: progress.orgId || undefined,
      timestamp: new Date(),
    });

    return this.mapToState(completed);
  }

  /**
   * Abandons an onboarding session, marking it as abandoned.
   * Called when user gives up on the flow.
   *
   * @param progressId - Progress record ID
   * @returns Updated onboarding state
   */
  async abandonOnboarding(progressId: string): Promise<OnboardingState> {
    const progress = await this.getProgressById(progressId);

    const abandoned = await db.onboardingProgress.update({
      where: { id: progressId },
      data: {
        isActive: false,
        abandonedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Emit abandonment event
    this.emitEvent({
      type: OnboardingEventType.ABANDONED,
      progressId,
      userId: progress.userId,
      orgId: progress.orgId || undefined,
      data: { completedSteps: progress.completedSteps.length },
      timestamp: new Date(),
    });

    return this.mapToState(abandoned);
  }

  /**
   * Links an organization to an onboarding session.
   * Called after organization is created during workspace provisioning.
   *
   * @param progressId - Progress record ID
   * @param orgId - Organization ID to link
   * @returns Updated onboarding state
   */
  async linkOrganization(
    progressId: string,
    orgId: string,
  ): Promise<OnboardingState> {
    const updated = await db.onboardingProgress.update({
      where: { id: progressId },
      data: {
        orgId,
        updatedAt: new Date(),
      },
    });

    return this.mapToState(updated);
  }

  /**
   * Validates that a step transition is allowed based on completed steps.
   * Ensures required prior steps have been completed.
   *
   * @param completedSteps - Array of completed step names
   * @param targetStep - Step being advanced to
   * @throws OnboardingError if transition is invalid
   */
  private validateStepTransition(
    completedSteps: string[],
    targetStep: OnboardingStep,
  ): void {
    const required = this.requiredPriorSteps[targetStep] || [];

    for (const req of required) {
      if (!completedSteps.includes(req)) {
        throw new OnboardingError(
          OnboardingErrorCodes.INVALID_TRANSITION,
          `Cannot advance to ${targetStep}: ${req} must be completed first`,
          400,
        );
      }
    }
  }

  /**
   * Maps a database progress record to OnboardingState interface.
   */
  private mapToState(record: any): OnboardingState {
    return {
      id: record.id,
      userId: record.userId,
      orgId: record.orgId,
      currentStep: record.currentStep as OnboardingStep,
      currentSubStep: record.currentSubStep,
      completedSteps: record.completedSteps || [],
      data: record.data || {},
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      abandonedAt: record.abandonedAt,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Emits an onboarding event to registered listeners.
   */
  private emitEvent(event: OnboardingEvent): void {
    this.eventEmitter.emit(event.type, event);
  }

  /**
   * Registers a listener for onboarding events.
   *
   * @param eventType - Event type to listen for
   * @param listener - Callback function
   */
  on(
    eventType: OnboardingEventType,
    listener: (event: OnboardingEvent) => void | Promise<void>,
  ): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Removes a listener for onboarding events.
   */
  off(eventType: OnboardingEventType, listener: Function): void {
    this.eventEmitter.off(eventType, listener);
  }

  /**
   * Cleans up abandoned onboarding sessions older than given days.
   * Should be run periodically (e.g., daily cron).
   *
   * @param olderThanDays - Delete records abandoned more than N days ago
   * @returns Count of deleted records
   */
  async cleanupAbandonedSessions(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await db.onboardingProgress.deleteMany({
      where: {
        abandonedAt: {
          lt: cutoff,
        },
      },
    });

    return result.count;
  }

  /**
   * Gets onboarding statistics for monitoring/analytics.
   *
   * @returns Statistics about onboarding sessions
   */
  async getStatistics(): Promise<{
    totalStarted: number;
    totalCompleted: number;
    totalAbandoned: number;
    averageStepsCompleted: number;
    completionRate: number;
  }> {
    const total = await db.onboardingProgress.count();
    const completed = await db.onboardingProgress.count({
      where: { completedAt: { not: null } },
    });
    const abandoned = await db.onboardingProgress.count({
      where: { abandonedAt: { not: null } },
    });

    const sessions = await db.onboardingProgress.findMany({
      select: {
        completedSteps: true,
      },
    });

    const totalCompletedSteps = sessions.reduce(
      (sum, s) => sum + (s.completedSteps?.length || 0),
      0,
    );
    const avgStepsCompleted =
      sessions.length > 0 ? totalCompletedSteps / sessions.length : 0;

    return {
      totalStarted: total,
      totalCompleted: completed,
      totalAbandoned: abandoned,
      averageStepsCompleted: Math.round(avgStepsCompleted * 100) / 100,
      completionRate:
        total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
    };
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();
