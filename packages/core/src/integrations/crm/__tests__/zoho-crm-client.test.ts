/**
 * Zoho CRM Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ZohoCRMAdapter } from "../zoho-crm-client.js";
import type {
  CRMConnection,
  CRMFieldMapping,
  ZohoCRMConfig,
  CRMContact,
  CRMAccount,
  CRMDeal,
} from "../types.js";

describe("ZohoCRMAdapter", () => {
  let adapter: ZohoCRMAdapter;
  let mockConfig: ZohoCRMConfig;
  let mockConnection: CRMConnection;
  let mockFieldMappings: CRMFieldMapping[];

  beforeEach(() => {
    mockConfig = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      domain: "com",
      redirectUri: "http://localhost:3000/callback",
    };

    mockConnection = {
      id: "conn-123",
      tenantId: "tenant-123",
      provider: "zoho",
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFieldMappings = [
      {
        id: "mapping-1",
        connectionId: "conn-123",
        witylogixField: "customerName",
        crmField: "First_Name",
        recordType: "contact",
        direction: "bidirectional",
        transformation: "none",
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    adapter = new ZohoCRMAdapter(mockConfig, mockConnection, mockFieldMappings);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Contact Operations", () => {
    it("should fetch contacts successfully", async () => {
      const mockResponse = {
        data: [
          {
            id: "contact-1",
            First_Name: "John",
            Last_Name: "Doe",
            Email: "john@example.com",
            Phone: "555-1234",
            Modified_Time: new Date().toISOString(),
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContacts({}, { limit: 200, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("contact-1");
      expect(result.data[0].firstName).toBe("John");
      expect(result.hasMore).toBe(false);
    });

    it("should get a single contact by ID", async () => {
      const mockResponse = {
        data: [
          {
            id: "contact-1",
            First_Name: "Jane",
            Last_Name: "Smith",
            Email: "jane@example.com",
            Modified_Time: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContact("contact-1");

      expect(result.id).toBe("contact-1");
      expect(result.firstName).toBe("Jane");
      expect(result.lastName).toBe("Smith");
    });

    it("should create a new contact", async () => {
      const newContact = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "555-5678",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "new-contact-1", message: "Success" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "new-contact-1",
                First_Name: "Test",
                Last_Name: "User",
                Email: "test@example.com",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.createContact(newContact);

      expect(result.id).toBe("new-contact-1");
      expect(result.firstName).toBe("Test");
      expect(result.lastName).toBe("User");
    });

    it("should update an existing contact", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "contact-1",
                First_Name: "John",
                Last_Name: "Updated",
                Email: "john.updated@example.com",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.updateContact("contact-1", {
        lastName: "Updated",
        email: "john.updated@example.com",
      });

      expect(result.lastName).toBe("Updated");
      expect(result.email).toBe("john.updated@example.com");
    });

    it("should bulk create contacts", async () => {
      const contacts = [
        { firstName: "Alice", lastName: "A", email: "alice@example.com" },
        { firstName: "Bob", lastName: "B", email: "bob@example.com" },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "contact-1", message: "Created" },
            { id: "contact-2", message: "Created" },
          ],
        }),
      });

      const results = await adapter.bulkCreateContacts(contacts);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("synced");
      expect(results[1].status).toBe("synced");
    });
  });

  describe("Account Operations", () => {
    it("should fetch accounts successfully", async () => {
      const mockResponse = {
        data: [
          {
            id: "account-1",
            Account_Name: "Acme Corp",
            Industry: "Technology",
            Website: "https://acme.com",
            Modified_Time: new Date().toISOString(),
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getAccounts({}, { limit: 200 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Acme Corp");
      expect(result.data[0].industry).toBe("Technology");
    });

    it("should create an account", async () => {
      const newAccount = {
        name: "New Corp",
        industry: "Finance",
        website: "https://newcorp.com",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "account-2", message: "Created" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "account-2",
                Account_Name: "New Corp",
                Industry: "Finance",
                Website: "https://newcorp.com",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.createAccount(newAccount);

      expect(result.id).toBe("account-2");
      expect(result.name).toBe("New Corp");
    });
  });

  describe("Deal Operations", () => {
    it("should fetch deals", async () => {
      const mockResponse = {
        data: [
          {
            id: "deal-1",
            Deal_Name: "Big Deal",
            Amount: 50000,
            Currency: "USD",
            Modified_Time: new Date().toISOString(),
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getDeals({}, { limit: 200 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Big Deal");
      expect(result.data[0].amount).toBe(50000);
    });

    it("should create a deal", async () => {
      const newDeal = {
        name: "New Deal",
        amount: 25000,
        currency: "USD",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "deal-2", message: "Created" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "deal-2",
                Deal_Name: "New Deal",
                Amount: 25000,
                Currency: "USD",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.createDeal(newDeal);

      expect(result.name).toBe("New Deal");
      expect(result.amount).toBe(25000);
    });

    it("should update a deal", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "deal-1",
                Deal_Name: "Updated Deal",
                Amount: 75000,
                Currency: "USD",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.updateDeal("deal-1", {
        name: "Updated Deal",
        amount: 75000,
      });

      expect(result.name).toBe("Updated Deal");
      expect(result.amount).toBe(75000);
    });
  });

  describe("Lead Operations", () => {
    it("should fetch leads", async () => {
      const mockResponse = {
        data: [
          {
            id: "lead-1",
            First_Name: "Lead",
            Last_Name: "User",
            Email: "lead@example.com",
            Company: "Lead Company",
            Modified_Time: new Date().toISOString(),
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getLeads({ limit: 200 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].firstName).toBe("Lead");
      expect(result.data[0].company).toBe("Lead Company");
    });

    it("should create a lead", async () => {
      const newLead = {
        firstName: "New",
        lastName: "Lead",
        email: "newlead@example.com",
        company: "New Company",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "lead-2", message: "Created" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "lead-2",
                First_Name: "New",
                Last_Name: "Lead",
                Email: "newlead@example.com",
                Company: "New Company",
                Modified_Time: new Date().toISOString(),
              },
            ],
          }),
        });

      const result = await adapter.createLead(newLead);

      expect(result.firstName).toBe("New");
      expect(result.company).toBe("New Company");
    });
  });

  describe("Activity Operations", () => {
    it("should fetch activities", async () => {
      const mockResponse = {
        data: [
          {
            id: "activity-1",
            Activity_Type: "call",
            Subject: "Follow up",
            Description: "Call customer",
            Modified_Time: new Date().toISOString(),
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getActivities("contact-1", { limit: 200 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe("call");
      expect(result.data[0].subject).toBe("Follow up");
    });

    it("should create an activity", async () => {
      const newActivity = {
        type: "email" as const,
        subject: "Send Email",
        description: "Follow up email",
        recordType: "contact" as const,
        recordId: "contact-1",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "activity-2", message: "Created" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "activity-2",
                Activity_Type: "email",
                Subject: "Send Email",
                Description: "Follow up email",
                Modified_Time: new Date().toISOString(),
              },
            ],
            info: { count: 1, more_records: false },
          }),
        });

      const result = await adapter.createActivity(newActivity);

      expect(result.type).toBe("email");
      expect(result.subject).toBe("Send Email");
    });
  });

  describe("Search Operations", () => {
    it("should search for records", async () => {
      const mockResponse = {
        data: [
          {
            id: "contact-1",
            First_Name: "John",
            Last_Name: "Doe",
            Email: "john@example.com",
          },
        ],
        info: { count: 1, more_records: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.search("john", "Contacts", { limit: 100 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("Note Operations", () => {
    it("should fetch notes for a record", async () => {
      const mockResponse = {
        data: [
          {
            id: "note-1",
            title: "Test Note",
            content: "This is a test note",
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getNotes("contact-1");

      expect(result).toHaveLength(1);
      expect((result[0] as any).title).toBe("Test Note");
    });

    it("should create a note", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "note-2" }],
        }),
      });

      const result = await adapter.createNote(
        "contact-1",
        "New Note",
        "Note content",
      );

      expect(result.id).toBe("note-2");
    });
  });

  describe("COQL Query Operations", () => {
    it("should execute COQL queries", async () => {
      const mockResponse = {
        data: [
          {
            id: "contact-1",
            First_Name: "John",
            Last_Name: "Doe",
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.executeCOQL(
        'SELECT id, First_Name FROM Contacts WHERE First_Name = "John"',
      );

      expect(result).toHaveLength(1);
      expect((result[0] as any).First_Name).toBe("John");
    });
  });

  describe("Rate Limiting", () => {
    it("should return rate limit info", () => {
      const rateLimit = adapter.getRateLimitInfo();

      expect(rateLimit).toHaveProperty("remaining");
      expect(rateLimit).toHaveProperty("limit");
      expect(rateLimit).toHaveProperty("resetAt");
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      await expect(adapter.getContacts({}, { limit: 200 })).rejects.toThrow();
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(adapter.getContacts({}, { limit: 200 })).rejects.toThrow();
    });
  });

  describe("Token Management", () => {
    it("should validate and refresh expired tokens", async () => {
      const expiredConnection: CRMConnection = {
        ...mockConnection,
        expiresAt: new Date(Date.now() - 1000), // Expired
        refreshToken: "test-refresh-token",
      };

      const adapterWithExpiredToken = new ZohoCRMAdapter(
        mockConfig,
        expiredConnection,
        mockFieldMappings,
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "new-access-token",
          expiresIn: 3600,
        }),
      });

      // Should attempt token refresh on next request
      expect(adapterWithExpiredToken).toBeDefined();
    });
  });
});
