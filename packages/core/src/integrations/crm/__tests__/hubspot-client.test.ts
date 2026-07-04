/**
 * HubSpot Adapter Tests
 * OAuth flow, CRUD operations, and data normalization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HubSpotAdapter } from "../hubspot-client.js";
import type {
  CRMConnection,
  CRMContact,
  CRMAccount,
  CRMDeal,
} from "../types.js";

describe("HubSpotAdapter", () => {
  let adapter: HubSpotAdapter;
  let mockConnection: CRMConnection;

  beforeEach(() => {
    mockConnection = {
      id: "hs_conn_123",
      tenantId: "tenant_1",
      provider: "hubspot",
      accessToken: "hs_access_token_xyz",
      refreshToken: "hs_refresh_token_xyz",
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    adapter = new HubSpotAdapter(mockConnection, {
      clientId: "test_client_id",
      clientSecret: "test_client_secret",
      redirectUri: "http://localhost:3000/callback",
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe("OAuth Flow", () => {
    it("should generate authorization URL", () => {
      const authUrl: string = adapter.getAuthorizationUrl("test_state");

      expect(authUrl).toContain("https://app.hubspot.com/oauth/authorize");
      expect(authUrl).toContain("client_id=test_client_id");
      expect(authUrl).toContain("state=test_state");
      expect(authUrl).toContain("scope=");
    });

    it("should authenticate with authorization code", async () => {
      const mockResponse = {
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
        expires_in: 3600,
        token_type: "Bearer",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const connection: CRMConnection =
        await adapter.authenticate("auth_code_123");

      expect(connection.provider).toBe("hubspot");
      expect(connection.accessToken).toBe("new_access_token");
      expect(connection.refreshToken).toBe("new_refresh_token");
      expect(connection.expiresAt).toBeInstanceOf(Date);
    });

    it("should refresh access token", async () => {
      const mockResponse = {
        access_token: "refreshed_token",
        refresh_token: "new_refresh_token",
        expires_in: 3600,
        token_type: "Bearer",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockResponse,
      });

      const newToken: string = await adapter.refreshToken();

      expect(newToken).toBe("refreshed_token");
      expect(mockConnection.accessToken).toBe("refreshed_token");
    });
  });

  describe("Contact Operations", () => {
    it("should fetch contacts with search", async () => {
      const mockResponse = {
        results: [
          {
            id: "contact_123",
            properties: {
              firstname: "John",
              lastname: "Doe",
              email: "john@example.com",
              phone: "555-1234",
              lastmodifieddate: "1704067200000",
            },
            associations: {
              companies: [],
              deals: [],
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T10:00:00Z",
            archived: false,
          },
        ],
        total: 1,
        paging: null,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContacts(
        { email: "john@example.com" },
        { limit: 20 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.data[0]?.firstName).toBe("John");
      expect(result.data[0]?.lastName).toBe("Doe");
    });

    it("should get single contact", async () => {
      const mockResponse = {
        id: "contact_123",
        properties: {
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          phone: "555-5678",
          city: "San Francisco",
        },
        associations: {
          companies: [],
          deals: [],
        },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-03-01T10:00:00Z",
        archived: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const contact: CRMContact = await adapter.getContact("contact_123");

      expect(contact.id).toBe("contact_123");
      expect(contact.firstName).toBe("Jane");
      expect(contact.lastName).toBe("Smith");
      expect(contact.address?.city).toBe("San Francisco");
    });

    it("should create contact", async () => {
      const mockResponse = {
        id: "contact_new_456",
        properties: {
          firstname: "Alice",
          lastname: "Johnson",
          email: "alice@example.com",
        },
        createdAt: "2024-03-01T12:00:00Z",
        updatedAt: "2024-03-01T12:00:00Z",
        archived: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const newContact: CRMContact = await adapter.createContact({
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@example.com",
      });

      expect(newContact.id).toBe("contact_new_456");
      expect(newContact.firstName).toBe("Alice");
      expect(newContact.lastModifiedAt).toBeInstanceOf(Date);
    });

    it("should update contact", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "contact_123",
            properties: { lastname: "Doe Updated" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "contact_123",
            properties: {
              firstname: "John",
              lastname: "Doe Updated",
              email: "john.new@example.com",
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T12:00:00Z",
            archived: false,
          }),
        });

      const updated: CRMContact = await adapter.updateContact("contact_123", {
        lastName: "Doe Updated",
        email: "john.new@example.com",
      });

      expect(updated.lastName).toBe("Doe Updated");
    });

    it("should search contacts", async () => {
      const mockResponse = {
        results: [
          {
            id: "contact_123",
            properties: {
              firstname: "John",
              lastname: "Doe",
            },
          },
        ],
        total: 1,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.search("John Doe", "contacts", {
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("Company Operations", () => {
    it("should fetch companies (accounts)", async () => {
      const mockResponse = {
        results: [
          {
            id: "company_123",
            properties: {
              name: "Acme Corp",
              industry: "Technology",
              website: "https://acme.com",
              phone: "555-0000",
              lastmodifieddate: "1704067200000",
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T10:00:00Z",
            archived: false,
          },
        ],
        total: 1,
        paging: null,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getAccounts({ name: "Acme" }, { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Acme Corp");
      expect(result.data[0]?.industry).toBe("Technology");
    });

    it("should create company", async () => {
      const mockResponse = {
        id: "company_new_789",
        properties: {
          name: "Tech Innovations LLC",
          industry: "Software",
        },
        createdAt: "2024-03-01T12:00:00Z",
        updatedAt: "2024-03-01T12:00:00Z",
        archived: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const newAccount: CRMAccount = await adapter.createAccount({
        name: "Tech Innovations LLC",
        industry: "Software",
      });

      expect(newAccount.id).toBe("company_new_789");
      expect(newAccount.name).toBe("Tech Innovations LLC");
    });

    it("should update company", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "company_123",
            properties: { industry: "Finance" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "company_123",
            properties: {
              name: "Acme Corp",
              industry: "Finance",
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T12:00:00Z",
            archived: false,
          }),
        });

      const updated: CRMAccount = await adapter.updateAccount("company_123", {
        industry: "Finance",
      });

      expect(updated.industry).toBe("Finance");
    });
  });

  describe("Deal Operations", () => {
    it("should fetch deals", async () => {
      const mockResponse = {
        results: [
          {
            id: "deal_123",
            properties: {
              dealname: "Enterprise License",
              dealstage: "negotiation",
              amount: "50000",
              closedate: "1719792000000",
              lastmodifieddate: "1704067200000",
            },
            associations: {
              contacts: [],
              companies: [{ id: "company_123" }],
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T10:00:00Z",
            archived: false,
          },
        ],
        total: 1,
        paging: null,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getOpportunities(
        { stage: "negotiation" },
        { limit: 20 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.stage).toBe("negotiation");
      expect(result.data[0]?.amount).toBe(50000);
    });

    it("should update deal", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "deal_123",
            properties: { dealstage: "closedwon" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "deal_123",
            properties: {
              dealname: "Enterprise License",
              dealstage: "closedwon",
              amount: "60000",
              lastmodifieddate: "1704067200000",
            },
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-03-01T12:00:00Z",
            archived: false,
          }),
        });

      const updated: CRMDeal = await adapter.updateDeal("deal_123", {
        stage: "closedwon",
        amount: 60000,
      });

      expect(updated.stage).toBe("closedwon");
      expect(updated.amount).toBe(60000);
    });
  });

  describe("Activity Operations", () => {
    it("should create activity (note)", async () => {
      const mockResponse = {
        id: "note_new_001",
        properties: {
          hs_note_body: "Delivery completed\nCustomer satisfied",
          hs_created_by: "api",
        },
        createdAt: "2024-03-01T12:00:00Z",
        updatedAt: "2024-03-01T12:00:00Z",
        archived: false,
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const activity = await adapter.createActivity({
        type: "note",
        subject: "Delivery completed",
        description: "Customer satisfied",
        recordType: "contact",
        recordId: "contact_123",
      });

      expect(activity.id).toBe("note_new_001");
      expect(activity.type).toBe("note");
    });

    it("should sync multiple activities", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "note_1",
            properties: { hs_note_body: "Activity 1" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "note_2",
            properties: { hs_note_body: "Activity 2" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const results = await adapter.syncActivities([
        {
          id: "act_1",
          type: "note",
          subject: "Activity 1",
          recordType: "contact",
          recordId: "contact_123",
        },
        {
          id: "act_2",
          type: "note",
          subject: "Activity 2",
          recordType: "contact",
          recordId: "contact_123",
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe("synced");
      expect(results[1]?.status).toBe("synced");
    });
  });

  describe("Rate Limiting", () => {
    it("should return rate limit info", () => {
      const rateLimitInfo = adapter.getRateLimitInfo();

      expect(rateLimitInfo).toHaveProperty("remaining");
      expect(rateLimitInfo).toHaveProperty("limit");
      expect(rateLimitInfo).toHaveProperty("resetAt");
      expect(rateLimitInfo.limit).toBe(100);
    });
  });

  describe("Data Normalization", () => {
    it("should normalize HubSpot contact to CRMContact", async () => {
      const mockResponse = {
        id: "hs_contact_123",
        properties: {
          firstname: "John",
          lastname: "Doe",
          email: "john@example.com",
          phone: "555-1234",
          mobilephone: "555-5678",
          jobtitle: "VP Sales",
          address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
          country: "USA",
          lastmodifieddate: "1704067200000",
        },
        associations: {
          companies: [],
          deals: [],
        },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-03-01T10:00:00Z",
        archived: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const contact: CRMContact = await adapter.getContact("hs_contact_123");

      expect(contact.firstName).toBe("John");
      expect(contact.lastName).toBe("Doe");
      expect(contact.email).toBe("john@example.com");
      expect(contact.phone).toBe("555-1234");
      expect(contact.mobile).toBe("555-5678");
      expect(contact.title).toBe("VP Sales");
      expect(contact.address).toEqual({
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94102",
        country: "USA",
      });
    });

    it("should normalize HubSpot company to CRMAccount", async () => {
      const mockResponse = {
        id: "hs_company_123",
        properties: {
          name: "Tech Corp",
          industry: "Technology",
          website: "https://techcorp.com",
          phone: "555-0000",
          address: "456 Tech Ave",
          city: "San Francisco",
          state: "CA",
          zip: "94103",
          country: "USA",
          numberofemployees: "250",
          annualrevenue: "5000000",
          lastmodifieddate: "1704067200000",
        },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-03-01T10:00:00Z",
        archived: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const account: CRMAccount = await adapter.getAccount("hs_company_123");

      expect(account.name).toBe("Tech Corp");
      expect(account.industry).toBe("Technology");
      expect(account.website).toBe("https://techcorp.com");
      expect(account.employees).toBe(250);
      expect(account.annualRevenue).toBe(5000000);
    });
  });

  describe("Error Handling", () => {
    it("should handle refresh token failures", async () => {
      const connectionNoToken = { ...mockConnection, refreshToken: undefined };
      const adapterNoToken = new HubSpotAdapter(connectionNoToken, {
        clientId: "test",
        clientSecret: "test",
        redirectUri: "http://localhost",
      });

      await expect(adapterNoToken.refreshToken()).rejects.toThrow(
        "No refresh token available",
      );
    });
  });
});
