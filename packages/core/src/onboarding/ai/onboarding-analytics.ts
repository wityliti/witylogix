/**
 * Onboarding Analytics Engine
 *
 * Tracks and analyzes onboarding flow to identify:
 * - Drop-off points where users abandon
 * - Step completion rates and time spent
 * - Popular integrations and goals
 * - Conversion funnel metrics
 * - Cohort analysis
 *
 * In-memory store for development; production would use analytics backend.
 */

import {
  OnboardingAnalyticsEvent,
  OnboardingAnalyticsEventType,
  StepCompletionMetrics,
  ConversionFunnelStep,
  PopularSelection,
} from "./types";

/**
 * In-memory analytics store.
 * In production, would be replaced with backend analytics service.
 */
class AnalyticsStore {
  private events: OnboardingAnalyticsEvent[] = [];
  private sessionData: Map<string, { startedAt: Date; userId: string; orgId?: string }> =
    new Map();

  addEvent(event: OnboardingAnalyticsEvent): void {
    this.events.push(event);

    // Track session
    if (!this.sessionData.has(event.sessionId)) {
      this.sessionData.set(event.sessionId, {
        startedAt: event.timestamp,
        userId: event.userId,
        orgId: event.orgId,
      });
    }
  }

  getEvents(): OnboardingAnalyticsEvent[] {
    return this.events;
  }

  getEventsByUser(userId: string): OnboardingAnalyticsEvent[] {
    return this.events.filter((e) => e.userId === userId);
  }

  getEventsBySession(sessionId: string): OnboardingAnalyticsEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  getEventsByType(type: OnboardingAnalyticsEventType): OnboardingAnalyticsEvent[] {
    return this.events.filter((e) => e.eventType === type);
  }

  getEventsByStep(step: string): OnboardingAnalyticsEvent[] {
    return this.events.filter((e) => e.step === step);
  }

  clear(): void {
    this.events = [];
    this.sessionData.clear();
  }
}

// Singleton instance
const store = new AnalyticsStore();

/**
 * Track an analytics event during onboarding.
 *
 * @param event - The event to track
 */
export function trackEvent(event: OnboardingAnalyticsEvent): void {
  store.addEvent(event);
}

/**
 * Get step completion metrics.
 *
 * @returns Completion metrics for each step
 */
export function getStepCompletionRates(): StepCompletionMetrics[] {
  const startedEvents = store.getEventsByType(OnboardingAnalyticsEventType.STEP_STARTED);
  const completedEvents = store.getEventsByType(OnboardingAnalyticsEventType.STEP_COMPLETED);

  const stepMetrics = new Map<string, StepCompletionMetrics>();

  // Process started events
  for (const event of startedEvents) {
    if (!stepMetrics.has(event.step)) {
      stepMetrics.set(event.step, {
        step: event.step,
        totalStarted: 0,
        totalCompleted: 0,
        completionRate: 0,
        averageTimeMinutes: 0,
        medianTimeMinutes: 0,
        abandonmentRate: 0,
      });
    }

    const metric = stepMetrics.get(event.step)!;
    metric.totalStarted += 1;
  }

  // Process completed events
  for (const event of completedEvents) {
    if (!stepMetrics.has(event.step)) {
      stepMetrics.set(event.step, {
        step: event.step,
        totalStarted: 0,
        totalCompleted: 0,
        completionRate: 0,
        averageTimeMinutes: 0,
        medianTimeMinutes: 0,
        abandonmentRate: 0,
      });
    }

    const metric = stepMetrics.get(event.step)!;
    metric.totalCompleted += 1;
  }

  // Calculate metrics
  for (const metric of stepMetrics.values()) {
    metric.completionRate =
      metric.totalStarted > 0 ? metric.totalCompleted / metric.totalStarted : 0;
    metric.abandonmentRate = 1 - metric.completionRate;

    // Calculate average time per step
    const stepStartEnd: Array<{ start: Date; end?: Date }> = [];
    const stepStartedBySession = new Map<string, Date>();

    for (const event of store.getEventsByStep(metric.step)) {
      if (event.eventType === OnboardingAnalyticsEventType.STEP_STARTED) {
        stepStartedBySession.set(event.sessionId, event.timestamp);
      } else if (event.eventType === OnboardingAnalyticsEventType.STEP_COMPLETED) {
        const startTime = stepStartedBySession.get(event.sessionId);
        if (startTime) {
          stepStartEnd.push({ start: startTime, end: event.timestamp });
          stepStartedBySession.delete(event.sessionId);
        }
      }
    }

    if (stepStartEnd.length > 0) {
      const times = stepStartEnd.map(
        (se) => (se.end?.getTime() ?? 0 - se.start.getTime()) / 1000 / 60,
      );
      metric.averageTimeMinutes = times.reduce((a, b) => a + b, 0) / times.length;
      metric.medianTimeMinutes = times.sort((a, b) => a - b)[
        Math.floor(times.length / 2)
      ];
    }
  }

  return Array.from(stepMetrics.values());
}

/**
 * Get average time spent per step.
 *
 * @returns Map of step to average time in minutes
 */
export function getAverageTimePerStep(): Map<string, number> {
  const metrics = getStepCompletionRates();
  const timeMap = new Map<string, number>();

  for (const metric of metrics) {
    timeMap.set(metric.step, metric.averageTimeMinutes);
  }

  return timeMap;
}

/**
 * Identify drop-off points where users abandon onboarding.
 *
 * @returns Steps with highest abandonment rates, ordered by severity
 */
export function getDropOffPoints(): Array<{
  step: string;
  abandonmentRate: number;
  userCount: number;
  suggestedImprovements: string[];
}> {
  const metrics = getStepCompletionRates();
  const dropOffs = metrics
    .filter((m) => m.abandonmentRate > 0)
    .map((m) => ({
      step: m.step,
      abandonmentRate: m.abandonmentRate,
      userCount: m.totalStarted,
      suggestedImprovements: getImprovementSuggestions(m.step, m.averageTimeMinutes),
    }))
    .sort((a, b) => b.abandonmentRate - a.abandonmentRate);

  return dropOffs;
}

/**
 * Get improvement suggestions for a step with high abandonment.
 */
function getImprovementSuggestions(step: string, avgTime: number): string[] {
  const suggestions: string[] = [];

  if (avgTime > 20) {
    suggestions.push("Step takes too long — consider breaking into substeps or simplifying");
  }

  if (step === "INTEGRATION_SETUP") {
    suggestions.push("Provide pre-built templates for popular integrations");
    suggestions.push("Allow skipping integrations to complete onboarding");
    suggestions.push("Show more detailed error messages");
  }

  if (step === "TEAM_SETUP") {
    suggestions.push("Make team setup optional — users can skip and add later");
    suggestions.push("Simplify to single-step invite");
  }

  if (step === "WORKSPACE_CONFIG") {
    suggestions.push("Use smart defaults based on industry");
    suggestions.push("Provide tooltips for each configuration option");
  }

  return suggestions;
}

/**
 * Get most popular integrations selected during onboarding.
 *
 * @param limit - Maximum results to return
 * @returns Popular integrations ranked by selection count
 */
export function getPopularIntegrations(limit: number = 10): PopularSelection[] {
  const toggleEvents = store.getEventsByType(
    OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
  );

  const integrations = new Map<string, number>();

  for (const event of toggleEvents) {
    const slug = event.data?.slug as string | undefined;
    if (slug) {
      integrations.set(slug, (integrations.get(slug) ?? 0) + 1);
    }
  }

  const totalSelections = toggleEvents.length;
  const sorted = Array.from(integrations.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalSelections > 0 ? (count / totalSelections) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return sorted;
}

/**
 * Get most popular goals selected during onboarding.
 *
 * @param limit - Maximum results to return
 * @returns Popular goals ranked by selection count
 */
export function getPopularGoals(limit: number = 10): PopularSelection[] {
  const goalEvents = store.getEventsByType(OnboardingAnalyticsEventType.GOAL_SELECTED);

  const goals = new Map<string, number>();

  for (const event of goalEvents) {
    const goal = event.data?.goal as string | undefined;
    if (goal) {
      goals.set(goal, (goals.get(goal) ?? 0) + 1);
    }
  }

  const totalSelections = goalEvents.length;
  const sorted = Array.from(goals.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalSelections > 0 ? (count / totalSelections) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return sorted;
}

/**
 * Get conversion funnel — progression through onboarding steps.
 *
 * @returns Funnel steps with conversion rates
 */
export function getConversionFunnel(): ConversionFunnelStep[] {
  const steps = [
    "EMAIL_VERIFICATION",
    "BASIC_INFO",
    "WORKSPACE_CONFIG",
    "INTEGRATION_SETUP",
    "TEAM_SETUP",
    "COMPLETION",
  ];

  const funnelSteps: ConversionFunnelStep[] = [];
  const startedByStep = new Map<string, Set<string>>();
  const completedByStep = new Map<string, Set<string>>();

  // Count unique users per step
  for (const event of store.getEvents()) {
    if (event.eventType === OnboardingAnalyticsEventType.STEP_STARTED) {
      if (!startedByStep.has(event.step)) {
        startedByStep.set(event.step, new Set());
      }
      startedByStep.get(event.step)?.add(event.userId);
    } else if (event.eventType === OnboardingAnalyticsEventType.STEP_COMPLETED) {
      if (!completedByStep.has(event.step)) {
        completedByStep.set(event.step, new Set());
      }
      completedByStep.get(event.step)?.add(event.userId);
    }
  }

  // Build funnel
  let previousStepUsers = 0;

  for (const step of steps) {
    const usersReached = startedByStep.get(step)?.size ?? 0;
    const usersCompleted = completedByStep.get(step)?.size ?? 0;

    let conversionRate = 0;
    if (previousStepUsers > 0) {
      conversionRate = usersReached / previousStepUsers;
    }

    funnelSteps.push({
      step,
      usersReached,
      usersCompleted,
      conversionRate,
      dropOffPercentage: usersReached > 0 ? 1 - usersCompleted / usersReached : 0,
    });

    previousStepUsers = usersCompleted;
  }

  return funnelSteps;
}

/**
 * Get cohort analysis by industry.
 *
 * @returns Analytics grouped by industry
 */
export function getCohortAnalysisByIndustry(): Record<
  string,
  { completionRate: number; averageTimeMinutes: number }
> {
  const byIndustry = new Map<
    string,
    { started: number; completed: number; totalTime: number; timeCount: number }
  >();

  for (const event of store.getEvents()) {
    const industry = event.data?.industry as string | undefined;
    if (!industry) continue;

    if (!byIndustry.has(industry)) {
      byIndustry.set(industry, {
        started: 0,
        completed: 0,
        totalTime: 0,
        timeCount: 0,
      });
    }

    const cohort = byIndustry.get(industry)!;

    if (event.eventType === OnboardingAnalyticsEventType.STEP_STARTED) {
      cohort.started += 1;
    } else if (event.eventType === OnboardingAnalyticsEventType.STEP_COMPLETED) {
      cohort.completed += 1;
    }
  }

  const result: Record<
    string,
    { completionRate: number; averageTimeMinutes: number }
  > = {};

  for (const [industry, data] of byIndustry.entries()) {
    result[industry] = {
      completionRate: data.started > 0 ? data.completed / data.started : 0,
      averageTimeMinutes:
        data.timeCount > 0 ? data.totalTime / data.timeCount : 0,
    };
  }

  return result;
}

/**
 * Export analytics data as JSON.
 *
 * @returns Complete analytics snapshot
 */
export function exportAnalyticsJSON(): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    completionRates: getStepCompletionRates(),
    dropOffPoints: getDropOffPoints(),
    popularIntegrations: getPopularIntegrations(),
    popularGoals: getPopularGoals(),
    conversionFunnel: getConversionFunnel(),
    cohortAnalysis: getCohortAnalysisByIndustry(),
    totalEvents: store.getEvents().length,
  };
}

/**
 * Export analytics as CSV format.
 *
 * @returns CSV string
 */
export function exportAnalyticsCSV(): string {
  const completionRates = getStepCompletionRates();

  let csv = "Step,Total Started,Total Completed,Completion Rate,Avg Time (min),Abandonment Rate\n";

  for (const metric of completionRates) {
    csv += `"${metric.step}",${metric.totalStarted},${metric.totalCompleted},${metric.completionRate.toFixed(2)},${metric.averageTimeMinutes.toFixed(1)},${metric.abandonmentRate.toFixed(2)}\n`;
  }

  return csv;
}

/**
 * Clear all analytics data (for testing).
 */
export function clearAnalytics(): void {
  store.clear();
}

/**
 * Get raw events (for debugging/testing).
 */
export function getAnalyticsEvents(): OnboardingAnalyticsEvent[] {
  return store.getEvents();
}

/**
 * Get summary statistics.
 */
export function getAnalyticsSummary(): {
  totalUsers: number;
  completionRate: number;
  averageTimeMinutes: number;
  totalEvents: number;
} {
  const allEvents = store.getEvents();
  const uniqueUsers = new Set(allEvents.map((e) => e.userId)).size;

  const completionEvents = store.getEventsByType(
    OnboardingAnalyticsEventType.ONBOARDING_COMPLETED,
  );
  const abandonmentEvents = store.getEventsByType(
    OnboardingAnalyticsEventType.ONBOARDING_ABANDONED,
  );

  const completionRate = (completionEvents.length + abandonmentEvents.length) > 0
    ? completionEvents.length / (completionEvents.length + abandonmentEvents.length)
    : 0;

  // Get average time across all sessions
  const sessionTimes = new Map<string, { start: Date; end: Date }>();

  for (const event of allEvents) {
    if (!sessionTimes.has(event.sessionId)) {
      sessionTimes.set(event.sessionId, { start: event.timestamp, end: event.timestamp });
    } else {
      const session = sessionTimes.get(event.sessionId)!;
      if (event.timestamp > session.end) {
        session.end = event.timestamp;
      }
    }
  }

  let totalMinutes = 0;
  for (const { start, end } of sessionTimes.values()) {
    totalMinutes += (end.getTime() - start.getTime()) / 1000 / 60;
  }

  const averageTimeMinutes = sessionTimes.size > 0 ? totalMinutes / sessionTimes.size : 0;

  return {
    totalUsers: uniqueUsers,
    completionRate,
    averageTimeMinutes,
    totalEvents: allEvents.length,
  };
}
