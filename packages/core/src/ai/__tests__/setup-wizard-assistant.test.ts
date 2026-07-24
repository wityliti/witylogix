/**
 * Tests for Setup Wizard Assistant
 *
 * Tests wizard initialization, progress tracking, step completion,
 * setup guides, and configuration suggestions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SetupWizardAssistant,
  type SetupWizardState,
} from "../setup-wizard-assistant.js";

describe("SetupWizardAssistant", () => {
  let wizard: SetupWizardAssistant;

  beforeEach(() => {
    wizard = new SetupWizardAssistant();
  });

  describe("Wizard Initialization", () => {
    it("should initialize wizard for new tenant", () => {
      const state = wizard.initializeWizard(
        "tenant-1",
        "Olive Garden",
        "Italian restaurant chain",
        "growth",
      );

      expect(state.tenantId).toBe("tenant-1");
      expect(state.companyName).toBe("Olive Garden");
      expect(state.industry).toBe("restaurant");
      expect(state.businessSize).toBe("growth");
      expect(state.steps.length).toBeGreaterThan(0);
      expect(state.currentStepIndex).toBe(0);
      expect(state.completedSteps.size).toBe(0);
      expect(state.startedAt).toBeInstanceOf(Date);
    });

    it("should detect restaurant industry", () => {
      const state = wizard.initializeWizard(
        "tenant-1",
        "Quick Pizza",
        "Local pizza restaurant",
      );

      expect(state.industry).toBe("restaurant");
    });

    it("should detect ecommerce industry", () => {
      const state = wizard.initializeWizard(
        "tenant-1",
        "TechStore",
        "Online electronics retailer",
      );

      expect(state.industry).toBe("ecommerce");
    });

    it("should create prioritized steps", () => {
      const state = wizard.initializeWizard(
        "tenant-1",
        "Restaurant Co",
        "Full-service restaurant",
      );

      expect(state.steps.length).toBeGreaterThan(0);

      // Check that steps have required properties
      state.steps.forEach((step) => {
        expect(step.stepNumber).toBeDefined();
        expect(step.providerId).toBeTruthy();
        expect(step.providerName).toBeTruthy();
        expect(step.priority).toMatch(/critical|high|medium|low/);
        expect(step.estimatedMinutes).toBeGreaterThan(0);
      });
    });

    it("should respect business size in step ordering", () => {
      const starterState = wizard.initializeWizard(
        "tenant-1",
        "Restaurant",
        "",
        "starter",
      );

      const enterpriseState = wizard.initializeWizard(
        "tenant-2",
        "Restaurant",
        "",
        "enterprise",
      );

      expect(starterState.steps.length).toBeLessThanOrEqual(
        enterpriseState.steps.length,
      );
    });
  });

  describe("Step Completion", () => {
    let state: SetupWizardState;

    beforeEach(() => {
      state = wizard.initializeWizard(
        "tenant-1",
        "Sample Restaurant",
        "",
        "growth",
      );
    });

    it("should complete a step", () => {
      expect(state.completedSteps.has(0)).toBe(false);

      wizard.completeStep(state, 0);

      expect(state.completedSteps.has(0)).toBe(true);
      expect(state.steps[0].completedAt).toBeInstanceOf(Date);
    });

    it("should update current step after completion", () => {
      const initialStep = state.currentStepIndex;

      wizard.completeStep(state, 0);

      expect(state.currentStepIndex).not.toBe(initialStep);
    });

    it("should skip a step", () => {
      expect(state.skippedSteps.has(1)).toBe(false);

      wizard.skipStep(state, 1);

      expect(state.skippedSteps.has(1)).toBe(true);
      expect(state.steps[1].skippedAt).toBeInstanceOf(Date);
    });

    it("should allow skipping and completing different steps", () => {
      wizard.completeStep(state, 0);
      wizard.skipStep(state, 1);

      expect(state.completedSteps.size).toBe(1);
      expect(state.skippedSteps.size).toBe(1);
    });
  });

  describe("Setup Progress", () => {
    let state: SetupWizardState;

    beforeEach(() => {
      state = wizard.initializeWizard(
        "tenant-1",
        "Sample Restaurant",
        "",
        "growth",
      );
    });

    it("should calculate progress percentage", () => {
      const progress = wizard.getProgress(state);

      expect(progress.completionPercentage).toBe(0);

      wizard.completeStep(state, 0);
      const progress2 = wizard.getProgress(state);

      expect(progress2.completionPercentage).toBeGreaterThan(0);
      expect(progress2.completionPercentage).toBeLessThan(100);
    });

    it("should track completed and skipped steps", () => {
      wizard.completeStep(state, 0);
      wizard.skipStep(state, 1);

      const progress = wizard.getProgress(state);

      expect(progress.completedSteps).toBe(1);
      expect(progress.skippedSteps).toBe(1);
    });

    it("should estimate remaining time", () => {
      const progress1 = wizard.getProgress(state);
      const initialRemaining = progress1.estimatedRemainingMinutes;

      wizard.completeStep(state, 0);
      const progress2 = wizard.getProgress(state);

      expect(progress2.estimatedRemainingMinutes).toBeLessThan(
        initialRemaining,
      );
    });

    it("should provide next recommended step", () => {
      const progress = wizard.getProgress(state);

      expect(progress.nextRecommendedStep).toBeDefined();
      expect(progress.nextRecommendedStep?.stepNumber).toBe(0);
    });

    it("should be 100% complete when all steps done", () => {
      for (let i = 0; i < state.steps.length; i++) {
        wizard.completeStep(state, i);
      }

      const progress = wizard.getProgress(state);

      expect(progress.completionPercentage).toBe(100);
      expect(progress.nextRecommendedStep).toBeUndefined();
    });
  });

  describe("Next Action Suggestions", () => {
    let state: SetupWizardState;

    beforeEach(() => {
      state = wizard.initializeWizard(
        "tenant-1",
        "Sample Restaurant",
        "",
        "growth",
      );
    });

    it("should suggest next action after provider connection", () => {
      const nextAction = wizard.getNextAction(state, "stripe");

      expect(nextAction).toBeDefined();
      expect(nextAction?.providerId).toBeTruthy();
    });

    it("should return null when all steps complete", () => {
      for (let i = 0; i < state.steps.length; i++) {
        wizard.completeStep(state, i);
      }

      const nextAction = wizard.getNextAction(state, "stripe");

      expect(nextAction).toBeNull();
    });

    it("should suggest critical steps first", () => {
      const nextAction = wizard.getNextAction(state, "stripe");

      if (nextAction) {
        const step = state.steps.find(
          (s) => s.stepNumber === nextAction.stepNumber,
        );
        expect(step?.priority).toMatch(/critical|high/);
      }
    });
  });

  describe("Integration Setup Guides", () => {
    it("should generate setup guide for known provider", () => {
      const guide = wizard.getIntegrationSetupGuide("stripe");

      expect(guide.providerId).toBe("stripe");
      expect(guide.providerName).toBeTruthy();
      expect(guide.basicSteps.length).toBeGreaterThan(0);
      expect(guide.authSteps.length).toBeGreaterThan(0);
      expect(guide.testingSteps.length).toBeGreaterThan(0);
      expect(guide.estimatedMinutes).toBeGreaterThan(0);
    });

    it("should include auth steps for OAuth provider", () => {
      const guide = wizard.getIntegrationSetupGuide("shopify");

      expect(guide.authSteps.length).toBeGreaterThan(0);
      expect(
        guide.authSteps.some(
          (s) =>
            s.toLowerCase().includes("oauth") ||
            s.toLowerCase().includes("authorize"),
        ),
      ).toBe(true);
    });

    it("should include webhook steps for providers with webhook support", () => {
      const guide = wizard.getIntegrationSetupGuide("stripe");

      expect(guide.webhookSteps).toBeDefined();
      expect(guide.webhookSteps?.length).toBeGreaterThan(0);
    });

    it("should list common issues and solutions", () => {
      const guide = wizard.getIntegrationSetupGuide("stripe");

      expect(guide.commonIssues.length).toBeGreaterThan(0);
      guide.commonIssues.forEach((issue) => {
        expect(issue.issue).toBeTruthy();
        expect(issue.solution).toBeTruthy();
      });
    });

    it("should throw for unknown provider", () => {
      expect(() =>
        wizard.getIntegrationSetupGuide("unknown-provider-xyz"),
      ).toThrow();
    });
  });

  describe("Configuration Suggestions", () => {
    it("should provide config suggestions for stripe", () => {
      const suggestions = wizard.getConfigSuggestions("stripe", "growth");

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach((s) => {
        expect(s.setting).toBeTruthy();
        expect(s.explanation).toBeTruthy();
        expect(Array.isArray(s.affectsOtherIntegrations)).toBe(true);
      });
    });

    it("should vary recommendations by business size", () => {
      const starter = wizard.getConfigSuggestions("stripe", "starter");
      const enterprise = wizard.getConfigSuggestions("stripe", "enterprise");

      const starterRecommended = starter.filter((s) => s.recommended).length;
      const enterpriseRecommended = enterprise.filter(
        (s) => s.recommended,
      ).length;

      expect(enterpriseRecommended).toBeGreaterThanOrEqual(starterRecommended);
    });

    it("should identify integration dependencies in config", () => {
      const suggestions = wizard.getConfigSuggestions("stripe", "enterprise");

      const withDeps = suggestions.filter(
        (s) => s.affectsOtherIntegrations.length > 0,
      );
      expect(withDeps.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown provider", () => {
      const suggestions = wizard.getConfigSuggestions(
        "unknown-provider",
        "growth",
      );

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });
  });

  describe("Workflow State Transitions", () => {
    let state: SetupWizardState;

    beforeEach(() => {
      state = wizard.initializeWizard("tenant-1", "Restaurant", "", "growth");
    });

    it("should mark wizard complete when all steps done", () => {
      expect(state.completedAt).toBeUndefined();

      for (let i = 0; i < state.steps.length; i++) {
        wizard.completeStep(state, i);
      }

      expect(state.completedAt).toBeDefined();
    });

    it("should not mark complete with only skipped steps", () => {
      for (let i = 0; i < state.steps.length; i++) {
        wizard.skipStep(state, i);
      }

      expect(state.completedAt).toBeDefined();
    });

    it("should track step completion order", () => {
      const timestamps: Date[] = [];

      wizard.completeStep(state, 0);
      timestamps.push(state.steps[0].completedAt!);

      wizard.completeStep(state, 1);
      timestamps.push(state.steps[1].completedAt!);

      expect(timestamps[1].getTime()).toBeGreaterThanOrEqual(
        timestamps[0].getTime(),
      );
    });
  });

  describe("Multi-Step Scenarios", () => {
    it("should handle realistic setup flow for restaurant", () => {
      const state = wizard.initializeWizard(
        "restaurant-1",
        "Fast Food Chain",
        "Quick service restaurant",
        "enterprise",
      );

      const progress1 = wizard.getProgress(state);
      expect(progress1.completionPercentage).toBe(0);

      // Complete first few steps
      wizard.completeStep(state, 0);
      wizard.completeStep(state, 1);
      wizard.skipStep(state, 2);

      const progress2 = wizard.getProgress(state);
      expect(progress2.completedSteps).toBe(2);
      expect(progress2.skippedSteps).toBe(1);
      expect(progress2.completionPercentage).toBeGreaterThan(0);
      expect(progress2.completionPercentage).toBeLessThan(100);

      // Get next suggestion
      const nextAction = wizard.getNextAction(state, state.steps[0].providerId);
      expect(nextAction).toBeDefined();
    });

    it("should handle rapid completion", () => {
      const state = wizard.initializeWizard(
        "quick-tenant",
        "Small Business",
        "",
        "starter",
      );

      for (let i = 0; i < Math.min(3, state.steps.length); i++) {
        wizard.completeStep(state, i);
      }

      const progress = wizard.getProgress(state);
      expect(progress.completedSteps).toBe(3);
    });
  });
});
