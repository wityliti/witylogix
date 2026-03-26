/**
 * Onboarding Completion Predictor
 *
 * Predicts whether a user will complete onboarding based on behavior patterns.
 *
 * Uses rule-based scoring (not ML) with risk factors:
 * - Time spent on each step
 * - Step skipping behavior
 * - Backward navigation patterns
 * - Interaction velocity
 *
 * Suggests interventions to prevent drop-off.
 */

import {
  CompletionPrediction,
  RiskFactor,
  InterventionSuggestion,
} from "./types";

/**
 * User session data for prediction.
 */
interface UserSessionData {
  userId: string;
  currentStep: string;
  timeSpentMinutes: number;
  totalInteractions: number;
  stepsCompleted: string[];
  stepsSkipped: string[];
  backwardNavigations: number;
  lastActivityMinutesAgo: number;
  formErrors: number;
  integrationSelectionCount: number;
}

/**
 * Predict whether a user will complete onboarding.
 *
 * @param session - User session data
 * @returns Completion prediction with risk analysis
 */
export function predictCompletion(session: UserSessionData): CompletionPrediction {
  const riskFactors: RiskFactor[] = [];
  let riskScore = 0;

  // Factor 1: Time spent on current step
  if (session.timeSpentMinutes > 15) {
    const severity = session.timeSpentMinutes > 30 ? "high" : "medium";
    riskFactors.push({
      name: "High Time on Step",
      severity,
      description: `User has spent ${Math.round(session.timeSpentMinutes)} minutes on ${session.currentStep}`,
      weight: severity === "high" ? 0.25 : 0.15,
    });
    riskScore += severity === "high" ? 0.25 : 0.15;
  }

  // Factor 2: Step skipping behavior
  if (session.stepsSkipped.length > 2) {
    riskFactors.push({
      name: "Skipping Steps",
      severity: "medium",
      description: `User skipped ${session.stepsSkipped.length} steps (${session.stepsSkipped.join(", ")})`,
      weight: 0.2,
    });
    riskScore += 0.2;
  }

  // Factor 3: Backward navigation pattern
  if (session.backwardNavigations > 3) {
    riskFactors.push({
      name: "Backward Navigation",
      severity: "medium",
      description: `User went back ${session.backwardNavigations} times, indicating uncertainty`,
      weight: 0.15,
    });
    riskScore += 0.15;
  }

  // Factor 4: Low interaction velocity
  if (session.totalInteractions < 5 && session.stepsCompleted.length > 1) {
    riskFactors.push({
      name: "Low Engagement",
      severity: "low",
      description: "User has few interactions relative to progress",
      weight: 0.1,
    });
    riskScore += 0.1;
  }

  // Factor 5: Form errors
  if (session.formErrors > 3) {
    riskFactors.push({
      name: "Form Validation Issues",
      severity: "medium",
      description: `User encountered ${session.formErrors} form validation errors`,
      weight: 0.15,
    });
    riskScore += 0.15;
  }

  // Factor 6: Inactivity
  if (session.lastActivityMinutesAgo > 30) {
    const severity = session.lastActivityMinutesAgo > 120 ? "high" : "medium";
    riskFactors.push({
      name: "User Inactivity",
      severity,
      description: `No activity for ${session.lastActivityMinutesAgo} minutes`,
      weight: severity === "high" ? 0.2 : 0.1,
    });
    riskScore += severity === "high" ? 0.2 : 0.1;
  }

  // Factor 7: No integration selection yet (if on integration step)
  if (
    session.currentStep === "INTEGRATION_SETUP" &&
    session.integrationSelectionCount === 0
  ) {
    riskFactors.push({
      name: "No Integrations Selected",
      severity: "low",
      description: "User is on integration step but hasn't selected any",
      weight: 0.1,
    });
    riskScore += 0.1;
  }

  // Clamp risk score to 0-1
  riskScore = Math.min(1, riskScore);

  // Determine drop-off risk level
  let dropOffRisk: "low" | "medium" | "high" = "low";
  if (riskScore > 0.6) {
    dropOffRisk = "high";
  } else if (riskScore > 0.3) {
    dropOffRisk = "medium";
  }

  // Calculate confidence based on data completeness
  const confidence = Math.min(0.95, 0.5 + session.stepsCompleted.length * 0.1);

  // Determine if user will complete (inverse of risk)
  const willComplete = riskScore < 0.5;

  // Suggest interventions based on risk factors
  const intervention = getInterventionSuggestion(session, riskFactors, riskScore);

  return {
    willComplete,
    dropOffRisk,
    riskScore,
    suggestedIntervention: intervention,
    factors: riskFactors,
    confidence,
  };
}

/**
 * Get suggested intervention based on risk profile.
 */
function getInterventionSuggestion(
  session: UserSessionData,
  riskFactors: RiskFactor[],
  riskScore: number,
): InterventionSuggestion | null {
  // No intervention for low risk
  if (riskScore < 0.3) {
    return null;
  }

  // Check for high time on step
  if (
    riskFactors.some(
      (f) =>
        f.name === "High Time on Step" &&
        (f.severity === "high" || f.severity === "medium"),
    )
  ) {
    return {
      type: "tooltip",
      message: `Need help with ${session.currentStep}? Click here for a tutorial.`,
      actionUrl: `/help/${session.currentStep.toLowerCase()}`,
      priority: "high",
    };
  }

  // Check for form validation issues
  if (riskFactors.some((f) => f.name === "Form Validation Issues")) {
    return {
      type: "tooltip",
      message: "Having trouble with this form? Let us simplify it for you.",
      actionUrl: "/support/chat",
      priority: "high",
    };
  }

  // Check for backward navigation
  if (
    riskFactors.some(
      (f) => f.name === "Backward Navigation" && f.severity !== "low",
    )
  ) {
    return {
      type: "simplify_step",
      message:
        "We've simplified this step based on what you're doing. Try again?",
      priority: "medium",
    };
  }

  // Check for step skipping
  if (riskFactors.some((f) => f.name === "Skipping Steps")) {
    return {
      type: "skip_optional",
      message:
        "Skip optional steps and complete essentials first. You can add more later.",
      priority: "medium",
    };
  }

  // Check for inactivity
  if (riskFactors.some((f) => f.name === "User Inactivity")) {
    return {
      type: "email_reminder",
      message: "We noticed you paused. Ready to continue where you left off?",
      priority: "high",
    };
  }

  return null;
}

/**
 * Detailed risk assessment with step-by-step guidance.
 */
export function getRiskAssessment(session: UserSessionData): {
  overallRisk: string;
  nextStepDifficulty: "easy" | "moderate" | "hard";
  recommendedPath: string;
  estimatedTimeToComplete: number;
} {
  const prediction = predictCompletion(session);

  let nextStepDifficulty: "easy" | "moderate" | "hard" = "moderate";
  const remainingSteps = getExpectedRemainingSteps(session.currentStep);

  // Estimate difficulty of next step
  if (
    ["EMAIL_VERIFICATION", "BASIC_INFO"].includes(
      remainingSteps[0] ?? "",
    )
  ) {
    nextStepDifficulty = "easy";
  } else if (
    ["INTEGRATION_SETUP"].includes(remainingSteps[0] ?? "")
  ) {
    nextStepDifficulty = "hard";
  }

  // Estimate time to complete
  const remainingTime = remainingSteps.length * 5 + 10; // 5 min per step + 10 min buffer

  return {
    overallRisk: prediction.dropOffRisk,
    nextStepDifficulty,
    recommendedPath: buildRecommendedPath(session),
    estimatedTimeToComplete: remainingTime,
  };
}

/**
 * Get expected remaining steps based on current step.
 */
function getExpectedRemainingSteps(currentStep: string): string[] {
  const steps = [
    "EMAIL_VERIFICATION",
    "BASIC_INFO",
    "WORKSPACE_CONFIG",
    "INTEGRATION_SETUP",
    "TEAM_SETUP",
    "COMPLETION",
  ];

  const currentIndex = steps.indexOf(currentStep);
  return currentIndex >= 0 ? steps.slice(currentIndex + 1) : [];
}

/**
 * Build recommended onboarding path based on behavior.
 */
function buildRecommendedPath(session: UserSessionData): string {
  if (
    session.backwardNavigations > 5 ||
    session.formErrors > 5
  ) {
    return "Simplified path: skip optional steps";
  }

  if (session.timeSpentMinutes > 20) {
    return "Fast-track path: auto-complete with defaults";
  }

  if (session.stepsSkipped.length > 3) {
    return "Essential-only path: focus on required steps";
  }

  return "Standard path: complete all steps for best setup";
}

/**
 * Should we suggest a human intervention (support call)?
 */
export function shouldOfferSupport(session: UserSessionData): boolean {
  const prediction = predictCompletion(session);

  // Offer support if:
  // - High risk and multiple errors
  // - Long time spent + high error rate
  // - Multiple inactivity periods

  return (
    prediction.riskScore > 0.7 ||
    (session.formErrors > 5 && session.timeSpentMinutes > 30) ||
    session.backwardNavigations > 8
  );
}

/**
 * Simulate user completion probability over time.
 *
 * Returns predicted completion time in minutes from now.
 */
export function estimateCompletionTime(session: UserSessionData): number {
  const remainingSteps = getExpectedRemainingSteps(session.currentStep);
  const prediction = predictCompletion(session);

  // Base time: 5 minutes per remaining step
  let estimatedMinutes = remainingSteps.length * 5;

  // Risk adjustments
  if (prediction.riskScore > 0.7) {
    // User might abandon — add buffer
    return -1; // Predict abandonment
  }

  if (prediction.riskScore > 0.5) {
    // High risk — might take longer
    estimatedMinutes += 10;
  } else if (prediction.riskScore < 0.2) {
    // Low risk — might be faster
    estimatedMinutes = Math.max(5, estimatedMinutes - 5);
  }

  return estimatedMinutes;
}

/**
 * Get completion prediction for cohort analysis.
 */
export function getCohortCompletionPrediction(
  sessions: UserSessionData[],
): {
  predictedCompletionRate: number;
  avgRiskScore: number;
  riskDistribution: Record<"low" | "medium" | "high", number>;
} {
  const predictions = sessions.map((session) => predictCompletion(session));

  const completedCount = predictions.filter((p) => p.willComplete).length;
  const predictedCompletionRate =
    sessions.length > 0 ? completedCount / sessions.length : 0;

  const avgRiskScore =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.riskScore, 0) /
        predictions.length
      : 0;

  const distribution = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const prediction of predictions) {
    distribution[prediction.dropOffRisk] += 1;
  }

  return {
    predictedCompletionRate,
    avgRiskScore,
    riskDistribution: {
      low: (distribution.low / sessions.length) * 100,
      medium: (distribution.medium / sessions.length) * 100,
      high: (distribution.high / sessions.length) * 100,
    },
  };
}
