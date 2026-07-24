# Sprint 4.5 Quick Start Guide

## 5-Minute Setup

### 1. Environment Variables

```bash
cp .env.integration.example .env
```

Add to `.env`:

```env
GOOGLE_MAPS_API_KEY=your_key_here
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_secret_here
API_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3001
```

### 2. Database Schema (Optional - if using new models)

```bash
# Add to packages/db/schema.prisma
# See INTEGRATION_GUIDE.md for schema examples

npx prisma migrate dev --name add_integrations
```

### 3. Install Dependencies

```bash
npm install
```

Zod is already added to checkout-ui package.json

### 4. Start Development Server

```bash
npm run dev
```

## Common Tasks

### Import and Use Google Maps

```typescript
import { createGoogleMapsService } from "@witylogix/core/integrations/google";

const mapsService = createGoogleMapsService(process.env.GOOGLE_MAPS_API_KEY);

const result = await mapsService.geocodeAddress("123 Main St");
console.log(result); // { address, latitude, longitude, ... }
```

### Use Checkout API Client

```typescript
import { WitylogixAPI } from "@witylogix/checkout-ui/api/witylogix-api";

const api = new WitylogixAPI(
  "http://localhost:3000",
  "api-key",
  "myshop.myshopify.com",
);

const slots = await api.fetchSlots("2024-03-15");
const rates = await api.fetchRates("12345");
const reservation = await api.reserveSlot("slot-123", "cart-456");
```

### Set Up Calendar Integration

```typescript
import { createGoogleCalendarService } from "@witylogix/core/integrations/google";

const calendarService = createGoogleCalendarService({
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri:
    "http://localhost:3000/api/integrations/google/calendar/callback",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

// Get authorization URL
const authUrl = calendarService.getAuthorizationUrl("state-token");
// Redirect user to authUrl...

// After callback with code:
const token = await calendarService.exchangeCodeForToken(code);
calendarService.setToken(token);

// Create event
const event = await calendarService.createOrderEvent({
  orderId: "order-123",
  customerName: "John Doe",
  deliveryAddress: "123 Main St",
  deliveryDate: "2024-03-15T10:00:00Z",
});
```

### Visualize Zones

```typescript
import { createZoneVisualizerService } from "@witylogix/core/integrations/google";

const visualizer = createZoneVisualizerService();

// Get GeoJSON for mapping
const geojson = visualizer.getZonePolygons(zones);

// Check if point is in zone
const inZone = visualizer.isPointInZone(40.7128, -74.006, zone);

// Get coverage stats
const stats = visualizer.calculateZoneCoverage(zones);

// Generate map URL
const mapUrl = visualizer.generateZoneMapUrl(
  zones,
  { latitude: 40.7128, longitude: -74.006 },
  process.env.GOOGLE_MAPS_API_KEY,
);
```

## API Endpoints

All endpoints under `/api/integrations/`

### Shopify Checkout

```
GET    /shopify/checkout/slots?date=YYYY-MM-DD&shop=domain
POST   /shopify/checkout/reserve
GET    /shopify/checkout/rates?zipcode=12345&shop=domain
GET    /shopify/checkout/geocode?address=...
GET    /shopify/checkout/availability?zipcode=12345
POST   /shopify/checkout/webhook/order
```

### Google Integration

```
GET    /google/geocode?address=...
GET    /google/distance?origin=...&destination=...
GET    /google/directions?origin=...&destination=...
POST   /google/calendar/auth
GET    /google/calendar/callback
POST   /google/calendar/sync
POST   /google/zone/validate
```

## Testing

```bash
# Run all tests
npm run test

# Run specific service tests
npm run test -- packages/core/src/integrations/google

# Run with coverage
npm run test -- --coverage
```

## File Locations

**Core Services**: `/packages/core/src/integrations/google/`

- `maps-service.ts` - Google Maps
- `calendar-service.ts` - Google Calendar
- `zone-visualizer.ts` - Zone visualization
- `types.ts` - Type definitions

**Checkout Client**: `/extensions/checkout-ui/src/api/`

- `witylogix-api.ts` - Shopify checkout API

**API Routes**: `/apps/api/src/routes/integrations/`

- `shopify-checkout.ts` - Checkout endpoints
- `google.ts` - Google integration endpoints

**Documentation**:

- `INTEGRATION_GUIDE.md` - Complete guide
- `SPRINT_4.5_SUMMARY.md` - Sprint summary
- `SPRINT_4.5_FILES.md` - File index
- `.env.integration.example` - Environment template

## Google Cloud Setup (Quick)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable APIs:
   - Maps SDK for JavaScript
   - Geocoding API
   - Distance Matrix API
   - Directions API
   - Google Calendar API
4. Create credentials:
   - API Key (for Maps)
   - OAuth2 Web Application (for Calendar)
5. Copy keys to `.env` file

## Troubleshooting

### Google Maps API errors

- Check API key is valid
- Verify APIs are enabled in Google Cloud Console
- Ensure API key has proper restrictions

### Calendar auth failing

- Verify redirect URI matches exactly
- Check client ID and secret
- Confirm calendar API is enabled
- Clear browser cookies if needed

### Slots not loading

- Verify shop is configured in database
- Check API endpoints are running
- Look for network errors in browser console
- Check database has slot data

### Zone detection issues

- Verify zone boundaries are properly formatted
- Check coordinates are valid (lat: -90 to 90, lng: -180 to 180)
- Test with simple rectangular zone first

## Performance Tips

1. **Caching**: Maps queries cached for 1 hour
2. **Rate Limiting**: Daily limits enforced (25K for Maps)
3. **Batch Sync**: Use calendar batch sync for multiple orders
4. **Boundary Simplification**: Use simplifyBoundaries() for complex zones

## Security Reminders

- Never commit `.env` file
- Keep API keys secret
- Use HTTPS in production
- Enable CORS only for trusted domains
- Encrypt stored credentials
- Rotate tokens regularly

## Next Steps

1. Review `INTEGRATION_GUIDE.md` for full documentation
2. Set up Google Cloud projects
3. Configure environment variables
4. Test API endpoints
5. Integrate with your app
6. Run tests
7. Deploy to production

## Documentation

For detailed information, see:

- **Full Integration Guide**: `INTEGRATION_GUIDE.md`
- **Sprint Summary**: `SPRINT_4.5_SUMMARY.md`
- **File Index**: `SPRINT_4.5_FILES.md`

## Support

Check `INTEGRATION_GUIDE.md` for:

- Complete API documentation
- Detailed setup instructions
- Usage examples
- Error handling patterns
- Troubleshooting guide
- Performance tips
- Security best practices
