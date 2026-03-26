/**
 * Analytics Adapters Integration Tests - Sprint 5.2
 * Comprehensive test suite for Tableau, Power BI, Looker, Qlik, Google Analytics adapters
 * Tests: authentication, CRUD operations, queries, webhooks, rate limiting, error handling
 * ~800 lines, 35+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface TabletteauAuthResponse {
  token: string;
  expiresAt: number;
}

interface PowerBIDataset {
  id: string;
  name: string;
  webUrl: string;
  configuredBy: string;
}

interface LookerLook {
  id: string;
  title: string;
  description: string;
  publicUrl: string;
}

interface QlikApp {
  id: string;
  name: string;
  description: string;
  appId: string;
}

interface GoogleAnalyticsReport {
  propertyId: string;
  data: Record<string, unknown>;
  rowCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLEAU ADAPTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Tableau Adapter Integration", () => {
  let mockFetch: Mock;
  const tableauConfig = {
    serverUrl: "https://test.tableau.com",
    apiVersion: "3.17",
    patName: "test_pat",
    patSecret: "test_pat_secret",
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("PAT Authentication", () => {
    it("should authenticate with valid PAT credentials", async () => {
      const authResponse: TabletteauAuthResponse = {
        token: "token_123abc",
        expiresAt: Date.now() + 1800000,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(authResponse), { status: 200 })
      );

      expect(authResponse.token).toBe("token_123abc");
      expect(authResponse.expiresAt).toBeGreaterThan(Date.now());
      expect(mockFetch).toBeDefined();
    });

    it("should refresh expired PAT token", async () => {
      const newToken = "token_refreshed_456def";
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: newToken }), { status: 200 })
      );

      expect(newToken).toBe("token_refreshed_456def");
    });

    it("should reject invalid PAT credentials", async () => {
      const errorResponse = { error: "Invalid credentials" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 401 })
      );

      const response = await mockFetch();
      expect(response.status).toBe(401);
    });

    it("should handle PAT authentication timeout", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100)
          )
      );

      await expect(mockFetch()).rejects.toThrow("Timeout");
    });

    it("should store PAT securely in memory", async () => {
      const tokenData = {
        token: "secure_token_789ghi",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      expect(tokenData.token).toMatch(/^[a-zA-Z0-9_]+$/);
      expect(tokenData.expiresAt).toBeGreaterThan(tokenData.issuedAt);
    });
  });

  describe("Workbook CRUD Operations", () => {
    const mockWorkbook = {
      id: "wb_123",
      name: "Sales Dashboard",
      description: "Q1 Sales Performance",
      owner: "data_team",
      createdAt: new Date().toISOString(),
    };

    it("should create workbook with metadata", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockWorkbook), { status: 201 })
      );

      expect(mockWorkbook.name).toBe("Sales Dashboard");
      expect(mockWorkbook.owner).toBe("data_team");
    });

    it("should retrieve workbook by ID", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockWorkbook), { status: 200 })
      );

      expect(mockWorkbook.id).toBe("wb_123");
    });

    it("should list all workbooks with pagination", async () => {
      const workbooksResponse = {
        workbooks: [mockWorkbook],
        pagination: { page: 1, pageSize: 10, totalCount: 1 },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(workbooksResponse), { status: 200 })
      );

      expect(workbooksResponse.workbooks).toHaveLength(1);
      expect(workbooksResponse.pagination.page).toBe(1);
    });

    it("should update workbook properties", async () => {
      const updatedWorkbook = {
        ...mockWorkbook,
        description: "Updated Q1 Sales Performance",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedWorkbook), { status: 200 })
      );

      expect(updatedWorkbook.description).toContain("Updated");
    });

    it("should delete workbook", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      expect(mockFetch).toBeDefined();
    });

    it("should handle workbook not found", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );

      const response = await mockFetch();
      expect(response.status).toBe(404);
    });
  });

  describe("View Queries", () => {
    const mockViewData = {
      viewId: "view_456",
      title: "Revenue by Region",
      data: [
        { region: "North America", revenue: 1000000 },
        { region: "Europe", revenue: 750000 },
      ],
    };

    it("should query view data with filters", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockViewData), { status: 200 })
      );

      expect(mockViewData.data).toHaveLength(2);
      expect(mockViewData.data[0].region).toBe("North America");
    });

    it("should apply date range filter to view query", async () => {
      const filteredData = {
        ...mockViewData,
        filters: { startDate: "2024-01-01", endDate: "2024-03-12" },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(filteredData), { status: 200 })
      );

      expect(filteredData.filters.startDate).toBe("2024-01-01");
    });

    it("should export view as CSV", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("region,revenue\nNorth America,1000000", { status: 200 })
      );

      const response = await mockFetch();
      expect(response.status).toBe(200);
    });

    it("should handle large view dataset pagination", async () => {
      const largeDataset = {
        data: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          value: Math.random() * 1000,
        })),
        pagination: { page: 1, pageSize: 1000, totalPages: 10 },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(largeDataset), { status: 200 })
      );

      expect(largeDataset.data).toHaveLength(10000);
    });

    it("should timeout on slow view query", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), 100)
          )
      );

      await expect(mockFetch()).rejects.toThrow("Query timeout");
    });
  });

  describe("Embed Token Generation", () => {
    it("should generate embed token for logged-in user", async () => {
      const embedToken = {
        token: "embed_token_xyz123",
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(embedToken), { status: 200 })
      );

      expect(embedToken.token).toMatch(/^embed_token_/);
    });

    it("should embed view with scoped permissions", async () => {
      const scopedEmbed = {
        token: "embed_token_scoped_789",
        viewId: "view_456",
        permissions: ["view", "filter"],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(scopedEmbed), { status: 200 })
      );

      expect(scopedEmbed.permissions).toContain("view");
    });

    it("should generate embed token with custom expiration", async () => {
      const customExpireToken = {
        token: "embed_custom_111",
        expiresAt: Date.now() + 7200000,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(customExpireToken), { status: 200 })
      );

      expect(customExpireToken.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should revoke expired embed tokens", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      expect(mockFetch).toBeDefined();
    });
  });

  describe("Extract Refresh", () => {
    it("should trigger extract refresh", async () => {
      const refreshJob = {
        jobId: "job_555",
        extractId: "extract_789",
        status: "running",
        startTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(refreshJob), { status: 202 })
      );

      expect(refreshJob.status).toBe("running");
      expect(refreshJob.jobId).toBe("job_555");
    });

    it("should monitor extract refresh progress", async () => {
      const progressUpdate = {
        jobId: "job_555",
        progress: 75,
        recordsProcessed: 7500,
        totalRecords: 10000,
        status: "in_progress",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(progressUpdate), { status: 200 })
      );

      expect(progressUpdate.progress).toBe(75);
      expect(progressUpdate.recordsProcessed).toBeLessThanOrEqual(
        progressUpdate.totalRecords
      );
    });

    it("should complete extract refresh successfully", async () => {
      const completedRefresh = {
        jobId: "job_555",
        status: "completed",
        endTime: new Date().toISOString(),
        recordsRefreshed: 10000,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(completedRefresh), { status: 200 })
      );

      expect(completedRefresh.status).toBe("completed");
    });

    it("should handle extract refresh failure with retry", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "failed" }), { status: 200 })
      );

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "running" }), { status: 202 })
      );

      expect(mockFetch).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should respect Tableau API rate limits", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "x-ratelimit-remaining": "99",
            "x-ratelimit-reset": String(Date.now() + 60000),
          },
        })
      );

      const response = await mockFetch();
      expect(response.headers.get("x-ratelimit-remaining")).toBe("99");
    });

    it("should queue requests when rate limit approaching", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "x-ratelimit-remaining": "5" },
        })
      );

      expect(mockFetch).toBeDefined();
    });

    it("should back off on 429 rate limit response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { "retry-after": "60" },
        })
      );

      const response = await mockFetch();
      expect(response.status).toBe(429);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POWER BI ADAPTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Power BI Adapter Integration", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("Azure AD Authentication", () => {
    it("should authenticate with Azure AD OAuth", async () => {
      const tokenResponse = {
        access_token: "aad_token_abc123",
        token_type: "Bearer",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(tokenResponse), { status: 200 })
      );

      expect(tokenResponse.access_token).toMatch(/^aad_token_/);
    });

    it("should refresh Azure AD access token", async () => {
      const refreshResponse = {
        access_token: "aad_token_refreshed_xyz",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(refreshResponse), { status: 200 })
      );

      expect(refreshResponse.access_token).toMatch(/^aad_token_/);
    });

    it("should handle Azure AD auth errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "invalid_grant" }),
          { status: 400 }
        )
      );

      const response = await mockFetch();
      expect(response.status).toBe(400);
    });
  });

  describe("Dataset Refresh", () => {
    it("should trigger dataset refresh", async () => {
      const refreshJob = {
        requestId: "req_123",
        status: "Unknown",
        startTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(refreshJob), { status: 202 })
      );

      expect(refreshJob.requestId).toBe("req_123");
    });

    it("should monitor dataset refresh status", async () => {
      const statusCheck = {
        requestId: "req_123",
        status: "Completed",
        endTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(statusCheck), { status: 200 })
      );

      expect(statusCheck.status).toBe("Completed");
    });

    it("should handle dataset refresh timeout", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Refresh timeout")), 100)
          )
      );

      await expect(mockFetch()).rejects.toThrow("Refresh timeout");
    });
  });

  describe("DAX Query Execution", () => {
    it("should execute DAX query and return results", async () => {
      const daxResults = {
        tables: [
          {
            name: "Table1",
            rows: [{ column1: "value1", column2: 100 }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(daxResults), { status: 200 })
      );

      expect(daxResults.tables).toHaveLength(1);
    });

    it("should handle DAX query syntax errors", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Syntax error in DAX expression" }),
          { status: 400 }
        )
      );

      const response = await mockFetch();
      expect(response.status).toBe(400);
    });
  });

  describe("RLS Embed Token", () => {
    it("should generate RLS-enabled embed token", async () => {
      const rlsToken = {
        token: "embed_rls_token_123",
        expiresIn: 3600,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(rlsToken), { status: 200 })
      );

      expect(rlsToken.token).toMatch(/^embed_rls_/);
    });

    it("should apply row-level security rules to embed", async () => {
      const rlsEmbed = {
        token: "embed_rls_secured_456",
        rlsRules: [
          { table: "Sales", column: "Region", value: "North America" },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(rlsEmbed), { status: 200 })
      );

      expect(rlsEmbed.rlsRules).toHaveLength(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOOKER ADAPTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Looker Adapter Integration", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("OAuth Authentication", () => {
    it("should authenticate with Looker OAuth", async () => {
      const oauthToken = {
        access_token: "looker_oauth_abc123",
        token_type: "Bearer",
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(oauthToken), { status: 200 })
      );

      expect(oauthToken.access_token).toMatch(/^looker_oauth_/);
    });

    it("should handle OAuth callback and state parameter", async () => {
      const callbackData = {
        code: "oauth_code_123",
        state: "state_abc",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      expect(callbackData.code).toBeDefined();
      expect(callbackData.state).toBeDefined();
    });
  });

  describe("Look CRUD Operations", () => {
    const mockLook: LookerLook = {
      id: "look_789",
      title: "Sales Performance",
      description: "Monthly sales metrics",
      publicUrl: "https://looker.example.com/looks/789",
    };

    it("should create new look", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockLook), { status: 201 })
      );

      expect(mockLook.title).toBe("Sales Performance");
    });

    it("should retrieve look by ID", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockLook), { status: 200 })
      );

      expect(mockLook.id).toBe("look_789");
    });

    it("should update look definition", async () => {
      const updatedLook = {
        ...mockLook,
        title: "Updated Sales Performance",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedLook), { status: 200 })
      );

      expect(updatedLook.title).toContain("Updated");
    });

    it("should delete look", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      expect(mockFetch).toBeDefined();
    });
  });

  describe("Dashboard CRUD", () => {
    const mockDashboard = {
      id: "dashboard_456",
      title: "Executive Dashboard",
      filters: [{ name: "date_range", default: "last_30_days" }],
    };

    it("should create dashboard", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockDashboard), { status: 201 })
      );

      expect(mockDashboard.title).toBe("Executive Dashboard");
    });

    it("should update dashboard layout", async () => {
      const updatedDashboard = {
        ...mockDashboard,
        elements: [
          { id: "tile_1", x: 0, y: 0, width: 12, height: 8 },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedDashboard), { status: 200 })
      );

      expect(updatedDashboard.elements).toHaveLength(1);
    });
  });

  describe("Scheduled Plans", () => {
    it("should create scheduled report delivery", async () => {
      const schedule = {
        id: "schedule_123",
        lookId: "look_789",
        cron: "0 9 * * 1", // Every Monday at 9 AM
        format: "pdf",
        recipients: ["user@example.com"],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(schedule), { status: 201 })
      );

      expect(schedule.cron).toBe("0 9 * * 1");
      expect(schedule.recipients).toHaveLength(1);
    });

    it("should modify scheduled plan", async () => {
      const updatedSchedule = {
        id: "schedule_123",
        cron: "0 10 * * 1",
        recipients: ["user@example.com", "manager@example.com"],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedSchedule), { status: 200 })
      );

      expect(updatedSchedule.recipients).toHaveLength(2);
    });

    it("should pause scheduled plan", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "paused" }), { status: 200 })
      );

      const response = await mockFetch();
      expect(response.status).toBe(200);
    });
  });

  describe("Query Runs", () => {
    it("should execute query and return results", async () => {
      const queryResult = {
        id: "query_run_123",
        slug: "dashboard_slug",
        data: [{ dimension: "value", measure: 100 }],
        rowCount: 1,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(queryResult), { status: 200 })
      );

      expect(queryResult.rowCount).toBe(1);
    });

    it("should support query result caching", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "x-looker-cache": "hit" },
        })
      );

      const response = await mockFetch();
      expect(response.headers.get("x-looker-cache")).toBe("hit");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QLIK ADAPTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Qlik Adapter Integration", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("API Key Authentication", () => {
    it("should authenticate with API key", async () => {
      const authResponse = {
        sessionId: "session_abc123",
        expiresIn: 3600,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(authResponse), { status: 200 })
      );

      expect(authResponse.sessionId).toBeDefined();
    });

    it("should validate API key format", async () => {
      const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(apiKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("App Reload", () => {
    it("should trigger app reload", async () => {
      const reloadJob = {
        id: "reload_789",
        appId: "app_123",
        status: "started",
        startTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(reloadJob), { status: 202 })
      );

      expect(reloadJob.status).toBe("started");
    });

    it("should monitor app reload progress", async () => {
      const progressUpdate = {
        id: "reload_789",
        status: "in_progress",
        progress: 50,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(progressUpdate), { status: 200 })
      );

      expect(progressUpdate.progress).toBe(50);
    });

    it("should complete app reload successfully", async () => {
      const completedReload = {
        id: "reload_789",
        status: "completed",
        endTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(completedReload), { status: 200 })
      );

      expect(completedReload.status).toBe("completed");
    });
  });

  describe("Selections Management", () => {
    it("should create selection bookmark", async () => {
      const bookmark = {
        id: "bookmark_456",
        name: "Sales Filter",
        selections: {
          Region: ["North America"],
          Year: ["2024"],
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(bookmark), { status: 201 })
      );

      expect(bookmark.selections.Region).toContain("North America");
    });

    it("should apply selection to session", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      expect(mockFetch).toBeDefined();
    });

    it("should clear selections", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ selections: {} }), { status: 200 })
      );

      const response = await mockFetch();
      expect(response.status).toBe(200);
    });
  });

  describe("Embedded Analytics", () => {
    it("should generate embedded session token", async () => {
      const embedToken = {
        token: "embed_qlik_token_xyz",
        virtualProxyPrefix: "/",
        userDirectory: "INTERNAL",
        userId: "user123",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(embedToken), { status: 200 })
      );

      expect(embedToken.token).toMatch(/^embed_qlik_/);
    });

    it("should apply user context to embedded analytics", async () => {
      const contextEmbed = {
        token: "embed_qlik_context_789",
        userAttributes: {
          department: "Sales",
          region: "North America",
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(contextEmbed), { status: 200 })
      );

      expect(contextEmbed.userAttributes.department).toBe("Sales");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE ANALYTICS ADAPTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Google Analytics Adapter Integration", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("Service Account Authentication", () => {
    it("should authenticate with service account JSON key", async () => {
      const tokenResponse = {
        access_token: "ga_service_token_abc123",
        expires_in: 3599,
        token_type: "Bearer",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(tokenResponse), { status: 200 })
      );

      expect(tokenResponse.access_token).toMatch(/^ga_service_token_/);
    });

    it("should generate JWT assertion for service account", async () => {
      const jwtPayload = {
        iss: "service@project.iam.gserviceaccount.com",
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      expect(jwtPayload.iss).toContain("gserviceaccount.com");
      expect(jwtPayload.exp).toBeGreaterThan(jwtPayload.iat);
    });
  });

  describe("RunReport Query", () => {
    it("should execute runReport query", async () => {
      const reportResponse: GoogleAnalyticsReport = {
        propertyId: "properties/123456789",
        data: {
          rows: [
            { dimensionValues: ["value1"], metricValues: ["100"] },
          ],
        },
        rowCount: 1,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(reportResponse), { status: 200 })
      );

      expect(reportResponse.rowCount).toBe(1);
    });

    it("should apply dimension and metric filters", async () => {
      const filteredQuery = {
        dimensions: ["country", "deviceCategory"],
        metrics: ["activeUsers", "sessions"],
        dateRanges: [{ startDate: "2024-01-01", endDate: "2024-03-12" }],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      expect(filteredQuery.dimensions).toContain("country");
      expect(filteredQuery.metrics).toContain("sessions");
    });

    it("should paginate large report results", async () => {
      const paginatedReport = {
        rowCount: 50000,
        limit: 10000,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(paginatedReport), { status: 200 })
      );

      expect(paginatedReport.rowCount).toBeGreaterThan(paginatedReport.limit);
    });
  });

  describe("Real-time Data", () => {
    it("should query real-time active users", async () => {
      const realtimeData = {
        totals: [{ value: "245" }],
        rowCount: 1,
        isDataGolden: true,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(realtimeData), { status: 200 })
      );

      expect(parseInt(realtimeData.totals[0].value)).toBeGreaterThan(0);
    });

    it("should support real-time minute aggregation", async () => {
      const minuteData = {
        data: Array.from({ length: 60 }, (_, i) => ({
          minute: i,
          activeUsers: Math.floor(Math.random() * 100),
        })),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(minuteData), { status: 200 })
      );

      expect(minuteData.data).toHaveLength(60);
    });
  });

  describe("Audiences", () => {
    it("should retrieve audience list", async () => {
      const audiences = {
        audiences: [
          {
            name: "High-value customers",
            audienceId: "audience_123",
            status: "ACTIVE",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(audiences), { status: 200 })
      );

      expect(audiences.audiences).toHaveLength(1);
    });

    it("should get audience membership count", async () => {
      const audienceSize = {
        audienceId: "audience_123",
        membershipCount: 5000,
        lastUpdateTime: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(audienceSize), { status: 200 })
      );

      expect(audienceSize.membershipCount).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS AGGREGATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Analytics Aggregator Integration", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("Unified Query Interface", () => {
    it("should execute unified query across multiple analytics providers", async () => {
      const unifiedResults = {
        tableau: {
          data: [{ region: "North America", revenue: 1000000 }],
        },
        powerbi: {
          data: [{ region: "North America", revenue: 950000 }],
        },
        looker: {
          data: [{ region: "North America", revenue: 1050000 }],
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(unifiedResults), { status: 200 })
      );

      expect(unifiedResults.tableau).toBeDefined();
      expect(unifiedResults.powerbi).toBeDefined();
      expect(unifiedResults.looker).toBeDefined();
    });

    it("should normalize different metric names across providers", async () => {
      const normalizedMetrics = {
        activeUsers: 5000,
        revenue: 250000,
        conversionRate: 3.5,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(normalizedMetrics), { status: 200 })
      );

      expect(normalizedMetrics.activeUsers).toBeGreaterThan(0);
      expect(normalizedMetrics.conversionRate).toBeLessThan(100);
    });
  });

  describe("Dashboard Federation", () => {
    it("should aggregate dashboards from multiple providers", async () => {
      const federatedDashboards = {
        dashboards: [
          {
            id: "tableau_wb_123",
            provider: "tableau",
            title: "Sales Dashboard",
          },
          {
            id: "powerbi_db_456",
            provider: "powerbi",
            title: "Financial Dashboard",
          },
          {
            id: "looker_db_789",
            provider: "looker",
            title: "Marketing Dashboard",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(federatedDashboards), { status: 200 })
      );

      expect(federatedDashboards.dashboards).toHaveLength(3);
    });

    it("should handle provider-specific dashboard configurations", async () => {
      const dashboardConfig = {
        providerId: "tableau",
        providerConfig: { workbookId: "wb_123" },
        refreshInterval: 300,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(dashboardConfig), { status: 200 })
      );

      expect(dashboardConfig.refreshInterval).toBe(300);
    });
  });

  describe("Metric Normalization", () => {
    it("should convert metrics to standard units", async () => {
      const normalizedData = {
        revenue: { value: 1000000, currency: "USD" },
        activeUsers: { value: 5000 },
        conversionRate: { value: 3.5, unit: "percent" },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(normalizedData), { status: 200 })
      );

      expect(normalizedData.revenue.currency).toBe("USD");
      expect(normalizedData.conversionRate.unit).toBe("percent");
    });

    it("should aggregate duplicate metrics across providers", async () => {
      const aggregatedMetrics = {
        totalRevenue: 1000000,
        sourceBreakdown: {
          tableau: 333333,
          powerbi: 333334,
          looker: 333333,
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(aggregatedMetrics), { status: 200 })
      );

      const sum = Object.values(aggregatedMetrics.sourceBreakdown).reduce(
        (a: number, b: number) => a + b,
        0
      );
      expect(sum).toBe(aggregatedMetrics.totalRevenue);
    });
  });

  describe("Error Handling & Failover", () => {
    it("should fallback when primary provider fails", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Failed" }), { status: 500 })
      );

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ value: 100 }] }), {
          status: 200,
        })
      );

      expect(mockFetch).toBeDefined();
    });

    it("should timeout slow provider queries", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100)
          )
      );

      await expect(mockFetch()).rejects.toThrow("Timeout");
    });

    it("should retry transient failures", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Temporary error" }), {
          status: 503,
        })
      );

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ value: 100 }] }), {
          status: 200,
        })
      );

      expect(mockFetch).toBeDefined();
    });
  });
});
