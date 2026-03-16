/**
 * Integration Test Harness
 * Re-exports all utilities for integration testing
 */

// Auth Simulators
export {
  APIKeyValidator,
  OAuth2Server,
  BasicAuthValidator,
  BearerTokenValidator,
  JWTHandler,
  HMACSignatureGenerator,
} from './auth-simulators';

export type {
  APIKeyValidatorConfig,
  OAuth2Config,
  OAuth2Token,
  JWTConfig,
  JWTPayload,
} from './auth-simulators';

// Webhook Simulator
export { WebhookSimulator, WebhookEventFactory } from './webhook-simulator';

export type {
  WebhookEvent,
  WebhookDeliveryRecord,
  WebhookSignatureConfig,
} from './webhook-simulator';

// Mock Provider Server
export { MockProviderServer } from './mock-provider-server';

export type { MockRequest, ProviderConfig } from './mock-provider-server';

// Test Fixtures
export {
  createMockOrder,
  createMockOrderItem,
  createMockProduct,
  createMockPaymentIntent,
  createMockVehicle,
  createMockVehicleLocation,
  createMockRoute,
  createMockShipment,
  createMockInvoice,
  createMockContact,
  createMockWebhookEvent,
  credentialFixture,
  apiKeyFixture,
  oauth2TokenFixture,
  jwtTokenFixture,
  stripePaymentIntentResponse,
  shopifyOrderResponse,
  stripeWebhookResponse,
  generateOrders,
  generateProducts,
  generateVehicles,
  generateVehicleLocations,
  generateInvoices,
  generateShipments,
} from './test-fixtures';

export type {
  MockOrder,
  MockOrderItem,
  MockProduct,
  MockPaymentIntent,
  MockVehicle,
  MockVehicleLocation,
  MockRoute,
  MockStop,
  MockShipment,
  MockInvoice,
  MockInvoiceItem,
  MockContact,
  MockWebhookEvent,
  CredentialFixture,
} from './test-fixtures';

// Integration Test Runner
export {
  IntegrationTestRunner,
  createIntegrationTestEnvironment,
  createProviderTestContext,
} from './integration-test-runner';

export type {
  ProviderContext,
  IntegrationTestConfig,
  TestResult,
} from './integration-test-runner';
