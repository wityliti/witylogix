# Witylogix Shopify Checkout + Google Integration Guide

## Overview

This guide documents the complete implementation of Shopify Checkout Extension with Google Maps and Calendar integrations for the Witylogix last-mile delivery platform.

## Architecture

### Components

1. **Shopify Checkout Extension** (`extensions/checkout-ui/`)
   - Preact-based UI component for delivery date/time selection
   - Renders in Shopify checkout flow
   - Communicates with Witylogix backend API

2. **Google Maps Service** (`packages/core/src/integrations/google/maps-service.ts`)
   - Address geocoding
   - Distance calculations
   - Directions with waypoints
   - Zone detection via point-in-polygon
   - Rate limiting and caching

3. **Google Calendar Service** (`packages/core/src/integrations/google/calendar-service.ts`)
   - OAuth2 authentication flow
   - Event creation/updating for orders
   - Pickup order synchronization
   - Token refresh handling

4. **Zone Visualizer** (`packages/core/src/integrations/google/zone-visualizer.ts`)
   - GeoJSON polygon generation
   - Zone boundary simplification (Douglas-Peucker)
   - Coverage statistics
   - Static map URL generation
   - KML export

5. **API Routes**
   - Shopify checkout routes (`apps/api/src/routes/integrations/shopify-checkout.ts`)
   - Google integration routes (`apps/api/src/routes/integrations/google.ts`)

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```env
# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Google OAuth2 (for Calendar)
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret

# API Configuration
API_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3001

# Shopify
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
```

### 2. Google Cloud Setup

#### Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Maps SDK for JavaScript
   - Geocoding API
   - Distance Matrix API
   - Directions API
4. Create an API key restriction to HTTP applications
5. Copy the API key to `GOOGLE_MAPS_API_KEY`

#### Google Calendar API

1. In Google Cloud Console, enable the Google Calendar API
2. Create OAuth2 credentials:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`, `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3000/api/integrations/google/calendar/callback`
3. Copy the Client ID and Secret to environment variables

### 3. Database Schema

Required Prisma models (add to `packages/db/schema.prisma`):

```prisma
model DeliveryZone {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  name      String
  boundaries Json     // Array of { latitude, longitude }
  zipcodes  String[] // Searchable zipcodes
  baseDeliveryFee Int?
  perMileFee Int?
  maxDistance Int?
  estimatedDeliveryDays Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  slots     DeliverySlot[]
  orders    DeliveryOrder[]

  @@unique([shopId, name])
}

model DeliverySlot {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  zoneId    String
  zone      DeliveryZone @relation(fields: [zoneId], references: [id])
  date      DateTime
  startTime String   // HH:MM format
  endTime   String   // HH:MM format
  capacity  Int
  reserved  Int      @default(0)
  baseFee   Int      // In cents
  isAvailable Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  reservations SlotReservation[]
  orders    DeliveryOrder[]

  @@index([shopId, date])
  @@index([zoneId])
}

model SlotReservation {
  id              String   @id @default(cuid())
  shopId          String
  shop            Shop     @relation(fields: [shopId], references: [id])
  slotId          String
  slot            DeliverySlot @relation(fields: [slotId], references: [id])
  cartId          String
  customerEmail   String?
  deliveryAddress String?
  status          String   // PENDING, CONFIRMED, CANCELLED, EXPIRED
  confirmationCode String  @unique @default(cuid())
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  order           DeliveryOrder?

  @@index([shopId, cartId])
  @@index([slotId])
}

model DeliveryOrder {
  id              String   @id @default(cuid())
  shopId          String
  shop            Shop     @relation(fields: [shopId], references: [id])
  shopifyOrderId  String
  slotId          String
  slot            DeliverySlot @relation(fields: [slotId], references: [id])
  zoneId          String?
  zone            DeliveryZone? @relation(fields: [zoneId], references: [id])
  reservationId   String?  @unique
  reservation     SlotReservation? @relation(fields: [reservationId], references: [id])
  customerEmail   String
  deliveryAddress String
  phoneNumber     String?
  deliveryFee     Int      // In cents
  status          String   // PENDING, ASSIGNED, IN_TRANSIT, DELIVERED, FAILED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([shopId])
  @@index([shopifyOrderId])
  @@index([slotId])
}

model Integration {
  id          String   @id @default(cuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id])
  provider    String   // google_maps, google_calendar, etc.
  credentials Json     // Encrypted credentials
  config      Json     // Provider-specific config
  isEnabled   Boolean  @default(true)
  lastSyncAt  DateTime?
  syncStatus  String?  // SUCCESS, FAILED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([shopId, provider])
  @@index([provider])
}

model IntegrationSession {
  id        String   @id @default(cuid())
  shopId    String
  provider  String
  state     String   @unique
  metadata  Json?
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([shopId, provider])
}

model PickupOrder {
  id            String   @id @default(cuid())
  shopId        String
  locationId    String
  customerName  String
  address       String
  pickupTime    DateTime
  phoneNumber   String?
  notes         String?
  scheduledDate DateTime
  createdAt     DateTime @default(now())

  @@index([locationId, scheduledDate])
}
```

## API Endpoints

### Shopify Checkout Routes

#### GET `/api/integrations/shopify/checkout/slots?date=YYYY-MM-DD&shop=domain`

Get available delivery slots for a specific date.

**Response:**

```json
{
  "slots": [
    {
      "id": "slot-123",
      "date": "2024-03-15",
      "startTime": "09:00",
      "endTime": "12:00",
      "label": "9:00 AM - 12:00 PM",
      "timeGroup": "morning",
      "capacity": 5,
      "reserved": 2,
      "price": 500,
      "available": true,
      "slotsRemaining": 3
    }
  ]
}
```

#### POST `/api/integrations/shopify/checkout/reserve`

Reserve a delivery slot.

**Request Body:**

```json
{
  "slotId": "slot-123",
  "cartId": "gid://shopify/Cart/...",
  "shopDomain": "myshop.myshopify.com",
  "customerEmail": "customer@example.com",
  "deliveryAddress": "123 Main St, City, State"
}
```

**Response:**

```json
{
  "slotId": "slot-123",
  "cartId": "gid://shopify/Cart/...",
  "reservationId": "res-456",
  "expiresAt": "2024-03-14T10:15:00Z",
  "confirmationCode": "WL123456"
}
```

#### GET `/api/integrations/shopify/checkout/rates?zipcode=12345&shop=domain`

Get delivery rates for a zipcode.

**Response:**

```json
{
  "zone": "Zone 1",
  "baseFee": 500,
  "perMile": 100,
  "estimatedDelivery": "1-2 business days"
}
```

#### GET `/api/integrations/shopify/checkout/geocode?address=...`

Geocode an address.

**Response:**

```json
{
  "address": "123 Main St, City, State 12345",
  "latitude": 40.7128,
  "longitude": -74.006,
  "zipcode": "12345",
  "city": "City",
  "state": "State"
}
```

#### GET `/api/integrations/shopify/checkout/availability?zipcode=12345`

Check service availability.

**Response:**

```json
{
  "available": true
}
```

### Google Integration Routes

#### GET `/api/integrations/google/geocode?address=...`

Geocode using Google Maps.

#### GET `/api/integrations/google/distance?origin=...&destination=...`

Calculate distance between two points.

#### GET `/api/integrations/google/directions?origin=...&destination=...&waypoints=...`

Get directions with waypoints.

#### POST `/api/integrations/google/calendar/auth`

Initiate OAuth2 flow.

**Request Body:**

```json
{
  "shopId": "shop-123",
  "calendarId": "primary"
}
```

**Response:**

```json
{
  "authUrl": "https://accounts.google.com/...",
  "state": "state-token"
}
```

#### GET `/api/integrations/google/calendar/callback?code=...&state=...`

OAuth2 callback (redirects to dashboard on success).

#### POST `/api/integrations/google/calendar/sync`

Sync pickup orders to calendar.

**Request Body:**

```json
{
  "locationId": "loc-123",
  "startDate": "2024-03-15",
  "endDate": "2024-03-20"
}
```

**Response:**

```json
{
  "synced": 10,
  "skipped": 2,
  "failed": 0,
  "errors": []
}
```

#### POST `/api/integrations/google/zone/validate`

Validate if address is in service zone.

**Request Body:**

```json
{
  "address": "123 Main St, City",
  "shop": "myshop.myshopify.com"
}
```

**Response:**

```json
{
  "address": "123 Main St, City, State 12345",
  "latitude": 40.7128,
  "longitude": -74.006,
  "zipcode": "12345",
  "inZone": true,
  "zone": "Zone 1"
}
```

## Usage Examples

### Using the WitylogixAPI Client

```typescript
import {
  WitylogixAPI,
  initializeAPIClient,
} from "@witylogix/checkout-ui/api/witylogix-api";

// Initialize
const api = await initializeAPIClient("myshop.myshopify.com");

// Fetch slots
const slots = await api.fetchSlots("2024-03-15", "myshop.myshopify.com");

// Fetch rates
const rates = await api.fetchRates("12345");

// Reserve slot
const reservation = await api.reserveSlot("slot-123", "cart-456");

// Geocode address
const geocoded = await api.geocodeAddress("123 Main St");

// Check availability
const available = await api.checkServiceAvailability("12345");
```

### Using Google Maps Service

```typescript
import { createGoogleMapsService } from "@witylogix/core/integrations/google";

const mapsService = createGoogleMapsService(process.env.GOOGLE_MAPS_API_KEY);

// Geocode
const result = await mapsService.geocodeAddress("123 Main St");

// Calculate distance
const distance = await mapsService.calculateDistance(
  { lat: 40.7128, lng: -74.006 },
  { lat: 40.758, lng: -73.9855 },
);

// Get directions
const directions = await mapsService.getDirections(
  "123 Main St",
  "456 Park Ave",
  ["789 Broadway"],
);

// Detect zone
const zone = mapsService.detectZone(40.7128, -74.006, zones);

// Check point in zone
const inZone = mapsService.isPointInZone(40.7128, -74.006, zone);
```

### Using Google Calendar Service

```typescript
import { createGoogleCalendarService } from "@witylogix/core/integrations/google";

const calendarService = createGoogleCalendarService({
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: "http://localhost:3000/callback",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

// Set token (from OAuth2 flow)
calendarService.setToken({
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 3600000,
  tokenType: "Bearer",
});

// Create event
const event = await calendarService.createOrderEvent({
  orderId: "order-123",
  customerName: "John Doe",
  deliveryAddress: "123 Main St",
  deliveryDate: "2024-03-15T10:00:00Z",
  phoneNumber: "555-0123",
});

// Sync pickup orders
const result = await calendarService.syncPickupOrders(
  "location-123",
  { startDate: "2024-03-15", endDate: "2024-03-20" },
  orders,
);

// Delete event
await calendarService.deleteOrderEvent("event-123");
```

### Using Zone Visualizer

```typescript
import { createZoneVisualizerService } from "@witylogix/core/integrations/google";

const visualizer = createZoneVisualizerService();

// Get GeoJSON
const geojson = visualizer.getZonePolygons(zones);

// Check if point in zone
const inZone = visualizer.isPointInZone(40.7128, -74.006, zone);

// Get coverage stats
const stats = visualizer.calculateZoneCoverage(zones);

// Generate map URL
const mapUrl = visualizer.generateZoneMapUrl(
  zones,
  { latitude: 40.7128, longitude: -74.006 },
  process.env.GOOGLE_MAPS_API_KEY,
);

// Simplify boundaries
const simplified = visualizer.simplifyBoundaries(zone.boundaries, 0.0001);
```

## Error Handling

All services include comprehensive error handling:

```typescript
try {
  const result = await mapsService.geocodeAddress("invalid address");
} catch (error) {
  if (error instanceof Error) {
    console.error("Geocoding failed:", error.message);
  }
}
```

Common errors:

- Invalid input validation (zod)
- API rate limiting
- Network errors
- Authentication failures
- Missing configuration

## Rate Limiting

### Google Maps API

- Daily limit: 25,000 requests (default)
- Rate limiter tracks usage and provides `getRateLimitInfo()`
- Cache TTL: 1 hour
- Reset daily counter with `resetDailyCounter()`

### Google Calendar API

- Token refresh: Automatic when expired
- OAuth2 scope: `calendar` and `calendar.events`

## Testing

Run tests with:

```bash
npm run test -- packages/core/src/integrations/google/__tests__
```

Test coverage includes:

- Maps service (geocoding, distance, zone detection)
- Calendar service (OAuth2, events, sync)
- Input validation
- Error scenarios

## Security Considerations

1. **API Keys**: Store in environment variables only
2. **OAuth2**: Use state parameter for CSRF protection
3. **Credentials**: Encrypt before storage in database
4. **Token Refresh**: Automatic with expiration checking
5. **Input Validation**: All inputs validated with zod schemas
6. **CORS**: Configure for Shopify domains only

## Performance Optimization

1. **Caching**: 1-hour TTL for geocoding and directions
2. **Rate Limiting**: Tracks usage and prevents quota exceeded
3. **Batch Operations**: Calendar sync supports bulk updates
4. **Boundary Simplification**: Douglas-Peucker for efficient polygons
5. **Index**: Database indexes on frequently queried fields

## Troubleshooting

### Google Maps API not working

- Verify API key is valid
- Check API is enabled in Google Cloud Console
- Confirm domain restrictions allow your server

### Calendar OAuth2 failing

- Verify redirect URI matches exactly
- Check client ID and secret are correct
- Ensure calendar API is enabled

### Slots not loading

- Check shop configuration in database
- Verify API endpoints are accessible
- Check network requests in browser dev tools

## Future Enhancements

1. Real-time slot availability updates (WebSocket)
2. Driver location tracking integration
3. Estimated delivery time calculation
4. SMS/email notifications
5. Advanced zone management UI
6. Analytics dashboard
7. Multi-language support

## Support

For issues or questions, refer to:

- Witylogix documentation: `/docs`
- API documentation: `/apps/api/docs`
- GitHub issues: Issues tab
