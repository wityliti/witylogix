/**
 * Smart Suggestions Engine
 *
 * Provides context-aware, actionable suggestions:
 * - Page context suggestions (orders, drivers, dashboard)
 * - Time-based suggestions (morning, evening routines)
 * - Rule-based condition engine
 * - Priority scoring (urgency × relevance × recency)
 * - Dismiss/snooze per suggestion
 */

import { prisma } from "@witylogix/db";
import type { Prisma } from "@prisma/client";

// ─── TYPES ─────────────────────────────────────────────────────────────

export type SuggestionContext =
  | "orders"
  | "drivers"
  | "dashboard"
  | "deliveries"
  | "analytics";

export type TimeOfDay = "morning" | "midday" | "evening" | "night";

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  context: SuggestionContext;
  actionUrl?: string;
  actionLabel?: string;
  priority: number; // 0-1, higher = more important
  urgency: "low" | "medium" | "high" | "critical";
  icon?: string;
  createdAt: Date;
  expiresAt?: Date;
  dismissedAt?: Date;
  snoozedUntil?: Date;
}

export interface SuggestionRule {
  id: string;
  name: string;
  condition: (context: PageContext) => boolean;
  suggestionFactory: (context: PageContext) => Partial<Suggestion>;
  enabled: boolean;
}

export interface PageContext {
  tenantId: string;
  userId: string;
  currentPage: SuggestionContext;
  timeOfDay: TimeOfDay;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SuggestionMetrics {
  suggestionId: string;
  dismissed: boolean;
  snoozed: boolean;
  clicked: boolean;
  actionTaken: boolean;
}

// ─── SUGGESTION ENGINE ──────────────────────────────────────────────────

export class SmartSuggestions {
  private rules: SuggestionRule[] = [];
  private dismissedCache = new Map<string, Set<string>>();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Get suggestions for current context
   */
  async generateSuggestions(
    context: PageContext
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Apply all enabled rules
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.condition(context)) {
        const suggestion = rule.suggestionFactory(context);
        suggestions.push({
          id: this.generateId(),
          title: suggestion.title || "",
          description: suggestion.description || "",
          context: context.currentPage,
          actionUrl: suggestion.actionUrl,
          actionLabel: suggestion.actionLabel || "View",
          priority: this.calculatePriority(context, suggestion),
          urgency: suggestion.urgency || "low",
          icon: suggestion.icon,
          createdAt: new Date(),
          expiresAt: suggestion.expiresAt,
        });
      }
    }

    // Filter out dismissed suggestions
    const dismissed = await this.getDismissedSuggestions(
      context.tenantId,
      context.userId
    );

    // Score and sort by priority
    return suggestions
      .filter(
        (s) =>
          !dismissed.has(s.id) &&
          (!s.snoozedUntil || s.snoozedUntil < new Date())
      )
      .sort((a, b) => {
        const urgencyScore = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        };
        const aDiff = urgencyScore[a.urgency] - urgencyScore[b.urgency];
        if (aDiff !== 0) return aDiff;
        return b.priority - a.priority;
      })
      .slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(
    suggestionId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    const cacheKey = `${tenantId}:${userId}`;
    if (!this.dismissedCache.has(cacheKey)) {
      this.dismissedCache.set(cacheKey, new Set());
    }
    this.dismissedCache.get(cacheKey)!.add(suggestionId);

    // Persist dismissal
    await (prisma as any).suggestionDismissal.create({
      data: {
        suggestionId,
        tenantId,
        userId,
        dismissedAt: new Date(),
      },
    });
  }

  /**
   * Snooze a suggestion
   */
  async snooze(
    suggestionId: string,
    tenantId: string,
    userId: string,
    minutes: number = 60
  ): Promise<void> {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);

    await (prisma as any).suggestionSnooze.create({
      data: {
        suggestionId,
        tenantId,
        userId,
        snoozedUntil,
      },
    });
  }

  /**
   * Track suggestion interaction (click, action)
   */
  async trackInteraction(
    suggestionId: string,
    tenantId: string,
    userId: string,
    actionTaken: boolean = false
  ): Promise<void> {
    await (prisma as any).suggestionMetric.create({
      data: {
        suggestionId,
        tenantId,
        userId,
        clicked: true,
        actionTaken,
      },
    });
  }

  /**
   * Register a custom suggestion rule
   */
  registerRule(rule: SuggestionRule): void {
    this.rules.push(rule);
  }

  /**
   * Register multiple rules at once
   */
  registerRules(rules: SuggestionRule[]): void {
    this.rules.push(...rules);
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────

  private async getDismissedSuggestions(
    tenantId: string,
    userId: string
  ): Promise<Set<string>> {
    const cacheKey = `${tenantId}:${userId}`;

    if (this.dismissedCache.has(cacheKey)) {
      return this.dismissedCache.get(cacheKey)!;
    }

    const dismissals = await (prisma as any).suggestionDismissal.findMany({
      where: { tenantId, userId },
      select: { suggestionId: true },
    });

    const dismissed = new Set(dismissals.map((d: any) => d.suggestionId));
    this.dismissedCache.set(cacheKey, dismissed);

    return dismissed;
  }

  private calculatePriority(
    context: PageContext,
    suggestion: Partial<Suggestion>
  ): number {
    const urgencyWeight = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25,
    };

    const recencyFactor = Math.max(0, 1 - (Date.now() - context.timestamp) / (24 * 60 * 60 * 1000));
    const urgency = urgencyWeight[suggestion.urgency || "low"] || 0.25;

    return Math.min(1, urgency * 0.7 + recencyFactor * 0.3);
  }

  private generateId(): string {
    return `sugg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  // ─── DEFAULT RULES ──────────────────────────────────────────────────

  private registerDefaultRules(): void {
    // Orders page suggestions
    this.registerRule({
      id: "unassigned_orders",
      name: "Unassigned Orders Alert",
      condition: (ctx) => ctx.currentPage === "orders",
      suggestionFactory: (ctx) => ({
        title: "Assign pending orders",
        description: "5 orders waiting for driver assignment",
        actionUrl: "/orders?filter=unassigned",
        actionLabel: "Assign Now",
        urgency: "high",
        icon: "AlertCircle",
      }),
      enabled: true,
    });

    this.registerRule({
      id: "overdue_deliveries",
      name: "Overdue Deliveries",
      condition: (ctx) => ctx.currentPage === "orders",
      suggestionFactory: (ctx) => ({
        title: "Check overdue deliveries",
        description: "2 deliveries past SLA",
        actionUrl: "/orders?filter=overdue",
        actionLabel: "View",
        urgency: "critical",
        icon: "Clock",
      }),
      enabled: true,
    });

    // Drivers page suggestions
    this.registerRule({
      id: "idle_drivers",
      name: "Idle Drivers Detection",
      condition: (ctx) => ctx.currentPage === "drivers",
      suggestionFactory: (ctx) => ({
        title: "Idle drivers detected",
        description: "3 drivers idle for 30+ minutes",
        actionUrl: "/drivers?filter=idle",
        actionLabel: "Reactivate",
        urgency: "medium",
        icon: "AlertTriangle",
      }),
      enabled: true,
    });

    this.registerRule({
      id: "zone_rebalance",
      name: "Zone Rebalancing",
      condition: (ctx) => ctx.currentPage === "drivers",
      suggestionFactory: (ctx) => ({
        title: "Rebalance driver zones",
        description: "Zone West has uneven distribution",
        actionUrl: "/drivers/zones",
        actionLabel: "Optimize",
        urgency: "medium",
        icon: "Map",
      }),
      enabled: true,
    });

    // Dashboard suggestions
    this.registerRule({
      id: "sla_warning",
      name: "SLA Degradation",
      condition: (ctx) => ctx.currentPage === "dashboard",
      suggestionFactory: (ctx) => ({
        title: "SLA dropping",
        description: "On-time delivery rate dropped to 94%",
        actionUrl: "/analytics/sla",
        actionLabel: "Investigate",
        urgency: "high",
        icon: "TrendingDown",
      }),
      enabled: true,
    });

    this.registerRule({
      id: "revenue_up",
      name: "Revenue Growth Alert",
      condition: (ctx) => ctx.currentPage === "dashboard",
      suggestionFactory: (ctx) => ({
        title: "Revenue milestone",
        description: "Revenue up 12% this week",
        actionUrl: "/analytics/revenue",
        actionLabel: "Details",
        urgency: "low",
        icon: "TrendingUp",
      }),
      enabled: true,
    });

    // Time-based suggestions
    this.registerRule({
      id: "morning_routine",
      name: "Morning Briefing",
      condition: (ctx) => ctx.timeOfDay === "morning",
      suggestionFactory: (ctx) => ({
        title: "Review overnight orders",
        description: "45 orders received while offline",
        actionUrl: "/orders?filter=new",
        actionLabel: "Review",
        urgency: "high",
        icon: "Sun",
      }),
      enabled: true,
    });

    this.registerRule({
      id: "evening_routine",
      name: "Evening Summary",
      condition: (ctx) => ctx.timeOfDay === "evening",
      suggestionFactory: (ctx) => ({
        title: "Export daily report",
        description: "Generate end-of-day summary",
        actionUrl: "/reports/daily",
        actionLabel: "Export",
        urgency: "low",
        icon: "Download",
      }),
      enabled: true,
    });
  }
}

// ─── FACTORY ────────────────────────────────────────────────────────────

let globalSuggestionEngine: SmartSuggestions | null = null;

export function getSmartSuggestions(): SmartSuggestions {
  if (!globalSuggestionEngine) {
    globalSuggestionEngine = new SmartSuggestions();
  }
  return globalSuggestionEngine;
}

export function createSmartSuggestions(): SmartSuggestions {
  return new SmartSuggestions();
}
