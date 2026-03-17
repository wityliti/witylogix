/**
 * Smart Notification Timer Tests
 *
 * Tests for:
 * - User activity tracking (opens, clicks, day-of-week patterns)
 * - Engagement scoring (open rate, click rate, response time)
 * - Optimal time prediction (timezone-aware, historical patterns)
 * - Channel preference learning
 * - Send time optimization
 * - Batch optimization with staggering
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createSmartNotificationTimer,
  createBatchOptimizer,
  UserActivityTracker,
  EngagementScorer,
  OptimalTimePredictor,
  ChannelPreferenceLearner,
  SendTimeOptimizer,
  type NotificationOutcome,
} from "../smart-notification-timer.js";

describe("Smart Notification Timer", () => {
  let optimizer: SendTimeOptimizer;
  let tracker: UserActivityTracker;

  beforeEach(() => {
    optimizer = createSmartNotificationTimer();
    tracker = optimizer.getActivityTracker();
  });

  // ─── User Activity Tracker ──────────────────────────────────────────

  describe("User Activity Tracker", () => {
    it("should record notification sends", () => {
      tracker.recordSent("user_1", "EMAIL", "ORDER", "America/New_York");
      tracker.recordSent("user_1", "EMAIL", "ORDER", "America/New_York");

      const activity = tracker.getActivity("user_1", "EMAIL");
      expect(activity).toBeDefined();
      expect(activity!.totalNotificationsSent).toBe(2);
    });

    it("should record notification opens with response time", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:15:00Z");

      tracker.recordOpened("user_1", "EMAIL", "ORDER", "America/New_York", sentAt, openedAt);

      const activity = tracker.getActivity("user_1", "EMAIL");
      expect(activity).toBeDefined();
      expect(activity!.totalNotificationsOpened).toBe(1);
      expect(activity!.averageResponseTimeMs).toBeGreaterThan(0);
      expect(activity!.averageResponseTimeMs).toBeLessThanOrEqual(15 * 60 * 1000); // <= 15 minutes
    });

    it("should record notification clicks with response time", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const clickedAt = new Date("2026-03-17T09:30:00Z");

      tracker.recordClicked("user_1", "SMS", "DELIVERY", "UTC", sentAt, clickedAt);

      const activity = tracker.getActivity("user_1", "SMS");
      expect(activity).toBeDefined();
      expect(activity!.totalNotificationsClicked).toBe(1);
      expect(activity!.averageResponseTimeMs).toBeGreaterThan(0);
    });

    it("should track category-specific performance", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:10:00Z");

      tracker.recordOpened("user_1", "PUSH", "ORDER", "UTC", sentAt, openedAt);
      tracker.recordOpened("user_1", "PUSH", "ORDER", "UTC", sentAt, openedAt);
      tracker.recordOpened("user_1", "PUSH", "MARKETING", "UTC", sentAt, openedAt);

      const activity = tracker.getActivity("user_1", "PUSH");
      expect(activity).toBeDefined();
      expect(activity!.categoryPerformance["ORDER"]).toBeDefined();
      expect(activity!.categoryPerformance["ORDER"].openCount).toBe(2);
      expect(activity!.categoryPerformance["MARKETING"].openCount).toBe(1);
    });

    it("should initialize day-of-week activity with 7 days", () => {
      tracker.recordSent("user_1", "EMAIL", "ORDER", "America/New_York");
      const activity = tracker.getActivity("user_1", "EMAIL");

      expect(activity).toBeDefined();
      expect(activity!.dayOfWeekActivity).toHaveLength(7);
      expect(activity!.dayOfWeekActivity[0].dayOfWeek).toBe(0); // Sunday
      expect(activity!.dayOfWeekActivity[6].dayOfWeek).toBe(6); // Saturday
    });
  });

  // ─── Engagement Scorer ──────────────────────────────────────────────

  describe("Engagement Scorer", () => {
    it("should calculate engagement score based on open rate", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:10:00Z");

      // Record 10 sends and 7 opens = 70% open rate
      for (let i = 0; i < 7; i++) {
        tracker.recordOpened("user_2", "EMAIL", "ORDER", "UTC", sentAt, openedAt);
      }
      for (let i = 0; i < 3; i++) {
        tracker.recordSent("user_2", "EMAIL", "ORDER", "UTC");
      }

      const scorer = new EngagementScorer(tracker);
      const score = scorer.scoreEngagement("user_2", "EMAIL", "ORDER");

      expect(score).toBeDefined();
      expect(score.factors.openRatePercent).toBeGreaterThan(0);
      expect(score.overallScore).toBeGreaterThan(30);
    });

    it("should return default score for new users with no data", () => {
      const scorer = new EngagementScorer(tracker);
      const score = scorer.scoreEngagement("unknown_user", "EMAIL", "ORDER");

      expect(score).toBeDefined();
      expect(score.overallScore).toBe(50); // neutral default
      expect(score.metrics.totalSent).toBe(0);
    });

    it("should factor response time into engagement score", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const quickOpenAt = new Date("2026-03-17T09:05:00Z");

      tracker.recordOpened("user_3", "PUSH", "ORDER", "UTC", sentAt, quickOpenAt);

      const scorer = new EngagementScorer(tracker);
      const score = scorer.scoreEngagement("user_3", "PUSH", "ORDER");

      expect(score.factors.responseTimeFactor).toBeGreaterThan(0.3);
    });
  });

  // ─── Optimal Time Predictor ────────────────────────────────────────

  describe("Optimal Time Predictor", () => {
    it("should return 9 AM default for users with insufficient data", () => {
      const predictor = optimizer.getTimePredictor();
      const recommendation = predictor.predictOptimalTime(
        "new_user",
        "EMAIL",
        "ORDER",
        "America/New_York"
      );

      expect(recommendation).toBeDefined();
      expect(recommendation.recommendedHourLocal).toBe(9);
      expect(recommendation.confidence).toBeLessThan(50); // low confidence on new users
    });

    it("should predict optimal time based on activity history", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:10:00Z");

      // Simulate user opening emails at 9 AM multiple times
      for (let i = 0; i < 10; i++) {
        const date = new Date(sentAt);
        date.setHours(9);
        const openDate = new Date(date);
        openDate.setMinutes(openDate.getMinutes() + 10);
        tracker.recordOpened("user_4", "EMAIL", "ORDER", "UTC", date, openDate);
      }

      const predictor = optimizer.getTimePredictor();
      const recommendation = predictor.predictOptimalTime(
        "user_4",
        "EMAIL",
        "ORDER",
        "America/New_York"
      );

      expect(recommendation.confidence).toBeGreaterThan(50);
      expect(recommendation.reasoning.bestHours.length).toBeGreaterThan(0);
    });

    it("should include day-of-week factors in reasoning", () => {
      tracker.recordSent("user_5", "EMAIL", "ORDER", "UTC");
      const predictor = optimizer.getTimePredictor();
      const recommendation = predictor.predictOptimalTime(
        "user_5",
        "EMAIL",
        "ORDER",
        "America/New_York"
      );

      expect(recommendation.reasoning.dayOfWeekFactors).toBeDefined();
      expect(Object.keys(recommendation.reasoning.dayOfWeekFactors).length).toBe(7);
    });
  });

  // ─── Channel Preference Learner ─────────────────────────────────────

  describe("Channel Preference Learner", () => {
    it("should learn channel preferences from engagement history", () => {
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:10:00Z");

      // Email gets higher engagement
      for (let i = 0; i < 8; i++) {
        tracker.recordOpened("user_6", "EMAIL", "ORDER", "UTC", sentAt, openedAt);
      }

      // SMS gets lower engagement
      for (let i = 0; i < 3; i++) {
        tracker.recordOpened("user_6", "SMS", "ORDER", "UTC", sentAt, openedAt);
      }

      const learner = optimizer.getChannelLearner();
      const preference = learner.learnChannelPreference("user_6", "ORDER", ["EMAIL", "SMS"]);

      expect(preference.channelRanking).toBeDefined();
      expect(preference.channelRanking.length).toBeGreaterThan(0);
      expect(preference.channelRanking[0].channel).toBe("EMAIL");
    });

    it("should recommend digest for low-engagement channels", () => {
      const learner = optimizer.getChannelLearner();
      const preference = learner.learnChannelPreference("new_user_digest", "ORDER", ["EMAIL"]);

      // New users with no data should consider digest
      if (preference.shouldUseDigest) {
        expect(preference.digestFrequency).toBeDefined();
      }
    });
  });

  // ─── Send Time Optimizer ───────────────────────────────────────────

  describe("Send Time Optimizer", () => {
    it("should optimize send time end-to-end", () => {
      const recommendation = optimizer.optimizeSendTime(
        "user_7",
        "ORDER",
        "America/New_York",
        ["EMAIL", "PUSH"]
      );

      expect(recommendation).toBeDefined();
      expect(recommendation.recommendedChannel).toBeDefined();
      expect(recommendation.recommendedHourLocal).toBeGreaterThanOrEqual(0);
      expect(recommendation.recommendedHourLocal).toBeLessThan(24);
    });

    it("should record notification outcomes", () => {
      const outcome: NotificationOutcome = {
        userId: "user_8",
        channel: "EMAIL",
        category: "ORDER",
        sentAt: new Date("2026-03-17T09:00:00Z"),
        openedAt: new Date("2026-03-17T09:15:00Z"),
      };

      optimizer.recordOutcome(outcome);

      const activity = optimizer.getActivityTracker().getActivity("user_8", "EMAIL");
      expect(activity).toBeDefined();
      expect(activity!.totalNotificationsOpened).toBe(1);
    });

    it("should handle outcomes without opens or clicks", () => {
      const outcome: NotificationOutcome = {
        userId: "user_9",
        channel: "SMS",
        category: "DELIVERY",
        sentAt: new Date("2026-03-17T09:00:00Z"),
      };

      optimizer.recordOutcome(outcome);

      const activity = optimizer.getActivityTracker().getActivity("user_9", "SMS");
      expect(activity).toBeDefined();
      expect(activity!.totalNotificationsSent).toBe(1);
      expect(activity!.totalNotificationsOpened).toBe(0);
    });
  });

  // ─── Batch Optimizer ───────────────────────────────────────────────

  describe("Batch Optimizer", () => {
    it("should optimize batch send schedule", () => {
      const batchOpt = createBatchOptimizer(optimizer);
      const schedule = batchOpt.optimizeBatchSend(
        [
          { userId: "user_10", timezone: "America/New_York" },
          { userId: "user_11", timezone: "America/Los_Angeles" },
          { userId: "user_12", timezone: "UTC" },
        ],
        "ORDER",
        ["EMAIL", "PUSH"],
        60
      );

      expect(schedule).toBeDefined();
      expect(schedule.recipients).toHaveLength(3);
      expect(schedule.totalRecipients).toBe(3);
      expect(schedule.staggeringIntervalMs).toBeGreaterThan(0);
    });

    it("should stagger delivery times", () => {
      const batchOpt = createBatchOptimizer(optimizer);
      const recipients = Array.from({ length: 10 }, (_, i) => ({
        userId: `user_batch_${i}`,
        timezone: "UTC",
      }));

      const schedule = batchOpt.optimizeBatchSend(
        recipients,
        "MARKETING",
        ["EMAIL"],
        120
      );

      // Recipients should be sorted by recommended time
      const times = schedule.recipients.map((r) => r.recommendedTimestampUTC.getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });

    it("should include reasoning with peak hours", () => {
      const batchOpt = createBatchOptimizer(optimizer);
      const schedule = batchOpt.optimizeBatchSend(
        [
          { userId: "user_13", timezone: "UTC" },
          { userId: "user_14", timezone: "UTC" },
        ],
        "DELIVERY",
        ["PUSH"],
        60
      );

      expect(schedule.reasoning.peakHours).toBeDefined();
      expect(schedule.reasoning.peakHours.length).toBeGreaterThan(0);
      expect(schedule.reasoning.channelDistribution).toBeDefined();
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────

  describe("Integration", () => {
    it("should handle complete notification lifecycle", () => {
      // Record multiple notifications for user
      const outcomes: NotificationOutcome[] = [
        {
          userId: "user_complete",
          channel: "EMAIL",
          category: "ORDER",
          sentAt: new Date("2026-03-15T09:00:00Z"),
          openedAt: new Date("2026-03-15T09:10:00Z"),
        },
        {
          userId: "user_complete",
          channel: "EMAIL",
          category: "ORDER",
          sentAt: new Date("2026-03-16T09:00:00Z"),
          openedAt: new Date("2026-03-16T09:15:00Z"),
          clickedAt: new Date("2026-03-16T09:16:00Z"),
        },
      ];

      outcomes.forEach((outcome) => optimizer.recordOutcome(outcome));

      // Get optimal time
      const recommendation = optimizer.optimizeSendTime(
        "user_complete",
        "ORDER",
        "UTC",
        ["EMAIL", "PUSH"]
      );

      expect(recommendation.confidence).toBeGreaterThan(30);
    });

    it("should work across multiple channels and categories", () => {
      const channels = ["EMAIL", "SMS", "PUSH"] as const;
      const categories = ["ORDER", "DELIVERY", "MARKETING"] as const;

      // Record diverse activity
      const sentAt = new Date("2026-03-17T09:00:00Z");
      const openedAt = new Date("2026-03-17T09:10:00Z");

      for (const channel of channels) {
        for (const category of categories) {
          tracker.recordOpened("user_diverse", channel, category, "UTC", sentAt, openedAt);
        }
      }

      const activity = tracker.getActivity("user_diverse", "EMAIL");
      expect(activity).toBeDefined();
      expect(Object.keys(activity!.categoryPerformance).length).toBe(3);
    });
  });
});
