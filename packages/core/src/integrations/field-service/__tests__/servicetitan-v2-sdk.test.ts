/**
 * ServiceTitan v2 SDK Client Tests
 * Unit tests for job management, customers, technicians, estimates, invoices, and dispatch
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceTitanV2Client } from '../servicetitan-v2-sdk-client.js';
import { APIError, RateLimitError } from '../field-service-sdk-types.js';

const mockConfig = {
  appKey: 'st_' + 'FAKE_APP_KEY_123',
  appSecret: 'st_' + 'FAKE_SECRET_456',
  tenantId: 'tenant_' + '789',
  apiUrl: 'https://api.servicetitan.com',
};

describe('ServiceTitanV2Client', () => {
  let client: ServiceTitanV2Client;

  beforeEach(() => {
    client = new ServiceTitanV2Client(mockConfig);
    vi.clearAllMocks();
  });

  // ─── AUTHENTICATION TESTS ─────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should authenticate with valid credentials', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'token_' + 'abc123',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
      );

      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw APIError on authentication failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }),
      );

      await expect(client.authenticate()).rejects.toThrow(APIError);
    });
  });

  // ─── JOB MANAGEMENT TESTS ─────────────────────────────────────────────────

  describe('Job Management', () => {
    beforeEach(async () => {
      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        if (url.includes('/auth/v1/oauth/token')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'token_' + 'test123',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: new Headers({
              'X-RateLimit-Remaining': '99',
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 60).toString(),
            }),
          }),
        );
      });
      await client.authenticate();
    });

    it('should create a job', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'job_' + '123',
            number: 'JOB-001',
            customerId: 'cust_' + '456',
            description: 'Fix HVAC',
            status: 'scheduled',
            priority: 1,
            locationStreet: '123 Main St',
            locationCity: 'Springfield',
            locationZip: '12345',
            locationState: 'IL',
            jobTotal: 500,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          {
            status: 201,
            headers: new Headers({
              'X-RateLimit-Remaining': '98',
              'X-RateLimit-Limit': '100',
            }),
          },
        ),
      );

      const response = await client.createJob({
        customerId: 'cust_' + '456',
        title: 'Fix HVAC',
        priority: 'high',
        location: {
          address: '123 Main St',
          city: 'Springfield',
          postalCode: '12345',
          state: 'IL',
          country: 'US',
        },
      });

      expect(response.id).toBe('job_' + '123');
      expect(response.title).toBe('Fix HVAC');
      expect(response.status).toBe('scheduled');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/v2/jobs'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should get a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'job_' + '123',
            number: 'JOB-001',
            customerId: 'cust_' + '456',
            description: 'Fix HVAC',
            status: 'scheduled',
            priority: 1,
            locationStreet: '123 Main St',
            locationCity: 'Springfield',
            locationZip: '12345',
            locationState: 'IL',
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const response = await client.getJob('job_' + '123');

      expect(response.id).toBe('job_' + '123');
      expect(response.title).toBe('Fix HVAC');
    });

    it('should update a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'job_' + '123',
            number: 'JOB-001',
            customerId: 'cust_' + '456',
            description: 'Fix HVAC - Updated',
            status: 'in_progress',
            priority: 1,
            locationStreet: '123 Main St',
            locationCity: 'Springfield',
            locationZip: '12345',
            locationState: 'IL',
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const response = await client.updateJob('job_' + '123', {
        title: 'Fix HVAC - Updated',
        status: 'in_progress',
      });

      expect(response.title).toBe('Fix HVAC - Updated');
      expect(response.status).toBe('in_progress');
    });

    it('should complete a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'job_' + '123',
            number: 'JOB-001',
            customerId: 'cust_' + '456',
            description: 'Fix HVAC',
            status: 'completed',
            priority: 1,
            locationStreet: '123 Main St',
            locationCity: 'Springfield',
            locationZip: '12345',
            locationState: 'IL',
            completionDate: new Date().toISOString(),
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const response = await client.completeJob('job_' + '123', 'Job completed successfully');

      expect(response.status).toBe('completed');
      expect(response.completedAt).toBeDefined();
    });

    it('should list jobs with pagination', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'job_' + '123',
                number: 'JOB-001',
                customerId: 'cust_' + '456',
                description: 'Fix HVAC',
                status: 'scheduled',
                priority: 1,
                locationStreet: '123 Main St',
                locationCity: 'Springfield',
                locationZip: '12345',
                locationState: 'IL',
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
              },
            ],
            pageInfo: {
              totalCount: 1,
              hasMore: false,
              nextOffset: undefined,
            },
          }),
          { status: 200 },
        ),
      );

      const response = await client.listJobs({ limit: 50, offset: 0 });

      expect(response.items).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(response.hasMore).toBe(false);
    });
  });

  // ─── CUSTOMER MANAGEMENT TESTS ────────────────────────────────────────────

  describe('Customer Management', () => {
    beforeEach(async () => {
      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        if (url.includes('/auth/v1/oauth/token')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'token_' + 'test123',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: new Headers({
              'X-RateLimit-Remaining': '99',
              'X-RateLimit-Limit': '100',
            }),
          }),
        );
      });
      await client.authenticate();
    });

    it('should create a customer', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'cust_' + '123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-1234',
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '12345',
            country: 'US',
            type: 'Residential',
            status: 'active',
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 201 },
        ),
      );

      const response = await client.createCustomer({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        type: 'residential',
        primaryAddress: {
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '12345',
          country: 'US',
        },
      });

      expect(response.id).toBe('cust_' + '123');
      expect(response.firstName).toBe('John');
      expect(response.email).toBe('john@example.com');
    });

    it('should get a customer', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'cust_' + '123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-1234',
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '12345',
            country: 'US',
            type: 'Residential',
            status: 'active',
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const response = await client.getCustomer('cust_' + '123');

      expect(response.id).toBe('cust_' + '123');
      expect(response.firstName).toBe('John');
    });
  });

  // ─── INVOICE MANAGEMENT TESTS ─────────────────────────────────────────────

  describe('Invoice Management', () => {
    beforeEach(async () => {
      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        if (url.includes('/auth/v1/oauth/token')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'token_' + 'test123',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: new Headers({
              'X-RateLimit-Remaining': '99',
              'X-RateLimit-Limit': '100',
            }),
          }),
        );
      });
      await client.authenticate();
    });

    it('should create an invoice', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'inv_' + '123',
            number: 'INV-001',
            customerId: 'cust_' + '456',
            status: 'draft',
            invoiceDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            lineItems: [],
            total: 500,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 201 },
        ),
      );

      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await client.createInvoice({
        customerId: 'cust_' + '456',
        invoiceDate,
        dueDate,
        lineItems: [
          {
            description: 'Service',
            quantity: 1,
            unitPrice: 500,
          },
        ],
      });

      expect(response.id).toBe('inv_' + '123');
      expect(response.total).toBe(500);
    });

    it('should record invoice payment', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            invoiceId: 'inv_' + '123',
            amount: 250,
            paymentMethod: 'card',
            paymentDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      // Mock the follow-up getInvoice call
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'inv_' + '123',
            number: 'INV-001',
            customerId: 'cust_' + '456',
            status: 'partially_paid',
            invoiceDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            lineItems: [],
            total: 500,
            amountPaid: 250,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString(),
          }),
          { status: 200 },
        ),
      );

      const response = await client.recordPayment({
        invoiceId: 'inv_' + '123',
        amount: 250,
        method: 'card',
      });

      expect(response.amountPaid).toBe(250);
      expect(response.status).toBe('partially_paid');
    });
  });

  // ─── DISPATCH MANAGEMENT TESTS ────────────────────────────────────────────

  describe('Dispatch Management', () => {
    beforeEach(async () => {
      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        if (url.includes('/auth/v1/oauth/token')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'token_' + 'test123',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: new Headers({
              'X-RateLimit-Remaining': '99',
              'X-RateLimit-Limit': '100',
            }),
          }),
        );
      });
      await client.authenticate();
    });

    it('should create a dispatch assignment', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'disp_' + '123',
            jobId: 'job_' + '456',
            resourceId: 'tech_' + '789',
            status: 'assigned',
            priority: 1,
            createdDate: new Date().toISOString(),
          }),
          { status: 201 },
        ),
      );

      const response = await client.createDispatchAssignment({
        jobId: 'job_' + '456',
        technicianId: 'tech_' + '789',
        priority: 'high',
      });

      expect(response.id).toBe('disp_' + '123');
      expect(response.status).toBe('assigned');
      expect(response.jobId).toBe('job_' + '456');
      expect(response.technicianId).toBe('tech_' + '789');
    });
  });

  // ─── WEBHOOK VERIFICATION TESTS ───────────────────────────────────────────

  describe('Webhook Verification', () => {
    it('should verify webhook signature', () => {
      const secret = 'secret_' + 'key123';
      const payload = JSON.stringify({ eventId: '123', type: 'job.created' });
      const signature = require('crypto')
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = client.verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const secret = 'secret_' + 'key123';
      const payload = JSON.stringify({ eventId: '123', type: 'job.created' });
      const invalidSignature = 'invalid_sig_' + 'abc123';

      const isValid = client.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });
  });

  // ─── HEALTH CHECK TESTS ───────────────────────────────────────────────────

  describe('Health Check', () => {
    beforeEach(async () => {
      vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
        if (url.includes('/auth/v1/oauth/token')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'token_' + 'test123',
                expires_in: 3600,
                token_type: 'Bearer',
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: new Headers({
              'X-RateLimit-Remaining': '99',
              'X-RateLimit-Limit': '100',
            }),
          }),
        );
      });
      await client.authenticate();
    });

    it('should return true for successful health check', async () => {
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});
