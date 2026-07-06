/**
 * Tests for the public ML ETA endpoint (WIT-310)
 *
 * GET /api/v4/tracking/track/:trackingCode/eta
 *
 * Scenarios:
 *   - valid tracking code with driver location → AI prediction
 *   - valid tracking code without driver (no driver assigned) → static fallback
 *   - tracking code not found → 404
 *   - Redis cache hit → cached response
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ────────────────────────────────────────────

vi.mock("@witylogix/db", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@witylogix/core/ai-eta", () => ({
  etaEngine: {
    predictETA: vi.fn(),
  },
}));

vi.mock("../../lib/redis.js", () => ({
  getRedis: vi.fn(),
}));

vi.mock("../../middleware/rate-limit-routes.js", () => ({
  createRateLimiter: () => async () => {}, // no-op pre-handler in tests
}));

// ─── Imports (after mocks) ───────────────────────────────────

import { prisma } from "@witylogix/db";
import { etaEngine } from "@witylogix/core/ai-eta";
import { getRedis } from "../../lib/redis.js";
import trackingRoutes from "../tracking.js";
import Fastify from "fastify";

// ─── Helpers ─────────────────────────────────────────────────

const TRACKING_CODE = "abc123xyz789";

function makeMockRedis(cachedValue: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(cachedValue),
    set: vi.fn().mockResolvedValue("OK"),
  };
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(trackingRoutes, { prefix: "/api/v4/tracking" });
  await app.ready();
  return app;
}

// ─── Tests ───────────────────────────────────────────────────

describe("GET /api/v4/tracking/track/:trackingCode/eta (WIT-310)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(makeMockRedis());
    app = await buildApp();
  });

  describe("valid tracking code with driver location", () => {
    it("returns AI-predicted ETA with confidence score and traffic status", async () => {
      const expectedArrival = new Date(Date.now() + 30 * 60 * 1000);

      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-1",
        estimatedArrival: null,
        deliveryLocation: { lat: 40.758, lng: -73.985 },
        driver: { currentLocation: { lat: 40.712, lng: -74.006 } },
      });

      (etaEngine.predictETA as ReturnType<typeof vi.fn>).mockReturnValue({
        prediction: {
          expected: expectedArrival,
          low: new Date(expectedArrival.getTime() - 10 * 60 * 1000),
          high: new Date(expectedArrival.getTime() + 10 * 60 * 1000),
        },
        confidence: 0.82,
        trafficCondition: "moderate",
        modelUsed: "ensemble",
        modelsConsidered: ["distance", "time-of-day", "traffic"],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toMatchObject({
        estimatedArrival: expectedArrival.toISOString(),
        confidenceScore: 0.82,
        trafficStatus: "moderate",
      });
      expect(typeof body.data.distanceKm).toBe("number");
      expect(body.data.distanceKm).toBeGreaterThan(0);
    });

    it("calls predictETA with correct origin and destination", async () => {
      const driverLoc = { lat: 40.712, lng: -74.006 };
      const destLoc = { lat: 40.758, lng: -73.985 };

      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-2",
        estimatedArrival: null,
        deliveryLocation: destLoc,
        driver: { currentLocation: driverLoc },
      });

      (etaEngine.predictETA as ReturnType<typeof vi.fn>).mockReturnValue({
        prediction: { expected: new Date(), low: new Date(), high: new Date() },
        confidence: 0.75,
        trafficCondition: "light",
        modelUsed: "ensemble",
        modelsConsidered: [],
      });

      await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });

      expect(etaEngine.predictETA).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: driverLoc,
          destination: destLoc,
          distanceKm: expect.any(Number),
          departureTime: expect.any(Date),
        }),
      );
    });

    it("caches the response in Redis with 60-second TTL", async () => {
      const mockRedis = makeMockRedis();
      (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);

      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-3",
        estimatedArrival: null,
        deliveryLocation: { lat: 40.758, lng: -73.985 },
        driver: { currentLocation: { lat: 40.712, lng: -74.006 } },
      });

      (etaEngine.predictETA as ReturnType<typeof vi.fn>).mockReturnValue({
        prediction: { expected: new Date(), low: new Date(), high: new Date() },
        confidence: 0.9,
        trafficCondition: "light",
        modelUsed: "ensemble",
        modelsConsidered: [],
      });

      await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });

      // Allow fire-and-forget set to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRedis.set).toHaveBeenCalledWith(
        `eta:public:${TRACKING_CODE}`,
        expect.any(String),
        "EX",
        60,
      );
    });
  });

  describe("driver not yet assigned", () => {
    it("returns static DB estimate with confidenceScore 0 and trafficStatus unknown", async () => {
      const dbArrival = new Date(Date.now() + 2 * 60 * 60 * 1000);

      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-4",
        estimatedArrival: dbArrival,
        deliveryLocation: { lat: 40.758, lng: -73.985 },
        driver: null,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toMatchObject({
        estimatedArrival: dbArrival.toISOString(),
        confidenceScore: 0,
        distanceKm: 0,
        trafficStatus: "unknown",
      });
      expect(etaEngine.predictETA).not.toHaveBeenCalled();
    });

    it("uses 2-hour fallback when no estimatedArrival in DB", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-5",
        estimatedArrival: null,
        deliveryLocation: null,
        driver: null,
      });

      const before = Date.now() + 2 * 60 * 60 * 1000 - 1000;
      const response = await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });
      const after = Date.now() + 2 * 60 * 60 * 1000 + 1000;

      expect(response.statusCode).toBe(200);
      const arrival = new Date(response.json().data.estimatedArrival).getTime();
      expect(arrival).toBeGreaterThanOrEqual(before);
      expect(arrival).toBeLessThanOrEqual(after);
    });
  });

  describe("tracking code not found", () => {
    it("returns 404 when tracking code is not in DB", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/notavalidcode/eta`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Redis cache hit", () => {
    it("returns cached response and skips DB + ML engine", async () => {
      const cachedData = {
        estimatedArrival: new Date().toISOString(),
        confidenceScore: 0.77,
        distanceKm: 3.2,
        trafficStatus: "light",
      };
      const mockRedis = makeMockRedis(JSON.stringify(cachedData));
      (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);

      const response = await app.inject({
        method: "GET",
        url: `/api/v4/tracking/track/${TRACKING_CODE}/eta`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(cachedData);
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(etaEngine.predictETA).not.toHaveBeenCalled();
    });
  });
});
