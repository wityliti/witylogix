/**
 * Jobber v2 SDK Client Tests
 * Unit tests for GraphQL queries, mutations, pagination, and cost-based rate limiting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobberV2Client } from '../jobber-v2-sdk-client.js';
import { APIError } from '../field-service-sdk-types.js';

const mockConfig = {
  accessToken: 'token_' + 'jobber_abc123',
  refreshToken: 'refresh_' + 'token_xyz789',
  clientId: 'client_' + 'id_123',
  clientSecret: 'client_' + 'secret_456',
  apiUrl: 'https://api.getjobber.com/graphql',
};

describe('JobberV2Client', () => {
  let client: JobberV2Client;

  beforeEach(() => {
    client = new JobberV2Client(mockConfig);
    vi.clearAllMocks();
  });

  // ─── GRAPHQL REQUEST TESTS ─────────────────────────────────────────────────

  describe('GraphQL Requests', () => {
    it('should execute GraphQL query', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobs: {
                edges: [
                  {
                    node: {
                      id: 'job_' + '123',
                      number: 'JOB-001',
                      clientId: 'client_' + '456',
                      title: 'Fix HVAC',
                      status: 'SCHEDULED',
                      priority: 'HIGH',
                      address: {
                        street: '123 Main St',
                        city: 'Springfield',
                        province: 'IL',
                        postalCode: '12345',
                        country: 'US',
                      },
                      createdAt: new Date().toISOString(),
                    },
                    cursor: 'cursor_' + '123',
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: 'cursor_' + '123',
                },
                totalCount: 1,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '10',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.listJobs({ limit: 50 });

      expect(response.items).toHaveLength(1);
      expect(response.items[0].title).toBe('Fix HVAC');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/graphql'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should handle GraphQL errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: 'Invalid query',
                path: ['jobs'],
              },
            ],
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '5',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      await expect(client.listJobs()).rejects.toThrow(APIError);
    });
  });

  // ─── JOB MANAGEMENT TESTS ─────────────────────────────────────────────────

  describe('Job Management', () => {
    it('should create a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobCreate: {
                job: {
                  id: 'job_' + '123',
                  number: 'JOB-001',
                  clientId: 'client_' + '456',
                  title: 'Fix HVAC',
                  status: 'SCHEDULED',
                  priority: 'HIGH',
                  address: {
                    street: '123 Main St',
                    city: 'Springfield',
                    province: 'IL',
                    postalCode: '12345',
                    country: 'CA',
                  },
                  total: 500,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                errors: null,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '25',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.createJob({
        customerId: 'client_' + '456',
        title: 'Fix HVAC',
        priority: 'high',
        location: {
          address: '123 Main St',
          city: 'Springfield',
          postalCode: '12345',
          state: 'IL',
          country: 'CA',
        },
      });

      expect(response.id).toBe('job_' + '123');
      expect(response.title).toBe('Fix HVAC');
      expect(response.status).toBe('scheduled');
    });

    it('should get a job by ID', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              job: {
                id: 'job_' + '123',
                number: 'JOB-001',
                clientId: 'client_' + '456',
                title: 'Fix HVAC',
                description: 'HVAC repair needed',
                status: 'SCHEDULED',
                priority: 'HIGH',
                scheduledStartTime: new Date().toISOString(),
                address: {
                  street: '123 Main St',
                  city: 'Springfield',
                  province: 'IL',
                  postalCode: '12345',
                  country: 'CA',
                },
                teamMembers: [
                  { id: 'tech_' + '789', name: 'John Doe' },
                ],
                total: 500,
                notes: 'Emergency call',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '15',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.getJob('job_' + '123');

      expect(response.id).toBe('job_' + '123');
      expect(response.title).toBe('Fix HVAC');
      expect(response.assignedTechnicians).toContain('tech_' + '789');
    });

    it('should update a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobUpdate: {
                job: {
                  id: 'job_' + '123',
                  number: 'JOB-001',
                  clientId: 'client_' + '456',
                  title: 'Fix HVAC - Updated',
                  status: 'IN_PROGRESS',
                  priority: 'HIGH',
                  address: {
                    street: '123 Main St',
                    city: 'Springfield',
                    province: 'IL',
                    postalCode: '12345',
                    country: 'CA',
                  },
                  total: 500,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '20',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.updateJob('job_' + '123', {
        title: 'Fix HVAC - Updated',
        status: 'in_progress',
      });

      expect(response.title).toBe('Fix HVAC - Updated');
      expect(response.status).toBe('in_progress');
    });

    it('should delete a job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobDelete: {
                deletedId: 'job_' + '123',
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '10',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      await expect(client.deleteJob('job_' + '123')).resolves.not.toThrow();
    });

    it('should list jobs with cursor pagination', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobs: {
                edges: [
                  {
                    node: {
                      id: 'job_' + '123',
                      number: 'JOB-001',
                      clientId: 'client_' + '456',
                      title: 'Fix HVAC',
                      status: 'SCHEDULED',
                      priority: 'HIGH',
                      address: {
                        street: '123 Main St',
                        city: 'Springfield',
                        province: 'IL',
                        postalCode: '12345',
                        country: 'CA',
                      },
                      total: 500,
                      createdAt: new Date().toISOString(),
                    },
                    cursor: 'cursor_' + 'abc123',
                  },
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor_' + 'abc123',
                },
                totalCount: 10,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '30',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.listJobs({ limit: 1, pageToken: undefined });

      expect(response.items).toHaveLength(1);
      expect(response.total).toBe(10);
      expect(response.hasMore).toBe(true);
      expect(response.nextPageToken).toBe('cursor_' + 'abc123');
    });

    it('should schedule job for technician', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobUpdate: {
                job: {
                  id: 'job_' + '123',
                  number: 'JOB-001',
                  clientId: 'client_' + '456',
                  title: 'Fix HVAC',
                  status: 'SCHEDULED',
                  scheduledStartTime: new Date().toISOString(),
                  address: {
                    street: '123 Main St',
                    city: 'Springfield',
                    province: 'IL',
                    postalCode: '12345',
                    country: 'CA',
                  },
                  total: 500,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '20',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.scheduleJob('job_' + '123', {
        technicianId: 'tech_' + '789',
        scheduledStart: new Date(),
      });

      expect(response.status).toBe('scheduled');
      expect(response.scheduledStart).toBeDefined();
    });

    it('should complete job', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              jobUpdate: {
                job: {
                  id: 'job_' + '123',
                  number: 'JOB-001',
                  status: 'COMPLETED',
                  completedAt: new Date().toISOString(),
                },
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '20',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.completeJob('job_' + '123', 'Completed successfully');

      expect(response.status).toBe('completed');
      expect(response.completedAt).toBeDefined();
    });
  });

  // ─── CUSTOMER MANAGEMENT TESTS ────────────────────────────────────────────

  describe('Customer Management', () => {
    it('should create a customer', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              clientCreate: {
                client: {
                  id: 'client_' + '123',
                  firstName: 'John',
                  lastName: 'Doe',
                  email: 'john@example.com',
                  phone: '555-1234',
                  mobile: '555-5678',
                  billingAddress: {
                    street: '123 Main St',
                    city: 'Springfield',
                    province: 'IL',
                    postalCode: '12345',
                    country: 'CA',
                  },
                  status: 'ACTIVE',
                },
                errors: null,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '25',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.createCustomer({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        mobile: '555-5678',
        type: 'residential',
        primaryAddress: {
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '12345',
          country: 'CA',
        },
      });

      expect(response.id).toBe('client_' + '123');
      expect(response.firstName).toBe('John');
      expect(response.email).toBe('john@example.com');
    });

    it('should get a customer', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              client: {
                id: 'client_' + '123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                phone: '555-1234',
                mobile: '555-5678',
                billingAddress: {
                  street: '123 Main St',
                  city: 'Springfield',
                  province: 'IL',
                  postalCode: '12345',
                  country: 'CA',
                },
                shippingAddress: {
                  street: '456 Oak Ave',
                  city: 'Shelbyville',
                  province: 'IL',
                  postalCode: '54321',
                  country: 'CA',
                },
                status: 'ACTIVE',
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '15',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.getCustomer('client_' + '123');

      expect(response.id).toBe('client_' + '123');
      expect(response.firstName).toBe('John');
    });

    it('should list customers with pagination', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              clients: {
                edges: [
                  {
                    node: {
                      id: 'client_' + '123',
                      firstName: 'John',
                      lastName: 'Doe',
                      email: 'john@example.com',
                      phone: '555-1234',
                      mobile: '555-5678',
                      billingAddress: {
                        street: '123 Main St',
                        city: 'Springfield',
                        province: 'IL',
                        postalCode: '12345',
                        country: 'CA',
                      },
                      status: 'ACTIVE',
                    },
                    cursor: 'cursor_' + 'abc123',
                  },
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor_' + 'abc123',
                },
                totalCount: 5,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '20',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.listCustomers({ limit: 1 });

      expect(response.items).toHaveLength(1);
      expect(response.total).toBe(5);
      expect(response.hasMore).toBe(true);
      expect(response.nextPageToken).toBe('cursor_' + 'abc123');
    });
  });

  // ─── INVOICE MANAGEMENT TESTS ─────────────────────────────────────────────

  describe('Invoice Management', () => {
    it('should create an invoice', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              invoiceCreate: {
                invoice: {
                  id: 'inv_' + '123',
                  number: 'INV-001',
                  clientId: 'client_' + '456',
                  status: 'DRAFT',
                  invoiceDate: new Date().toISOString(),
                  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  lineItems: [],
                  total: 500,
                  amountPaid: 0,
                  notes: 'Payment due within 30 days',
                },
                errors: null,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '30',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await client.createInvoice({
        customerId: 'client_' + '456',
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
            data: {
              paymentCreate: {
                payment: {
                  invoiceId: 'inv_' + '123',
                  amount: 250,
                  paymentMethod: 'CARD',
                },
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '25',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      // Mock the follow-up getInvoice call
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              invoice: {
                id: 'inv_' + '123',
                number: 'INV-001',
                clientId: 'client_' + '456',
                status: 'PARTIALLY_PAID',
                invoiceDate: new Date().toISOString(),
                dueDate: new Date().toISOString(),
                lineItems: [],
                total: 500,
                amountPaid: 250,
                notes: 'Partial payment received',
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '15',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
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

  // ─── TECHNICIAN MANAGEMENT TESTS ──────────────────────────────────────────

  describe('Technician Management', () => {
    it('should get a technician', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              teamMember: {
                id: 'tech_' + '123',
                firstName: 'John',
                lastName: 'Smith',
                email: 'john.smith@example.com',
                phone: '555-9999',
                status: 'AVAILABLE',
                skills: ['HVAC', 'Plumbing'],
                currentLocation: {
                  latitude: 39.7817,
                  longitude: -89.6501,
                  timestamp: new Date().toISOString(),
                },
                currentJobId: 'job_' + '456',
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '15',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.getTechnician('tech_' + '123');

      expect(response.id).toBe('tech_' + '123');
      expect(response.firstName).toBe('John');
      expect(response.skills).toContain('HVAC');
      expect(response.currentLocation).toBeDefined();
    });

    it('should list technicians with pagination', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              teamMembers: {
                edges: [
                  {
                    node: {
                      id: 'tech_' + '123',
                      firstName: 'John',
                      lastName: 'Smith',
                      email: 'john.smith@example.com',
                      phone: '555-9999',
                      status: 'AVAILABLE',
                      skills: ['HVAC', 'Plumbing'],
                      currentLocation: {
                        latitude: 39.7817,
                        longitude: -89.6501,
                        timestamp: new Date().toISOString(),
                      },
                    },
                    cursor: 'cursor_' + 'tech123',
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: 'cursor_' + 'tech123',
                },
                totalCount: 3,
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '25',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const response = await client.listTechnicians({ limit: 1 });

      expect(response.items).toHaveLength(1);
      expect(response.total).toBe(3);
      expect(response.hasMore).toBe(false);
    });
  });

  // ─── HEALTH CHECK TESTS ───────────────────────────────────────────────────

  describe('Health Check', () => {
    it('should return true for successful health check', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { viewer: { id: 'user_' + '123' } },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '5',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  // ─── BATCH OPERATIONS TESTS ────────────────────────────────────────────────

  describe('Batch Operations', () => {
    it('should batch create jobs', async () => {
      const createDate = new Date().toISOString();

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              job0: {
                job: {
                  id: 'job_' + '101',
                  number: 'JOB-101',
                  clientId: 'client_' + '456',
                  title: 'Fix HVAC',
                  status: 'SCHEDULED',
                  scheduledStartTime: createDate,
                  total: 500,
                  createdAt: createDate,
                },
              },
              job1: {
                job: {
                  id: 'job_' + '102',
                  number: 'JOB-102',
                  clientId: 'client_' + '456',
                  title: 'Fix Plumbing',
                  status: 'SCHEDULED',
                  scheduledStartTime: createDate,
                  total: 400,
                  createdAt: createDate,
                },
              },
            },
          }),
          {
            status: 200,
            headers: new Headers({
              'X-GraphQL-Cost-Used': '50',
              'X-GraphQL-Cost-Limit': '1000',
            }),
          },
        ),
      );

      const responses = await client.batchCreateJobs([
        {
          customerId: 'client_' + '456',
          title: 'Fix HVAC',
          priority: 'high',
          location: {
            address: '123 Main St',
            city: 'Springfield',
            postalCode: '12345',
            country: 'CA',
          },
        },
        {
          customerId: 'client_' + '456',
          title: 'Fix Plumbing',
          priority: 'medium',
          location: {
            address: '456 Oak Ave',
            city: 'Shelbyville',
            postalCode: '54321',
            country: 'CA',
          },
        },
      ]);

      expect(responses).toHaveLength(2);
      expect(responses[0].id).toBe('job_' + '101');
      expect(responses[1].id).toBe('job_' + '102');
    });
  });
});
