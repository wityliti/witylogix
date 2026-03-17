/**
 * Notification Fatigue Detector Tests
 *
 * Tests for:
 * - Fatigue score calculation (volume, trends)
 * - Overload detection (high volume in short window)
 * - Throttle recommendations
 * - Importance ranking (priority, relevance, timeliness)
 * - Digest window optimization
 * - Unsubscribe risk prediction
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createFatigueDetector,
  createOverloadDetector,
  createThrottleRecommender,
  createImportanceRanker,
  createUnsubscribePrediction,
  FatigueScorer,
  OverloadDetector,
  ThrottleRecommender,
  ImportanceRanker,
  UnsubscribePrediction,
} from "../notification-fatigue-detector.js";

describe("Notification Fatigue Detector", () => {
  let fatigueScorer: FatigueScorer;
  let overloadDetector: OverloadDetector;
  let throttleRecommender: ThrottleRecommender;
  let importanceRanker: ImportanceRanker;

  beforeEach(() => {
    fatigueScorer = createFatigueDetector();
    overloadDetector = createOverloadDetector();
    throttleRecommender = createThrottleRecommender(fatigueScorer);
    importanceRanker = createImportanceRanker();
  });

  // ─── Fatigue Scorer ────────────────────────────────────────────────

  describe("Fatigue Scorer", () => {
    it("should return low fatigue for no notifications", () => {
      const score = fatigueScorer.calculateFatigueScore("user_no_notifs");

      expect(score.overallFatigueScore).toBeLessThan(30);
      expect(score.fatigueSeverity).toBe("NONE");
    });

    it("should track daily notification volume", () => {
      for (let i = 0; i < 15; i++) {
        fatigueScorer.recordNotificationSent("user_volume", "EMAIL", "ORDER");
      }

      const score = fatigueScorer.calculateFatigueScore("user_volume");

      expect(score.metrics.notificationsToday).toBe(15);
      expect(score.factors.dailyVolumeScore).toBeGreaterThan(0);
    });

    it("should increase fatigue with high dismiss rates", () => {
      fatigueScorer.recordNotificationSent("user_dismiss", "EMAIL", "ORDER");
      fatigueScorer.recordNotificationDismissed("user_dismiss");
      fatigueScorer.recordNotificationDismissed("user_dismiss");
      fatigueScorer.recordNotificationDismissed("user_dismiss");

      const score = fatigueScorer.calculateFatigueScore("user_dismiss");

      expect(score.factors.dismissRateTrendScore).toBeGreaterThan(0);
      expect(score.signals.length).toBeGreaterThan(0);
    });

    it("should track channel-specific fatigue", () => {
      // Record heavy email usage
      for (let i = 0; i < 20; i++) {
        fatigueScorer.recordNotificationSent("user_ch_fatigue", "EMAIL", "MARKETING");
      }

      // Lighter SMS usage
      for (let i = 0; i < 3; i++) {
        fatigueScorer.recordNotificationSent("user_ch_fatigue", "SMS", "ORDER");
      }

      const score = fatigueScorer.calculateFatigueScore("user_ch_fatigue");

      expect(score.factors.channelFatigueScores["EMAIL"]).toBeGreaterThan(
        score.factors.channelFatigueScores["SMS"]
      );
    });

    it("should calculate fatigue severity levels", () => {
      // Light usage
      const lightScore = fatigueScorer.calculateFatigueScore("light_user");
      expect(["NONE", "LOW"]).toContain(lightScore.fatigueSeverity);

      // Heavy usage
      for (let i = 0; i < 50; i++) {
        fatigueScorer.recordNotificationSent("heavy_user", "EMAIL", "MARKETING");
      }
      const heavyScore = fatigueScorer.calculateFatigueScore("heavy_user");
      expect(heavyScore.overallFatigueScore).toBeGreaterThan(30);
    });

    it("should track unsubscribe attempts as signals", () => {
      fatigueScorer.recordUnsubscribeAttempt("user_unsubscribe");

      const score = fatigueScorer.calculateFatigueScore("user_unsubscribe");

      expect(score.metrics.unsubscribeAttempts).toBe(1);
      expect(score.signals.some((s) => s.signalType === "UNSUBSCRIBE_REQUEST")).toBe(true);
    });

    it("should decay fatigue on successful opens", () => {
      // Build up fatigue
      for (let i = 0; i < 20; i++) {
        fatigueScorer.recordNotificationSent("user_open", "EMAIL", "ORDER");
      }

      const scoreBeforeOpen = fatigueScorer.calculateFatigueScore("user_open");

      // Record successful open
      fatigueScorer.recordNotificationOpened("user_open");

      const scoreAfterOpen = fatigueScorer.calculateFatigueScore("user_open");

      expect(scoreAfterOpen.factors.channelFatigueScores["EMAIL"]).toBeLessThan(
        scoreBeforeOpen.factors.channelFatigueScores["EMAIL"]
      );
    });
  });

  // ─── Overload Detector ─────────────────────────────────────────────

  describe("Overload Detector", () => {
    it("should detect overload with high volume in short window", () => {
      // Record 20+ notifications in 1 hour
      for (let i = 0; i < 25; i++) {
        overloadDetector.recordNotification("user_overload");
      }

      const isOverloaded = overloadDetector.isOverloaded("user_overload", 20, 1);
      expect(isOverloaded).toBe(true);
    });

    it("should not flag normal volume as overload", () => {
      for (let i = 0; i < 5; i++) {
        overloadDetector.recordNotification("user_normal");
      }

      const isOverloaded = overloadDetector.isOverloaded("user_normal", 20, 1);
      expect(isOverloaded).toBe(false);
    });

    it("should count notifications in rolling window", () => {
      for (let i = 0; i < 15; i++) {
        overloadDetector.recordNotification("user_window");
      }

      const count = overloadDetector.getNotificationCountInWindow("user_window", 1);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(15);
    });

    it("should respect custom thresholds", () => {
      for (let i = 0; i < 10; i++) {
        overloadDetector.recordNotification("user_threshold");
      }

      const isOverloadedHigh = overloadDetector.isOverloaded("user_threshold", 50, 1);
      expect(isOverloadedHigh).toBe(false);

      const isOverloadedLow = overloadDetector.isOverloaded("user_threshold", 5, 1);
      expect(isOverloadedLow).toBe(true);
    });
  });

  // ─── Throttle Recommender ──────────────────────────────────────────

  describe("Throttle Recommender", () => {
    it("should not recommend throttle for healthy users", () => {
      const recommendation = throttleRecommender.recommendThrottle("healthy_user");

      expect(recommendation.shouldThrottle).toBe(false);
      expect(recommendation.recommendedReduction).toBe(0);
    });

    it("should recommend throttle for fatigued users", () => {
      // Create fatigued user
      for (let i = 0; i < 40; i++) {
        fatigueScorer.recordNotificationSent("fatigued_user", "EMAIL", "MARKETING");
      }

      const recommendation = throttleRecommender.recommendThrottle("fatigued_user");

      expect(recommendation.shouldThrottle).toBe(true);
      expect(recommendation.recommendedReduction).toBeGreaterThan(0);
      expect(recommendation.throttleWindow.durationHours).toBeGreaterThan(0);
    });

    it("should increase throttle duration for severe fatigue", () => {
      // Build severe fatigue
      for (let i = 0; i < 100; i++) {
        fatigueScorer.recordNotificationSent("severe_user", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("severe_user");
      }

      const recommendation = throttleRecommender.recommendThrottle("severe_user");

      if (recommendation.shouldThrottle) {
        expect(recommendation.throttleWindow.durationHours).toBeGreaterThan(6);
      }
    });

    it("should identify affected categories", () => {
      // Heavy marketing emails
      for (let i = 0; i < 30; i++) {
        fatigueScorer.recordNotificationSent("cat_user", "EMAIL", "MARKETING");
      }

      // Light order emails
      for (let i = 0; i < 5; i++) {
        fatigueScorer.recordNotificationSent("cat_user", "EMAIL", "ORDER");
      }

      const recommendation = throttleRecommender.recommendThrottle("cat_user");

      if (recommendation.shouldThrottle && recommendation.categoriesAffected) {
        expect(recommendation.categoriesAffected.length).toBeGreaterThan(0);
      }
    });

    it("should recommend stricter priority threshold for severe cases", () => {
      for (let i = 0; i < 80; i++) {
        fatigueScorer.recordNotificationSent("severe2_user", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("severe2_user");
      }

      const recommendation = throttleRecommender.recommendThrottle("severe2_user");

      if (recommendation.shouldThrottle) {
        expect(["HIGH", "CRITICAL"]).toContain(recommendation.priorityThreshold);
      }
    });
  });

  // ─── Importance Ranker ────────────────────────────────────────────

  describe("Importance Ranker", () => {
    it("should rank CRITICAL priority highest", () => {
      const criticalScore = importanceRanker.rankImportance(
        "notif_1",
        "user_1",
        "ORDER",
        "CRITICAL",
        0.5
      );
      const normalScore = importanceRanker.rankImportance(
        "notif_2",
        "user_1",
        "ORDER",
        "NORMAL",
        0.5
      );

      expect(criticalScore.importanceScore).toBeGreaterThan(normalScore.importanceScore);
    });

    it("should factor user affinity", () => {
      const highAffinityScore = importanceRanker.rankImportance(
        "notif_3",
        "user_2",
        "ORDER",
        "NORMAL",
        0.9
      );
      const lowAffinityScore = importanceRanker.rankImportance(
        "notif_4",
        "user_2",
        "ORDER",
        "NORMAL",
        0.1
      );

      expect(highAffinityScore.importanceScore).toBeGreaterThan(lowAffinityScore.importanceScore);
    });

    it("should rank batch of notifications", () => {
      const notifications = [
        { id: "n1", category: "ORDER" as const, priority: "CRITICAL" as const },
        { id: "n2", category: "MARKETING" as const, priority: "LOW" as const },
        { id: "n3", category: "DELIVERY" as const, priority: "HIGH" as const },
      ];

      const scores = importanceRanker.rankBatch(notifications, "user_batch");

      expect(scores).toHaveLength(3);
      expect(scores[0].importanceScore).toBeGreaterThan(0);

      // CRITICAL should rank higher than LOW
      const criticalScore = scores.find((s) => s.priority === "CRITICAL");
      const lowScore = scores.find((s) => s.priority === "LOW");

      if (criticalScore && lowScore) {
        expect(criticalScore.importanceScore).toBeGreaterThan(lowScore.importanceScore);
      }
    });

    it("should show transparent factor breakdown", () => {
      const score = importanceRanker.rankImportance(
        "notif_5",
        "user_3",
        "ORDER",
        "HIGH",
        0.6
      );

      expect(score.factors.priorityFactor).toBeGreaterThan(0);
      expect(score.factors.relevanceFactor).toBeGreaterThan(0);
      expect(score.factors.timelinesseFactor).toBeGreaterThan(0);
      expect(score.factors.userAffinityFactor).toBeGreaterThan(0);
    });
  });

  // ─── Unsubscribe Prediction ────────────────────────────────────────

  describe("Unsubscribe Prediction", () => {
    it("should predict low risk for healthy users", () => {
      const fatigueScore = fatigueScorer.calculateFatigueScore("healthy_pred");
      const predictor = createUnsubscribePrediction();
      const risk = predictor.predictUnsubscribeRisk("healthy_pred", fatigueScore);

      expect(risk.riskLevel).toBe("LOW");
      expect(risk.unsubscribeLikelihood).toBeLessThan(30);
    });

    it("should predict high risk for fatigued users", () => {
      for (let i = 0; i < 50; i++) {
        fatigueScorer.recordNotificationSent("fatigued_pred", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("fatigued_pred");
      }

      const fatigueScore = fatigueScorer.calculateFatigueScore("fatigued_pred");
      const predictor = createUnsubscribePrediction();
      const risk = predictor.predictUnsubscribeRisk("fatigued_pred", fatigueScore);

      expect(risk.riskLevel).toBe("HIGH");
      expect(risk.unsubscribeLikelihood).toBeGreaterThan(50);
    });

    it("should predict CRITICAL risk for severe cases", () => {
      for (let i = 0; i < 80; i++) {
        fatigueScorer.recordNotificationSent("critical_pred", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("critical_pred");
      }
      fatigueScorer.recordUnsubscribeAttempt("critical_pred");

      const fatigueScore = fatigueScorer.calculateFatigueScore("critical_pred");
      const predictor = createUnsubscribePrediction();
      const risk = predictor.predictUnsubscribeRisk("critical_pred", fatigueScore);

      expect(risk.riskLevel).toBe("CRITICAL");
      expect(risk.daysUntilLikelyUnsubscribe).toBeLessThan(30);
    });

    it("should recommend actions for at-risk users", () => {
      for (let i = 0; i < 60; i++) {
        fatigueScorer.recordNotificationSent("action_pred", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("action_pred");
      }

      const fatigueScore = fatigueScorer.calculateFatigueScore("action_pred");
      const predictor = createUnsubscribePrediction();
      const risk = predictor.predictUnsubscribeRisk("action_pred", fatigueScore);

      if (risk.riskLevel !== "LOW") {
        expect(risk.recommendedActions.length).toBeGreaterThan(0);
        expect(risk.recommendedActions[0].action).toBeDefined();
      }
    });

    it("should identify at-risk channels", () => {
      for (let i = 0; i < 40; i++) {
        fatigueScorer.recordNotificationSent("ch_risk", "EMAIL", "MARKETING");
        fatigueScorer.recordNotificationDismissed("ch_risk");
      }

      const fatigueScore = fatigueScorer.calculateFatigueScore("ch_risk");
      const predictor = createUnsubscribePrediction();
      const risk = predictor.predictUnsubscribeRisk("ch_risk", fatigueScore);

      if (risk.factors.channelsAtRisk.length > 0) {
        expect(risk.factors.channelsAtRisk[0].channel).toBeDefined();
        expect(risk.factors.channelsAtRisk[0].riskScore).toBeGreaterThan(0);
      }
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────

  describe("Integration", () => {
    it("should handle complete fatigue lifecycle", () => {
      const userId = "lifecycle_user";

      // Phase 1: Normal volume
      for (let i = 0; i < 5; i++) {
        fatigueScorer.recordNotificationSent(userId, "EMAIL", "ORDER");
      }

      const phase1Score = fatigueScorer.calculateFatigueScore(userId);
      expect(phase1Score.fatigueSeverity).toBe("NONE");

      // Phase 2: Increased volume
      for (let i = 0; i < 30; i++) {
        fatigueScorer.recordNotificationSent(userId, "EMAIL", "MARKETING");
      }

      const phase2Score = fatigueScorer.calculateFatigueScore(userId);
      expect(phase2Score.overallFatigueScore).toBeGreaterThan(phase1Score.overallFatigueScore);

      // Phase 3: Low engagement
      for (let i = 0; i < 10; i++) {
        fatigueScorer.recordNotificationDismissed(userId);
      }

      const phase3Score = fatigueScorer.calculateFatigueScore(userId);
      expect(phase3Score.overallFatigueScore).toBeGreaterThan(phase2Score.overallFatigueScore);

      // Should recommend throttle by phase 3
      const throttleRec = throttleRecommender.recommendThrottle(userId);
      expect(throttleRec.shouldThrottle).toBe(true);
    });
  });
});
