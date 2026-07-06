/**
 * Tableau Client Integration Tests
 *
 * Comprehensive test suite covering:
 * - Authentication (PAT and JWT)
 * - Workbook and view operations
 * - Data source management
 * - Subscriptions
 * - Embed token generation
 * - Query execution
 * - Export functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TableauClient } from "../tableau-client.js";
import type {
  AnalyticsConfig,
  QueryDefinition,
  DashboardDefinition,
} from "../types.js";

describe("TableauClient", () => {
  let client: TableauClient;
  let config: AnalyticsConfig;

  beforeEach(() => {
    config = {
      integrationId: "tableau-test",
      provider: "tableau",
      apiUrl: "https://tableau.example.com/api/2.10",
      instanceUrl: "https://tableau.example.com",
      credentials: {
        pat: "test-pat-token",
        username: "testuser",
        contentUrl: "test-site",
      },
    };

    client = new TableauClient(config);
  });

  describe("Authentication", () => {
    it("should authenticate successfully with PAT token", async () => {
      // Mock fetch for signin
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>valid-token-123</token><site id="site-123" /></tsRequest>`,
      } as Response);

      const token = await client.authenticate();

      expect(token).toBe("valid-token-123");
    });

    it("should cache authentication token", async () => {
      const mockResponse = {
        ok: true,
        text: async () =>
          `<tsRequest><token>cached-token</token><site id="site-123" /></tsRequest>`,
      } as Response;

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const token1 = await client.authenticate();
      const token2 = await client.authenticate();

      expect(token1).toBe(token2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should throw error on authentication failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      } as Response);

      await expect(client.authenticate()).rejects.toThrow(
        "authentication failed",
      );
    });

    it("should generate JWT token correctly", async () => {
      config.credentials.clientId = "test-client-id";
      config.credentials.clientSecret = "test-client-secret";

      const jwt = await client.generateJWT();

      expect(jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(jwt.split(".").length).toBe(3);
    });
  });

  describe("Workbook Operations", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>valid-token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should fetch workbooks successfully", async () => {
      const mockWorkbooks = {
        workbooks: [
          {
            id: "wb-1",
            name: "Sales Dashboard",
            description: "Q4 Sales",
            owner: { id: "owner-1" },
            createdAt: new Date(),
            updatedAt: new Date(),
            views: [],
          },
          {
            id: "wb-2",
            name: "Revenue Report",
            owner: { id: "owner-2" },
            createdAt: new Date(),
            updatedAt: new Date(),
            views: [],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkbooks,
      } as Response);

      const workbooks = await client.getWorkbooks();

      expect(workbooks).toHaveLength(2);
      expect(workbooks[0].name).toBe("Sales Dashboard");
      expect(workbooks[1].name).toBe("Revenue Report");
    });

    it("should fetch specific workbook by ID", async () => {
      const mockWorkbook = {
        id: "wb-1",
        name: "Sales Dashboard",
        description: "Q4 Sales",
        owner: { id: "owner-1" },
        createdAt: new Date(),
        updatedAt: new Date(),
        views: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkbook,
      } as Response);

      const workbook = await client.getWorkbook("wb-1");

      expect(workbook.id).toBe("wb-1");
      expect(workbook.name).toBe("Sales Dashboard");
    });

    it("should throw error when workbook not found", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      } as Response);

      await expect(client.getWorkbook("invalid-id")).rejects.toThrow(
        "Failed to fetch workbook",
      );
    });

    it("should publish workbook successfully", async () => {
      // Mock fs.readFileSync via vi.mock at module level is not feasible here,
      // so we mock fetch to return the expected result and mock the dynamic import
      const mockReadFileSync = vi
        .fn()
        .mockReturnValue(Buffer.from("workbook content"));
      vi.doMock("fs", () => ({
        readFileSync: mockReadFileSync,
        default: { readFileSync: mockReadFileSync },
      }));

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workbook: {
            id: "wb-new",
            name: "New Workbook",
          },
        }),
      } as Response);

      const published = await client.publishWorkbook(
        "New Workbook",
        "/path/to/file.twbx",
        "proj-1",
      );

      expect(published.id).toBe("wb-new");
      expect(published.name).toBe("New Workbook");
      vi.doUnmock("fs");
    });
  });

  describe("Data Source Operations", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should fetch data sources", async () => {
      const mockDataSources = {
        datasources: [
          {
            id: "ds-1",
            name: "Sales Data",
            datasourceType: "extract",
            isArchived: false,
            lastRefreshedAt: new Date(),
          },
          {
            id: "ds-2",
            name: "Customer Data",
            datasourceType: "live",
            isArchived: false,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockDataSources,
      } as Response);

      const dataSources = await client.getDataSources();

      expect(dataSources).toHaveLength(2);
      expect(dataSources[0].name).toBe("Sales Data");
      expect(dataSources[0].type).toBe("extract");
    });

    it("should refresh data source", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ds-1",
          name: "Sales Data",
        }),
      } as Response);

      const refreshed = await client.refreshDataSource("ds-1");

      expect(refreshed.id).toBe("ds-1");
      expect(refreshed.name).toBe("Sales Data");
    });
  });

  describe("Subscriptions", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should create subscription", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subscription: {
            id: "sub-1",
            subject: "Daily Report",
            contentId: "view-1",
            contentType: "view",
            recipient: { id: "user-1" },
            frequency: "daily",
          },
        }),
      } as Response);

      const subscription = await client.createSubscription(
        "view-1",
        "user-1",
        "daily",
      );

      expect(subscription.id).toBe("sub-1");
      expect(subscription.frequency).toBe("daily");
    });
  });

  describe("Embed Tokens", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should generate trusted ticket", async () => {
      config.credentials.trustedTicketToken = "trusted-token";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => "ticket-123",
      } as Response);

      const ticket = await client.generateTrustedTicket("testuser");

      expect(ticket.ticket).toBe("ticket-123");
      expect(ticket.username).toBe("testuser");
    });

    it("should generate embed URL with trusted ticket", async () => {
      config.credentials.trustedTicketToken = "trusted-token";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => "ticket-123",
      } as Response);

      const url = await client.generateEmbedUrl("view-1", "testuser");

      expect(url).toContain("view-1");
      expect(url).toContain("ticket-123");
    });

    it("should generate embed token with RLS rules", async () => {
      config.credentials.trustedTicketToken = "trusted-token";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => "ticket-for-embed",
      } as Response);

      const token = await client.generateEmbedToken(
        "view-1",
        "user-1",
        ["view"],
        [{ field: "region", allowedValues: ["US", "CA"] }],
      );

      expect(token.entityId).toBe("view-1");
      expect(token.userId).toBe("user-1");
      expect(token.rlsRules).toHaveLength(1);
    });
  });

  describe("Query Execution", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should execute query on view", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columns: [{ name: "Region" }, { name: "Revenue" }],
          rows: [
            { Region: "US", Revenue: "100000" },
            { Region: "CA", Revenue: "50000" },
          ],
        }),
      } as Response);

      const result = await client.queryView("view-1");

      expect(result.columns).toHaveLength(2);
      expect(result.rows).toHaveLength(2);
    });

    it("should apply filters to query", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columns: [{ name: "Region" }, { name: "Revenue" }],
          rows: [{ Region: "US", Revenue: "100000" }],
        }),
      } as Response);

      const filters = [
        {
          field: "Region",
          operator: "equals" as const,
          value: "US",
        },
      ];

      const result = await client.queryView("view-1", filters);

      expect(result.rows).toHaveLength(1);
    });
  });

  describe("Export Functionality", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should export dashboard to PDF", async () => {
      const mockPdfBuffer = Buffer.from("PDF content");

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as Response);

      const result = await client.exportDashboard("view-1", "pdf");

      expect(result.format).toBe("pdf");
      expect(result.status).toBe("completed");
    });

    it("should export dashboard to PNG", async () => {
      const mockPngBuffer = Buffer.from("PNG content");

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockPngBuffer.buffer,
      } as Response);

      const result = await client.exportDashboard("view-1", "png");

      expect(result.format).toBe("png");
      expect(result.status).toBe("completed");
    });

    it("should export dashboard to CSV", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () =>
          Buffer.from("region,revenue\nUS,100000\nCA,50000").buffer,
      } as Response);

      const result = await client.exportDashboard("view-1", "csv");

      expect(result.format).toBe("csv");
      expect(result.status).toBe("completed");
    });
  });

  describe("Dashboard CRUD", () => {
    beforeEach(async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<tsRequest><token>token</token><site id="site-123" /></tsRequest>`,
      } as Response);

      await client.authenticate();
    });

    it("should create dashboard", async () => {
      const dashboardDef: DashboardDefinition = {
        id: "dash-1",
        name: "Sales Dashboard",
        description: "Q4 Sales",
        widgets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "dash-1", name: "Sales Dashboard" }),
      } as Response);

      const created = await client.createDashboard(dashboardDef);

      expect(created.name).toBe("Sales Dashboard");
      expect(created.id).toBeTruthy();
    });

    it("should get dashboard", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "dash-1",
          name: "Sales Dashboard",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as Response);

      const dashboard = await client.getDashboard("dash-1");

      expect(dashboard.id).toBe("dash-1");
      expect(dashboard.name).toBe("Sales Dashboard");
    });

    it("should delete dashboard", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
      } as Response);

      await expect(client.deleteDashboard("dash-1")).resolves.toBeUndefined();
    });
  });

  describe("Health Check", () => {
    it("should return healthy status when authenticated", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            `<tsRequest><token>health-token</token><site id="site-123" /></tsRequest>`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
        } as Response);

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.authenticated).toBe(true);
    });

    it("should return unhealthy status on authentication failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      } as Response);

      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.authenticated).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit info", async () => {
      const info = client.getRateLimitInfo();

      expect(info).toHaveProperty("remaining");
      expect(info).toHaveProperty("limit");
      expect(info).toHaveProperty("resetAt");
      expect(info.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Caching", () => {
    it("should cache query results", async () => {
      const stats = client.getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxEntries");
    });

    it("should clear cache", () => {
      client.clearCache();

      const stats = client.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
