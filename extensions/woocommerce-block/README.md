# WooCommerce Delivery Scheduler Block

A production-ready WooCommerce checkout block for delivery date/time slot selection with address-based rate display.

## Features

- **Calendar Date Picker**: Interactive calendar with availability indicators
- **Time Slot Selector**: Grid-based time slot selection with capacity indicators
- **Zone-Based Rates**: Display delivery rates based on shipping address
- **Delivery Instructions**: Text input for special delivery notes
- **Responsive Design**: Mobile and desktop optimized
- **WC Store API Integration**: Uses native WooCommerce authentication
- **PHP Plugin Scaffold**: Complete REST API endpoints and order meta storage

## Architecture

### Block Components

#### `src/components/date-picker.tsx`
Calendar date picker with:
- Month navigation
- Availability indicators (available/limited/unavailable)
- Date range validation
- Legend display

#### `src/components/time-slots.tsx`
Time slot grid with:
- Grouping by time period (morning/afternoon/evening)
- Capacity indicators and availability status
- Price display
- Selection state management

#### `src/components/rate-display.tsx`
Zone rate display showing:
- Base fee
- Per-mile rate
- Estimated delivery time
- Zone badge
- Loading and error states

#### `src/components/delivery-notes.tsx`
Text area for delivery instructions with:
- Character counter
- 500-character limit
- Focus/blur states
- Warning/error states

### API Client

#### `src/api/witylogix-api.ts`
WooCommerce-native API client with:
- `fetchAvailableSlots(date, zoneId)` - Get slots for specific date
- `fetchZoneRates(address)` - Get rates for address
- `reserveSlot(slotId, orderId)` - Reserve time slot
- `validateAddress(address)` - Validate shipping address
- `checkServiceAvailability(zipcode)` - Check service coverage

Uses WC Store API nonce for authentication.

### PHP Plugin

#### `php/witylogix-delivery.php`
WordPress plugin providing:
- Block registration via `block.json`
- REST API endpoints for proxy to Witylogix backend:
  - `/wc/v1/witylogix/slots` - Get available slots
  - `/wc/v1/witylogix/rates` - Get delivery rates
  - `/wc/v1/witylogix/reserve` - Reserve a slot
  - `/wc/v1/witylogix/validate-address` - Validate address
  - `/wc/v1/witylogix/availability` - Check service availability
- Order meta storage for delivery selection
- Admin order display for delivery information
- Plugin settings page (API URL, Merchant ID, API Key)

## Installation

### Prerequisites
- WordPress 5.9+
- WooCommerce 8.0+
- PHP 8.0+

### Setup

1. Copy block files to `wp-content/plugins/witylogix-delivery/`
2. Configure plugin settings in WordPress admin
3. Add block to WooCommerce checkout page via block editor
4. Configure block attributes:
   - API URL: Your Witylogix API endpoint
   - Merchant ID: Your Witylogix merchant identifier

## Configuration

### Block Attributes

```json
{
  "apiUrl": "https://api.witylogix.app",
  "merchantId": "your-merchant-id",
  "defaultView": "calendar",
  "enableDeliveryNotes": true
}
```

### Plugin Settings

Set these as WordPress options:
- `witylogix_delivery_api_url` - Witylogix API endpoint
- `witylogix_delivery_merchant_id` - Merchant ID
- `witylogix_delivery_api_key` - API key for server-to-server requests

## Styling

### CSS Variables

All styling uses CSS custom properties for easy customization:

```css
--witylogix-primary: #007cba;
--witylogix-primary-dark: #005a87;
--witylogix-primary-light: #e7f5ff;
--witylogix-success: #46b450;
--witylogix-warning: #ffb81c;
--witylogix-error: #d32f2f;
--witylogix-neutral-light: #f9f9f9;
--witylogix-border: #ddd;
--witylogix-text-primary: #1e1e1e;
--witylogix-text-secondary: #666;
```

### Component Classes

- `.witylogix-date-picker` - Date picker container
- `.witylogix-time-slots` - Time slots grid
- `.witylogix-rate-display` - Rate display container
- `.witylogix-delivery-notes` - Notes textarea
- `.witylogix-delivery-scheduler-block` - Main block wrapper

## Usage

### Block Registration

```tsx
registerBlockType('witylogix/delivery-scheduler', {
  edit: DeliverySchedulerBlock,
  save: () => null, // Dynamic block
});
```

### Event Handling

Block dispatches custom events for integration:

```javascript
// Selection changed event
window.addEventListener('witylogix:selection-changed', (event) => {
  console.log(event.detail); // { date, slotId, notes }
});

// Address changed event
window.dispatchEvent(new CustomEvent('witylogix:address-changed', {
  detail: addressObject
}));
```

### Data Storage

Selection is stored in window object:
```javascript
window.__WITYLOGIX_DELIVERY__ = {
  date: '2024-01-20',
  slotId: 'slot-123',
  slotLabel: 'Morning (8am-12pm)',
  timeGroup: 'morning',
  notes: 'Please ring doorbell'
}
```

## Order Meta

Delivery selection is stored in WooCommerce order meta:

- `_witylogix_delivery_date` - Selected delivery date
- `_witylogix_delivery_slot` - Selected time slot ID
- `_witylogix_delivery_notes` - Delivery instructions

## Error Handling

The block includes comprehensive error handling:

- Network errors are caught and displayed
- Invalid data is validated before submission
- Missing configuration shows helpful messages
- Graceful degradation if services unavailable

## Accessibility

- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader friendly
- Color contrast compliant (WCAG 2.1 AA)

## Performance

- Lazy loading of slots only when needed
- Debounced API requests
- Cached zone rates
- Optimized re-renders with React hooks
- CSS Grid for efficient layouts

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

## API Integration

### Witylogix API Endpoints

All requests require:
- `X-Merchant-ID` header
- `X-WC-Store-API-Nonce` header (client-side)

#### Get Available Slots

```
GET /wc/v1/witylogix/slots?date=2024-01-20&zone_id=zone-1
```

Response:
```json
{
  "slots": [
    {
      "id": "slot-1",
      "date": "2024-01-20",
      "startTime": "08:00",
      "endTime": "12:00",
      "label": "Morning",
      "timeGroup": "morning",
      "capacity": 20,
      "reserved": 12,
      "price": 0,
      "available": true
    }
  ]
}
```

#### Get Delivery Rates

```
GET /wc/v1/witylogix/rates?zip=10001&country=US
```

Response:
```json
{
  "zone": "New York",
  "baseFee": 1500,
  "perMile": 50,
  "estimatedDelivery": "1-2 days"
}
```

#### Reserve Slot

```
POST /wc/v1/witylogix/reserve
Content-Type: application/json

{
  "slotId": "slot-1",
  "orderId": "123"
}
```

Response:
```json
{
  "slotId": "slot-1",
  "orderId": "123",
  "reservationId": "res-123",
  "expiresAt": "2024-01-20T12:00:00Z",
  "confirmationCode": "WLY-123456"
}
```

## Troubleshooting

### Block Not Appearing
- Verify plugin is activated
- Check `block.json` is valid
- Ensure WordPress version 5.9+

### API Errors
- Check merchant ID configuration
- Verify API URL is correct
- Ensure API key is valid
- Check network tab for failed requests

### Styling Issues
- Clear browser cache
- Verify CSS custom properties are set
- Check for conflicting styles from theme

## Support

For issues or feature requests, contact support@witylogix.com

## License

GPL v2 or later
