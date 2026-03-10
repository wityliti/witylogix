import { Page, Route } from '@playwright/test';
import {
  mockDrivers,
  mockRoutes,
  mockUnscheduledStops,
  mockMapMarkers,
  mockDispatchStats,
  routeOptimizationResponse,
  realtimeStatsUpdate,
  mockStopDetail,
} from '../fixtures/dispatch-fixtures';
import {
  mockDeliveryZones,
  mockAvailableDates,
  mockTimeSlots,
  addressValidationResponse,
  rateCalculationResponse,
  capacityCheckResponse,
  orderConfirmationResponse,
  mockCheckoutErrors,
} from '../fixtures/checkout-fixtures';

/**
 * Mock API Helper for E2E Tests
 * Intercepts and mocks API responses for testing without real backend
 */

/**
 * Setup dispatch API mocks
 */
export async function setupDispatchMocks(page: Page): Promise<void> {
  // Mock get drivers
  await page.route('**/api/drivers', async (route: Route) => {
    await route.abort('blockcontent');
    await route.continue();
  });

  await page.route('**/api/drivers*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockDrivers }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get routes
  await page.route('**/api/routes*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockRoutes }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get unscheduled stops
  await page.route('**/api/stops/unscheduled*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockUnscheduledStops }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get map markers
  await page.route('**/api/dispatch/map/markers*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockMapMarkers }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get dispatch stats
  await page.route('**/api/dispatch/stats*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockDispatchStats }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock route optimization
  await page.route('**/api/dispatch/optimize*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(routeOptimizationResponse),
      });
    } else {
      await route.continue();
    }
  });

  // Mock stop detail
  await page.route('**/api/stops/*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockStopDetail }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock drag and drop stop reassignment
  await page.route('**/api/stops/*/assign*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Stop reassigned' }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock real-time updates
  await page.route('**/api/dispatch/realtime*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: realtimeStatsUpdate }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Setup checkout API mocks
 */
export async function setupCheckoutMocks(page: Page): Promise<void> {
  // Mock get delivery zones
  await page.route('**/api/zones*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockDeliveryZones }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock address validation
  await page.route('**/api/address/validate*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(addressValidationResponse),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get available dates
  await page.route('**/api/availability/dates*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockAvailableDates }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get time slots
  await page.route('**/api/availability/slots*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockTimeSlots }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock rate calculation
  await page.route('**/api/rates/calculate*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rateCalculationResponse),
      });
    } else {
      await route.continue();
    }
  });

  // Mock capacity check
  await page.route('**/api/availability/capacity*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(capacityCheckResponse),
      });
    } else {
      await route.continue();
    }
  });

  // Mock order creation
  await page.route('**/api/orders*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(orderConfirmationResponse),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Setup customer portal API mocks
 */
export async function setupPortalMocks(page: Page): Promise<void> {
  // Mock login
  await page.route('**/api/auth/login*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          user: {
            id: 'cust-001',
            email: 'customer@example.com',
            name: 'Test Customer',
            role: 'customer',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get orders
  await page.route('**/api/customers/*/orders*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'ORD-001',
              date: '2026-03-10',
              status: 'delivered',
              address: '123 Main St, New York, NY 10001',
              total: '$35.98',
            },
            {
              id: 'ORD-002',
              date: '2026-03-09',
              status: 'in-transit',
              address: '456 Park Ave, New York, NY 10022',
              total: '$42.50',
            },
          ],
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get order detail
  await page.route('**/api/orders/*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'ORD-001',
            status: 'delivered',
            address: '123 Main St, New York, NY 10001',
            phone: '+1111111111',
            email: 'customer@example.com',
            items: [
              { name: 'Electronics Package', quantity: 1, price: '$29.99' },
            ],
            total: '$35.98',
            estimatedDelivery: '2026-03-12',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get delivery timeline
  await page.route('**/api/orders/*/timeline*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: '2026-03-11 10:00',
              status: 'confirmed',
              description: 'Order confirmed',
              icon: 'check',
            },
            {
              timestamp: '2026-03-11 12:30',
              status: 'in-transit',
              description: 'Out for delivery',
              icon: 'truck',
            },
            {
              timestamp: '2026-03-11 14:15',
              status: 'delivered',
              description: 'Delivered',
              icon: 'check-circle',
            },
          ],
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock reschedule
  await page.route('**/api/orders/*/reschedule*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Delivery rescheduled' }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock rate delivery
  await page.route('**/api/orders/*/rate*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Rating submitted' }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock save preferences
  await page.route('**/api/customers/*/preferences*', async (route: Route) => {
    if (route.request().method() === 'PUT') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Preferences saved' }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock get tracking info
  await page.route('**/api/orders/*/tracking*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            driverName: 'John Smith',
            driverPhone: '+1234567890',
            vehiclePlate: 'DL-01-AB-1234',
            estimatedArrival: '14:30',
            currentLocation: 'Broadway & 42nd St',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock error responses for testing error scenarios
 */
export async function setupErrorMocks(page: Page, errorType: string): Promise<void> {
  switch (errorType) {
    case 'outside-zone':
      await page.route('**/api/address/validate*', (route: Route) => {
        route.respond({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify(mockCheckoutErrors.OUTSIDE_DELIVERY_ZONE),
        });
      });
      break;
    case 'invalid-zipcode':
      await page.route('**/api/address/validate*', (route: Route) => {
        route.respond({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify(mockCheckoutErrors.INVALID_ZIPCODE),
        });
      });
      break;
    case 'no-slots':
      await page.route('**/api/availability/slots*', (route: Route) => {
        route.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });
      break;
    case 'network-error':
      await page.route('**/*', (route: Route) => {
        route.abort('failed');
      });
      break;
  }
}

/**
 * Clean up all mocked routes
 */
export async function clearAllMocks(page: Page): Promise<void> {
  await page.unroute('**/*');
}

/**
 * Mock realtime updates using WebSocket
 */
export async function setupRealtimeUpdates(page: Page): Promise<void> {
  // For WebSocket mocking, we intercept updates through polling endpoints
  let updateCount = 0;

  await page.route('**/api/dispatch/realtime*', async (route: Route) => {
    updateCount++;

    // Return different data on subsequent calls to simulate real-time updates
    if (updateCount === 1) {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockDispatchStats }),
      });
    } else {
      await route.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: realtimeStatsUpdate }),
      });
    }
  });
}
