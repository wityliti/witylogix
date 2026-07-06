# Courier Partner Adapters — Implementation Guide

Complete implementation of Courier Partner Adapters for Onfleet, Stuart, and Uber Direct delivery services.

## Overview

This system provides a unified interface for managing multiple courier providers, enabling quote comparison, intelligent dispatch selection, and real-time delivery tracking across different courier APIs.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  API Routes (/couriers)                                         │
│  - Register partners, get quotes, dispatch, track deliveries   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────────┐
│  CourierDispatcher                                              │
│  - Routes to adapters, compares quotes, handles webhooks       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    ┌───▼──┐      ┌───▼──┐      ┌───▼──┐
    │OnfleetClient   │StuartClient   │UberDirectClient
    │- Task mgmt   │- OAuth2       │- OAuth2
    │- 20 req/sec  │- Job tracking │- Webhooks
    └────────┘      └────────┘      └────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    ┌───▼──────────┐      ┌──────────▼──┐
    │Normalizer    │      │StatusTracker│
    │QuoteComparator│      └─────────────┘
    └───────────────┘
```

## Files Created

### Core Type Definitions

- **`packages/core/src/integrations/couriers/types.ts`** (200 lines)
  - `CourierConfig`: Provider credentials and configuration
  - `QuoteRequest`, `CourierQuote`: Pricing and estimates
  - `CreateDeliveryRequest`, `CourierDelivery`: Delivery creation
  - `CourierStatus`, `DriverPosition`: Status tracking
  - `WebhookRegistration`, `WebhookPayload`: Event handling
  - `NormalizedQuote`, `NormalizedDelivery`: Unified types
  - `DispatchRequest`, `DispatchResult`: Dispatch operations
  - Enums: `DeliveryStatus`, `WebhookEvent`, `DispatchStrategy`

### Abstract Adapter Interface

- **`packages/core/src/integrations/couriers/courier-adapter.ts`** (150 lines)
  - `CourierAdapter`: Abstract base class
  - Methods: `getQuote()`, `createDelivery()`, `getDeliveryStatus()`, `cancelDelivery()`, `getDriverLocation()`, `listWebhooks()`, `registerWebhook()`, `deregisterWebhook()`, `validateConfig()`, `healthCheck()`
  - `WebhookInfo`: Webhook registration metadata

### Onfleet Client Implementation

- **`packages/core/src/integrations/couriers/onfleet-client.ts`** (450 lines)
  - REST API client (Basic auth)
  - Features: Task management, team assignment, auto-assign, rate limiting (20 req/sec)
  - Methods: All courier adapter methods
  - Onfleet-specific types: `OnfleetTask`, `OnfleetWebhook`, `OnfleetEstimate`, `OnfleetWorkerLocation`
  - Status mapping: 0→pending, 1→picked_up, 2→in_transit, 3→delivered, -1→cancelled
  - Event mapping: Onfleet event codes ↔ normalized webhook events

### Stuart Client Implementation

- **`packages/core/src/integrations/couriers/stuart-client.ts`** (450 lines)
  - REST API client (OAuth2)
  - Features: Multi-transport types (bike/car/van), scheduled deliveries, job tracking
  - Methods: All courier adapter methods
  - Stuart-specific types: `StuartJob`, `StuartPricing`, `StuartWebhook`
  - Webhook management: Dashboard-configured (API returns empty list)
  - Status mapping: PENDING, ACCEPTED, IN_PROGRESS, DELIVERED, CANCELLED, FAILED
  - Price in cents conversion

### Uber Direct Client Implementation

- **`packages/core/src/integrations/couriers/uber-direct-client.ts`** (450 lines)
  - REST API client (OAuth2)
  - Features: Tip support, dropoff verification, manifest items, signature capture
  - Methods: All courier adapter methods
  - Uber-specific types: `UberDelivery`, `UberDeliveryQuote`, `UberWebhook`
  - OAuth2 token management with auto-refresh
  - Status mapping: 10+ status codes with transitions
  - Event mapping: Uber event types ↔ normalized webhook events

### Normalizer & Comparison

- **`packages/core/src/integrations/couriers/courier-normalizer.ts`** (200 lines)
  - `CourierNormalizer`: Normalize quotes and status across providers
    - Currency conversion to USD
    - Status mapping
    - Confidence scoring
  - `QuoteComparator`: Compare and score quotes
    - Find cheapest/fastest
    - Weighted scoring (default: 60% price, 40% time)
    - Average calculations
  - `StatusTracker`: Track delivery state changes
    - Change detection
    - Terminal state checking
    - Polling state management

### Dispatcher Service

- **`packages/core/src/integrations/couriers/courier-dispatcher.ts`** (300 lines)
  - `CourierDispatcher`: Multi-provider orchestration
    - Register/manage adapters
    - Get multi-provider quotes
    - Intelligent dispatch with strategies (cheapest, fastest, preferred, auto)
    - Webhook routing and event handling
    - Delivery status polling
    - Health checks across providers
  - `courierDispatcher`: Singleton instance for global use

### Barrel Exports

- **`packages/core/src/integrations/couriers/index.ts`**
  - Exports all types, classes, and services
  - Single import source: `import { ... } from "@witylogix/core/integrations/couriers"`

### Database Schema

- **`packages/db/prisma/schema/46-couriers.prisma`** (80 lines)
  - `CourierPartner`: Registered courier integrations
    - Credentials (encrypted at app layer)
    - Provider-specific config
    - Health status tracking
  - `CourierDelivery`: Delivery tracking
    - External ID linking
    - Status and location tracking
    - Cost and proof of delivery
  - `CourierWebhookLog`: Webhook audit trail
    - Event logging
    - Payload storage
    - Processing status
  - Enums: `CourierStatus`, `DeliveryStatus`, `HealthStatus`

### API Routes

- **`apps/api/src/routes/couriers.ts`** (400 lines)
  - 10 endpoints:
    - `GET /partners` - List registered couriers
    - `POST /partners` - Register new courier (validates credentials)
    - `DELETE /partners/:id` - Unregister courier
    - `PATCH /partners/:id` - Update configuration
    - `GET /quote` - Get quotes from multiple providers
    - `POST /dispatch` - Auto-dispatch with selection strategy
    - `GET /deliveries/:id` - Get delivery status and tracking
    - `POST /deliveries/:id/cancel` - Cancel active delivery
    - `GET /deliveries/:id/tracking` - Live tracking with driver location
    - `POST /webhooks/:provider` - Receive provider webhooks
    - `GET /compare` - Provider health/comparison
    - `GET /stats` - Delivery statistics and analytics
  - Zod validation for all inputs
  - Auth/tenant context middleware
  - Error handling with detailed messages

### Test Suite

- **`packages/core/src/integrations/couriers/__tests__/onfleet-client.test.ts`** (200+ lines)
  - 20+ tests covering:
    - Configuration validation
    - Quote retrieval with package specs
    - Delivery creation and tracking
    - Status mapping
    - Driver location tracking
    - Webhook registration/management
    - Rate limiting
    - Edge cases
    - Provider property verification

- **`packages/core/src/integrations/couriers/__tests__/stuart-client.test.ts`** (200+ lines)
  - 20+ tests covering:
    - OAuth2 authentication
    - Multi-transport type support
    - Scheduled deliveries
    - Dashboard webhook configuration
    - Token caching and refresh
    - Distance/duration conversions
    - Status mapping
    - Error scenarios

- **`packages/core/src/integrations/couriers/__tests__/uber-direct-client.test.ts`** (200+ lines)
  - 20+ tests covering:
    - OAuth2 credential management
    - Delivery lifecycle (create → deliver)
    - Status transitions
    - Signature requirement support
    - Manifest items
    - Token auto-refresh
    - Price conversion (cents → USD)
    - Webhook event mapping

## Usage Examples

### Register a Courier Partner

```typescript
const response = await fetch("/couriers/partners", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "onfleet",
    name: "Onfleet Primary",
    credentials: {
      apiKey: "your_onfleet_api_key",
    },
    config: {
      autoAssign: true,
      teamId: "team_uuid",
    },
  }),
});
```

### Get Multi-Courier Quote

```typescript
const quote = await fetch(
  "/couriers/quote?pickup.latitude=40.7128&pickup.longitude=-74.006&dropoff.latitude=40.758&dropoff.longitude=-73.9855",
);
// Returns: { quotes, analysis: { cheapest, fastest, average, all } }
```

### Dispatch with Auto-Selection

```typescript
const dispatch = await fetch("/couriers/dispatch", {
  method: "POST",
  body: JSON.stringify({
    orderId: "order_123",
    pickup: { latitude: 40.7128, longitude: -74.006 },
    dropoff: { latitude: 40.758, longitude: -73.9855 },
    recipient: { name: "John", phone: "+1234567890" },
    strategy: "auto", // cheapest, fastest, preferred, or auto
  }),
});
// Returns: { dispatch, tracking: deliveryRecord }
```

### Track Delivery

```typescript
const tracking = await fetch("/couriers/deliveries/delivery_uuid/tracking");
// Returns: { delivery, driver: { location, name, phone }, estimatedArrival }
```

### Handle Webhooks

```typescript
// POST /couriers/webhooks/onfleet
{
  action: "task_completed",
  data: { id: "task_123", status: 3 }
}
```

## Adapter-Specific Details

### Onfleet

- **Auth**: Basic HTTP (API key)
- **Rate Limit**: 20 requests/second
- **Task Types**: Pickup + Dropoff
- **Key Features**: Team management, auto-assign, task metadata
- **Webhook Events**: 17 event types via numeric codes
- **Status Codes**: 0/1/2/3/-1 (numeric)

### Stuart

- **Auth**: OAuth2 (client_credentials)
- **Rate Limit**: Standard OAuth limits
- **Transport Types**: Bike, Car, Van
- **Key Features**: Scheduled jobs, package type, pricing via booking
- **Webhook Events**: Dashboard-configured (API doesn't expose)
- **Status Values**: String-based (PENDING, ACCEPTED, IN_PROGRESS, etc.)
- **Price Format**: Returned in cents

### Uber Direct

- **Auth**: OAuth2 (client_credentials)
- **Customer ID**: Required (tenant_id field)
- **Key Features**: Tip support, dropoff signature, manifest items
- **Webhook Events**: 9+ event types
- **Status Values**: SCHEDULED, REQUEST*ACCEPTED, PICKUP*_, DROPOFF\__, etc.
- **Price Format**: Returned in cents
- **Token Refresh**: 1 minute before expiry

## Implementation Notes

### Currency Handling

- All quotes normalized to USD
- Exchange rates are default/configurable
- Uber/Stuart return prices in cents (auto-converted)

### Status Mapping

```
Provider-Specific → Normalized
Onfleet: 0→pending, 1→picked_up, 2→in_transit, 3→delivered, -1→cancelled
Stuart: PENDING→pending, IN_PROGRESS→in_transit, DELIVERED→delivered
Uber: SCHEDULED→pending, IN_TRANSIT→in_transit, DROPOFF_COMPLETED→delivered
```

### Dispatch Strategy

- **cheapest**: Lowest price
- **fastest**: Shortest ETA
- **preferred**: Weighted scoring (60% price, 40% time)
- **auto**: Fastest if within 20% of cheapest, else cheapest

### Webhook Event Mapping

```
Onfleet (numeric codes): 0/13/14/15/16/17/84
Stuart (strings): job_created/accepted/in_progress/completed/failed/cancelled
Uber (strings): delivery_scheduled/pickup_completed/dropoff_estimated_arrival/etc.
↓
Normalized: DELIVERY_CREATED/PICKED_UP/IN_TRANSIT/DELIVERED/FAILED/CANCELLED
```

### Error Handling

- Credential validation on registration
- Per-provider error collection in multi-courier operations
- Fallback support in dispatch (continues if provider fails)
- Health check endpoints for monitoring

## Integration Points

All HTTP calls are marked with `// INTEGRATION:` comments for implementation:

1. **Onfleet**: Basic auth header construction, rate limit delays
2. **Stuart**: OAuth2 token endpoint, credentials grant flow
3. **Uber**: OAuth2 token endpoint, customer account validation

## Testing

Run tests with:

```bash
npm test -- couriers
```

Covers:

- Credential validation
- Quote retrieval and comparison
- Delivery creation and status tracking
- Driver location tracking
- Webhook registration
- Status mapping
- Edge cases and error scenarios
- OAuth2 token management
- Rate limiting

## Security Considerations

- Credentials encrypted at application layer before DB storage
- OAuth2 tokens cached with 1-minute refresh buffer
- API keys never logged or exposed in responses
- Webhook signature validation (provider-specific)
- Rate limiting enforced per adapter

## Future Enhancements

1. **Batch Operations**: Bulk quote requests, multi-delivery dispatch
2. **Advanced Scoring**: Machine learning for optimal provider selection
3. **Fallback Strategy**: Automatic retry with alternative provider if primary fails
4. **Real-time Analytics**: Delivery performance by provider/region
5. **Custom Webhooks**: Tenant-specific event routing
6. **Provider Switching**: Mid-delivery reassignment capability
7. **Cost Optimization**: Dynamic pricing based on load/time
8. **Integration Marketplace**: Third-party courier provider support
