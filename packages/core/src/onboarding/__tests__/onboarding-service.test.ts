/**
 * Onboarding Service Tests
 *
 * Tests cover:
 * - Starting new onboarding sessions
 * - Step progression with validation
 * - Step dependency enforcement
 * - Data persistence
 * - Completion and abandonment
 * - Event emission
 */

// Mock prisma - must be before any imports
vi.mock("@witylogix/db", () => ({
  prisma: {
    onboardingProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { OnboardingService } from "../onboarding-service";
import {
  OnboardingStep,
  OnboardingEventType,
  OnboardingError,
  OnboardingErrorCodes,
} from "../types";
import { prisma as any } from "@witylogix/db";

describe("OnboardingService", () => {
  let service: OnboardingService;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    service = new OnboardingService(eventEmitter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    eventEmitter.removeAllListeners();
  });

  describe("startOnboarding", () => {
    it("should create a new onboarding session", async () => {
      const userId = "user-123";
      const email = "test@example.com";

      const mockProgress = {
        id: "progress-123",
        userId,
        orgId: null,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        currentSubStep: null,
        completedSteps: [],
        data: expect.objectContaining({ email }),
        startedAt: new Date(),
        completedAt: null,
        abandonedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);
      (any.onboardingProgress.create as any).mockResolvedValue(mockProgress);

      const result = await service.startOnboarding({ userId, email });

      expect(result.userId).toBe(userId);
      expect(result.currentStep).toBe(OnboardingStep.EMAIL_VERIFICATION);
      expect(result.data.email).toBe(email);
      expect(result.isActive).toBe(true);
    });

    it("should emit STARTED event", async () => {
      const eventListener = vi.fn();
      eventEmitter.on(OnboardingEventType.STARTED, eventListener);

      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);
      (any.onboardingProgress.create as any).mockResolvedValue({
        id: "progress-123",
        userId: "user-123",
        orgId: null,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        currentSubStep: null,
        completedSteps: [],
        data: {},
        startedAt: new Date(),
        completedAt: null,
        abandonedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.startOnboarding({ userId: "user-123", email: "test@example.com" });

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe(OnboardingEventType.STARTED);
      expect(event.userId).toBe("user-123");
    });

    it("should prevent duplicate active sessions", async () => {
      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: "progress-123",
        userId: "user-123",
        isActive: true,
      });

      await expect(
        service.startOnboarding({ userId: "user-123", email: "test@example.com" }),
      ).rejects.toThrow(OnboardingError);
    });
  });

  describe("updateStep", () => {
    it("should advance to next step with data", async () => {
      const progressId = "progress-123";
      const currentProgress = {
        id: progressId,
        userId: "user-123",
        orgId: null,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION],
        data: { email: "test@example.com" },
        isActive: true,
      };

      const updatedProgress = {
        ...currentProgress,
        currentStep: OnboardingStep.BASIC_INFO,
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION, OnboardingStep.BASIC_INFO],
        data: { email: "test@example.com", company: "Acme" },
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(currentProgress);
      (any.onboardingProgress.update as any).mockResolvedValue(updatedProgress);

      const result = await service.updateStep({
        progressId,
        step: OnboardingStep.BASIC_INFO,
        data: { company: "Acme" },
      });

      expect(result.currentStep).toBe(OnboardingStep.BASIC_INFO);
      expect(result.data.company).toBe("Acme");
      expect(result.completedSteps).toContain(OnboardingStep.BASIC_INFO);
    });

    it("should prevent skipping required steps", async () => {
      const progressId = "progress-123";
      const currentProgress = {
        id: progressId,
        userId: "user-123",
        completedSteps: [], // No steps completed
        isActive: true,
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(currentProgress);

      // Try to skip EMAIL_VERIFICATION and go straight to BASIC_INFO
      await expect(
        service.updateStep({
          progressId,
          step: OnboardingStep.BASIC_INFO,
          data: {},
        }),
      ).rejects.toThrow(OnboardingError);
    });

    it("should emit STEP_COMPLETED event", async () => {
      const eventListener = vi.fn();
      eventEmitter.on(OnboardingEventType.STEP_COMPLETED, eventListener);

      const progressId = "progress-123";
      const currentProgress = {
        id: progressId,
        userId: "user-123",
        orgId: null,
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION],
        isActive: true,
        data: {},
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(currentProgress);
      (any.onboardingProgress.update as any).mockResolvedValue({
        ...currentProgress,
        currentStep: OnboardingStep.BASIC_INFO,
        completedSteps: [
          OnboardingStep.EMAIL_VERIFICATION,
          OnboardingStep.BASIC_INFO,
        ],
      });

      await service.updateStep({
        progressId,
        step: OnboardingStep.BASIC_INFO,
        data: {},
      });

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe(OnboardingEventType.STEP_COMPLETED);
      expect(event.data.step).toBe(OnboardingStep.BASIC_INFO);
    });

    it("should throw error if progress not found", async () => {
      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);

      await expect(
        service.updateStep({
          progressId: "invalid",
          step: OnboardingStep.EMAIL_VERIFICATION,
          data: {},
        }),
      ).rejects.toThrow(OnboardingError);
    });

    it("should throw error if onboarding not active", async () => {
      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: "progress-123",
        isActive: false,
      });

      await expect(
        service.updateStep({
          progressId: "progress-123",
          step: OnboardingStep.EMAIL_VERIFICATION,
          data: {},
        }),
      ).rejects.toThrow(OnboardingError);
    });
  });

  describe("getProgress", () => {
    it("should retrieve progress by user ID", async () => {
      const userId = "user-123";
      const mockProgress = {
        id: "progress-123",
        userId,
        currentStep: OnboardingStep.BASIC_INFO,
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION],
        data: {},
        startedAt: new Date(),
        completedAt: null,
        abandonedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(mockProgress);

      const result = await service.getProgress(userId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
      expect(result?.currentStep).toBe(OnboardingStep.BASIC_INFO);
    });

    it("should return null if no progress exists", async () => {
      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);

      const result = await service.getProgress("user-123");

      expect(result).toBeNull();
    });
  });

  describe("completeOnboarding", () => {
    it("should mark onboarding as complete when all steps done", async () => {
      const progressId = "progress-123";
      const allSteps = Object.values(OnboardingStep);

      const mockProgress = {
        id: progressId,
        userId: "user-123",
        orgId: "org-123",
        completedSteps: allSteps,
        isActive: true,
      };

      (any.onboardingProgress.findUnique as any).mockResolvedValue(mockProgress);
      (any.onboardingProgress.update as any).mockResolvedValue({
        ...mockProgress,
        isActive: false,
        completedAt: new Date(),
      });

      const result = await service.completeOnboarding({ progressId });

      expect(result.completedAt).toBeDefined();
      expect(result.isActive).toBe(false);
    });

    it("should emit COMPLETED event", async () => {
      const eventListener = vi.fn();
      eventEmitter.on(OnboardingEventType.COMPLETED, eventListener);

      const progressId = "progress-123";
      const allSteps = Object.values(OnboardingStep);

      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        orgId: "org-123",
        completedSteps: allSteps,
        isActive: true,
      });

      (any.onboardingProgress.update as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        orgId: "org-123",
        completedSteps: allSteps,
        isActive: false,
        completedAt: new Date(),
      });

      await service.completeOnboarding({ progressId });

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe(OnboardingEventType.COMPLETED);
    });

    it("should throw error if not all steps complete", async () => {
      const progressId = "progress-123";

      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION], // Only one step
        isActive: true,
      });

      await expect(
        service.completeOnboarding({ progressId }),
      ).rejects.toThrow(OnboardingError);
    });
  });

  describe("abandonOnboarding", () => {
    it("should mark onboarding as abandoned", async () => {
      const progressId = "progress-123";

      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        isActive: true,
      });

      (any.onboardingProgress.update as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        isActive: false,
        abandonedAt: new Date(),
      });

      const result = await service.abandonOnboarding(progressId);

      expect(result.abandonedAt).toBeDefined();
      expect(result.isActive).toBe(false);
    });

    it("should emit ABANDONED event", async () => {
      const eventListener = vi.fn();
      eventEmitter.on(OnboardingEventType.ABANDONED, eventListener);

      const progressId = "progress-123";

      (any.onboardingProgress.findUnique as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        orgId: "org-123",
        completedSteps: [OnboardingStep.EMAIL_VERIFICATION],
        isActive: true,
      });

      (any.onboardingProgress.update as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        isActive: false,
        abandonedAt: new Date(),
      });

      await service.abandonOnboarding(progressId);

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0];
      expect(event.type).toBe(OnboardingEventType.ABANDONED);
    });
  });

  describe("linkOrganization", () => {
    it("should link organization to progress", async () => {
      const progressId = "progress-123";
      const orgId = "org-456";

      (any.onboardingProgress.update as any).mockResolvedValue({
        id: progressId,
        userId: "user-123",
        orgId,
        isActive: true,
      });

      const result = await service.linkOrganization(progressId, orgId);

      expect(result.orgId).toBe(orgId);
    });
  });

  describe("getStatistics", () => {
    it("should return onboarding statistics", async () => {
      (any.onboardingProgress.count as any)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(50) // completed
        .mockResolvedValueOnce(20); // abandoned

      (any.onboardingProgress.findMany as any).mockResolvedValue([
        { completedSteps: [OnboardingStep.EMAIL_VERIFICATION, OnboardingStep.BASIC_INFO] },
        { completedSteps: [OnboardingStep.EMAIL_VERIFICATION] },
        { completedSteps: [] },
      ]);

      const stats = await service.getStatistics();

      expect(stats.totalStarted).toBe(100);
      expect(stats.totalCompleted).toBe(50);
      expect(stats.totalAbandoned).toBe(20);
      expect(stats.completionRate).toBe(50);
    });
  });

  describe("cleanupAbandonedSessions", () => {
    it("should delete abandoned sessions older than N days", async () => {
      (any.onboardingProgress.deleteMany as any).mockResolvedValue({ count: 5 });

      const deleted = await service.cleanupAbandonedSessions(30);

      expect(deleted).toBe(5);
      expect(any.onboardingProgress.deleteMany).toHaveBeenCalled();
    });
  });

  describe("Event listeners", () => {
    it("should register and call event listeners", async () => {
      const listener = vi.fn();
      service.on(OnboardingEventType.STARTED, listener);

      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);
      (any.onboardingProgress.create as any).mockResolvedValue({
        id: "progress-123",
        userId: "user-123",
        orgId: null,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        completedSteps: [],
        data: {},
        startedAt: new Date(),
        completedAt: null,
        abandonedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.startOnboarding({ userId: "user-123", email: "test@example.com" });

      expect(listener).toHaveBeenCalled();
    });

    it("should unregister event listeners", async () => {
      const listener = vi.fn();
      service.on(OnboardingEventType.STARTED, listener);
      service.off(OnboardingEventType.STARTED, listener);

      (any.onboardingProgress.findUnique as any).mockResolvedValue(null);
      (any.onboardingProgress.create as any).mockResolvedValue({
        id: "progress-123",
        userId: "user-123",
        orgId: null,
        currentStep: OnboardingStep.EMAIL_VERIFICATION,
        completedSteps: [],
        data: {},
        startedAt: new Date(),
        completedAt: null,
        abandonedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.startOnboarding({ userId: "user-123", email: "test@example.com" });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
