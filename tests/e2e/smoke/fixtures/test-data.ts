/**
 * Smoke Test Shared Test Data
 * Centralized test data for smoke tests
 */

export const SMOKE_TEST_DATA = {
  // Registration and new account
  newAccount: {
    email: `smoke-test-${Date.now()}@test.witylogix.com`,
    password: 'SmokeTest@123',
    firstName: 'Smoke',
    lastName: 'Tester',
    company: 'Smoke Test Company',
    phone: '+1234567890',
  },

  // Delivery zone creation
  deliveryZone: {
    name: 'Downtown Delivery Zone',
    address: '123 Main Street, New York, NY 10001',
    radius: 5,
    type: 'Urban',
  },

  // Driver creation
  driver: {
    firstName: 'John',
    lastName: 'Driver',
    email: `driver-${Date.now()}@test.witylogix.com`,
    phone: '+19876543210',
    licenseNumber: 'DL123456789',
    vehicleType: 'Van',
  },

  // Order creation
  order: {
    trackingId: `TRACK-${Date.now()}`,
    senderName: 'Test Sender',
    senderEmail: 'sender@test.com',
    senderPhone: '+1111111111',
    senderAddress: '456 Sender St, Boston, MA 02101',
    receiverName: 'Test Receiver',
    receiverEmail: 'receiver@test.com',
    receiverPhone: '+2222222222',
    receiverAddress: '789 Receiver Ave, Boston, MA 02102',
    weight: '5',
    description: 'Test Package',
  },

  // Onboarding
  onboarding: {
    company: {
      name: 'E-Commerce Corp',
      website: 'https://ecommerce.test.com',
      size: 'medium',
    },
    industry: 'e-commerce',
    goals: ['increase-delivery-speed', 'reduce-costs', 'improve-tracking'],
    integrations: ['shopify', 'stripe'],
  },

  // MFA test
  mfa: {
    totpSecret: 'JBSWY3DPEBLW64TMMQ======',
    codes: ['123456', '234567', '345678'],
  },

  // Timeouts in milliseconds
  timeouts: {
    page: 30000,
    network: 10000,
    element: 5000,
    sla: 500,
  },
};

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.witylogix.com`;
}

/**
 * Generate unique tracking ID
 */
export function generateTrackingId(): string {
  return `TRACK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
}
