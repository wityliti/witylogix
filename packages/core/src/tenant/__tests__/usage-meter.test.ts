/**
 * Usage Meter Tests — API usage tracking, aggregation, quota checking.
 *
 * Tests cover:
 * - Recording individual usage events (non-blocking)
 * - Buffer flushing (100 records or 5 seconds)
 * - Daily aggregation (rolls up raw records)
 * - Quota enforcement (per-plan limits)
 * - Top endpoints analysis
 * - Cleanup of old records
 *
 * Run with: npm test -- usage-meter.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordUsage,
  getUsageSummary,
  checkQuota,
  getTodayQuotaStatus,
  getTopEndpoints,
  aggregateDailyUsage,
  cleanupOldRecords,
  shutdownUsageMeter,
} from "../usage-meter";
import { prisma } from "@witylogix/db";

describe("Usage Meter", () => {
  const testOrgId = "test-org-uuid";
  const testApiKeyId = "test-api-key-uuid";

  beforeEach(async () => {
    // Create test organization
    await prisma.organization.create({
      data: {
        id: testOrgId,
        name: "Test Org",
        slug: "test-org",
        planTier: "STARTUP",
        isActive: true,
      },
    });

    // Create test API key
    await prisma.apiKey.create({
      data: {
        id: testApiKeyId,
        orgId: testOrgId,
        name: "Test Key",
        keyHash: "testhash",
        prefix: "wl_live_",
        scopes: ["READ"],
        isActive: true,
        createdBy: "system",
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    await shutdownUsageMeter();
    await prisma.usageRecord.deleteMany({ where: { orgId: testOrgId } });
    await prisma.usageSummary.deleteMany({ where: { orgId: testOrgId } });
    await prisma.apiKey.deleteMany({ where: { orgId: testOrgId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
  });

  // ─── RECORDING TESTS ────────────────────────────────────────────────

  describe("recordUsage", () => {
    it("should record a usage event (non-blocking)", async () => {
      recordUsage(
        testOrgId,
        testApiKeyId,
        "/api/v1/routes",
        "GET",
        200,
        42,
        128,
        1024,
        "192.168.1.1",
      );

      // Flush to ensure write
      await shutdownUsageMeter();

      const records = await prisma.usageRecord.findMany({
        where: { orgId: testOrgId },
      });

      expect(records).toHaveLength(1);
      expect(records[0].endpoint).toBe("/api/v1/routes");
      expect(records[0].statusCode).toBe(200);
      expect(records[0].responseTimeMs).toBe(42);
    });

    it("should record request and response sizes", async () => {
      recordUsage(
        testOrgId,
        testApiKeyId,
        "/api/v1/orders",
        "POST",
        201,
        156,
        2048, // request
        4096, // response
        "192.168.1.1",
      );

      await shutdownUsageMeter();

      const record = await prisma.usageRecord.findFirst({
        where: { orgId: testOrgId },
      });

      expect(record?.requestSizeBytes).toBe(2048);
      expect(record?.responseSizeBytes).toBe(4096);
    });

    it("should record without API key (JWT auth)", async () => {
      recordUsage(
        testOrgId,
        undefined, // No API key
        "/api/v1/drivers",
        "GET",
        200,
        50,
        100,
        500,
        "192.168.1.2",
      );

      await shutdownUsageMeter();

      const record = await prisma.usageRecord.findFirst({
        where: { orgId: testOrgId },
      });

      expect(record?.apiKeyId).toBeNull();
    });

    it("should handle multiple concurrent records", async () => {
      for (let i = 0; i < 10; i++) {
        recordUsage(
          testOrgId,
          testApiKeyId,
          `/api/v1/endpoint${i}`,
          i % 2 === 0 ? "GET" : "POST",
          i % 3 === 0 ? 400 : 200,
          Math.random() * 200,
          Math.random() * 1024,
          Math.random() * 4096,
          `192.168.1.${i}`,
        );
      }

      await shutdownUsageMeter();

      const records = await prisma.usageRecord.findMany({
        where: { orgId: testOrgId },
      });

      expect(records).toHaveLength(10);
    });
  });

  // ─── AGGREGATION TESTS ──────────────────────────────────────────────

  describe("aggregateDailyUsage", () => {
    beforeEach(async () => {
      // Create raw usage records for today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      await prisma.usageRecord.createMany({
        data: [
          {
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/api/v1/routes",
            method: "GET",
            statusCode: 200,
            responseTimeMs: 50,
            requestSizeBytes: 100,
            responseSizeBytes: 1000,
            ipAddress: "192.168.1.1",
            timestamp: today,
          },
          {
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/api/v1/routes",
            method: "GET",
            statusCode: 200,
            responseTimeMs: 60,
            requestSizeBytes: 100,
            responseSizeBytes: 1000,
            ipAddress: "192.168.1.2",
            timestamp: today,
          },
          {
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/api/v1/drivers",
            method: "POST",
            statusCode: 500,
            responseTimeMs: 100,
            requestSizeBytes: 200,
            responseSizeBytes: 500,
            ipAddress: "192.168.1.3",
            timestamp: today,
          },
        ],
      });
    });

    it("should aggregate daily usage into UsageSummary", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await aggregateDailyUsage();

      const summary = await prisma.usageSummary.findUnique({
        where: { orgId_period: { orgId: testOrgId, period: today } },
      });

      expect(summary).toBeDefined();
      expect(summary?.requestCount).toBe(3);
      expect(summary?.errorCount).toBe(1); // One 500 error
    });

    it("should calculate bandwidth correctly", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await aggregateDailyUsage();

      const summary = await prisma.usageSummary.findUnique({
        where: { orgId_period: { orgId: testOrgId, period: today } },
      });

      // (100 + 1000) + (100 + 1000) + (200 + 500) = 2800
      expect(summary?.bandwidthBytes).toBe(2800n);
    });

    it("should identify top endpoints", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await aggregateDailyUsage();

      const summary = await prisma.usageSummary.findUnique({
        where: { orgId_period: { orgId: testOrgId, period: today } },
      });

      expect(summary?.topEndpoints).toBeDefined();
      const topEndpoints = summary?.topEndpoints as any;
      expect(topEndpoints.length).toBeGreaterThan(0);
      expect(topEndpoints[0].endpoint).toBe("/api/v1/routes"); // 2 requests
    });

    it("should calculate average response time", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await aggregateDailyUsage();

      const summary = await prisma.usageSummary.findUnique({
        where: { orgId_period: { orgId: testOrgId, period: today } },
      });

      // (50 + 60 + 100) / 3 = 70
      expect(summary?.avgResponseTimeMs).toBe(70);
    });

    it("should count unique endpoints", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await aggregateDailyUsage();

      const summary = await prisma.usageSummary.findUnique({
        where: { orgId_period: { orgId: testOrgId, period: today } },
      });

      expect(summary?.uniqueEndpoints).toBe(2);
    });
  });

  // ─── QUOTA CHECKING TESTS ───────────────────────────────────────────

  describe("checkQuota", () => {
    beforeEach(async () => {
      // Create today's usage summary
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await prisma.usageSummary.create({
        data: {
          orgId: testOrgId,
          period: today,
          requestCount: 8000, // 8k requests
          bandwidthBytes: 10000000n,
          errorCount: 50,
          avgResponseTimeMs: 75,
          uniqueEndpoints: 15,
          topEndpoints: [],
        },
      });
    });

    it("should return true when under quota", async () => {
      const result = await checkQuota(testOrgId, {
        maxRequestsPerDay: 10000,
      });

      expect(result).toBe(true);
    });

    it("should return false when at quota", async () => {
      const result = await checkQuota(testOrgId, {
        maxRequestsPerDay: 8000,
      });

      expect(result).toBe(false);
    });

    it("should return false when over quota", async () => {
      const result = await checkQuota(testOrgId, {
        maxRequestsPerDay: 5000,
      });

      expect(result).toBe(false);
    });

    it("should return true for unlimited plans", async () => {
      const result = await checkQuota(testOrgId, {
        maxRequestsPerDay: Number.MAX_SAFE_INTEGER,
      });

      expect(result).toBe(true);
    });

    it("should return true when no usage today", async () => {
      const other = await prisma.organization.create({
        data: {
          id: "other-org",
          name: "Other",
          slug: "other",
          planTier: "FREE",
          isActive: true,
        },
      });

      const result = await checkQuota(other.id, {
        maxRequestsPerDay: 100,
      });

      expect(result).toBe(true);

      await prisma.organization.delete({ where: { id: other.id } });
    });
  });

  // ─── QUOTA STATUS TESTS ──────────────────────────────────────────────

  describe("getTodayQuotaStatus", () => {
    beforeEach(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await prisma.usageSummary.create({
        data: {
          orgId: testOrgId,
          period: today,
          requestCount: 6000,
          bandwidthBytes: 0n,
          errorCount: 0,
          avgResponseTimeMs: 0,
          uniqueEndpoints: 0,
          topEndpoints: [],
        },
      });
    });

    it("should report quota status", async () => {
      const status = await getTodayQuotaStatus(testOrgId, 10000);

      expect(status.used).toBe(6000);
      expect(status.limit).toBe(10000);
      expect(status.remaining).toBe(4000);
      expect(status.percentUsed).toBe(60);
      expect(status.exceeded).toBe(false);
    });

    it("should mark as exceeded when over limit", async () => {
      const status = await getTodayQuotaStatus(testOrgId, 5000);

      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0); // Floor at 0
    });

    it("should handle 100% quota usage", async () => {
      const status = await getTodayQuotaStatus(testOrgId, 6000);

      expect(status.percentUsed).toBe(100);
      expect(status.remaining).toBe(0);
      expect(status.exceeded).toBe(true);
    });
  });

  // ─── TOP ENDPOINTS TESTS ────────────────────────────────────────────

  describe("getTopEndpoints", () => {
    beforeEach(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Create various usage records
      await prisma.usageRecord.createMany({
        data: [
          // /api/v1/routes - 5 requests, 1 error
          ...Array.from({ length: 5 }, (_, i) => ({
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/api/v1/routes",
            method: "GET",
            statusCode: i === 0 ? 500 : 200,
            responseTimeMs: 50,
            requestSizeBytes: 100,
            responseSizeBytes: 1000,
            ipAddress: "192.168.1.1",
            timestamp: today,
          })),
          // /api/v1/drivers - 3 requests, 0 errors
          ...Array.from({ length: 3 }, () => ({
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/api/v1/drivers",
            method: "GET",
            statusCode: 200,
            responseTimeMs: 75,
            requestSizeBytes: 50,
            responseSizeBytes: 500,
            ipAddress: "192.168.1.2",
            timestamp: today,
          })),
        ],
      });
    });

    it("should return top endpoints sorted by request count", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const topEndpoints = await getTopEndpoints(testOrgId, today, tomorrow, 5);

      expect(topEndpoints).toHaveLength(2);
      expect(topEndpoints[0].endpoint).toBe("/api/v1/routes");
      expect(topEndpoints[0].count).toBe(5);
      expect(topEndpoints[1].count).toBe(3);
    });

    it("should include error counts", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const topEndpoints = await getTopEndpoints(testOrgId, today, tomorrow, 5);

      const routes = topEndpoints.find((e) => e.endpoint === "/api/v1/routes");
      expect(routes?.errorCount).toBe(1);
    });

    it("should respect limit parameter", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const topEndpoints = await getTopEndpoints(testOrgId, today, tomorrow, 1);

      expect(topEndpoints).toHaveLength(1);
      expect(topEndpoints[0].endpoint).toBe("/api/v1/routes");
    });
  });

  // ─── SUMMARY TESTS ──────────────────────────────────────────────────

  describe("getUsageSummary", () => {
    beforeEach(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await prisma.usageSummary.create({
        data: {
          orgId: testOrgId,
          period: today,
          requestCount: 5000,
          bandwidthBytes: 50000000n,
          errorCount: 100,
          avgResponseTimeMs: 80,
          uniqueEndpoints: 20,
          topEndpoints: [
            {
              endpoint: "/api/v1/routes",
              method: "GET",
              count: 2000,
              errorCount: 20,
              avgResponseTimeMs: 60,
            },
          ],
        },
      });
    });

    it("should return aggregated usage metrics", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const metrics = await getUsageSummary(testOrgId, today, tomorrow);

      expect(metrics.totalRequests).toBe(5000);
      expect(metrics.totalBandwidthBytes).toBe(50000000);
      expect(metrics.errorCount).toBe(100);
      expect(metrics.avgResponseTimeMs).toBe(80);
      expect(metrics.uniqueEndpoints).toBe(20);
    });

    it("should calculate error rate", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const metrics = await getUsageSummary(testOrgId, today, tomorrow);

      // 100 errors / 5000 requests = 2%
      expect(metrics.errorRate).toBe(2);
    });

    it("should include top endpoints", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const metrics = await getUsageSummary(testOrgId, today, tomorrow);

      expect(metrics.topEndpoints).toHaveLength(1);
      expect(metrics.topEndpoints[0].endpoint).toBe("/api/v1/routes");
    });
  });

  // ─── CLEANUP TESTS ──────────────────────────────────────────────────

  describe("cleanupOldRecords", () => {
    beforeEach(async () => {
      const oldDate = new Date();
      oldDate.setUTCDate(oldDate.getUTCDate() - 100); // 100 days ago

      const recentDate = new Date();
      recentDate.setUTCDate(recentDate.getUTCDate() - 5); // 5 days ago

      await prisma.usageRecord.createMany({
        data: [
          {
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/old",
            method: "GET",
            statusCode: 200,
            responseTimeMs: 50,
            requestSizeBytes: 100,
            responseSizeBytes: 1000,
            ipAddress: "192.168.1.1",
            timestamp: oldDate,
          },
          {
            orgId: testOrgId,
            apiKeyId: testApiKeyId,
            endpoint: "/recent",
            method: "GET",
            statusCode: 200,
            responseTimeMs: 50,
            requestSizeBytes: 100,
            responseSizeBytes: 1000,
            ipAddress: "192.168.1.1",
            timestamp: recentDate,
          },
        ],
      });
    });

    it("should delete records older than retention period", async () => {
      await cleanupOldRecords(30); // Keep last 30 days

      const records = await prisma.usageRecord.findMany({
        where: { orgId: testOrgId },
      });

      expect(records).toHaveLength(1);
      expect(records[0].endpoint).toBe("/recent");
    });

    it("should keep records within retention period", async () => {
      await cleanupOldRecords(120); // Keep last 120 days

      const records = await prisma.usageRecord.findMany({
        where: { orgId: testOrgId },
      });

      expect(records).toHaveLength(2);
    });
  });
});
