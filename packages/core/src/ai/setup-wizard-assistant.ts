/**
 * Setup Wizard Assistant
 *
 * Conversational setup flow for new tenants:
 * - Industry detection from company info
 * - Step-by-step integration recommendations
 * - Priority ordering: most impactful first
 * - Setup time estimates per integration
 * - Configuration suggestions by business size
 * - Progress tracking
 * - Next-best-action suggestions
 */

import type {
  IntegrationRecommendation,
  TenantIntegrationProfile,
} from "./integration-recommender.js";
import {
  IntegrationRecommender,
  type IndustryType,
} from "./integration-recommender.js";
import type { IntegrationProvider } from "../integrations/registry/integration-registry.js";
import { integrationRegistry } from "../integrations/registry/integration-registry.js";

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface SetupStep {
  stepNumber: number;
  providerId: string;
  providerName: string;
  description: string;
  estimatedMinutes: number;
  priority: "critical" | "high" | "medium" | "low";
  configSuggestions: ConfigSuggestion[];
  completedAt?: Date;
  skippedAt?: Date;
}

export interface ConfigSuggestion {
  setting: string;
  recommended: boolean;
  value?: string | number | boolean;
  explanation: string;
  affectsOtherIntegrations: string[];
}

export interface SetupWizardState {
  tenantId: string;
  companyName: string;
  industry: IndustryType;
  businessSize: "starter" | "growth" | "enterprise";
  steps: SetupStep[];
  currentStepIndex: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  startedAt: Date;
  completedAt?: Date;
}

export interface SetupProgress {
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  completionPercentage: number;
  estimatedTotalMinutes: number;
  estimatedRemainingMinutes: number;
  nextRecommendedStep?: SetupStep;
}

export interface IntegrationSetupGuide {
  providerId: string;
  providerName: string;
  category: string;
  docUrl: string;
  basicSteps: string[];
  authSteps: string[];
  webhookSteps?: string[];
  testingSteps: string[];
  commonIssues: { issue: string; solution: string }[];
  estimatedMinutes: number;
}

// ─── SETUP WIZARD ───────────────────────────────────────────────────────

export class SetupWizardAssistant {
  private recommender: IntegrationRecommender;

  constructor() {
    this.recommender = new IntegrationRecommender();
  }

  /**
   * Initialize setup wizard for a new tenant
   */
  initializeWizard(
    tenantId: string,
    companyName: string,
    companyDescription: string = "",
    businessSize: "starter" | "growth" | "enterprise" = "growth",
  ): SetupWizardState {
    const industry = this.recommender.detectIndustry(
      companyName,
      companyDescription,
    );

    const profile: TenantIntegrationProfile = {
      tenantId,
      industry,
      businessSize,
      detectedWorkflows: [],
      connectedProviderIds: [],
      companyDescription,
    };

    const recommendations = this.recommender.getRecommendations(profile, 15);
    const steps = this.createPrioritizedSteps(recommendations, businessSize);

    return {
      tenantId,
      companyName,
      industry,
      businessSize,
      steps,
      currentStepIndex: 0,
      completedSteps: new Set(),
      skippedSteps: new Set(),
      startedAt: new Date(),
    };
  }

  /**
   * Get next recommended action after integration is connected
   */
  getNextAction(
    wizardState: SetupWizardState,
    newlyConnectedProviderId: string,
  ): SetupStep | null {
    const completed = new Set([
      ...wizardState.completedSteps,
      ...wizardState.skippedSteps,
    ]);
    const remaining = wizardState.steps.filter((s, i) => !completed.has(i));

    if (remaining.length === 0) {
      return null;
    }

    // Prioritize steps that depend on the newly connected provider
    const withDependencies = remaining.map((step) => {
      const provider = integrationRegistry.getProvider(
        newlyConnectedProviderId,
      );
      const currentProvider = integrationRegistry.getProvider(step.providerId);

      if (!provider || !currentProvider) return { step, score: 0 };

      // Check if this step's category complements the newly connected one
      const categoryScore =
        provider.category === currentProvider.category ? 0.3 : 0;

      const priorityScores: Record<string, number> = {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.3,
      };
      return {
        step,
        score: (priorityScores[step.priority] ?? 0.5) + categoryScore,
      };
    });

    withDependencies.sort((a, b) => b.score - a.score);
    return withDependencies[0]?.step ?? remaining[0];
  }

  /**
   * Mark a setup step as completed
   */
  completeStep(wizardState: SetupWizardState, stepNumber: number): void {
    wizardState.completedSteps.add(stepNumber);
    const step = wizardState.steps[stepNumber];
    if (step) {
      step.completedAt = new Date();
    }
    this.updateCurrentStep(wizardState);
  }

  /**
   * Mark a setup step as skipped
   */
  skipStep(wizardState: SetupWizardState, stepNumber: number): void {
    wizardState.skippedSteps.add(stepNumber);
    const step = wizardState.steps[stepNumber];
    if (step) {
      step.skippedAt = new Date();
    }
    this.updateCurrentStep(wizardState);
  }

  /**
   * Get setup progress
   */
  getProgress(wizardState: SetupWizardState): SetupProgress {
    const totalSteps = wizardState.steps.length;
    const completedSteps = wizardState.completedSteps.size;
    const skippedSteps = wizardState.skippedSteps.size;
    const completionPercentage =
      totalSteps > 0 ? ((completedSteps + skippedSteps) / totalSteps) * 100 : 0;

    const estimatedTotalMinutes = wizardState.steps.reduce(
      (sum, s) => sum + s.estimatedMinutes,
      0,
    );
    const completedMinutes = Array.from(wizardState.completedSteps)
      .map((i) => wizardState.steps[i]?.estimatedMinutes ?? 0)
      .reduce((sum, m) => sum + m, 0);
    const estimatedRemainingMinutes = estimatedTotalMinutes - completedMinutes;

    const nextRecommendedStep = wizardState.steps.find(
      (_, i) =>
        !wizardState.completedSteps.has(i) && !wizardState.skippedSteps.has(i),
    );

    return {
      totalSteps,
      completedSteps,
      skippedSteps,
      completionPercentage: Math.round(completionPercentage),
      estimatedTotalMinutes,
      estimatedRemainingMinutes,
      nextRecommendedStep,
    };
  }

  /**
   * Get detailed setup guide for a specific integration
   */
  getIntegrationSetupGuide(providerId: string): IntegrationSetupGuide {
    const provider = integrationRegistry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const basicSteps = this.generateBasicSteps(provider);
    const authSteps = this.generateAuthSteps(provider);
    const webhookSteps = provider.webhookSupport
      ? this.generateWebhookSteps(provider)
      : undefined;
    const testingSteps = this.generateTestingSteps(provider);
    const commonIssues = this.getCommonIssues(providerId);

    const estimatedMinutes =
      15 +
      (provider.authMethod === "oauth2" ? 5 : 0) +
      (provider.webhookSupport ? 10 : 0);

    return {
      providerId,
      providerName: provider.name,
      category: provider.category,
      docUrl: provider.docsUrl,
      basicSteps,
      authSteps,
      webhookSteps,
      testingSteps,
      commonIssues,
      estimatedMinutes,
    };
  }

  /**
   * Get configuration suggestions based on business size
   */
  getConfigSuggestions(
    providerId: string,
    businessSize: "starter" | "growth" | "enterprise",
  ): ConfigSuggestion[] {
    const suggestions: Record<string, ConfigSuggestion[]> = {
      stripe: [
        {
          setting: "Enable ACH payments",
          recommended: businessSize !== "starter",
          value: businessSize !== "starter",
          explanation: "ACH reduces processing fees for B2B payments",
          affectsOtherIntegrations: ["quickbooks", "square-payments"],
        },
        {
          setting: "Set up webhooks for dispute monitoring",
          recommended: businessSize === "enterprise",
          value: businessSize === "enterprise",
          explanation: "Critical for high-volume merchants",
          affectsOtherIntegrations: ["slack"],
        },
        {
          setting: "Enable 3D Secure 2",
          recommended: true,
          value: true,
          explanation: "Required for PCI compliance and fraud prevention",
          affectsOtherIntegrations: ["quickbooks"],
        },
      ],
      shopify: [
        {
          setting: "Enable inventory sync",
          recommended: true,
          value: true,
          explanation: "Keeps inventory in sync across sales channels",
          affectsOtherIntegrations: ["shipstation", "square-online"],
        },
        {
          setting: "Set up order webhooks",
          recommended: businessSize !== "starter",
          value: businessSize !== "starter",
          explanation: "Real-time order notifications to fulfillment systems",
          affectsOtherIntegrations: ["shipstation", "sendgrid"],
        },
      ],
      samsara: [
        {
          setting: "Enable GPS-based geofencing",
          recommended: true,
          value: true,
          explanation: "Automatic arrival/departure tracking",
          affectsOtherIntegrations: ["google-maps", "twilio"],
        },
        {
          setting: "Configure harsh event alerts",
          recommended: businessSize !== "starter",
          value: businessSize !== "starter",
          explanation: "Safety monitoring for high-risk operations",
          affectsOtherIntegrations: ["slack"],
        },
        {
          setting: "Enable fuel card integration",
          recommended: businessSize === "enterprise",
          value: businessSize === "enterprise",
          explanation: "Consolidated fuel and maintenance data",
          affectsOtherIntegrations: ["quickbooks"],
        },
      ],
      twilio: [
        {
          setting: "Enable message logging",
          recommended: businessSize === "enterprise",
          value: businessSize === "enterprise",
          explanation: "Compliance and audit trail",
          affectsOtherIntegrations: ["slack"],
        },
        {
          setting: "Set up auto-reply templates",
          recommended: true,
          value: true,
          explanation: "Reduce manual responses",
          affectsOtherIntegrations: [],
        },
      ],
    };

    return suggestions[providerId] ?? [];
  }

  /**
   * Create prioritized steps from recommendations
   */
  private createPrioritizedSteps(
    recommendations: IntegrationRecommendation[],
    businessSize: "starter" | "growth" | "enterprise",
  ): SetupStep[] {
    const priorityMap: Record<number, "critical" | "high" | "medium" | "low"> =
      {
        90: "critical",
        70: "high",
        50: "medium",
        0: "low",
      };

    return recommendations.slice(0, 10).map((rec, index) => {
      let priority: "critical" | "high" | "medium" | "low" = "low";
      if (rec.relevanceScore >= 80) priority = "critical";
      else if (rec.relevanceScore >= 55) priority = "high";
      else if (rec.relevanceScore >= 35) priority = "medium";

      const configSuggestions = this.getConfigSuggestions(
        rec.providerId,
        businessSize,
      );

      return {
        stepNumber: index,
        providerId: rec.providerId,
        providerName: rec.providerName,
        description: rec.reason,
        estimatedMinutes: rec.setupEstimateMinutes,
        priority,
        configSuggestions,
      };
    });
  }

  /**
   * Generate basic setup steps
   */
  private generateBasicSteps(provider: IntegrationProvider): string[] {
    return [
      `Go to ${provider.apiBaseUrl}`,
      "Create an account or sign in to your existing account",
      "Navigate to API settings or developer portal",
      `Generate API credentials (${provider.authMethod})`,
      "Store credentials securely in Witylogix integration settings",
    ];
  }

  /**
   * Generate auth-specific steps
   */
  private generateAuthSteps(provider: IntegrationProvider): string[] {
    switch (provider.authMethod) {
      case "oauth2":
        return [
          'Click "Connect with [Provider]" to start the OAuth authorization flow',
          "You will be redirected to authorize access on their login page",
          "Grant Witylogix the requested permissions",
          "You will be redirected back to Witylogix to confirm",
        ];
      case "api-key":
      case "bearer":
        return [
          "Generate an API key in your provider account settings",
          "Copy the API key",
          "Paste it into the Witylogix integration form",
          'Click "Test Connection" to verify',
        ];
      case "basic":
        return [
          "Prepare your username/email and password",
          "Enter credentials in the Witylogix integration form",
          'Click "Test Connection" to verify',
        ];
      case "custom":
        return [
          "Follow provider-specific authentication steps",
          "Contact provider support if needed",
        ];
      default:
        return ["Follow provider documentation for authentication"];
    }
  }

  /**
   * Generate webhook setup steps
   */
  private generateWebhookSteps(_provider: IntegrationProvider): string[] {
    return [
      "Copy the webhook URL from Witylogix integration settings",
      "Go to your provider account webhook/notification settings",
      "Add a new webhook with the copied URL",
      "Select events you want to subscribe to (e.g., order.created, payment.completed)",
      "Save the webhook and test it by triggering an event",
      "Verify the webhook event appears in Witylogix activity log",
    ];
  }

  /**
   * Generate testing steps
   */
  private generateTestingSteps(provider: IntegrationProvider): string[] {
    return [
      'Click "Test Connection" in the integration settings',
      "Verify the test request succeeds",
      "Send a real API call through the Witylogix interface",
      "Confirm the operation completed in your provider account",
      "Check logs to verify the operation was recorded",
    ];
  }

  /**
   * Get common issues and solutions
   */
  private getCommonIssues(
    providerId: string,
  ): { issue: string; solution: string }[] {
    const commonIssues: Record<string, { issue: string; solution: string }[]> =
      {
        stripe: [
          {
            issue: '"Invalid API key" error',
            solution:
              "Verify you copied the full API key (usually starts with sk_live_ or sk_test_). Check that you used the correct environment (test vs. live).",
          },
          {
            issue: "Webhooks not being received",
            solution:
              "Ensure the webhook endpoint is publicly accessible. Check webhook signing key in Witylogix matches Stripe dashboard. Verify URL is HTTPS.",
          },
        ],
        shopify: [
          {
            issue: "OAuth consent screen rejected",
            solution:
              "Ensure your Shopify account has admin access. Try again in an incognito window. Check that app scopes match your store needs.",
          },
          {
            issue: "Rate limit (429) errors",
            solution:
              "Implement exponential backoff retry logic. Shopify allows 2 requests/second. Check for bulk operations that count as multiple API calls.",
          },
        ],
        samsara: [
          {
            issue: "No vehicles or drivers appearing",
            solution:
              'Ensure devices are powered on and connected to network. Check that your Samsara account has "API" user role enabled. Verify organization is active.',
          },
          {
            issue: "GPS data is delayed or stale",
            solution:
              "GPS data updates every 5-30 seconds depending on vehicle state. Check device connectivity. Ensure telematics hardware is properly installed.",
          },
        ],
        twilio: [
          {
            issue: "SMS delivery failures (undelivered status)",
            solution:
              "Verify phone number format is correct (E.164 format). Check account balance. Ensure number is not on DNC list. Some carriers may block shortcodes.",
          },
          {
            issue: "High latency on SMS sends",
            solution:
              "Queue messages asynchronously instead of synchronous sends. Use Twilio messaging queue services. Consider time of day when sending.",
          },
        ],
      };

    return (
      commonIssues[providerId] ?? [
        {
          issue: "General connection error",
          solution:
            "Verify credentials are correct. Check that your account has API access enabled. Review provider documentation for any account requirements.",
        },
      ]
    );
  }

  /**
   * Update current step index
   */
  private updateCurrentStep(wizardState: SetupWizardState): void {
    for (let i = 0; i < wizardState.steps.length; i++) {
      if (
        !wizardState.completedSteps.has(i) &&
        !wizardState.skippedSteps.has(i)
      ) {
        wizardState.currentStepIndex = i;
        return;
      }
    }
    // All steps completed or skipped
    wizardState.currentStepIndex = wizardState.steps.length;
    wizardState.completedAt = new Date();
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────
