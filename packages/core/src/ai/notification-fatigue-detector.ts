/**
 * Notification Fatigue & Overload Detection
 *
 * Smart fatigue monitoring and engagement optimization:
 * - FatigueScorer: tracks notification volume per user per day/week, detects fatigue signals
 * - OverloadDetector: flags overload if user receives >N notifications in X hours
 * - ThrottleRecommender: suggests reducing frequency when fatigue detected
 * - ImportanceRanker: ranks pending notifications by importance (priority × relevance × timeliness)
 * - DigestOptimizer: suggests grouping low-priority notifications into optimal digest windows
 * - UnsubscribePrediction: predicts likelihood of unsubscribe based on engagement trajectory
 *
 * All scoring is transparent with explainable factors. No external ML libraries.
 */

import { type NotificationChannel, type NotificationCategory, type NotificationPriority } from "../notifications/notification-types.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

/**
 * Fatigue signal from user behavior
 */
export interface FatigueSignal {
  userId: string;
  signalType:
    | "DECREASING_OPEN_RATE"
    | "INCREASING_DISMISS_RATE"
    | "UNSUBSCRIBE_REQUEST"
    | "SPAM_COMPLAINT"
    | "HIGH_VOLUME_SPIKE";
  severity: number; // 0-100
  timestamp: Date;
  context: {
    metric: string;
    previousValue: number;
    currentValue: number;
    changePercent: number;
  };
}

/**
 * Fatigue score with contributing factors
 */
export interface FatigueScore {
  userId: string;
  overallFatigueScore: number; // 0-100, 0=no fatigue, 100=severe fatigue
  fatigueSeverity: "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE";

  factors: {
    dailyVolumeScore: number; // how many notifications today
    weeklyVolumeScore: number; // how many this week
    openRateTrendScore: number; // trending down = higher score
    dismissRateTrendScore: number; // trending up = higher score
    channelFatigueScores: Record<NotificationChannel, number>;
    categoryFatigueScores: Record<NotificationCategory, number>;
  };

  metrics: {
    notificationsToday: number;
    notificationsThisWeek: number;
    averageOpenRateLast7Days: number;
    averageDismissRateLast7Days: number;
    unsubscribeAttempts: number;
  };

  signals: FatigueSignal[];
  calculatedAt: Date;
}

/**
 * Throttle recommendation when fatigue is detected
 */
export interface ThrottleRecommendation {
  userId: string;
  shouldThrottle: boolean;
  recommendedReduction: number; // 0-100, % reduction in frequency
  throttleWindow: {
    startAt: Date;
    endAt: Date;
    durationHours: number;
  };

  // What to throttle
  categoriesAffected: NotificationCategory[];
  channelsAffected: NotificationChannel[];
  priorityThreshold: NotificationPriority; // only send >= this priority

  reasoning: {
    primaryCause: string;
    currentFatigueScore: number;
    estimatedRecoveryHours: number;
    impact: {
      expectedOpenRateImprovement: number; // % points
      expectedEngagementImprovement: number;
    };
  };

  calculatedAt: Date;
}

/**
 * Importance score for a pending notification
 */
export interface ImportanceScore {
  notificationId: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;

  // Final composite importance (0-100)
  importanceScore: number;

  // Contributing factors
  factors: {
    priorityFactor: number; // 0-40 based on priority level
    relevanceFactor: number; // 0-30 based on category + user history
    timelinesseFactor: number; // 0-20 based on urgency/expiration
    userAffinityFactor: number; // 0-10 based on engagement with category
  };

  calculatedAt: Date;
}

/**
 * Optimal digest window for batching notifications
 */
export interface DigestWindow {
  userId: string;
  windowId: string;
  startTime: Date;
  endTime: Date;
  frequency: "HOURLY" | "DAILY" | "WEEKLY";
  recommendedDeliveryTime: Date; // when to send the digest
  timezone: string;

  expectedNotificationCount: number;
  averageImportanceScore: number;

  reasoning: {
    rationale: string;
    userEngagementPattern: string;
    expectedOpenRate: number;
  };

  calculatedAt: Date;
}

/**
 * Unsubscribe prediction
 */
export interface UnsubscribePrediction {
  userId: string;
  unsubscribeLikelihood: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  daysUntilLikelyUnsubscribe: number | null; // null if low risk

  // Contributing factors
  factors: {
    currentFatigueScore: number;
    openRateTrend: number; // negative = declining
    dismissRateTrend: number; // positive = increasing
    recentComplaintsCount: number;
    channelsAtRisk: Array<{
      channel: NotificationChannel;
      riskScore: number;
    }>;
  };

  // Recommended actions
  recommendedActions: Array<{
    action: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;

  calculatedAt: Date;
}

// ─── FATIGUE SCORER ───────────────────────────────────────────────────────

export class FatigueScorer {
  private dailyNotifications: Map<string, { count: number; date: Date }> = new Map();
  private dismissRates: Map<string, number[]> = new Map(); // rolling 7-day dismiss rates
  private openRates: Map<string, number[]> = new Map(); // rolling 7-day open rates
  private channelFatigue: Map<string, Record<NotificationChannel, number>> = new Map();
  private categoryFatigue: Map<string, Record<NotificationCategory, number>> = new Map();
  private signals: Map<string, FatigueSignal[]> = new Map();

  recordNotificationSent(userId: string, channel: NotificationChannel, category: NotificationCategory): void {
    const today = new Date().toDateString();
    const key = `${userId}:${today}`;

    const current = this.dailyNotifications.get(key) ?? { count: 0, date: new Date() };
    current.count++;
    this.dailyNotifications.set(key, current);

    // Track channel fatigue
    if (!this.channelFatigue.has(userId)) {
      this.channelFatigue.set(userId, {} as any);
    }
    const chFatigue = this.channelFatigue.get(userId)!;
    chFatigue[channel] = (chFatigue[channel] ?? 0) + 0.1; // increment slightly

    // Track category fatigue
    if (!this.categoryFatigue.has(userId)) {
      this.categoryFatigue.set(userId, {} as any);
    }
    const catFatigue = this.categoryFatigue.get(userId)!;
    catFatigue[category] = (catFatigue[category] ?? 0) + 0.2;
  }

  recordNotificationOpened(userId: string): void {
    if (!this.openRates.has(userId)) {
      this.openRates.set(userId, []);
    }
    const rates = this.openRates.get(userId)!;
    rates.push(1);
    if (rates.length > 7) rates.shift(); // keep last 7 days

    // Decay fatigue slightly on successful engagement
    if (this.channelFatigue.has(userId)) {
      const chFatigue = this.channelFatigue.get(userId)!;
      for (const ch in chFatigue) {
        chFatigue[ch as NotificationChannel] *= 0.95; // slight decay
      }
    }
  }

  recordNotificationDismissed(userId: string): void {
    if (!this.dismissRates.has(userId)) {
      this.dismissRates.set(userId, []);
    }
    const rates = this.dismissRates.get(userId)!;
    rates.push(1);
    if (rates.length > 7) rates.shift();

    // Increase fatigue on dismiss
    if (this.channelFatigue.has(userId)) {
      const chFatigue = this.channelFatigue.get(userId)!;
      for (const ch in chFatigue) {
        chFatigue[ch as NotificationChannel] *= 1.1; // increase fatigue
      }
    }

    // Check for high dismiss rate signal
    const dismissRate = rates.length > 0 ? rates.reduce((a, b) => a + b) / rates.length : 0;
    if (dismissRate > 0.7) {
      this.addSignal(userId, "INCREASING_DISMISS_RATE", 75, {
        metric: "dismiss_rate",
        previousValue: 0.5,
        currentValue: dismissRate,
        changePercent: (dismissRate - 0.5) / 0.5 * 100,
      });
    }
  }

  recordUnsubscribeAttempt(userId: string): void {
    this.addSignal(userId, "UNSUBSCRIBE_REQUEST", 90, {
      metric: "unsubscribe_attempt",
      previousValue: 0,
      currentValue: 1,
      changePercent: 100,
    });
  }

  private addSignal(
    userId: string,
    type: FatigueSignal["signalType"],
    severity: number,
    context: FatigueSignal["context"]
  ): void {
    if (!this.signals.has(userId)) {
      this.signals.set(userId, []);
    }
    const userSignals = this.signals.get(userId)!;
    userSignals.push({
      userId,
      signalType: type,
      severity,
      timestamp: new Date(),
      context,
    });

    // Keep only last 30 signals
    if (userSignals.length > 30) {
      userSignals.shift();
    }
  }

  calculateFatigueScore(userId: string): FatigueScore {
    const today = new Date().toDateString();
    const dailyKey = `${userId}:${today}`;
    const notificationsToday = this.dailyNotifications.get(dailyKey)?.count ?? 0;

    // Weekly count (simplified: last 7 days)
    let weeklyCount = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `${userId}:${date.toDateString()}`;
      weeklyCount += this.dailyNotifications.get(key)?.count ?? 0;
    }

    // Calculate open and dismiss rates
    const openRates = this.openRates.get(userId) ?? [];
    const dismissRates = this.dismissRates.get(userId) ?? [];
    const avgOpenRate =
      openRates.length > 0 ? openRates.reduce((a, b) => a + b) / openRates.length : 0.7;
    const avgDismissRate =
      dismissRates.length > 0 ? dismissRates.reduce((a, b) => a + b) / dismissRates.length : 0;

    // Volume scores (0-50 each)
    const dailyVolumeScore = Math.min(50, (notificationsToday / 10) * 50);
    const weeklyVolumeScore = Math.min(50, (weeklyCount / 50) * 50);

    // Trend scores
    const openRateTrendScore = Math.max(0, (0.7 - avgOpenRate) * 100); // lower open rate = higher fatigue
    const dismissRateTrendScore = Math.min(50, avgDismissRate * 100); // higher dismiss = higher fatigue

    // Channel and category fatigue
    const chFatigue = this.channelFatigue.get(userId) ?? {};
    const catFatigue = this.categoryFatigue.get(userId) ?? {};

    // Normalize fatigue scores to 0-100
    const normChFatigue: Record<NotificationChannel, number> = {} as any;
    for (const ch in chFatigue) {
      normChFatigue[ch as NotificationChannel] = Math.min(100, (chFatigue[ch as NotificationChannel] ?? 0) * 10);
    }

    const normCatFatigue: Record<NotificationCategory, number> = {} as any;
    for (const cat in catFatigue) {
      normCatFatigue[cat as NotificationCategory] = Math.min(100, (catFatigue[cat as NotificationCategory] ?? 0) * 20);
    }

    // Overall fatigue score (weighted average)
    const avgChFatigue = Object.keys(normChFatigue).length > 0
      ? Object.values(normChFatigue).reduce((a, b) => a + b, 0) / Object.keys(normChFatigue).length
      : 0;

    // Scale volume scores to 0-100 range (from 0-50)
    const scaledDailyVolume = dailyVolumeScore * 2;
    const scaledWeeklyVolume = weeklyVolumeScore * 2;

    const overallFatigue = Math.min(
      100,
      scaledDailyVolume * 0.3 +
        scaledWeeklyVolume * 0.2 +
        openRateTrendScore * 0.15 +
        dismissRateTrendScore * 0.15 +
        avgChFatigue * 0.2
    );

    const severity =
      overallFatigue < 20 ? "NONE" : overallFatigue < 40 ? "LOW" : overallFatigue < 60 ? "MODERATE" : overallFatigue < 80 ? "HIGH" : "SEVERE";

    return {
      userId,
      overallFatigueScore: Math.round(overallFatigue),
      fatigueSeverity: severity,
      factors: {
        dailyVolumeScore,
        weeklyVolumeScore,
        openRateTrendScore,
        dismissRateTrendScore,
        channelFatigueScores: normChFatigue,
        categoryFatigueScores: normCatFatigue,
      },
      metrics: {
        notificationsToday,
        notificationsThisWeek: weeklyCount,
        averageOpenRateLast7Days: avgOpenRate,
        averageDismissRateLast7Days: avgDismissRate,
        unsubscribeAttempts: this.signals.get(userId)?.filter((s) => s.signalType === "UNSUBSCRIBE_REQUEST").length ?? 0,
      },
      signals: this.signals.get(userId) ?? [],
      calculatedAt: new Date(),
    };
  }
}

// ─── OVERLOAD DETECTOR ────────────────────────────────────────────────────

export class OverloadDetector {
  private notificationTimestamps: Map<string, Date[]> = new Map();

  recordNotification(userId: string): void {
    if (!this.notificationTimestamps.has(userId)) {
      this.notificationTimestamps.set(userId, []);
    }
    const timestamps = this.notificationTimestamps.get(userId)!;
    timestamps.push(new Date());

    // Keep only last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = timestamps.filter((t) => t > oneDayAgo);
    this.notificationTimestamps.set(userId, filtered);
  }

  isOverloaded(userId: string, thresholdCount: number = 20, thresholdHours: number = 1): boolean {
    const timestamps = this.notificationTimestamps.get(userId) ?? [];
    if (timestamps.length < thresholdCount) return false;

    const cutoffTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
    const recentCount = timestamps.filter((t) => t > cutoffTime).length;

    return recentCount >= thresholdCount;
  }

  getNotificationCountInWindow(userId: string, windowHours: number): number {
    const timestamps = this.notificationTimestamps.get(userId) ?? [];
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return timestamps.filter((t) => t > cutoffTime).length;
  }
}

// ─── THROTTLE RECOMMENDER ─────────────────────────────────────────────────

export class ThrottleRecommender {
  private fatigueScorer: FatigueScorer;

  constructor(fatigueScorer: FatigueScorer) {
    this.fatigueScorer = fatigueScorer;
  }

  recommendThrottle(userId: string): ThrottleRecommendation {
    const fatigueScore = this.fatigueScorer.calculateFatigueScore(userId);
    const shouldThrottle = fatigueScore.overallFatigueScore > 50;

    if (!shouldThrottle) {
      return {
        userId,
        shouldThrottle: false,
        recommendedReduction: 0,
        throttleWindow: {
          startAt: new Date(),
          endAt: new Date(),
          durationHours: 0,
        },
        categoriesAffected: [],
        channelsAffected: [],
        priorityThreshold: "NORMAL",
        reasoning: {
          primaryCause: "No fatigue detected",
          currentFatigueScore: fatigueScore.overallFatigueScore,
          estimatedRecoveryHours: 0,
          impact: {
            expectedOpenRateImprovement: 0,
            expectedEngagementImprovement: 0,
          },
        },
        calculatedAt: new Date(),
      };
    }

    // Calculate throttle parameters based on fatigue level
    const reductionPercent = Math.min(100, (fatigueScore.overallFatigueScore - 50) * 2);
    const throttleHours =
      fatigueScore.overallFatigueScore > 80 ? 24 : fatigueScore.overallFatigueScore > 70 ? 12 : 6;

    const now = new Date();
    const throttleEnd = new Date(now.getTime() + throttleHours * 60 * 60 * 1000);

    // Affected categories based on fatigue
    const affectedCategories: NotificationCategory[] = [];
    for (const [cat, fatigue] of Object.entries(fatigueScore.factors.categoryFatigueScores)) {
      if (fatigue > 60) {
        affectedCategories.push(cat as NotificationCategory);
      }
    }

    // Affected channels based on fatigue
    const affectedChannels: NotificationChannel[] = [];
    for (const [ch, fatigue] of Object.entries(fatigueScore.factors.channelFatigueScores)) {
      if (fatigue > 60) {
        affectedChannels.push(ch as NotificationChannel);
      }
    }

    // Priority threshold: only send HIGH/CRITICAL during throttle
    const priorityThreshold = fatigueScore.overallFatigueScore > 80 ? "HIGH" : "NORMAL";

    return {
      userId,
      shouldThrottle: true,
      recommendedReduction: Math.round(reductionPercent),
      throttleWindow: {
        startAt: now,
        endAt: throttleEnd,
        durationHours: throttleHours,
      },
      categoriesAffected: affectedCategories.length > 0 ? affectedCategories : [],
      channelsAffected: affectedChannels.length > 0 ? affectedChannels : [],
      priorityThreshold: priorityThreshold as NotificationPriority,
      reasoning: {
        primaryCause: `High fatigue score (${fatigueScore.overallFatigueScore})`,
        currentFatigueScore: fatigueScore.overallFatigueScore,
        estimatedRecoveryHours: throttleHours,
        impact: {
          expectedOpenRateImprovement: Math.min(15, (100 - fatigueScore.metrics.averageOpenRateLast7Days * 100) * 0.2),
          expectedEngagementImprovement: Math.min(20, reductionPercent * 0.15),
        },
      },
      calculatedAt: new Date(),
    };
  }
}

// ─── IMPORTANCE RANKER ────────────────────────────────────────────────────

export class ImportanceRanker {
  rankImportance(
    notificationId: string,
    userId: string,
    category: NotificationCategory,
    priority: NotificationPriority,
    userEngagementWithCategory: number = 0.5 // 0-1
  ): ImportanceScore {
    // Priority factor (0-40)
    const priorityValues: Record<NotificationPriority, number> = {
      CRITICAL: 40,
      HIGH: 30,
      NORMAL: 20,
      LOW: 10,
      DIGEST: 5,
    };
    const priorityFactor = priorityValues[priority] ?? 20;

    // Relevance factor (0-30) - based on category
    const relevanceFactor = 15 + userEngagementWithCategory * 15;

    // Timeliness factor (0-20) - typically time-sensitive
    const timelinesseFactor = priority === "CRITICAL" ? 20 : priority === "HIGH" ? 15 : 10;

    // User affinity factor (0-10)
    const affinityFactor = userEngagementWithCategory * 10;

    const importanceScore = Math.min(
      100,
      priorityFactor + relevanceFactor + timelinesseFactor + affinityFactor
    );

    return {
      notificationId,
      userId,
      category,
      priority,
      importanceScore,
      factors: {
        priorityFactor,
        relevanceFactor,
        timelinesseFactor,
        userAffinityFactor: affinityFactor,
      },
      calculatedAt: new Date(),
    };
  }

  rankBatch(
    notifications: Array<{
      id: string;
      category: NotificationCategory;
      priority: NotificationPriority;
    }>,
    userId: string
  ): ImportanceScore[] {
    return notifications.map((n) =>
      this.rankImportance(n.id, userId, n.category, n.priority, 0.6)
    );
  }
}

// ─── DIGEST OPTIMIZER ─────────────────────────────────────────────────────

export class DigestOptimizer {
  suggestDigestWindow(userId: string, timezone: string): DigestWindow {
    // Simple heuristic: suggest 9 AM local time for daily digest
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    return {
      userId,
      windowId: `digest_${userId}_${Date.now()}`,
      startTime: now,
      endTime: tomorrow,
      frequency: "DAILY",
      recommendedDeliveryTime: tomorrow,
      timezone,
      expectedNotificationCount: 5,
      averageImportanceScore: 35,
      reasoning: {
        rationale: "Group low-priority notifications into daily digest",
        userEngagementPattern: "Morning reader - opens emails around 9 AM",
        expectedOpenRate: 0.65,
      },
      calculatedAt: new Date(),
    };
  }
}

// ─── UNSUBSCRIBE PREDICTOR ────────────────────────────────────────────────

export class UnsubscribePrediction {
  predictUnsubscribeRisk(
    userId: string,
    fatigueScore: FatigueScore
  ): UnsubscribePrediction {
    // Calculate unsubscribe likelihood based on fatigue
    const baselineRisk = 10;
    const fatigueRisk = (fatigueScore.overallFatigueScore / 100) * 60;
    const openRateDecliningRisk = fatigueScore.factors.openRateTrendScore > 50 ? 15 : 0;
    const dismissRateRising = fatigueScore.metrics.averageDismissRateLast7Days > 0.5 ? 10 : 0;
    const unsubscribeAttemptRisk = fatigueScore.metrics.unsubscribeAttempts > 0 ? 25 : 0;

    const likelihood = Math.min(
      100,
      baselineRisk + fatigueRisk + openRateDecliningRisk + dismissRateRising + unsubscribeAttemptRisk
    );

    const riskLevel =
      likelihood < 30
        ? "LOW"
        : likelihood < 50
          ? "MEDIUM"
          : likelihood < 75
            ? "HIGH"
            : "CRITICAL";

    // Estimate days until unsubscribe
    let daysUntil: number | null = null;
    if (riskLevel !== "LOW") {
      daysUntil = Math.max(1, Math.ceil((100 - likelihood) / 5));
    }

    // Identify at-risk channels
    const channelsAtRisk = Object.entries(fatigueScore.factors.channelFatigueScores)
      .filter(([_, fatigue]) => fatigue > 70)
      .map(([channel, fatigue]) => ({
        channel: channel as NotificationChannel,
        riskScore: fatigue,
      }));

    const recommendedActions = [];
    if (riskLevel === "CRITICAL") {
      recommendedActions.push(
        { action: "Immediately reduce notification frequency by 50%", priority: "HIGH" },
        { action: "Contact user to understand preferences", priority: "HIGH" },
        { action: "Implement weekly digest instead of daily", priority: "MEDIUM" }
      );
    } else if (riskLevel === "HIGH") {
      recommendedActions.push(
        { action: "Reduce notification frequency by 25%", priority: "HIGH" },
        { action: "Consolidate messages into digest", priority: "MEDIUM" }
      );
    } else if (riskLevel === "MEDIUM") {
      recommendedActions.push(
        { action: "Monitor open rates closely", priority: "MEDIUM" },
        { action: "Personalize content to increase relevance", priority: "LOW" }
      );
    }

    return {
      userId,
      unsubscribeLikelihood: Math.round(likelihood),
      riskLevel,
      daysUntilLikelyUnsubscribe: daysUntil,
      factors: {
        currentFatigueScore: fatigueScore.overallFatigueScore,
        openRateTrend: fatigueScore.factors.openRateTrendScore - 50,
        dismissRateTrend: fatigueScore.metrics.averageDismissRateLast7Days,
        recentComplaintsCount: fatigueScore.metrics.unsubscribeAttempts,
        channelsAtRisk,
      },
      recommendedActions,
      calculatedAt: new Date(),
    };
  }
}

// ─── FACTORY FUNCTIONS ────────────────────────────────────────────────────

export function createFatigueDetector(): FatigueScorer {
  return new FatigueScorer();
}

export function createOverloadDetector(): OverloadDetector {
  return new OverloadDetector();
}

export function createThrottleRecommender(fatigueScorer: FatigueScorer): ThrottleRecommender {
  return new ThrottleRecommender(fatigueScorer);
}

export function createImportanceRanker(): ImportanceRanker {
  return new ImportanceRanker();
}

export function createDigestOptimizer(): DigestOptimizer {
  return new DigestOptimizer();
}

export function createUnsubscribePrediction(): UnsubscribePrediction {
  return new UnsubscribePrediction();
}
