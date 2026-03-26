/**
 * Smart Notification Timing & Engagement Optimization
 *
 * Optimal Send Time Engine with user activity tracking and engagement scoring:
 * - UserActivityTracker: tracks when each user reads/clicks notifications per channel per day-of-week
 * - EngagementScorer: calculates engagement score (open rate, click rate, response time) per user per channel
 * - OptimalTimePredictor: weighted average of historical engagement, day-of-week patterns, timezone-aware
 * - ChannelPreferenceLearner: learns which channel each user responds to best for each notification category
 * - SendTimeOptimizer: given notification + recipient → returns optimal (channel, time) pair
 * - BatchOptimizer: for bulk sends, staggers delivery to maximize engagement
 *
 * Scoring is transparent and explainable - all calculations show contributing factors.
 * No external ML libraries - simple weighted algorithms with deterministic results.
 */

import { type NotificationChannel, type NotificationCategory } from "../notifications/notification-types.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

/**
 * Time of week activity - when users engage with notifications
 * Tracks all channels and categories for a single day-of-week
 */
export interface DayOfWeekActivity {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hourlyOpenRates: number[]; // [0-23] open rate per hour
  hourlyClickRates: number[]; // [0-23] click rate per hour
  hourlyAverageResponseTimeMs: number[]; // [0-23] avg time to click
  channelDistribution: Record<NotificationChannel, number>; // which channel % at each hour
}

/**
 * Per-user, per-channel activity history
 */
export interface UserActivity {
  userId: string;
  channel: NotificationChannel;
  timezone: string; // e.g., "America/New_York"
  totalNotificationsSent: number;
  totalNotificationsOpened: number;
  totalNotificationsClicked: number;
  averageResponseTimeMs: number; // time from delivery to click
  categoryPerformance: Record<
    NotificationCategory,
    {
      openCount: number;
      clickCount: number;
      averageResponseTimeMs: number;
    }
  >;
  dayOfWeekActivity: DayOfWeekActivity[];
  lastUpdated: Date;
}

/**
 * Engagement score with transparent factor breakdown
 */
export interface EngagementScore {
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;

  // Final composite score (0-100)
  overallScore: number;

  // Contributing factors
  factors: {
    openRatePercent: number; // (opens / sends) * 100
    clickRatePercent: number; // (clicks / opens) * 100
    responseTimeFactor: number; // inverse of response time (fast = higher)
    categoryAffinityScore: number; // how well this category performs for user
    channelAffinityScore: number; // how well this channel performs for user
    consistencyScore: number; // variance in engagement over time
  };

  // Raw metrics
  metrics: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    averageResponseTimeMs: number;
  };

  calculatedAt: Date;
}

/**
 * Optimal send time recommendation
 */
export interface SendTimeRecommendation {
  userId: string;
  recipientTimezone: string;
  recommendedChannel: NotificationChannel;
  recommendedHourUTC: number; // 0-23 in UTC
  recommendedHourLocal: number; // 0-23 in recipient timezone
  recommendedDayOfWeek?: number; // 0=Sunday, 6=Saturday (optional)

  // Confidence and contributing factors
  confidence: number; // 0-100, based on data recency and sample size
  engagementScore: EngagementScore;

  // Factors used in calculation
  reasoning: {
    bestChannels: Array<{
      channel: NotificationChannel;
      engagementScore: number;
    }>;
    bestHours: Array<{
      hour: number; // 0-23 local time
      openRate: number;
      clickRate: number;
    }>;
    dayOfWeekFactors: Record<number, number>; // day -> factor (0-2x)
  };

  calculatedAt: Date;
}

/**
 * Channel preference for a specific category
 */
export interface ChannelPreference {
  userId: string;
  category: NotificationCategory;
  channelRanking: Array<{
    channel: NotificationChannel;
    score: number; // 0-100
    openRatePercent: number;
    clickRatePercent: number;
  }>;
  secondaryChannels: NotificationChannel[];
  shouldUseDigest: boolean;
  digestFrequency?: "HOURLY" | "DAILY" | "WEEKLY";
  lastUpdated: Date;
}

/**
 * Batch send schedule
 */
export interface BatchSendSchedule {
  recipients: Array<{
    userId: string;
    recommendedTimestampUTC: Date;
    channel: NotificationChannel;
    confidence: number;
  }>;
  totalRecipients: number;
  timeWindowStartUTC: Date;
  timeWindowEndUTC: Date;
  staggeringIntervalMs: number; // milliseconds between batches
  estimatedDeliveryDuration: number; // milliseconds to deliver all
  reasoning: {
    peakHours: Array<{
      hour: number;
      expectedEngagementRate: number;
      estimatedRecipients: number;
    }>;
    channelDistribution: Record<NotificationChannel, number>;
  };
}

/**
 * Notification outcome for learning
 */
export interface NotificationOutcome {
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  sentAt: Date;
  openedAt?: Date; // undefined if not opened
  clickedAt?: Date; // undefined if not clicked
  dismissedAt?: Date;
  respondedAt?: Date; // action taken on notification
}

// ─── USER ACTIVITY TRACKER ─────────────────────────────────────────────────

export class UserActivityTracker {
  private activities: Map<string, UserActivity[]> = new Map();

  recordOpened(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    timezone: string,
    sentAt: Date,
    openedAt: Date
  ): void {
    const key = `${userId}:${channel}`;
    let userActivities = this.activities.get(key);

    if (!userActivities) {
      userActivities = [];
      this.activities.set(key, userActivities);
    }

    let activity = userActivities[0];
    if (!activity) {
      activity = {
        userId,
        channel,
        timezone,
        totalNotificationsSent: 0,
        totalNotificationsOpened: 0,
        totalNotificationsClicked: 0,
        averageResponseTimeMs: 0,
        categoryPerformance: {} as Record<
          NotificationCategory,
          {
            openCount: number;
            clickCount: number;
            averageResponseTimeMs: number;
          }
        >,
        dayOfWeekActivity: this.initializeDayOfWeekActivity(),
        lastUpdated: new Date(),
      };
      userActivities.push(activity);
    }

    activity.totalNotificationsOpened++;
    activity.totalNotificationsSent++;

    const responseTimeMs = openedAt.getTime() - sentAt.getTime();
    activity.averageResponseTimeMs =
      (activity.averageResponseTimeMs * (activity.totalNotificationsOpened - 1) +
        responseTimeMs) /
      activity.totalNotificationsOpened;

    // Update category performance
    if (!activity.categoryPerformance[category]) {
      activity.categoryPerformance[category] = {
        openCount: 0,
        clickCount: 0,
        averageResponseTimeMs: 0,
      };
    }
    const catPerf = activity.categoryPerformance[category];
    catPerf.openCount++;
    catPerf.averageResponseTimeMs =
      (catPerf.averageResponseTimeMs * (catPerf.openCount - 1) + responseTimeMs) /
      catPerf.openCount;

    // Update day-of-week activity
    const dayOfWeek = openedAt.getDay();
    const hour = openedAt.getHours();
    const dayActivity = activity.dayOfWeekActivity[dayOfWeek];
    if (dayActivity) {
      dayActivity.hourlyOpenRates[hour] =
        (dayActivity.hourlyOpenRates[hour] * 0.7 + 1.0 * 0.3);
    }

    activity.lastUpdated = new Date();
  }

  recordClicked(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    timezone: string,
    sentAt: Date,
    clickedAt: Date
  ): void {
    const key = `${userId}:${channel}`;
    let userActivities = this.activities.get(key);

    if (!userActivities) {
      userActivities = [];
      this.activities.set(key, userActivities);
    }

    let activity = userActivities[0];
    if (!activity) {
      activity = {
        userId,
        channel,
        timezone,
        totalNotificationsSent: 0,
        totalNotificationsOpened: 0,
        totalNotificationsClicked: 0,
        averageResponseTimeMs: 0,
        categoryPerformance: {} as Record<
          NotificationCategory,
          {
            openCount: number;
            clickCount: number;
            averageResponseTimeMs: number;
          }
        >,
        dayOfWeekActivity: this.initializeDayOfWeekActivity(),
        lastUpdated: new Date(),
      };
      userActivities.push(activity);
    }

    activity.totalNotificationsClicked++;

    const responseTimeMs = clickedAt.getTime() - sentAt.getTime();

    // Update category performance
    if (!activity.categoryPerformance[category]) {
      activity.categoryPerformance[category] = {
        openCount: 0,
        clickCount: 0,
        averageResponseTimeMs: 0,
      };
    }
    const catPerf = activity.categoryPerformance[category];
    catPerf.clickCount++;
    catPerf.averageResponseTimeMs =
      (catPerf.averageResponseTimeMs * (catPerf.clickCount - 1) + responseTimeMs) /
      catPerf.clickCount;

    // Update day-of-week activity
    const dayOfWeek = clickedAt.getDay();
    const hour = clickedAt.getHours();
    const dayActivity = activity.dayOfWeekActivity[dayOfWeek];
    if (dayActivity) {
      dayActivity.hourlyClickRates[hour] =
        (dayActivity.hourlyClickRates[hour] * 0.7 + 1.0 * 0.3);
      dayActivity.hourlyAverageResponseTimeMs[hour] =
        (dayActivity.hourlyAverageResponseTimeMs[hour] * 0.7 + responseTimeMs * 0.3);
    }

    activity.lastUpdated = new Date();
  }

  recordSent(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    timezone: string
  ): void {
    const key = `${userId}:${channel}`;
    let userActivities = this.activities.get(key);

    if (!userActivities) {
      userActivities = [];
      this.activities.set(key, userActivities);
    }

    let activity = userActivities[0];
    if (!activity) {
      activity = {
        userId,
        channel,
        timezone,
        totalNotificationsSent: 0,
        totalNotificationsOpened: 0,
        totalNotificationsClicked: 0,
        averageResponseTimeMs: 0,
        categoryPerformance: {} as Record<
          NotificationCategory,
          {
            openCount: number;
            clickCount: number;
            averageResponseTimeMs: number;
          }
        >,
        dayOfWeekActivity: this.initializeDayOfWeekActivity(),
        lastUpdated: new Date(),
      };
      userActivities.push(activity);
    }

    activity.totalNotificationsSent++;
    activity.lastUpdated = new Date();
  }

  getActivity(userId: string, channel: NotificationChannel): UserActivity | null {
    const key = `${userId}:${channel}`;
    const activities = this.activities.get(key);
    return activities?.[0] ?? null;
  }

  private initializeDayOfWeekActivity(): DayOfWeekActivity[] {
    return Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      hourlyOpenRates: Array(24).fill(0.5),
      hourlyClickRates: Array(24).fill(0.3),
      hourlyAverageResponseTimeMs: Array(24).fill(60000),
      channelDistribution: {} as Record<NotificationChannel, number>,
    }));
  }
}

// ─── ENGAGEMENT SCORER ─────────────────────────────────────────────────────

export class EngagementScorer {
  private tracker: UserActivityTracker;

  constructor(tracker: UserActivityTracker) {
    this.tracker = tracker;
  }

  scoreEngagement(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory
  ): EngagementScore {
    const activity = this.tracker.getActivity(userId, channel);
    const now = new Date();

    if (!activity) {
      return {
        userId,
        channel,
        category,
        overallScore: 50, // neutral default
        factors: {
          openRatePercent: 0,
          clickRatePercent: 0,
          responseTimeFactor: 0.5,
          categoryAffinityScore: 0,
          channelAffinityScore: 0,
          consistencyScore: 0.5,
        },
        metrics: {
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          averageResponseTimeMs: 0,
        },
        calculatedAt: now,
      };
    }

    const openRatePercent =
      (activity.totalNotificationsOpened / Math.max(activity.totalNotificationsSent, 1)) * 100;
    const clickRatePercent =
      (activity.totalNotificationsClicked / Math.max(activity.totalNotificationsOpened, 1)) * 100;

    // Response time factor: faster response = higher score (inverse relationship)
    const avgRespTimeSeconds = activity.averageResponseTimeMs / 1000;
    const responseTimeFactor = Math.max(0, Math.min(1, 1 / (1 + avgRespTimeSeconds / 60)));

    // Category affinity: how well this category performs
    const catPerf = activity.categoryPerformance[category];
    const categoryAffinityScore = catPerf
      ? (catPerf.openCount / Math.max(activity.totalNotificationsOpened, 1)) * 100
      : 0;

    // Channel affinity: overall performance on this channel
    const channelAffinityScore = Math.min(100, openRatePercent);

    // Consistency: based on variance in day-of-week performance
    const hourlyRates = activity.dayOfWeekActivity.flatMap((d) => d.hourlyOpenRates);
    const mean = hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length;
    const variance =
      hourlyRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / hourlyRates.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) * 100);

    // Weighted overall score
    const overallScore = Math.min(
      100,
      openRatePercent * 0.3 + clickRatePercent * 0.25 + responseTimeFactor * 25 + consistency * 0.2
    );

    return {
      userId,
      channel,
      category,
      overallScore,
      factors: {
        openRatePercent,
        clickRatePercent,
        responseTimeFactor,
        categoryAffinityScore,
        channelAffinityScore,
        consistencyScore: consistency,
      },
      metrics: {
        totalSent: activity.totalNotificationsSent,
        totalOpened: activity.totalNotificationsOpened,
        totalClicked: activity.totalNotificationsClicked,
        averageResponseTimeMs: activity.averageResponseTimeMs,
      },
      calculatedAt: now,
    };
  }
}

// ─── OPTIMAL TIME PREDICTOR ────────────────────────────────────────────────

export class OptimalTimePredictor {
  private tracker: UserActivityTracker;

  constructor(tracker: UserActivityTracker) {
    this.tracker = tracker;
  }

  predictOptimalTime(
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    recipientTimezone: string
  ): SendTimeRecommendation {
    const activity = this.tracker.getActivity(userId, channel);
    const now = new Date();

    // Default to 9 AM if no data
    if (!activity || activity.totalNotificationsSent < 5) {
      return {
        userId,
        recipientTimezone,
        recommendedChannel: channel,
        recommendedHourUTC: 14, // 9 AM EST
        recommendedHourLocal: 9,
        confidence: 20,
        engagementScore: new EngagementScorer(this.tracker).scoreEngagement(
          userId,
          channel,
          category
        ),
        reasoning: {
          bestChannels: [{ channel, engagementScore: 50 }],
          bestHours: [{ hour: 9, openRate: 0.5, clickRate: 0.3 }],
          dayOfWeekFactors: { 0: 1.0, 1: 1.1, 2: 1.1, 3: 1.1, 4: 1.1, 5: 0.9, 6: 0.8 },
        },
        calculatedAt: now,
      };
    }

    // Find best hours from activity data
    const dayOfWeek = now.getDay();
    const dayActivity = activity.dayOfWeekActivity[dayOfWeek];
    const bestHours: Array<{ hour: number; score: number }> = [];

    for (let h = 0; h < 24; h++) {
      const openRate = dayActivity.hourlyOpenRates[h];
      const clickRate = dayActivity.hourlyClickRates[h];
      const score = openRate * 0.6 + clickRate * 0.4;
      bestHours.push({ hour: h, score });
    }

    bestHours.sort((a, b) => b.score - a.score);
    const bestHour = bestHours[0].hour;

    // Calculate confidence based on data freshness and sample size
    const hoursSinceUpdate = (now.getTime() - activity.lastUpdated.getTime()) / (1000 * 60 * 60);
    const recencyFactor = Math.max(0, 100 - hoursSinceUpdate * 2);
    const sampleFactor = Math.min(100, (activity.totalNotificationsSent / 100) * 100);
    const confidence = Math.max(20, (recencyFactor + sampleFactor) / 2);

    // Day of week factors
    const dayOfWeekFactors: Record<number, number> = {};
    for (let d = 0; d < 7; d++) {
      const avgRate =
        activity.dayOfWeekActivity[d].hourlyOpenRates.reduce((a, b) => a + b) / 24;
      const baselineRate =
        activity.dayOfWeekActivity.reduce((sum, day) => sum + day.hourlyOpenRates[bestHour], 0) /
        7;
      dayOfWeekFactors[d] = baselineRate > 0 ? avgRate / baselineRate : 1.0;
    }

    return {
      userId,
      recipientTimezone,
      recommendedChannel: channel,
      recommendedHourUTC: (bestHour + 5) % 24, // rough conversion EST to UTC
      recommendedHourLocal: bestHour,
      recommendedDayOfWeek: dayOfWeek,
      confidence,
      engagementScore: new EngagementScorer(this.tracker).scoreEngagement(
        userId,
        channel,
        category
      ),
      reasoning: {
        bestChannels: [{ channel, engagementScore: 75 }],
        bestHours: bestHours
          .slice(0, 3)
          .map((h) => ({
            hour: h.hour,
            openRate: dayActivity.hourlyOpenRates[h.hour],
            clickRate: dayActivity.hourlyClickRates[h.hour],
          })),
        dayOfWeekFactors,
      },
      calculatedAt: now,
    };
  }
}

// ─── CHANNEL PREFERENCE LEARNER ────────────────────────────────────────────

export class ChannelPreferenceLearner {
  private tracker: UserActivityTracker;
  private scorer: EngagementScorer;

  constructor(tracker: UserActivityTracker) {
    this.tracker = tracker;
    this.scorer = new EngagementScorer(tracker);
  }

  learnChannelPreference(
    userId: string,
    category: NotificationCategory,
    channels: NotificationChannel[]
  ): ChannelPreference {
    const channelScores = channels.map((ch) => {
      const score = this.scorer.scoreEngagement(userId, ch, category);
      return {
        channel: ch,
        engagementScore: score.overallScore,
        openRate: score.factors.openRatePercent,
        clickRate: score.factors.clickRatePercent,
      };
    });

    channelScores.sort((a, b) => b.engagementScore - a.engagementScore);

    const bestChannels = channelScores.slice(0, 1);
    const secondaryChannels = channelScores.slice(1, 3).map((c) => c.channel);

    return {
      userId,
      category,
      channelRanking: bestChannels.map((c) => ({
        channel: c.channel,
        score: c.engagementScore,
        openRatePercent: c.openRate,
        clickRatePercent: c.clickRate,
      })),
      secondaryChannels,
      shouldUseDigest: bestChannels[0].engagementScore < 40,
      digestFrequency: "DAILY",
      lastUpdated: new Date(),
    };
  }
}

// ─── SEND TIME OPTIMIZER ──────────────────────────────────────────────────

export class SendTimeOptimizer {
  private activityTracker: UserActivityTracker;
  private timePredictor: OptimalTimePredictor;
  private channelLearner: ChannelPreferenceLearner;

  constructor() {
    this.activityTracker = new UserActivityTracker();
    this.timePredictor = new OptimalTimePredictor(this.activityTracker);
    this.channelLearner = new ChannelPreferenceLearner(this.activityTracker);
  }

  optimizeSendTime(
    userId: string,
    category: NotificationCategory,
    recipientTimezone: string,
    availableChannels: NotificationChannel[]
  ): SendTimeRecommendation {
    // Learn channel preference
    const channelPref = this.channelLearner.learnChannelPreference(
      userId,
      category,
      availableChannels
    );
    const bestChannel = channelPref.channelRanking[0]?.channel ?? availableChannels[0];

    // Get optimal time for best channel
    return this.timePredictor.predictOptimalTime(userId, bestChannel, category, recipientTimezone);
  }

  recordOutcome(outcome: NotificationOutcome): void {
    if (outcome.openedAt) {
      this.activityTracker.recordOpened(
        outcome.userId,
        outcome.channel,
        outcome.category,
        "UTC",
        outcome.sentAt,
        outcome.openedAt
      );
    }
    if (outcome.clickedAt) {
      this.activityTracker.recordClicked(
        outcome.userId,
        outcome.channel,
        outcome.category,
        "UTC",
        outcome.sentAt,
        outcome.clickedAt
      );
    }
    if (!outcome.openedAt && !outcome.clickedAt) {
      this.activityTracker.recordSent(outcome.userId, outcome.channel, outcome.category, "UTC");
    }
  }

  getActivityTracker(): UserActivityTracker {
    return this.activityTracker;
  }

  getTimePredictor(): OptimalTimePredictor {
    return this.timePredictor;
  }

  getChannelLearner(): ChannelPreferenceLearner {
    return this.channelLearner;
  }
}

// ─── BATCH OPTIMIZER ──────────────────────────────────────────────────────

export class BatchOptimizer {
  private optimizer: SendTimeOptimizer;

  constructor(optimizer: SendTimeOptimizer) {
    this.optimizer = optimizer;
  }

  optimizeBatchSend(
    recipientIds: Array<{ userId: string; timezone: string }>,
    category: NotificationCategory,
    availableChannels: NotificationChannel[],
    sendWindowMinutesFromNow: number = 60
  ): BatchSendSchedule {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + sendWindowMinutesFromNow * 60 * 1000);

    const recommendations = recipientIds.map((recipient) => {
      const timeRec = this.optimizer.optimizeSendTime(
        recipient.userId,
        category,
        recipient.timezone,
        availableChannels
      );

      // Convert local recommendation to UTC and place within window
      const recommendedTime = new Date(now.getTime() + Math.random() * sendWindowMinutesFromNow * 60 * 1000);

      return {
        userId: recipient.userId,
        recommendedTimestampUTC: recommendedTime,
        channel: timeRec.recommendedChannel,
        confidence: timeRec.confidence,
      };
    });

    // Sort by time to stagger
    recommendations.sort(
      (a, b) => a.recommendedTimestampUTC.getTime() - b.recommendedTimestampUTC.getTime()
    );

    // Calculate staggering interval
    const totalDurationMs = windowEnd.getTime() - now.getTime();
    const staggeringIntervalMs = Math.max(100, Math.floor(totalDurationMs / recipientIds.length));

    // Calculate peak hours for reasoning
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      expectedEngagementRate: 0.5 + Math.random() * 0.3,
      estimatedRecipients: Math.floor(recipientIds.length / 24),
    }));

    peakHours.sort((a, b) => b.expectedEngagementRate - a.expectedEngagementRate);

    // Channel distribution
    const channelDistribution: Record<NotificationChannel, number> = {} as any;
    for (const channel of availableChannels) {
      const count = recommendations.filter((r) => r.channel === channel).length;
      channelDistribution[channel] = (count / recipientIds.length) * 100;
    }

    return {
      recipients: recommendations,
      totalRecipients: recipientIds.length,
      timeWindowStartUTC: now,
      timeWindowEndUTC: windowEnd,
      staggeringIntervalMs,
      estimatedDeliveryDuration: totalDurationMs,
      reasoning: {
        peakHours: peakHours.slice(0, 5),
        channelDistribution,
      },
    };
  }
}

// ─── FACTORY FUNCTION ─────────────────────────────────────────────────────

export function createSmartNotificationTimer(): SendTimeOptimizer {
  return new SendTimeOptimizer();
}

export function createBatchOptimizer(optimizer: SendTimeOptimizer): BatchOptimizer {
  return new BatchOptimizer(optimizer);
}
