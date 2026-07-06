/**
 * Notification Intelligence API
 *
 * RESTful endpoints for AI-powered notification optimization:
 * - POST /api/notifications/ai/optimal-time — get optimal send time for notification
 * - POST /api/notifications/ai/batch-optimize — optimize batch send schedule
 * - GET /api/notifications/ai/fatigue/:userId — get fatigue score for user
 * - GET /api/notifications/ai/engagement/:userId — get engagement metrics
 * - POST /api/notifications/ai/channel-recommend — recommend best channel
 * - GET /api/notifications/ai/analytics — notification intelligence dashboard data
 * - POST /api/notifications/ai/feedback — record notification outcome for learning
 *
 * Request validation, error handling, response formatting.
 */

import {
  type NotificationChannel,
  type NotificationCategory,
  type NotificationPriority,
} from "../notifications/notification-types.js";
import {
  createSmartNotificationTimer,
  createBatchOptimizer,
  type SendTimeRecommendation,
  type NotificationOutcome,
} from "./smart-notification-timer.js";
import {
  createFatigueDetector,
  createThrottleRecommender,
  createImportanceRanker,
  createUnsubscribePrediction,
  type FatigueScore,
  type ThrottleRecommendation,
} from "./notification-fatigue-detector.js";
import { type EngagementScore } from "./smart-notification-timer.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  executionTimeMs?: number;
}

/**
 * Request to get optimal send time
 */
export interface OptimalTimeRequest {
  userId: string;
  recipientTimezone: string;
  category: NotificationCategory;
  availableChannels: NotificationChannel[];
}

/**
 * Request to optimize batch send
 */
export interface BatchOptimizeRequest {
  recipients: Array<{
    userId: string;
    timezone: string;
  }>;
  category: NotificationCategory;
  availableChannels: NotificationChannel[];
  sendWindowMinutesFromNow?: number; // default 60
}

/**
 * Request to get engagement metrics
 */
export interface EngagementRequest {
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
}

/**
 * Request to recommend channel
 */
export interface ChannelRecommendRequest {
  userId: string;
  category: NotificationCategory;
  availableChannels: NotificationChannel[];
}

/**
 * Request to record notification outcome
 */
export interface FeedbackRequest {
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  sentAt: string; // ISO 8601
  openedAt?: string; // ISO 8601
  clickedAt?: string; // ISO 8601
  dismissedAt?: string; // ISO 8601
}

/**
 * Analytics dashboard data
 */
export interface NotificationAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalNotificationsSent: number;
    totalOpened: number;
    averageOpenRate: number;
    totalClicked: number;
    averageClickRate: number;
    usersFatigued: number;
    usersAtRisk: number;
  };
  channelMetrics: Array<{
    channel: NotificationChannel;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  }>;
  categoryMetrics: Array<{
    category: NotificationCategory;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
  }>;
  topPerformingHours: Array<{
    hour: number;
    engagementRate: number;
    volumePercent: number;
  }>;
  fatigueDistribution: {
    none: number; // %
    low: number;
    moderate: number;
    high: number;
    severe: number;
  };
}

// ─── SINGLETON INSTANCES ──────────────────────────────────────────────────

const smartTimer = createSmartNotificationTimer();
const batchOptimizer = createBatchOptimizer(smartTimer);
const fatigueDetector = createFatigueDetector();
const throttleRecommender = createThrottleRecommender(fatigueDetector);
const importanceRanker = createImportanceRanker();

// ─── ENDPOINTS ────────────────────────────────────────────────────────────

/**
 * POST /api/notifications/ai/optimal-time
 * Get optimal send time for a single notification
 */
export function getOptimalTime(
  req: OptimalTimeRequest,
): ApiResponse<SendTimeRecommendation> {
  const startTime = Date.now();

  try {
    if (
      !req.userId ||
      !req.category ||
      !req.availableChannels ||
      req.availableChannels.length === 0
    ) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: userId, category, availableChannels",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const recommendation = smartTimer.optimizeSendTime(
      req.userId,
      req.category,
      req.recipientTimezone || "UTC",
      req.availableChannels,
    );

    return {
      success: true,
      data: recommendation,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/notifications/ai/batch-optimize
 * Optimize batch send schedule for multiple recipients
 */
export function optimizeBatchSend(req: BatchOptimizeRequest): ApiResponse<any> {
  const startTime = Date.now();

  try {
    if (!req.recipients || req.recipients.length === 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Recipients array is required and must not be empty",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!req.category || !req.availableChannels) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: category, availableChannels",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const schedule = batchOptimizer.optimizeBatchSend(
      req.recipients,
      req.category,
      req.availableChannels,
      req.sendWindowMinutesFromNow || 60,
    );

    return {
      success: true,
      data: schedule,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * GET /api/notifications/ai/fatigue/:userId
 * Get fatigue score for a specific user
 */
export function getFatigueScore(userId: string): ApiResponse<FatigueScore> {
  const startTime = Date.now();

  try {
    if (!userId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId is required",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const fatigueScore = fatigueDetector.calculateFatigueScore(userId);
    const throttleRec = throttleRecommender.recommendThrottle(userId);

    return {
      success: true,
      data: {
        ...fatigueScore,
        throttleRecommendation: throttleRec,
      } as any,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * GET /api/notifications/ai/engagement/:userId
 * Get engagement metrics for a user
 */
export function getEngagementMetrics(
  userId: string,
  channel: NotificationChannel,
): ApiResponse<EngagementScore> {
  const startTime = Date.now();

  try {
    if (!userId || !channel) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId and channel are required",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const tracker = smartTimer.getActivityTracker();
    const activity = tracker["getActivity"](userId, channel);

    if (!activity) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No activity data found for user ${userId} on channel ${channel}`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Return engagement metrics
    return {
      success: true,
      data: {
        userId,
        channel,
        category: "ORDER" as NotificationCategory, // placeholder
        overallScore: Math.round(
          (activity.totalNotificationsOpened /
            Math.max(activity.totalNotificationsSent, 1)) *
            100,
        ),
        factors: {
          openRatePercent:
            (activity.totalNotificationsOpened /
              Math.max(activity.totalNotificationsSent, 1)) *
            100,
          clickRatePercent:
            (activity.totalNotificationsClicked /
              Math.max(activity.totalNotificationsOpened, 1)) *
            100,
          responseTimeFactor: Math.max(
            0,
            Math.min(1, 1 / (1 + activity.averageResponseTimeMs / 60000)),
          ),
          categoryAffinityScore: 75,
          channelAffinityScore: 80,
          consistencyScore: 85,
        },
        metrics: {
          totalSent: activity.totalNotificationsSent,
          totalOpened: activity.totalNotificationsOpened,
          totalClicked: activity.totalNotificationsClicked,
          averageResponseTimeMs: activity.averageResponseTimeMs,
        },
        calculatedAt: new Date(),
      } as any,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/notifications/ai/channel-recommend
 * Recommend best channel for a notification
 */
export function recommendChannel(
  req: ChannelRecommendRequest,
): ApiResponse<any> {
  const startTime = Date.now();

  try {
    if (!req.userId || !req.category || !req.availableChannels) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId, category, and availableChannels are required",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const channelLearner = smartTimer.getChannelLearner();
    const preference = channelLearner.learnChannelPreference(
      req.userId,
      req.category,
      req.availableChannels,
    );

    return {
      success: true,
      data: preference,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/notifications/ai/feedback
 * Record notification outcome for learning
 */
export function recordFeedback(
  req: FeedbackRequest,
): ApiResponse<{ acknowledged: boolean }> {
  const startTime = Date.now();

  try {
    if (!req.userId || !req.channel || !req.category || !req.sentAt) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId, channel, category, and sentAt are required",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const outcome: NotificationOutcome = {
      userId: req.userId,
      channel: req.channel,
      category: req.category,
      sentAt: new Date(req.sentAt),
      openedAt: req.openedAt ? new Date(req.openedAt) : undefined,
      clickedAt: req.clickedAt ? new Date(req.clickedAt) : undefined,
      dismissedAt: req.dismissedAt ? new Date(req.dismissedAt) : undefined,
      respondedAt: req.clickedAt ? new Date(req.clickedAt) : undefined,
    };

    smartTimer.recordOutcome(outcome);

    // Update fatigue detector
    if (outcome.openedAt) {
      fatigueDetector.recordNotificationOpened(req.userId);
    } else if (outcome.dismissedAt) {
      fatigueDetector.recordNotificationDismissed(req.userId);
    } else {
      fatigueDetector.recordNotificationSent(
        req.userId,
        req.channel,
        req.category,
      );
    }

    return {
      success: true,
      data: { acknowledged: true },
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * GET /api/notifications/ai/analytics
 * Get notification intelligence dashboard data
 */
export function getAnalytics(): ApiResponse<NotificationAnalytics> {
  const startTime = Date.now();

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Simulated analytics data
    const analytics: NotificationAnalytics = {
      period: {
        startDate: sevenDaysAgo,
        endDate: now,
      },
      summary: {
        totalNotificationsSent: 5230,
        totalOpened: 3850,
        averageOpenRate: 73.5,
        totalClicked: 1540,
        averageClickRate: 40.0,
        usersFatigued: 145,
        usersAtRisk: 52,
      },
      channelMetrics: [
        {
          channel: "EMAIL",
          sent: 2500,
          opened: 1950,
          clicked: 850,
          openRate: 78.0,
          clickRate: 43.6,
        },
        {
          channel: "PUSH",
          sent: 1800,
          opened: 1350,
          clicked: 490,
          openRate: 75.0,
          clickRate: 36.3,
        },
        {
          channel: "SMS",
          sent: 930,
          opened: 550,
          clicked: 200,
          openRate: 59.1,
          clickRate: 36.4,
        },
      ],
      categoryMetrics: [
        {
          category: "ORDER",
          sent: 1200,
          opened: 960,
          clicked: 480,
          openRate: 80.0,
        },
        {
          category: "DELIVERY",
          sent: 1800,
          opened: 1440,
          clicked: 550,
          openRate: 80.0,
        },
        {
          category: "PAYMENT",
          sent: 950,
          opened: 665,
          clicked: 200,
          openRate: 70.0,
        },
        {
          category: "MARKETING",
          sent: 1280,
          opened: 785,
          clicked: 310,
          openRate: 61.3,
        },
      ],
      topPerformingHours: [
        { hour: 9, engagementRate: 82.5, volumePercent: 12.3 },
        { hour: 14, engagementRate: 78.9, volumePercent: 11.8 },
        { hour: 18, engagementRate: 76.4, volumePercent: 10.5 },
        { hour: 20, engagementRate: 74.2, volumePercent: 9.8 },
        { hour: 10, engagementRate: 73.1, volumePercent: 9.4 },
      ],
      fatigueDistribution: {
        none: 78,
        low: 14,
        moderate: 5,
        high: 2.5,
        severe: 0.5,
      },
    };

    return {
      success: true,
      data: analytics,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Get unsubscribe risk for a user
 */
export function getUnsubscribeRisk(userId: string): ApiResponse<any> {
  const startTime = Date.now();

  try {
    if (!userId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId is required",
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const fatigueScore = fatigueDetector.calculateFatigueScore(userId);
    const predictor = createUnsubscribePrediction();
    const riskPrediction = predictor.predictUnsubscribeRisk(
      userId,
      fatigueScore,
    );

    return {
      success: true,
      data: riskPrediction,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
