/**
 * CRUD Operations Load Testing - K6
 * Tests: Orders/drivers/deliveries CRUD
 * Scenarios: ~150 lines
 * - Mixed read/write (80/20), cursor pagination
 * - Thresholds: read p95 < 200ms, write p95 < 500ms
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';
import { generateOrder, generateDriver, generateDelivery } from './helpers/data-generators.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v4';
const AUTH_TOKEN = __ENV.TEST_TOKEN || 'test-token';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'read_duration': ['p(95)<200', 'p(99)<400', 'avg<120'],
    'write_duration': ['p(95)<500', 'p(99)<1000', 'avg<300'],
    'pagination_duration': ['p(95)<300', 'p(99)<600', 'avg<180'],
    'http_req_failed': ['rate<0.01'],
    'crud_success_rate': ['rate>0.98'],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const readDuration = new Trend('read_duration');
const writeDuration = new Trend('write_duration');
const paginationDuration = new Trend('pagination_duration');
const crudSuccessRate = new Rate('crud_success_rate');
const errorCounter = new Counter('crud_errors');

// ─── Helper Functions ───────────────────────────────────────────────────────

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
}

// ─── Test Scenarios ─────────────────────────────────────────────────────────

export default function () {
  const rand = Math.random();

  // 80% reads, 20% writes distribution
  if (rand < 0.8) {
    // ─── READ OPERATIONS ────────────────────────────────────────────────────

    // Read: Get orders list
    group('Read: Get Orders', () => {
      const startTime = Date.now();
      const response = http.get(`${BASE_URL}/orders?limit=20&offset=0`, {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      readDuration.add(duration);

      const success = check(response, {
        'get orders status 200': (r) => r.status === 200,
        'orders response is array': (r) => {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data || body);
        },
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });

    sleep(0.2);

    // Read: Get drivers list with pagination
    group('Read: Get Drivers', () => {
      const startTime = Date.now();
      const response = http.get(`${BASE_URL}/drivers?limit=20&offset=0`, {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      readDuration.add(duration);

      const success = check(response, {
        'get drivers status 200': (r) => r.status === 200,
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });

    sleep(0.2);

    // Read: Get deliveries with cursor pagination
    group('Read: Get Deliveries (Cursor)', () => {
      const startTime = Date.now();
      const response = http.get(`${BASE_URL}/deliveries?limit=20`, {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      paginationDuration.add(duration);

      const success = check(response, {
        'get deliveries status 200': (r) => r.status === 200,
        'deliveries response has pagination': (r) => {
          const body = JSON.parse(r.body);
          return body.cursor || body.pagination;
        },
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);

      // Follow pagination if available
      if (success) {
        const body = JSON.parse(response.body);
        const nextCursor = body.cursor?.next;
        if (nextCursor) {
          sleep(0.1);
          const nextStartTime = Date.now();
          const nextResponse = http.get(`${BASE_URL}/deliveries?limit=20&cursor=${nextCursor}`, {
            headers: getAuthHeaders(),
            timeout: '10s',
          });
          const nextDuration = Date.now() - nextStartTime;
          paginationDuration.add(nextDuration);
        }
      }
    });

    sleep(0.2);

    // Read: Get single order
    group('Read: Get Single Order', () => {
      const orderId = `ord_${Math.random().toString(36).substring(7)}`;
      const startTime = Date.now();

      const response = http.get(`${BASE_URL}/orders/${orderId}`, {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      readDuration.add(duration);

      const success = check(response, {
        'get single order status 200 or 404': (r) => r.status === 200 || r.status === 404,
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });
  } else {
    // ─── WRITE OPERATIONS ───────────────────────────────────────────────────

    // Write: Create order
    group('Write: Create Order', () => {
      const order = generateOrder(`cust_${Date.now()}`);
      const startTime = Date.now();

      const response = http.post(`${BASE_URL}/orders`, JSON.stringify(order), {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      writeDuration.add(duration);

      const success = check(response, {
        'create order status 201': (r) => r.status === 201 || r.status === 200,
        'order has id': (r) => {
          const body = JSON.parse(r.body);
          return body.id || body.orderId;
        },
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });

    sleep(0.2);

    // Write: Update order
    group('Write: Update Order', () => {
      const orderId = `ord_${Math.random().toString(36).substring(7)}`;
      const startTime = Date.now();

      const response = http.put(`${BASE_URL}/orders/${orderId}`, JSON.stringify({
        status: 'processing',
        priority: 'normal',
      }), {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      writeDuration.add(duration);

      const success = check(response, {
        'update order status 200 or 404': (r) => r.status === 200 || r.status === 404,
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });

    sleep(0.2);

    // Write: Create driver
    group('Write: Create Driver', () => {
      const driver = generateDriver(`shop_${Date.now()}`);
      const startTime = Date.now();

      const response = http.post(`${BASE_URL}/drivers`, JSON.stringify(driver), {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      writeDuration.add(duration);

      const success = check(response, {
        'create driver status 201': (r) => r.status === 201 || r.status === 200,
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });

    sleep(0.2);

    // Write: Create delivery
    group('Write: Create Delivery', () => {
      const delivery = generateDelivery(`ord_${Date.now()}`);
      const startTime = Date.now();

      const response = http.post(`${BASE_URL}/deliveries`, JSON.stringify(delivery), {
        headers: getAuthHeaders(),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      writeDuration.add(duration);

      const success = check(response, {
        'create delivery status 201': (r) => r.status === 201 || r.status === 200,
      });

      crudSuccessRate.add(success);
      if (!success) errorCounter.add(1);
    });
  }

  sleep(1);
}
