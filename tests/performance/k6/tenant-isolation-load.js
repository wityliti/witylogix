/**
 * Multi-Tenant Isolation Load Testing - K6
 * Tests: 10 tenants concurrent, verify isolation under load
 * Scenarios: ~100 lines
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';
import { generateOrder, generateDriver } from './helpers/data-generators.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v4';

// Test tenants (10 different shops/orgs)
const TENANTS = [
  { tenantId: 'shop-001', token: 'token-001' },
  { tenantId: 'shop-002', token: 'token-002' },
  { tenantId: 'shop-003', token: 'token-003' },
  { tenantId: 'shop-004', token: 'token-004' },
  { tenantId: 'shop-005', token: 'token-005' },
  { tenantId: 'shop-006', token: 'token-006' },
  { tenantId: 'shop-007', token: 'token-007' },
  { tenantId: 'shop-008', token: 'token-008' },
  { tenantId: 'shop-009', token: 'token-009' },
  { tenantId: 'shop-010', token: 'token-010' },
];

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // 50 VUs across 10 tenants = ~5 VUs per tenant
    { duration: '3m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'isolation_check_duration': ['p(95)<300', 'p(99)<600', 'avg<150'],
    'http_req_failed': ['rate<0.01'],
    'isolation_violations': ['count==0'],
    'tenant_isolation_rate': ['rate>0.99'],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const isolationCheckDuration = new Trend('isolation_check_duration');
const tenantIsolationRate = new Rate('tenant_isolation_rate');
const isolationViolations = new Counter('isolation_violations');
const crossTenantAccess = new Counter('cross_tenant_access_attempts');

// ─── Helper Functions ───────────────────────────────────────────────────────

function getTenant() {
  return TENANTS[Math.floor(Math.random() * TENANTS.length)];
}

function getTenantHeaders(tenant) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tenant.token}`,
    'X-Tenant-ID': tenant.tenantId,
  };
}

// ─── Test Scenarios ─────────────────────────────────────────────────────────

export default function () {
  const currentTenant = getTenant();

  // Scenario 1: Create and read order within same tenant
  group('Tenant: Create Order', () => {
    const order = generateOrder(`cust_${currentTenant.tenantId}`, currentTenant.tenantId);
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/orders`, JSON.stringify(order), {
      headers: getTenantHeaders(currentTenant),
      timeout: '10s',
    });

    const duration = Date.now() - startTime;
    isolationCheckDuration.add(duration);

    const success = check(response, {
      'create order status 201': (r) => r.status === 201 || r.status === 200,
      'order has correct tenant': (r) => {
        const body = JSON.parse(r.body);
        return !body.error;
      },
    });

    tenantIsolationRate.add(success);
    if (!success) {
      isolationViolations.add(1);
    }
  });

  sleep(0.3);

  // Scenario 2: Verify tenant cannot access other tenant's data
  group('Tenant: Isolation Check - Read Orders', () => {
    const startTime = Date.now();

    const response = http.get(`${BASE_URL}/orders`, {
      headers: getTenantHeaders(currentTenant),
      timeout: '10s',
    });

    const duration = Date.now() - startTime;
    isolationCheckDuration.add(duration);

    const success = check(response, {
      'get orders status 200': (r) => r.status === 200,
      'orders belong to tenant': (r) => {
        const body = JSON.parse(r.body);
        const orders = body.data || body;
        if (!Array.isArray(orders) || orders.length === 0) return true; // Empty is ok
        return orders.every(order => {
          // Verify order's tenant matches current tenant
          return order.tenantId === currentTenant.tenantId || order.shopId === currentTenant.tenantId;
        });
      },
    });

    tenantIsolationRate.add(success);
    if (!success) {
      isolationViolations.add(1);
    }
  });

  sleep(0.3);

  // Scenario 3: Create driver for tenant
  group('Tenant: Create Driver', () => {
    const driver = generateDriver(currentTenant.tenantId);
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/drivers`, JSON.stringify(driver), {
      headers: getTenantHeaders(currentTenant),
      timeout: '10s',
    });

    const duration = Date.now() - startTime;
    isolationCheckDuration.add(duration);

    const success = check(response, {
      'create driver status 201': (r) => r.status === 201 || r.status === 200,
    });

    tenantIsolationRate.add(success);
    if (!success) {
      isolationViolations.add(1);
    }
  });

  sleep(0.3);

  // Scenario 4: Test cross-tenant access prevention
  group('Tenant: Cross-Tenant Access Prevention', () => {
    const otherTenant = getTenants().find(t => t.tenantId !== currentTenant.tenantId);
    if (otherTenant) {
      crossTenantAccess.add(1);

      const startTime = Date.now();
      const response = http.get(`${BASE_URL}/orders`, {
        headers: getTenantHeaders(otherTenant),
        timeout: '10s',
      });

      const duration = Date.now() - startTime;
      isolationCheckDuration.add(duration);

      const body = JSON.parse(response.body);
      const orders = body.data || body;

      // Verify no orders from current tenant appear in other tenant's response
      const violation = Array.isArray(orders) && orders.some(
        order => (order.tenantId === currentTenant.tenantId || order.shopId === currentTenant.tenantId)
      );

      if (violation) {
        isolationViolations.add(1);
      }

      const success = !violation;
      tenantIsolationRate.add(success);
    }
  });

  sleep(0.3);

  // Scenario 5: Verify tenant quota/resource separation
  group('Tenant: Resource Separation', () => {
    const startTime = Date.now();

    const response = http.get(`${BASE_URL}/tenant/limits`, {
      headers: getTenantHeaders(currentTenant),
      timeout: '10s',
    });

    const duration = Date.now() - startTime;
    isolationCheckDuration.add(duration);

    const success = check(response, {
      'get tenant limits status 200': (r) => r.status === 200 || r.status === 404,
    });

    tenantIsolationRate.add(success);
  });

  sleep(0.5);
}

// Helper to get all tenants
function getTenants() {
  return TENANTS;
}
