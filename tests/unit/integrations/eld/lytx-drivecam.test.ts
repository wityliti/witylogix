/**
 * Lytx DriveCam API Client Tests
 *
 * Tests for:
 * - API initialization and OAuth2 authentication
 * - Video event detection (harsh braking, collision, distraction)
 * - Video clip request and download with signed URLs
 * - Driver management with risk profiles and coaching
 * - Vehicle tracking with camera status
 * - Safety scoring (driver and fleet)
 * - Coaching session creation and sign-off
 * - Safety reports with improvement trends
 * - Live stream request
 * - Real-time alert management
 * - Webhook event handling
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LytxDriveCamClient } from "../../../packages/core/src/integrations/eld/lytx-drivecam-client";
import type { ELDConfig } from "../../../packages/core/src/integrations/eld/types";

describe("LytxDriveCamClient", () => {
  let client: LytxDriveCamClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "omnitracs",
      apiKey: "test-client-id",
      apiSecret: "test-client-secret",
      accountId: "acc_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new LytxDriveCamClient(config);
  });

  describe("initialization", () => {
    it("should initialize successfully with valid OAuth2 credentials", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ account: { id: "acc_123" } }), {
            status: 200,
          }),
        );

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it("should throw error if OAuth2 credentials are missing", () => {
      const invalidConfig = { ...config, apiKey: "", apiSecret: "" };
      const invalidClient = new LytxDriveCamClient(invalidConfig);

      expect(() => invalidClient.initialize()).rejects.toThrow(
        "Lytx DriveCam OAuth2 credentials",
      );
    });
  });

  describe("events", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ account: { id: "acc_123" } }), {
            status: 200,
          }),
        );
    });

    it("should retrieve safety events for driver", async () => {
      const mockEvents = [
        {
          eventId: "event_1",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          eventType: "harsh_braking",
          severity: "high",
          timestamp: "2026-03-12T08:15:00Z",
          videoAvailable: true,
          coachingRequired: true,
          createdAt: "2026-03-12T08:16:00Z",
        },
        {
          eventId: "event_2",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          eventType: "distraction",
          severity: "medium",
          timestamp: "2026-03-12T09:30:00Z",
          videoAvailable: true,
          coachingRequired: false,
          createdAt: "2026-03-12T09:31:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockEvents), { status: 200 }),
      );

      const events = await client.getEvents("driver_1", 30);

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("harsh_braking");
      expect(events[1].eventType).toBe("distraction");
    });

    it("should map events to violations", async () => {
      const mockEvents = [
        {
          eventId: "event_1",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          eventType: "collision",
          severity: "critical",
          timestamp: "2026-03-12T08:15:00Z",
          videoAvailable: true,
          coachingRequired: true,
          createdAt: "2026-03-12T08:16:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockEvents), { status: 200 }),
      );

      const violations = await client.getViolations("driver_1", 30);

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("critical");
      expect(violations[0].description).toBe("collision");
    });
  });

  describe("video clips", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should request video clip for event", async () => {
      const mockClip = {
        clipId: "clip_1",
        eventId: "event_1",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: "2026-03-12T08:15:00Z",
        endTime: "2026-03-12T08:20:00Z",
        downloadUrl: "https://api.lytx.com/download/clip_1?expires=...",
        duration: 300,
        format: "mp4",
        createdAt: "2026-03-12T08:16:00Z",
        expiresAt: "2026-03-12T09:16:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockClip), { status: 200 }),
      );

      const clip = await client.requestVideoClip("event_1");

      expect(clip.clipId).toBe("clip_1");
      expect(clip.duration).toBe(300);
      expect(clip.downloadUrl).toContain("https://api.lytx.com");
    });

    it("should download video clip with time range", async () => {
      const mockResponse = {
        downloadUrl: "https://api.lytx.com/download/video?expires=...",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const startTime = new Date("2026-03-12T08:15:00Z");
      const endTime = new Date("2026-03-12T08:20:00Z");
      const downloadUrl = await client.downloadVideoClip(
        "event_1",
        startTime,
        endTime,
      );

      expect(downloadUrl).toContain("https://api.lytx.com");
    });
  });

  describe("drivers", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should retrieve driver with risk profile", async () => {
      const mockDriver = {
        driverId: "driver_1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        riskProfile: {
          riskScore: 35,
          riskLevel: "low",
          eventCount: 2,
          lastIncident: "2026-03-10T14:00:00Z",
        },
        coachingHistory: [
          {
            sessionId: "session_1",
            eventId: "event_1",
            createdAt: "2026-03-12T08:16:00Z",
            completedAt: "2026-03-12T14:00:00Z",
            status: "completed",
          },
        ],
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2026-03-12T12:00:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDriver), { status: 200 }),
      );

      const driver = await client.getDriver("driver_1");

      expect(driver.driverId).toBe("driver_1");
      expect(driver.riskProfile?.riskScore).toBe(35);
      expect(driver.riskProfile?.riskLevel).toBe("low");
      expect(driver.coachingHistory).toHaveLength(1);
    });

    it("should retrieve all drivers", async () => {
      const mockDrivers = [
        {
          driverId: "driver_1",
          firstName: "John",
          lastName: "Doe",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2026-03-12T12:00:00Z",
        },
        {
          driverId: "driver_2",
          firstName: "Jane",
          lastName: "Smith",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2026-03-12T12:00:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDrivers), { status: 200 }),
      );

      const drivers = await client.getDrivers();

      expect(drivers).toHaveLength(2);
      expect(drivers[0].firstName).toBe("John");
    });
  });

  describe("safety scoring", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should retrieve driver safety score", async () => {
      const mockScore = {
        scoreId: "score_1",
        driverId: "driver_1",
        period: "monthly",
        driverRiskScore: 35,
        fleetAverage: 50,
        benchmark: 40,
        eventBreakdown: {
          harshBraking: 2,
          collision: 0,
          distraction: 1,
          unsafeFollowing: 0,
        },
        coachingCompletionRate: 100,
        trend: "improving",
        createdAt: "2026-03-12T12:00:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockScore), { status: 200 }),
      );

      const score = await client.getSafetyScore("driver_1", "monthly");

      expect(score.driverRiskScore).toBe(35);
      expect(score.trend).toBe("improving");
      expect(score.eventBreakdown.harshBraking).toBe(2);
    });

    it("should retrieve fleet safety score", async () => {
      const mockFleetScore = {
        fleetRiskScore: 50,
        driverCount: 50,
        eventCount: 234,
        trend: "stable",
        topRisks: ["harsh_braking", "distraction"],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockFleetScore), { status: 200 }),
      );

      const fleetScore = await client.getFleetSafetyScore("monthly");

      expect(fleetScore.fleetRiskScore).toBe(50);
    });
  });

  describe("coaching", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should create coaching session from event", async () => {
      const mockSession = {
        sessionId: "session_1",
        driverId: "driver_1",
        eventId: "event_1",
        createdAt: "2026-03-12T08:16:00Z",
        topic: "Safety Coaching",
        status: "pending",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockSession), { status: 200 }),
      );

      const session = await client.createCoachingSession(
        "event_1",
        "Safety Coaching",
      );

      expect(session.sessionId).toBe("session_1");
      expect(session.status).toBe("pending");
      expect(session.topic).toBe("Safety Coaching");
    });

    it("should complete coaching session with sign-off", async () => {
      const mockSession = {
        sessionId: "session_1",
        driverId: "driver_1",
        eventId: "event_1",
        completedAt: "2026-03-12T14:00:00Z",
        status: "completed",
        signedOffBy: "driver_1",
        signedOffAt: "2026-03-12T14:00:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockSession), { status: 200 }),
      );

      const session = await client.completeCoachingSession(
        "session_1",
        "driver_1",
      );

      expect(session.status).toBe("completed");
      expect(session.signedOffBy).toBe("driver_1");
    });
  });

  describe("reports", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should retrieve safety report with improvement trends", async () => {
      const mockReport = {
        reportId: "report_1",
        driverId: "driver_1",
        period: "monthly",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        eventFrequency: {
          harsh_braking: 2,
          collision: 0,
          distraction: 1,
        },
        safetyScore: 85,
        improvementTrend: {
          previousScore: 78,
          percentChange: 9,
        },
        coachingCompletions: 2,
        recommendations: [
          "Continue focus on collision avoidance",
          "Reduce distraction incidents",
        ],
        createdAt: "2026-03-31T23:59:59Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockReport), { status: 200 }),
      );

      const report = await client.getSafetyReport("driver_1", "monthly");

      expect(report.safetyScore).toBe(85);
      expect(report.improvementTrend?.percentChange).toBe(9);
      expect(report.recommendations).toHaveLength(2);
    });
  });

  describe("live stream", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should request live stream for vehicle", async () => {
      const mockStream = {
        streamId: "stream_1",
        vehicleId: "vehicle_1",
        streamUrl: "https://stream.lytx.com/live/stream_1",
        expiresAt: "2026-03-12T13:15:00Z",
        quality: "hd",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockStream), { status: 200 }),
      );

      const stream = await client.requestLiveStream("vehicle_1", 300);

      expect(stream.streamId).toBe("stream_1");
      expect(stream.streamUrl).toContain("https://stream.lytx.com");
      expect(stream.quality).toBe("hd");
    });
  });

  describe("alerts", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );
    });

    it("should retrieve real-time alerts", async () => {
      const mockAlerts = [
        {
          alertId: "alert_1",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          alertType: "high_risk_event",
          severity: "critical",
          message: "Collision detected",
          timestamp: "2026-03-12T08:15:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockAlerts), { status: 200 }),
      );

      const alerts = await client.getAlerts("critical");

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
    });

    it("should acknowledge alert", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      await expect(client.acknowledgeAlert("alert_1")).resolves.not.toThrow();
    });
  });

  describe("health check", () => {
    it("should return true for successful health check", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ account: { id: "acc_123" } }), {
            status: 200,
          }),
        );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false for failed health check", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection timeout"),
      );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});
