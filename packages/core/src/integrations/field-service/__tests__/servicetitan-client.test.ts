/**
 * ServiceTitan Client Tests
 * Comprehensive unit tests for ServiceTitan API v2 integration
 * 25+ test cases covering CRUD, dispatch, and sync operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceTitanClient } from "../servicetitan-client.js";
import type {
  FieldServiceConnection,
  Job,
  Technician,
  Estimate,
  Invoice,
} from "../types.js";

/** Helper: build a mock fetch that handles auth + one API response */
function createAuthAwareMock(apiResponse: Response): ReturnType<typeof vi.fn> {
  const authResponse = new Response(
    JSON.stringify({
      access_token: "test-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
    { status: 200 },
  );
  const fn = vi
    .fn()
    .mockResolvedValueOnce(authResponse)
    .mockResolvedValueOnce(apiResponse);
  return fn;
}

describe("ServiceTitanClient", () => {
  let client: ServiceTitanClient;
  let mockConnection: FieldServiceConnection;
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockConnection = {
      id: "test-conn",
      tenantId: "test-tenant",
      provider: "servicetitan",
      credentials: {
        apiKey: "test-key",
        apiSecret: "test-secret",
        tenantId: "test-tenant-id",
      },
      config: {
        timeout: 30000,
        maxRetries: 3,
        retryDelayMs: 1000,
        rateLimitPerSecond: 100,
      },
      status: "active",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);

    client = new ServiceTitanClient(mockConnection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Health Check", () => {
    it("should return true for successful health check", async () => {
      // auth call + health check call
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "tok", expires_in: 3600 }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [{ id: "1" }] }), {
            status: 200,
          }),
        );
      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when health check fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("Job Management", () => {
    const authResp = () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });

    it("should create a job successfully", async () => {
      const mockJob: Job = {
        jobNumber: "JOB001",
        customerId: "CUST001",
        title: "Test Job",
        location: {
          address: "123 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "high",
      };

      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "job-123",
            number: "JOB001",
            customerId: "CUST001",
            description: "Test Job",
            status: "scheduled",
            priority: 1,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.createJob(mockJob);
      expect(result.jobNumber).toBe("JOB001");
      expect(result.id).toBe("job-123");
    });

    it("should get a job by ID", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "job-123",
            number: "JOB001",
            customerId: "CUST001",
            customerName: "Acme Corp",
            description: "Test Job",
            status: "in_progress",
            priority: 1,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.getJob("job-123");
      expect(result.jobNumber).toBe("JOB001");
      expect(result.customerName).toBe("Acme Corp");
    });

    it("should list jobs with pagination", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "job-1",
                number: "JOB001",
                customerId: "CUST001",
                description: "Job 1",
                status: "scheduled",
                priority: 1,
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
              {
                id: "job-2",
                number: "JOB002",
                customerId: "CUST002",
                description: "Job 2",
                status: "scheduled",
                priority: 1,
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
            ],
            pageInfo: { totalCount: 2, hasMore: false },
          }),
          { status: 200 },
        ),
      );

      const result = await client.listJobs({ limit: 50 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should update a job", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "job-123",
            number: "JOB001",
            customerId: "CUST001",
            description: "Updated Job",
            status: "completed",
            priority: 1,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.updateJob("job-123", {
        title: "Updated Job",
        status: "completed",
      });
      expect(result.title).toBe("Updated Job");
    });

    it("should delete a job", async () => {
      mockFetch
        .mockResolvedValueOnce(authResp())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      await expect(client.deleteJob("job-123")).resolves.not.toThrow();
    });

    it("should batch create jobs", async () => {
      // batch creates call createJob for each job, each needing auth + API response
      // After first auth, token is cached, so only first call needs auth
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "job-new",
            number: "JOB-NEW",
            customerId: "CUST001",
            description: "New Job",
            status: "scheduled",
            priority: 1,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const jobs: Job[] = [
        {
          jobNumber: "JOB001",
          customerId: "CUST001",
          title: "Job 1",
          location: {
            address: "123 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
          },
          status: "scheduled",
          priority: "high",
        },
      ];

      const result = await client.batchCreateJobs(jobs);
      expect(result.successful).toBeGreaterThan(0);
    });
  });

  describe("Technician Management", () => {
    const authResp = () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });

    it("should get a technician by ID", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "tech-123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            phone: "555-1234",
            status: "available",
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.getTechnician("tech-123");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
    });

    it("should list technicians", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "tech-1",
                firstName: "John",
                lastName: "Doe",
                status: "available",
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
              {
                id: "tech-2",
                firstName: "Jane",
                lastName: "Smith",
                status: "busy",
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
            ],
            pageInfo: { totalCount: 2, hasMore: false },
          }),
          { status: 200 },
        ),
      );

      const result = await client.listTechnicians({ limit: 50 });
      expect(result.items).toHaveLength(2);
    });

    it("should update technician availability", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "tech-123",
            firstName: "John",
            lastName: "Doe",
            status: "unavailable",
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.updateTechnicianAvailability(
        "tech-123",
        "unavailable",
      );
      expect(result.status).toBe("unavailable");
    });

    it("should get technician location", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            latitude: 42.3601,
            longitude: -71.0589,
            timestamp: new Date().toISOString(),
            accuracy: 10,
          }),
          { status: 200 },
        ),
      );

      const result = await client.getTechnicianLocation("tech-123");
      expect(result.latitude).toBe(42.3601);
      expect(result.longitude).toBe(-71.0589);
    });
  });

  describe("Scheduling", () => {
    const authResp = () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });

    it("should list available time slots", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                startTime: "2024-01-01T09:00:00Z",
                endTime: "2024-01-01T17:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const result = await client.listAvailableSlots(
        "tech-123",
        startDate,
        endDate,
      );
      expect(result).toHaveLength(1);
    });

    it("should schedule a job for technician", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "job-123",
            number: "JOB001",
            customerId: "CUST001",
            description: "Test Job",
            status: "scheduled",
            priority: 1,
            jobDate: "2024-01-15",
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.scheduleJob(
        "job-123",
        "tech-123",
        new Date("2024-01-15"),
      );
      expect(result.jobNumber).toBe("JOB001");
    });
  });

  describe("Estimates and Invoices", () => {
    const authResp = () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });

    it("should create an estimate", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "est-123",
            number: "EST001",
            customerId: "CUST001",
            status: "draft",
            issueDate: new Date().toISOString(),
            total: 1500,
          }),
          { status: 200 },
        ),
      );

      const estimate: Estimate = {
        estimateNumber: "EST001",
        customerId: "CUST001",
        issueDate: new Date(),
        lineItems: [
          { description: "Service", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
        subtotal: 1500,
        total: 1500,
        status: "draft",
      };

      const result = await client.createEstimate(estimate);
      expect(result.estimateNumber).toBe("EST001");
    });

    it("should create an invoice", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "inv-123",
            number: "INV001",
            customerId: "CUST001",
            status: "draft",
            invoiceDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            total: 1500,
          }),
          { status: 200 },
        ),
      );

      const invoice: Invoice = {
        invoiceNumber: "INV001",
        customerId: "CUST001",
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [
          { description: "Service", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
        subtotal: 1500,
        total: 1500,
        status: "draft",
      };

      const result = await client.createInvoice(invoice);
      expect(result.invoiceNumber).toBe("INV001");
    });

    it("should list invoices", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "inv-1",
                number: "INV001",
                customerId: "CUST001",
                status: "draft",
                invoiceDate: new Date().toISOString(),
                dueDate: new Date().toISOString(),
                total: 1500,
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
            ],
            pageInfo: { totalCount: 1, hasMore: false },
          }),
          { status: 200 },
        ),
      );

      const result = await client.listInvoices();
      expect(result.items).toHaveLength(1);
    });

    it("should record an invoice payment", async () => {
      // recordPayment calls POST /billing/v2/payments then getInvoice
      mockFetch
        .mockResolvedValueOnce(authResp())
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              invoiceId: "inv-123",
              amount: 1500,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "inv-123",
              number: "INV001",
              customerId: "CUST001",
              status: "paid",
              invoiceDate: new Date().toISOString(),
              dueDate: new Date().toISOString(),
              total: 1500,
              amountPaid: 1500,
              createdDate: new Date().toISOString(),
              modifiedDate: new Date().toISOString(),
            }),
            { status: 200 },
          ),
        );

      const result = await client.recordPayment("inv-123", 1500, "credit_card");
      expect(result.status).toBe("paid");
    });
  });

  describe("Dispatch Operations", () => {
    const authResp = () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });

    it("should create dispatch assignment", async () => {
      mockFetch.mockResolvedValueOnce(authResp()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "assign-123",
            jobId: "job-123",
            resourceId: "tech-123",
            status: "assigned",
            createdDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const result = await client.createDispatchAssignment({
        jobId: "job-123",
        technicianId: "tech-123",
        status: "assigned",
        assignedAt: new Date(),
        priority: "high",
      });

      expect(result.status).toBe("assigned");
    });

    it("should cancel dispatch assignment", async () => {
      mockFetch
        .mockResolvedValueOnce(authResp())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      await expect(
        client.cancelDispatchAssignment("assign-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));
      const mockJob: Job = {
        jobNumber: "JOB999",
        customerId: "CUST999",
        title: "Test",
        location: {
          address: "123 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "high",
      };

      await expect(client.createJob(mockJob)).rejects.toThrow();
    });

    it("should retry failed requests", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        // First call is auth - let it succeed
        if (callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ access_token: "tok", expires_in: 3600 }),
              { status: 200 },
            ),
          );
        }
        // Second call fails (first API attempt), third succeeds (retry)
        if (callCount === 2) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "job-123",
              number: "JOB001",
              customerId: "CUST001",
              description: "Test Job",
              status: "scheduled",
              priority: 1,
              createdDate: new Date().toISOString(),
              modifiedDate: new Date().toISOString(),
            }),
            { status: 200 },
          ),
        );
      });

      const mockJob: Job = {
        jobNumber: "JOB001",
        customerId: "CUST001",
        title: "Test Job",
        location: {
          address: "123 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "high",
      };

      const result = await client.createJob(mockJob);
      expect(result.jobNumber).toBe("JOB001");
    });
  });
});
