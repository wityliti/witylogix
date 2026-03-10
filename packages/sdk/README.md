# @witylogix/sdk

TypeScript SDK for the Witylogix delivery logistics API. Production-ready HTTP client with full type safety, error handling, and automatic retry logic.

## Features

- **Full TypeScript Support** - Complete type definitions for all API resources
- **Zero Dependencies** - Uses native fetch API, no external HTTP libraries
- **Automatic Retries** - Built-in retry logic for rate limits (429) with Retry-After header support
- **Type-Safe Resources** - Dedicated resource classes for Orders, Drivers, Zones, and Shipments
- **Error Handling** - Comprehensive error classes for different failure scenarios
- **Rate Limit Handling** - Automatic backoff with exponential retry strategy
- **Dual Module** - Supports both CommonJS and ES Modules

## Installation

```bash
npm install @witylogix/sdk
# or
yarn add @witylogix/sdk
# or
pnpm add @witylogix/sdk
```

## Quick Start

### Basic Setup

```typescript
import Witylogix from '@witylogix/sdk';

// Initialize the client
const client = new Witylogix({
  baseUrl: 'https://api.witylogix.com',
  apiKey: 'your-api-key',
  // OR use accessToken for OAuth
  // accessToken: 'your-access-token'
});
```

### Working with Orders

```typescript
// List orders
const orders = await client.orders.list({ page: 1, limit: 20 });
console.log(`Found ${orders.pagination.total} orders`);

// Get a single order
const order = await client.orders.get('order-123');
console.log(`Order status: ${order.status}`);

// Create an order
const newOrder = await client.orders.create({
  reference_number: 'ORD-001',
  customer_id: 'cust-123',
  origin: {
    latitude: 40.7128,
    longitude: -74.0060,
    address: '123 Main St, New York, NY 10001',
  },
  destination: {
    latitude: 40.7580,
    longitude: -73.9855,
    address: '456 Park Ave, New York, NY 10022',
  },
  items: [
    {
      sku: 'ITEM-001',
      name: 'Package',
      quantity: 1,
      weight: 5.5,
    },
  ],
  scheduled_date: '2024-03-15',
  time_slot: {
    start_time: '09:00',
    end_time: '12:00',
    date: '2024-03-15',
  },
  special_instructions: 'Leave at door if no one home',
});

// Update an order
const updatedOrder = await client.orders.update('order-123', {
  special_instructions: 'Ring doorbell',
});

// Assign order to driver
const assignedOrder = await client.orders.assign('order-123', 'driver-456');

// Get orders by status
const pendingOrders = await client.orders.getByStatus('pending');

// Get orders for a specific date
const todayOrders = await client.orders.getByDate('2024-03-15');

// Delete an order
await client.orders.delete('order-123');
```

### Working with Drivers

```typescript
// List all drivers
const drivers = await client.drivers.list({ page: 1, limit: 50 });

// Get a driver
const driver = await client.drivers.get('driver-123');

// Create a driver
const newDriver = await client.drivers.create({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-234-567-8900',
  vehicle_id: 'van-001',
  total_capacity: 500,
  assigned_zone_id: 'zone-123',
});

// Update driver information
const updatedDriver = await client.drivers.update('driver-123', {
  phone: '+1-234-567-8901',
});

// Update driver location
const locationUpdate = await client.drivers.updateLocation('driver-123', {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: new Date().toISOString(),
});

// Get active drivers
const activeDrivers = await client.drivers.getByStatus('active');

// Get available drivers
const available = await client.drivers.getAvailable({ limit: 10 });

// Set driver status
const inactiveDriver = await client.drivers.setStatus('driver-123', 'inactive');
```

### Working with Zones

```typescript
// List zones
const zones = await client.zones.list();

// Get a zone
const zone = await client.zones.get('zone-123');

// Create a zone
const newZone = await client.zones.create({
  name: 'Downtown Manhattan',
  polygon_coordinates: [
    { latitude: 40.7128, longitude: -74.0060 },
    { latitude: 40.7150, longitude: -74.0100 },
    { latitude: 40.7100, longitude: -74.0080 },
  ],
  capacity: 200,
});

// Update a zone
const updatedZone = await client.zones.update('zone-123', {
  capacity: 250,
});

// Check if location is in a zone
const checkResult = await client.zones.checkPoint(40.7128, -74.0060);
if (checkResult.inside) {
  console.log(`Location is in zone: ${checkResult.zone_id}`);
}

// Find zones containing a location
const containingZones = await client.zones.findByLocation(40.7128, -74.0060);

// Add driver to zone
const zoneWithDriver = await client.zones.addDriver('zone-123', 'driver-456');

// Delete a zone
await client.zones.delete('zone-123');
```

### Working with Shipments

```typescript
// List shipments
const shipments = await client.shipments.list({ page: 1, limit: 50 });

// Get a shipment
const shipment = await client.shipments.get('shipment-123');

// Create a shipment from an order
const newShipment = await client.shipments.create({
  order_id: 'order-123',
  driver_id: 'driver-456',
});

// Update a shipment
const updated = await client.shipments.update('shipment-123', {
  driver_id: 'driver-789',
});

// Update shipment status
const delivered = await client.shipments.updateStatus(
  'shipment-123',
  'delivered'
);

// Get tracking information
const tracking = await client.shipments.getTracking('shipment-123');
console.log(`Status: ${tracking.status}`);
console.log(`Current location: ${tracking.location?.address}`);
console.log(`Events: ${tracking.events.length}`);

// Track by tracking number
const trackingInfo = await client.shipments.trackByNumber('TRK-123456');

// Get shipments by status
const inTransit = await client.shipments.getByStatus('in_transit');

// Get shipments for an order
const orderShipments = await client.shipments.getByOrder('order-123');

// Bulk update statuses
const result = await client.shipments.bulkUpdateStatus(
  ['shipment-1', 'shipment-2', 'shipment-3'],
  'delivered'
);
console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
```

## Error Handling

The SDK provides specific error classes for different scenarios:

```typescript
import { Witylogix, AuthError, NotFoundError, RateLimitError } from '@witylogix/sdk';

const client = new Witylogix({
  baseUrl: 'https://api.witylogix.com',
  apiKey: 'your-api-key',
});

try {
  const order = await client.orders.get('order-123');
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Order not found');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}ms`);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Available Error Classes

- `ApiError` - Base error class, includes status code and error details
- `AuthError` - Authentication/authorization failures (401, 403)
- `NotFoundError` - Resource not found (404)
- `RateLimitError` - Rate limit exceeded (429)
- `BadRequestError` - Invalid request (400)
- `ServerError` - Server errors (5xx)
- `NetworkError` - Network/timeout errors
- `ConfigError` - Configuration errors

## Configuration

### Client Configuration Options

```typescript
interface ClientConfig {
  baseUrl: string;        // Required: API base URL
  apiKey?: string;        // Optional: API key for authentication
  accessToken?: string;   // Optional: OAuth bearer token
  timeout?: number;       // Optional: Request timeout in ms (default: 30000)
  retryAttempts?: number; // Optional: Max retry attempts for 429 (default: 3)
}
```

### Request Options

You can override default options per request:

```typescript
const orders = await client.orders.list(
  { page: 1 },
  {
    headers: { 'X-Custom-Header': 'value' },
    timeout: 60000,
    retryAttempts: 5,
  }
);
```

## Pagination

All list endpoints return paginated results:

```typescript
const response = await client.orders.list({ page: 1, limit: 20 });

console.log(response.data);        // Order[]
console.log(response.pagination);  // { page: 1, limit: 20, total: 150, pages: 8 }
```

## TypeScript Support

Full type definitions are included for all resources and responses:

```typescript
import type {
  Order,
  Driver,
  Zone,
  Shipment,
  CreateOrderData,
  PaginatedResponse,
} from '@witylogix/sdk';

// Fully typed function
async function processOrders(client: Witylogix): Promise<void> {
  const response: PaginatedResponse<Order> = await client.orders.list();

  response.data.forEach((order: Order) => {
    console.log(`${order.reference_number}: ${order.status}`);
  });
}
```

## Rate Limiting

The SDK automatically handles rate limiting with exponential backoff:

```typescript
// If you get a 429 (Too Many Requests), the SDK will:
// 1. Read the Retry-After header
// 2. Wait the specified time
// 3. Automatically retry the request
// 4. Fail after max retries

const orders = await client.orders.list();
// If rate limited, automatically retries up to 3 times
```

## Logging

To debug requests, enable console logging:

```typescript
const client = new Witylogix({
  baseUrl: 'https://api.witylogix.com',
  apiKey: 'your-api-key',
});

// Check if authenticated
if (client.isAuthenticated()) {
  console.log('Client is authenticated');
}
```

## Browser Support

The SDK uses the native Fetch API and requires a modern browser or Node.js 18+.

## License

AGPL-3.0
