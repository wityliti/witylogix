# @witylogix/checkout-widget

> Embeddable checkout date/time picker widget for delivery date/time slot selection

Pickeasy-quality checkout widget built with React 18+, TypeScript, and Tailwind CSS. Designed to be embedded in Shopify, WooCommerce, or any standalone HTML context.

## Features

- 📅 Calendar date picker with availability indicators
- ⏰ Time slot grid with capacity tracking
- 🗺️ Address autocomplete with zone detection
- 📦 Delivery method selector
- 💰 Zone-based rate calculation and display
- 📱 Mobile-responsive and compact modes
- 🎨 Dark mode support
- ♿ WCAG accessible
- 🌍 Multi-locale support
- 📦 Zero dependencies (except React)

## Installation

```bash
npm install @witylogix/checkout-widget
# or
pnpm add @witylogix/checkout-widget
# or
yarn add @witylogix/checkout-widget
```

## Quick Start

```tsx
import React from 'react';
import { CheckoutWidget, DeliveryMethodType } from '@witylogix/checkout-widget';

const deliveryMethods = [
  {
    id: DeliveryMethodType.STANDARD,
    name: 'Standard Delivery',
    description: 'Delivery in 1-2 business days',
    estimatedTime: 'Next business day',
    estimatedMinutes: 1440,
    price: 5.99,
    enabled: true,
  },
  {
    id: DeliveryMethodType.EXPRESS,
    name: 'Express Delivery',
    description: 'Delivery today or tomorrow',
    estimatedTime: 'Today or tomorrow',
    estimatedMinutes: 480,
    price: 12.99,
    enabled: true,
  },
];

export function App() {
  return (
    <CheckoutWidget
      apiBaseUrl="https://api.example.com"
      deliveryMethods={deliveryMethods}
      defaultOrderValue={100}
      onComplete={(selection) => {
        console.log('Order completed:', selection);
        // Send to your backend
      }}
      onError={(error) => {
        console.error('Error:', error);
      }}
    />
  );
}
```

## API Configuration

The widget requires an API backend with the following endpoints:

### `POST /api/address/validate`

Validate address and detect delivery zone.

**Request:**
```json
{
  "address": "123 Main St, New York, NY",
  "zipcode": "10001"
}
```

**Response:**
```json
{
  "valid": true,
  "address": "123 Main St, New York, NY 10001",
  "zipcode": "10001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "zoneId": "zone-1",
  "zoneName": "Manhattan",
  "message": "We deliver to your area!"
}
```

### `POST /api/address/autocomplete`

Address autocomplete suggestions.

**Request:**
```json
{
  "query": "123 main"
}
```

**Response:**
```json
[
  "123 Main St, New York, NY",
  "123 Main Ave, Brooklyn, NY",
  "123 Main St, Manhattan, NY"
]
```

### `POST /api/address/suggestions`

Get address suggestions.

**Request:**
```json
{
  "query": "123 main"
}
```

**Response:**
```json
[
  "123 Main St, New York, NY",
  "123 Main Ave, Brooklyn, NY"
]
```

### `POST /api/availability`

Fetch available delivery slots for a date range.

**Request:**
```json
{
  "zoneId": "zone-1",
  "startDate": "2024-03-15",
  "endDate": "2024-03-30",
  "deliveryMethod": "standard"
}
```

**Response:**
```json
[
  {
    "date": "2024-03-15T00:00:00Z",
    "slots": [
      {
        "id": "slot-1",
        "startTime": "2024-03-15T09:00:00Z",
        "endTime": "2024-03-15T10:00:00Z",
        "capacity": {
          "total": 10,
          "available": 3,
          "reserved": 7
        },
        "price": 5.99,
        "prepTime": {
          "cutoffHour": 16,
          "cutoffMinute": 0,
          "deliveryDaysAhead": 1,
          "message": "Order by 4pm for next-day delivery"
        }
      }
    ],
    "capacity": {
      "total": 50,
      "available": 15,
      "reserved": 35
    },
    "isAvailable": true
  }
]
```

### `POST /api/availability/batch`

Batch fetch availability for multiple dates (same as above but for optimization).

### `POST /api/rates`

Fetch delivery rates for a zone.

**Request:**
```json
{
  "zoneId": "zone-1",
  "orderValue": 100,
  "estimatedWeight": 2.5,
  "deliveryMethod": "standard"
}
```

**Response:**
```json
{
  "zoneId": "zone-1",
  "zoneName": "Manhattan",
  "baseRate": 5.99,
  "distanceFeePerKm": 0.50,
  "weightSurchargePerKg": 1.00,
  "freeDeliveryThreshold": 50,
  "currency": "USD",
  "enabled": true
}
```

### `POST /api/rates/batch`

Batch fetch rates for multiple zones.

**Request:**
```json
{
  "zoneIds": ["zone-1", "zone-2"],
  "orderValue": 100,
  "estimatedWeight": 2.5
}
```

**Response:**
```json
[
  {
    "zoneId": "zone-1",
    "zoneName": "Manhattan",
    "baseRate": 5.99,
    ...
  },
  {
    "zoneId": "zone-2",
    "zoneName": "Brooklyn",
    "baseRate": 6.99,
    ...
  }
]
```

## Props

```tsx
interface CheckoutWidgetProps extends WidgetConfig {
  // Required
  apiBaseUrl: string;
  deliveryMethods: DeliveryMethod[];

  // Callbacks
  onSelectionChange?: (selection: Partial<CheckoutSelection>) => void;
  onComplete?: (selection: CheckoutSelection) => void;
  onError?: (error: Error) => void;

  // Optional
  blackoutDates?: BlackoutDate[];
  pickupLocations?: PickupLocation[];
  defaultOrderValue?: number;
  defaultWeight?: number;
  compactMode?: boolean;
  maxDate?: Date;
  minDate?: Date;
  defaultDeliveryMethod?: DeliveryMethodType;
  currency?: string;
  locale?: string;
  darkMode?: boolean;
  customVariables?: Record<string, string>;
}
```

## Styling

The widget uses CSS variables for theming. Customize colors by providing `customVariables`:

```tsx
<CheckoutWidget
  {...props}
  customVariables={{
    '--wl-accent': '200 100% 50%',
    '--wl-success': '142 72% 29%',
    '--wl-warning': '38 92% 50%',
    '--wl-destructive': '0 84% 60%',
  }}
/>
```

Available CSS variables:
- `--wl-foreground`
- `--wl-background`
- `--wl-muted`
- `--wl-muted-foreground`
- `--wl-border`
- `--wl-accent`
- `--wl-success`
- `--wl-warning`
- `--wl-destructive`
- `--wl-blue`

## Components

Use individual components for custom flows:

```tsx
import {
  DatePicker,
  TimeSlotGrid,
  AddressInput,
  DeliveryOptions,
  ZoneRateDisplay,
} from '@witylogix/checkout-widget';

// Use components individually
<DatePicker
  selectedDate={date}
  onDateSelect={(date) => setDate(date)}
  availableDates={availableDates}
/>
```

## Hooks

Available hooks for custom integration:

- `useSlotAvailability` - Fetch time slot availability
- `useBatchSlotAvailability` - Batch fetch availability
- `useZoneRates` - Fetch zone rates
- `useBatchZoneRates` - Batch fetch rates
- `useAddressValidation` - Validate addresses
- `useAddressAutocomplete` - Address autocomplete

```tsx
import { useSlotAvailability } from '@witylogix/checkout-widget';

const { data, isLoading, error, refetch } = useSlotAvailability(
  'zone-1',
  '2024-03-15',
  '2024-03-30',
  'standard',
  { apiBaseUrl: 'https://api.example.com', enabled: true }
);
```

## Accessibility

The widget is fully WCAG 2.1 AA compliant:
- Semantic HTML
- ARIA labels and roles
- Keyboard navigation
- Focus management
- High contrast support
- Reduced motion support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 13+, Chrome Android)

## Examples

### Shopify Integration

```tsx
// Assuming you have a Shopify checkout extension
import { CheckoutWidget } from '@witylogix/checkout-widget';

export function MyCheckoutExtension() {
  return (
    <CheckoutWidget
      apiBaseUrl={process.env.REACT_APP_API_URL}
      deliveryMethods={DELIVERY_METHODS}
      onComplete={(selection) => {
        // Save selection to order metadata
        updateCheckout({ deliverySelection: selection });
      }}
    />
  );
}
```

### WooCommerce Integration

```html
<div id="witylogix-checkout"></div>

<script>
  import { CheckoutWidget } from '@witylogix/checkout-widget';

  const root = ReactDOM.createRoot(
    document.getElementById('witylogix-checkout')
  );

  root.render(
    <CheckoutWidget
      apiBaseUrl="https://api.mystore.com"
      deliveryMethods={window.witylogixMethods}
      onComplete={(selection) => {
        // Save to WooCommerce order
        fetch('/api/wc-orders/update', {
          method: 'POST',
          body: JSON.stringify(selection),
        });
      }}
    />
  );
</script>
```

## License

AGPL-3.0-only

## Support

For issues, feature requests, or questions, visit [GitHub](https://github.com/witylogix/witylogix-platform/issues).
