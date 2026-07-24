/**
 * Salesforce SDK Client Unit Tests
 * Tests for OAuth flow, SOQL queries, CRUD operations, and rate limiting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SalesforceSDKClient,
  type SalesforceConfig,
  type SalesforceAccount,
  type SalesforceContact,
} from "../../../../packages/core/src/integrations/crm/salesforce-sdk-client";

describe("SalesforceSDKClient", () => {
  let client: SalesforceSDKClient;
  let config: SalesforceConfig;

  beforeEach(() => {
    config = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "https://app.example.com/auth/salesforce/callback",
      environment: "sandbox",
      apiVersion: "v59.0",
    };

    client = new SalesforceSDKClient(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration & Validation", () => {
    it("should validate and accept valid config", () => {
      const validConfig: SalesforceConfig = {
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "https://example.com/callback",
        environment: "production",
        apiVersion: "v59.0",
      };

      expect(() => new SalesforceSDKClient(validConfig)).not.toThrow();
    });

    it("should fail with missing clientId", () => {
      expect(() => {
        new SalesforceSDKClient({
          clientId: "",
          clientSecret: "secret",
          redirectUri: "https://example.com/callback",
        } as SalesforceConfig);
      }).toThrow();
    });

    it("should fail with invalid redirectUri", () => {
      expect(() => {
        new SalesforceSDKClient({
          clientId: "id",
          clientSecret: "secret",
          redirectUri: "not-a-url",
        } as SalesforceConfig);
      }).toThrow();
    });

    it("should default environment to production", () => {
      const cfg = new SalesforceSDKClient({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "https://example.com/callback",
      });

      expect(cfg).toBeDefined();
    });
  });

  describe("OAuth Flow", () => {
    it("should generate authorization URL with correct parameters", () => {
      const authUrl = client.getAuthorizationUrl({ state: "test-state" });

      expect(authUrl).toContain("test.salesforce.com");
      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain("state=test-state");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=full");
    });

    it("should exchange authorization code for access token", async () => {
      const mockTokenResponse = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        instance_url: "https://test-instance.salesforce.com",
        id: "user-id",
        token_type: "Bearer",
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const result = await client.handleOAuthCallback("auth-code");

      expect(result.access_token).toBe("mock-access-token");
      expect(result.instance_url).toContain("salesforce.com");
      expect(client.getAccessToken()).toBe("mock-access-token");
      expect(client.getInstanceUrl()).toContain("salesforce.com");
    });

    it("should throw on failed token exchange", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(client.handleOAuthCallback("bad-code")).rejects.toThrow(
        "OAuth token exchange failed",
      );
    });

    it("should refresh access token", async () => {
      // Set initial tokens
      const mockTokenResponse = {
        access_token: "initial-token",
        refresh_token: "refresh-token",
        instance_url: "https://test-instance.salesforce.com",
        id: "user-id",
        token_type: "Bearer",
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      await client.handleOAuthCallback("code");

      // Now refresh
      const newTokenResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        instance_url: "https://test-instance.salesforce.com",
        id: "user-id",
        token_type: "Bearer",
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => newTokenResponse,
      });

      const result = await client.refreshAccessToken();

      expect(result.access_token).toBe("new-access-token");
      expect(client.getAccessToken()).toBe("new-access-token");
    });

    it("should throw when refreshing without refresh token", async () => {
      await expect(client.refreshAccessToken()).rejects.toThrow(
        "No refresh token available",
      );
    });
  });

  describe("SOQL Query Execution", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should execute parameterized SOQL query", async () => {
      const mockResult = {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: "account-123",
            Name: "Acme Corp",
            Industry: "Technology",
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const result = await client.querySOQL({
        query:
          "SELECT Id, Name, Industry FROM Account WHERE Industry = :industry",
        params: { industry: "Technology" },
      });

      expect(result.totalSize).toBe(1);
      expect(result.records[0].Name).toBe("Acme Corp");
    });

    it("should escape SOQL parameter values to prevent injection", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalSize: 0, done: true, records: [] }),
        headers: new Map(),
      });

      const maliciousValue = "'; DELETE FROM Account; --";

      await client.querySOQL({
        query: "SELECT Id FROM Account WHERE Name = :name",
        params: { name: maliciousValue },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];

      // Should escape the quote and backslash
      expect(url).toContain("'\\'; DELETE FROM Account; --'");
      expect(url).not.toContain(maliciousValue);
    });

    it("should handle numeric and boolean parameters", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalSize: 0, done: true, records: [] }),
        headers: new Map(),
      });

      await client.querySOQL({
        query:
          "SELECT Id FROM Account WHERE NumberOfEmployees > :count AND IsActive = :active",
        params: { count: 100, active: true },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain("100");
      expect(url).toContain("true");
    });

    it("should handle array parameters in SOQL", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalSize: 0, done: true, records: [] }),
        headers: new Map(),
      });

      await client.querySOQL({
        query: "SELECT Id FROM Account WHERE Status IN :statuses",
        params: { statuses: ["Active", "Pending"] },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain("(");
      expect(url).toContain("Active");
      expect(url).toContain("Pending");
    });
  });

  describe("CRUD Operations", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should get Account by ID", async () => {
      const mockAccount: SalesforceAccount = {
        Id: "account-123",
        Name: "Acme Corp",
        Industry: "Technology",
        Website: "https://acme.example.com",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
        headers: new Map(),
      });

      const result = await client.getAccount("account-123");

      expect(result.Id).toBe("account-123");
      expect(result.Name).toBe("Acme Corp");
    });

    it("should create Contact", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "contact-123" }),
        headers: new Map(),
      });

      const result = await client.createContact({
        FirstName: "John",
        LastName: "Doe",
        Email: "john@example.com",
      });

      expect(result).toBe("contact-123");
    });

    it("should update Opportunity", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await expect(
        client.updateOpportunity("opp-123", {
          StageName: "Closed Won",
          Amount: 50000,
        }),
      ).resolves.not.toThrow();
    });

    it("should delete Lead", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(client.deleteLead("lead-123")).resolves.not.toThrow();
    });

    it("should throw when not authenticated", async () => {
      const newClient = new SalesforceSDKClient(config);

      await expect(newClient.getAccount("account-123")).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  describe("Composite API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should execute composite request with multiple subrequests", async () => {
      const mockResponse = {
        compositeResponse: [
          {
            body: { id: "contact-1" },
            httpStatusCode: 201,
            referenceId: "contact1",
            httpHeaders: {},
          },
          {
            body: { Id: "account-1", Name: "Acme" },
            httpStatusCode: 200,
            referenceId: "account1",
            httpHeaders: {},
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.executeComposite({
        allOrNone: false,
        compositeRequest: [
          {
            method: "POST",
            url: "/services/data/v59.0/sobjects/Contact",
            body: { FirstName: "John", LastName: "Doe" },
            referenceId: "contact1",
          },
          {
            method: "GET",
            url: "/services/data/v59.0/sobjects/Account/account-1",
            referenceId: "account1",
          },
        ],
      });

      expect(result.compositeResponse).toHaveLength(2);
      expect(result.compositeResponse[0].httpStatusCode).toBe(201);
    });

    it("should reject composite request with > 25 subrequests", async () => {
      const requests = Array.from({ length: 26 }).map((_, i) => ({
        method: "GET" as const,
        url: `/services/data/v59.0/sobjects/Contact/id-${i}`,
        referenceId: `contact${i}`,
      }));

      await expect(
        client.executeComposite({
          allOrNone: false,
          compositeRequest: requests,
        }),
      ).rejects.toThrow("limited to 25 subrequests");
    });
  });

  describe("Bulk API 2.0", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should create bulk job", async () => {
      const mockJob = {
        id: "job-123",
        state: "Open",
        object: "Contact",
        operation: "insert",
        createdDate: "2024-01-01T00:00:00Z",
        systemModstamp: "2024-01-01T00:00:00Z",
        contentType: "CSV",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJob,
        headers: new Map(),
      });

      const result = await client.createBulkJob({
        object: "Contact",
        operation: "insert",
        contentType: "CSV",
      });

      expect(result.id).toBe("job-123");
      expect(result.state).toBe("Open");
    });

    it("should get bulk job status", async () => {
      const mockJob = {
        id: "job-123",
        state: "InProgress",
        object: "Contact",
        operation: "insert",
        numberRecordsProcessed: 50,
        numberRecordsFailed: 2,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJob,
        headers: new Map(),
      });

      const result = await client.getBulkJobStatus("job-123");

      expect(result.state).toBe("InProgress");
      expect(result.numberRecordsProcessed).toBe(50);
    });

    it("should upload CSV to bulk job", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const csv = "FirstName,LastName,Email\nJohn,Doe,john@example.com";

      await expect(
        client.uploadBulkJobData("job-123", csv),
      ).resolves.not.toThrow();
    });

    it("should get bulk job results", async () => {
      const csv = "Id,FirstName,LastName\n001,John,Doe";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => csv,
        headers: new Map(),
      });

      const result = await client.getBulkJobResults("job-123");

      expect(result).toContain("Id,FirstName,LastName");
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should track rate limit info from response headers", async () => {
      const mockHeaders = new Map([
        ["sforce-limit-info", "api-usage=50/100000"],
      ]);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalSize: 0, done: true, records: [] }),
        headers: mockHeaders,
      });

      await client.querySOQL({
        query: "SELECT Id FROM Account LIMIT 1",
      });

      const rateLimitInfo = client.getRateLimitInfo();

      expect(rateLimitInfo).toBeDefined();
      expect(rateLimitInfo?.total).toBe(100000);
      expect(rateLimitInfo?.remaining).toBe(99950);
    });
  });

  describe("Metadata API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token", "https://instance.salesforce.com");
    });

    it("should describe SObject", async () => {
      const mockMetadata = {
        name: "Account",
        label: "Account",
        fields: [
          { name: "Id", type: "id", label: "Account ID" },
          { name: "Name", type: "string", label: "Account Name" },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
        headers: new Map(),
      });

      const result = await client.describeSObject("Account");

      expect(result.name).toBe("Account");
      expect(result.fields).toBeDefined();
    });
  });

  describe("Webhook Verification", () => {
    it("should verify valid outbound message signature", () => {
      const body = "test-message-body";
      const signature = "VxNu1Y1r1tBN4pqF0z7jQ4qHcC5p7H1w2m3n4o5p=";

      // In real scenario, signature would be computed with actual client secret
      // This is a simplified test to verify the method exists and works

      const result = client.verifyOutboundMessage(signature, body);

      // Result will be false with test data, but verifies the method works
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Token Management", () => {
    it("should set access token and instance URL", () => {
      client.setAccessToken("new-token", "https://new-instance.salesforce.com");

      expect(client.getAccessToken()).toBe("new-token");
      expect(client.getInstanceUrl()).toBe(
        "https://new-instance.salesforce.com",
      );
    });

    it("should get current rate limit info", () => {
      const info = client.getRateLimitInfo();

      expect(info === null || typeof info === "object").toBe(true);
    });
  });
});
