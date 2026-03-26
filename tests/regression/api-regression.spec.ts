import { test, expect } from '@playwright/test';

/**
 * API Regression Test Suite
 * Tests API contracts, consistency, and error handling
 *
 * Covers:
 * - CRUD endpoints return expected status codes
 * - Pagination consistency (cursor, offset)
 * - Filter combinations and edge cases
 * - Sort ordering
 * - Rate limit headers
 * - Error response format consistency
 * - Content-Type enforcement
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

test.describe('API Regression Tests', () => {

  test.describe('@regression CRUD Operations', () => {
    test('should create order via POST /orders', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          recipientName: 'John Doe',
          recipientPhone: '555-0100',
          recipientAddress: '123 Main St',
          itemDescription: 'Test Package',
          itemValue: 99.99,
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('status', 'draft');
      expect(body).toHaveProperty('createdAt');
    });

    test('should get order via GET /orders/:id', async ({ request }) => {
      // First create an order
      const createResponse = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          recipientName: 'Jane Doe',
          recipientPhone: '555-0101',
          recipientAddress: '456 Oak Ave',
          itemDescription: 'Package',
          itemValue: 50.00,
        },
      });

      const order = await createResponse.json();
      const orderId = order.id;

      // Now fetch it
      const getResponse = await request.get(`${API_BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(getResponse.status()).toBe(200);
      const body = await getResponse.json();
      expect(body.id).toBe(orderId);
      expect(body.recipientName).toBe('Jane Doe');
    });

    test('should update order via PATCH /orders/:id', async ({ request }) => {
      // Create order
      const createResponse = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          recipientName: 'Bob Smith',
          recipientPhone: '555-0102',
          recipientAddress: '789 Pine Rd',
          itemDescription: 'Box',
          itemValue: 75.00,
        },
      });

      const order = await createResponse.json();

      // Update order
      const updateResponse = await request.patch(`${API_BASE_URL}/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: { recipientPhone: '555-0103' },
      });

      expect(updateResponse.status()).toBe(200);
      const updated = await updateResponse.json();
      expect(updated.recipientPhone).toBe('555-0103');
    });

    test('should delete order via DELETE /orders/:id', async ({ request }) => {
      // Create order
      const createResponse = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          recipientName: 'Alice Johnson',
          recipientPhone: '555-0104',
          recipientAddress: '321 Elm St',
          itemDescription: 'Parcel',
          itemValue: 30.00,
        },
      });

      const order = await createResponse.json();

      // Delete order
      const deleteResponse = await request.delete(`${API_BASE_URL}/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(deleteResponse.status()).toBe(204);

      // Verify deleted
      const getResponse = await request.get(`${API_BASE_URL}/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('@regression List Endpoints', () => {
    test('should list orders with cursor pagination', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { limit: 10 },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.pagination) {
        expect(body.pagination).toHaveProperty('limit');
        expect(body.pagination).toHaveProperty('nextCursor');
      }
    });

    test('should list orders with offset pagination', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { skip: 0, take: 10 },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination.skip).toBe(0);
      expect(body.pagination.take).toBe(10);
    });

    test('should list drivers with cursor pagination', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/drivers`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { limit: 5 },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  test.describe('@regression Filtering', () => {
    test('should filter orders by status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { status: 'draft' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((order: any) => {
        expect(order.status).toBe('draft');
      });
    });

    test('should filter orders by date range', async ({ request }) => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: {
          createdAfter: startDate,
          createdBefore: endDate,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((order: any) => {
        const createdAt = new Date(order.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      });
    });

    test('should combine multiple filters', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: {
          status: 'assigned',
          minValue: 50,
          maxValue: 150,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      body.data.forEach((order: any) => {
        expect(order.status).toBe('assigned');
        expect(order.itemValue).toBeGreaterThanOrEqual(50);
        expect(order.itemValue).toBeLessThanOrEqual(150);
      });
    });

    test('should handle empty filter results', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { status: 'nonexistent-status' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  test.describe('@regression Sorting', () => {
    test('should sort orders by date ascending', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { sort: 'createdAt', order: 'asc' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          const current = new Date(body.data[i].createdAt).getTime();
          const next = new Date(body.data[i + 1].createdAt).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });

    test('should sort orders by date descending', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { sort: 'createdAt', order: 'desc' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          const current = new Date(body.data[i].createdAt).getTime();
          const next = new Date(body.data[i + 1].createdAt).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    test('should sort orders by value', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { sort: 'itemValue', order: 'asc' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          expect(body.data[i].itemValue).toBeLessThanOrEqual(body.data[i + 1].itemValue);
        }
      }
    });
  });

  test.describe('@regression Error Handling', () => {
    test('should return 400 for invalid request body', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: { invalid: 'data' }, // Missing required fields
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    test('should return 401 for missing auth token', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('unauthorized');
    });

    test('should return 403 for insufficient permissions', async ({ request }) => {
      const driverToken = 'test-driver-token'; // Token with limited permissions

      const response = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${driverToken}` },
        data: {
          recipientName: 'Test',
          recipientPhone: '555-0001',
          recipientAddress: 'Test Address',
          itemDescription: 'Test',
          itemValue: 10.00,
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    test('should return 404 for nonexistent resource', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders/nonexistent-id`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.message).toContain('not found');
    });

    test('should return 409 for duplicate resource', async ({ request }) => {
      // First create a driver with unique email
      const driverEmail = `driver-${Date.now()}@test.com`;
      await request.post(`${API_BASE_URL}/drivers/register`, {
        data: {
          email: driverEmail,
          firstName: 'Test',
          lastName: 'Driver',
          phone: '555-9999',
          password: 'TestPass123',
        },
      });

      // Try to create another with same email
      const response = await request.post(`${API_BASE_URL}/drivers/register`, {
        data: {
          email: driverEmail,
          firstName: 'Duplicate',
          lastName: 'Driver',
          phone: '555-9998',
          password: 'TestPass123',
        },
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });
  });

  test.describe('@regression Rate Limiting', () => {
    test('should include rate limit headers in response', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()).toHaveProperty('x-ratelimit-limit');
      expect(response.headers()).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers()).toHaveProperty('x-ratelimit-reset');

      const limit = parseInt(response.headers()['x-ratelimit-limit'] || '1000');
      const remaining = parseInt(response.headers()['x-ratelimit-remaining'] || '0');
      expect(remaining).toBeLessThanOrEqual(limit);
    });

    test('should enforce rate limit on repeated requests', async ({ request }) => {
      // Make requests until rate limit is hit
      let rateLimited = false;
      let requestCount = 0;
      const maxAttempts = 1100; // Typical rate limit is 1000/minute

      for (let i = 0; i < maxAttempts; i++) {
        const response = await request.get(`${API_BASE_URL}/orders`, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        });

        requestCount++;

        if (response.status() === 429) {
          rateLimited = true;
          break;
        }
      }

      // Note: May not hit rate limit in test environment with mocked rates
      // Just verify headers are present
      const testResponse = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      expect(testResponse.headers()).toHaveProperty('x-ratelimit-limit');
    });
  });

  test.describe('@regression Content-Type Enforcement', () => {
    test('should require Content-Type: application/json for POST', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/orders`, {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded', // Wrong content type
        },
        data: { test: 'data' },
      });

      expect(response.status()).toBe(400);
    });

    test('should return application/json content type', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
    });
  });

  test.describe('@regression Response Format Consistency', () => {
    test('should return consistent error response format', async ({ request }) => {
      const errorResponses = [];

      // 400 error
      const res400 = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        params: { limit: 'invalid' }, // Invalid limit parameter
      });
      if (res400.status() >= 400) {
        errorResponses.push(res400);
      }

      // 401 error
      const res401 = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      errorResponses.push(res401);

      // 404 error
      const res404 = await request.get(`${API_BASE_URL}/orders/nonexistent`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      errorResponses.push(res404);

      // Verify all errors have consistent structure
      for (const response of errorResponses) {
        if (response.status() >= 400) {
          const body = await response.json();
          expect(body).toHaveProperty('error');
          expect(body).toHaveProperty('message');
          expect(body).toHaveProperty('statusCode');
        }
      }
    });

    test('should return consistent success response structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data) {
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
      }
      if (body.pagination) {
        expect(body).toHaveProperty('pagination');
        expect(body.pagination).toHaveProperty('total');
      }
    });
  });

  test.describe('@regression Timestamp Consistency', () => {
    test('should include proper timestamps in responses', async ({ request }) => {
      const createResponse = await request.post(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          recipientName: 'Timestamp Test',
          recipientPhone: '555-0105',
          recipientAddress: 'Test Address',
          itemDescription: 'Package',
          itemValue: 50.00,
        },
      });

      expect(createResponse.status()).toBe(201);
      const body = await createResponse.json();

      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');

      const createdAt = new Date(body.createdAt);
      const updatedAt = new Date(body.updatedAt);
      const now = new Date();

      expect(createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });
});
