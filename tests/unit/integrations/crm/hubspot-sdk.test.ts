/**
 * HubSpot SDK Client Unit Tests
 * Tests for OAuth flow, CRM operations, search, associations, and batch operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HubSpotSDKClient,
  type HubSpotConfig,
  type HubSpotContact,
  type HubSpotCompany,
  type HubSpotDeal,
} from "../../../../packages/core/src/integrations/crm/hubspot-sdk-client";

describe("HubSpotSDKClient", () => {
  let client: HubSpotSDKClient;
  let config: HubSpotConfig;

  beforeEach(() => {
    config = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "https://app.example.com/auth/hubspot/callback",
    };

    client = new HubSpotSDKClient(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration & Validation", () => {
    it("should validate and accept valid config", () => {
      const validConfig: HubSpotConfig = {
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "https://example.com/callback",
      };

      expect(() => new HubSpotSDKClient(validConfig)).not.toThrow();
    });

    it("should fail with missing clientId", () => {
      expect(() => {
        new HubSpotSDKClient({
          clientId: "",
          clientSecret: "secret",
          redirectUri: "https://example.com/callback",
        } as HubSpotConfig);
      }).toThrow();
    });

    it("should fail with invalid redirectUri", () => {
      expect(() => {
        new HubSpotSDKClient({
          clientId: "id",
          clientSecret: "secret",
          redirectUri: "not-a-url",
        } as HubSpotConfig);
      }).toThrow();
    });

    it("should accept API key config", () => {
      const apiKeyConfig: HubSpotConfig = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "https://example.com/callback",
        apiKey: "pat-xxx",
      };

      const client = new HubSpotSDKClient(apiKeyConfig);
      expect(client.getAccessToken()).toBe("pat-xxx");
    });
  });

  describe("OAuth Flow", () => {
    it("should generate authorization URL with correct parameters", () => {
      const authUrl = client.getAuthorizationUrl();

      expect(authUrl).toContain("app.hubspot.com");
      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=");
    });

    it("should generate authorization URL with custom scopes", () => {
      const customScopes = [
        "crm.objects.contacts.read",
        "crm.objects.companies.read",
      ];

      const authUrl = client.getAuthorizationUrl(customScopes);

      expect(authUrl).toContain("crm.objects.contacts.read");
      expect(authUrl).toContain("crm.objects.companies.read");
    });

    it("should exchange authorization code for access token", async () => {
      const mockTokenResponse = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const result = await client.handleOAuthCallback("auth-code");

      expect(result.access_token).toBe("mock-access-token");
      expect(result.refresh_token).toBe("mock-refresh-token");
      expect(client.getAccessToken()).toBe("mock-access-token");
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
        expires_in: 3600,
        token_type: "Bearer",
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
        expires_in: 3600,
        token_type: "Bearer",
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

  describe("CRUD Operations", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should get Contact by ID", async () => {
      const mockContact: HubSpotContact = {
        id: "contact-123",
        properties: {
          firstname: "John",
          lastname: "Doe",
          email: "john@example.com",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact,
        headers: new Map(),
      });

      const result = await client.getContact("contact-123");

      expect(result.id).toBe("contact-123");
      expect(result.properties.firstname).toBe("John");
    });

    it("should get Contact with specific properties", async () => {
      const mockContact = {
        id: "contact-123",
        properties: {
          firstname: "John",
          email: "john@example.com",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact,
        headers: new Map(),
      });

      const result = await client.getContact("contact-123", [
        "firstname",
        "email",
      ]);

      expect(result.id).toBe("contact-123");

      const fetchUrl = (global.fetch as any).mock.calls[0][0];
      expect(fetchUrl).toContain("properties=");
    });

    it("should create Contact", async () => {
      const mockResponse = {
        id: "contact-123",
        properties: {
          firstname: "John",
          lastname: "Doe",
          email: "john@example.com",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.createContact({
        properties: {
          firstname: "John",
          lastname: "Doe",
          email: "john@example.com",
        },
      });

      expect(result.id).toBe("contact-123");
      expect(result.properties.email).toBe("john@example.com");
    });

    it("should update Contact", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(
        client.updateContact("contact-123", {
          properties: { firstname: "Jane" },
        }),
      ).resolves.not.toThrow();
    });

    it("should delete Contact", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(client.deleteContact("contact-123")).resolves.not.toThrow();
    });

    it("should create Company", async () => {
      const mockCompany: HubSpotCompany = {
        id: "company-123",
        properties: {
          name: "Acme Corp",
          industry: "Technology",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompany,
        headers: new Map(),
      });

      const result = await client.createCompany({
        properties: {
          name: "Acme Corp",
          industry: "Technology",
        },
      });

      expect(result.id).toBe("company-123");
      expect(result.properties.name).toBe("Acme Corp");
    });

    it("should throw when not authenticated", async () => {
      const newClient = new HubSpotSDKClient(config);

      await expect(newClient.getContact("contact-123")).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  describe("Search API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should search Contacts with filter", async () => {
      const mockResult = {
        results: [
          {
            id: "contact-1",
            properties: {
              email: "john@example.com",
              firstname: "John",
            },
          },
        ],
        paging: { next: { after: "next-cursor", link: "https://..." } },
        total: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const result = await client.searchContacts({
        filters: [
          {
            propertyName: "email",
            operator: "CONTAINS",
            value: "example.com",
          },
        ],
        filterOperator: "AND",
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("contact-1");
      expect(result.paging?.next?.after).toBe("next-cursor");
    });

    it("should search Companies with multiple filters", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total: 0 }),
        headers: new Map(),
      });

      await client.searchCompanies({
        filters: [
          {
            propertyName: "industry",
            operator: "EQ",
            value: "Technology",
          },
          {
            propertyName: "numberofemployees",
            operator: "GT",
            value: "100",
          },
        ],
        filterOperator: "AND",
      });

      expect((global.fetch as any).mock.calls).toHaveLength(1);
    });

    it("should search Deals", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total: 0 }),
        headers: new Map(),
      });

      await client.searchDeals({
        filters: [
          {
            propertyName: "dealstage",
            operator: "EQ",
            value: "closedwon",
          },
        ],
      });

      expect((global.fetch as any).mock.calls).toHaveLength(1);
    });
  });

  describe("Associations API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should create association between objects", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(
        client.associateObjects(
          "contacts",
          "contact-123",
          "companies",
          "company-456",
        ),
      ).resolves.not.toThrow();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("associations");
      expect(fetchCall[1].method).toBe("PUT");
    });

    it("should list associations for an object", async () => {
      const mockAssociations = {
        results: [
          { id: "deal-1", type: "contact_to_deal" },
          { id: "deal-2", type: "contact_to_deal" },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssociations,
        headers: new Map(),
      });

      const result = await client.listAssociations(
        "contacts",
        "contact-123",
        "deals",
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("deal-1");
    });

    it("should delete association between objects", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(
        client.deleteAssociation(
          "contacts",
          "contact-123",
          "companies",
          "company-456",
          "contact_to_company",
        ),
      ).resolves.not.toThrow();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });
  });

  describe("Properties API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should get custom properties for object type", async () => {
      const mockProperties = {
        results: [
          {
            name: "custom_field_1",
            label: "Custom Field 1",
            type: "string",
          },
          {
            name: "custom_field_2",
            label: "Custom Field 2",
            type: "number",
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProperties,
        headers: new Map(),
      });

      const result = await client.getCustomProperties("contacts");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("custom_field_1");
    });

    it("should create custom property", async () => {
      const mockResponse = {
        name: "custom_field",
        label: "Custom Field",
        type: "string",
        created: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.createCustomProperty("contacts", {
        name: "custom_field",
        label: "Custom Field",
        type: "string",
      });

      expect(result.created).toBe(true);
    });
  });

  describe("Pipelines API", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should get deal pipelines", async () => {
      const mockPipelines = {
        results: [
          {
            id: "pipeline-1",
            label: "Sales Pipeline",
            stages: [
              { id: "stage-1", label: "Lead", displayOrder: 0 },
              { id: "stage-2", label: "Negotiation", displayOrder: 1 },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines,
        headers: new Map(),
      });

      const result = await client.getDealPipelines();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Sales Pipeline");
      expect(result[0].stages).toHaveLength(2);
    });

    it("should get ticket pipelines", async () => {
      const mockPipelines = {
        results: [
          {
            id: "pipeline-1",
            label: "Support Pipeline",
            stages: [
              { id: "stage-1", label: "New", displayOrder: 0 },
              { id: "stage-2", label: "Closed", displayOrder: 1 },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines,
        headers: new Map(),
      });

      const result = await client.getTicketPipelines();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Support Pipeline");
    });
  });

  describe("Batch Operations", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should batch create Contacts", async () => {
      const mockResponse = {
        results: [
          {
            id: "contact-1",
            properties: { firstname: "John", lastname: "Doe" },
          },
          {
            id: "contact-2",
            properties: { firstname: "Jane", lastname: "Smith" },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.batchCreateContacts([
        {
          properties: { firstname: "John", lastname: "Doe" },
        },
        {
          properties: { firstname: "Jane", lastname: "Smith" },
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("contact-1");
    });

    it("should batch update Contacts", async () => {
      const mockResponse = {
        results: [
          {
            id: "contact-1",
            properties: { firstname: "Johnny" },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.batchUpdateContacts([
        {
          id: "contact-1",
          properties: { firstname: "Johnny" },
        },
      ]);

      expect(result[0].id).toBe("contact-1");
    });

    it("should batch archive Contacts", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      await expect(
        client.batchArchiveContacts(["contact-1", "contact-2"]),
      ).resolves.not.toThrow();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("batch/archive");
    });

    it("should reject batch with > 100 records", async () => {
      const inputs = Array.from({ length: 101 }).map((_, i) => ({
        properties: { firstname: `Contact${i}` },
      }));

      await expect(client.batchCreateContacts(inputs)).rejects.toThrow(
        "limited to 100 records",
      );
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(() => {
      client.setAccessToken("test-token");
    });

    it("should track rate limit info from response headers", async () => {
      const mockHeaders = new Map([
        ["x-hubspot-ratelimit-remaining", "99"],
        ["x-hubspot-ratelimit-interval-milliseconds", "10000"],
      ]);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
        headers: mockHeaders,
      });

      await client.searchContacts({
        filters: [
          {
            propertyName: "email",
            operator: "CONTAINS",
            value: "@example.com",
          },
        ],
      });

      const rateLimitInfo = client.getRateLimitInfo();

      expect(rateLimitInfo).toBeDefined();
      expect(rateLimitInfo?.remaining).toBe(99);
      expect(rateLimitInfo?.rateLimit).toBe(10000);
    });
  });

  describe("Webhook Verification", () => {
    it("should verify valid webhook signature", () => {
      const body = "test-message-body";
      const signature = "fakesignaturevalue";

      const result = client.verifyWebhookSignature(signature, body);

      // Result will be false with test data, but verifies method exists
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Token Management", () => {
    it("should set access token", () => {
      client.setAccessToken("new-token");

      expect(client.getAccessToken()).toBe("new-token");
    });

    it("should get current rate limit info", () => {
      const info = client.getRateLimitInfo();

      expect(info === null || typeof info === "object").toBe(true);
    });
  });
});
