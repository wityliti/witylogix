# Checkout Widget - Quick Start Guide

## Installation

The widget is now ready to be installed into your workspace. First, install its dependencies:

```bash
cd packages/checkout-widget
pnpm install
```

## Build the Widget

```bash
# Development mode with watch
pnpm run dev

# Production build
pnpm run build

# Type checking
pnpm run type-check
```

## Basic Usage

### 1. Define Delivery Methods

```typescript
import { DeliveryMethodType } from '@witylogix/checkout-widget';

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
  {
    id: DeliveryMethodType.PICKUP,
    name: 'Store Pickup',
    description: 'Pick up at your nearest store',
    estimatedTime: 'Ready in 2 hours',
    estimatedMinutes: 120,
    price: 0,
    enabled: true,
  },
];
```

### 2. Render the Widget

```tsx
import React from 'react';
import { CheckoutWidget } from '@witylogix/checkout-widget';

export function CheckoutPage() {
  return (
    <CheckoutWidget
      apiBaseUrl={process.env.REACT_APP_API_URL || 'https://api.example.com'}
      deliveryMethods={deliveryMethods}
      defaultOrderValue={100}
      onComplete={(selection) => {
        console.log('Delivery selection:', selection);
        // Save to your backend
        saveCheckoutSelection(selection);
      }}
      onError={(error) => {
        console.error('Checkout error:', error);
        // Show error notification
        showNotification('Error: ' + error.message, 'error');
      }}
    />
  );
}
```

### 3. Implement Backend API

The widget expects these API endpoints. Here's a sample implementation with Node.js/Express:

```typescript
// Address validation endpoint
app.post('/api/address/validate', async (req, res) => {
  const { address, zipcode } = req.body;

  try {
    // Validate with your geocoding service (Google Maps, etc.)
    const validated = await geocodingService.validate(address, zipcode);

    // Detect zone from coordinates
    const zone = await zoneService.detectZone(
      validated.latitude,
      validated.longitude
    );

    res.json({
      valid: !!zone,
      address: validated.fullAddress,
      zipcode: validated.zipcode,
      latitude: validated.latitude,
      longitude: validated.longitude,
      zoneId: zone?.id,
      zoneName: zone?.name,
      message: zone ? 'We deliver to your area!' : 'Sorry, outside delivery zone',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Availability endpoint
app.post('/api/availability', async (req, res) => {
  const { zoneId, startDate, endDate, deliveryMethod } = req.body;

  try {
    const availability = await availabilityService.getSlots(
      zoneId,
      new Date(startDate),
      new Date(endDate),
      deliveryMethod
    );

    res.json(availability);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rates endpoint
app.post('/api/rates', async (req, res) => {
  const { zoneId, orderValue, estimatedWeight, deliveryMethod } = req.body;

  try {
    const rate = await rateService.getRate(
      zoneId,
      orderValue,
      estimatedWeight,
      deliveryMethod
    );

    res.json(rate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Component Structure

The widget is built as a multi-step form with these screens:

1. **Address Entry** - Address autocomplete + zipcode validation
2. **Delivery Method** - Choose standard, express, or pickup
3. **Date Selection** - Calendar with availability indicators
4. **Time Slot Selection** - Available time slots with pricing
5. **Review** - Confirm all selections before checkout

## API Response Examples

### Address Validation Response
```json
{
  "valid": true,
  "address": "123 Main St, New York, NY 10001",
  "zipcode": "10001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "zoneId": "zone-manhattan",
  "zoneName": "Manhattan",
  "message": "We deliver to your area!"
}
```

### Availability Response
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

### Rates Response
```json
{
  "zoneId": "zone-manhattan",
  "zoneName": "Manhattan",
  "baseRate": 5.99,
  "distanceFeePerKm": 0.50,
  "weightSurchargePerKg": 1.00,
  "freeDeliveryThreshold": 50,
  "currency": "USD",
  "enabled": true
}
```

## Customization

### Dark Mode
```tsx
<CheckoutWidget
  {...props}
  darkMode={true}
/>
```

### Compact Mode (for embedded contexts)
```tsx
<CheckoutWidget
  {...props}
  compactMode={true}
/>
```

### Custom Colors
```tsx
<CheckoutWidget
  {...props}
  customVariables={{
    '--wl-accent': '220 90% 56%',      // Custom blue
    '--wl-success': '134 61% 41%',    // Custom green
    '--wl-warning': '45 93% 47%',     // Custom amber
    '--wl-destructive': '0 84% 60%',  // Custom red
  }}
/>
```

### Custom Date Range
```tsx
<CheckoutWidget
  {...props}
  minDate={new Date()}
  maxDate={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)} // 60 days out
/>
```

## Integration Examples

### Shopify Checkout Extension

```tsx
import { CheckoutWidget } from '@witylogix/checkout-widget';

export function CheckoutUiExtension() {
  return (
    <CheckoutWidget
      apiBaseUrl={process.env.REACT_APP_API_URL}
      deliveryMethods={DELIVERY_METHODS}
      defaultOrderValue={100}
      onComplete={(selection) => {
        // Update Shopify checkout with metafield
        fetch('/api/checkout/metafield', {
          method: 'PUT',
          body: JSON.stringify({
            metafield: {
              namespace: 'witylogix',
              key: 'delivery_selection',
              value: JSON.stringify(selection),
              type: 'json',
            },
          }),
        });
      }}
    />
  );
}
```

### WooCommerce Integration

```html
<div id="witylogix-checkout-widget"></div>

<script>
  import React from 'react';
  import ReactDOM from 'react-dom';
  import { CheckoutWidget } from '@witylogix/checkout-widget';

  const deliveryMethods = window.witylogixDeliveryMethods || [];

  ReactDOM.render(
    <CheckoutWidget
      apiBaseUrl="<?php echo esc_url(rest_url('witylogix/v1')); ?>"
      deliveryMethods={deliveryMethods}
      onComplete={(selection) => {
        // Save to WooCommerce order meta
        jQuery.post('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
          action: 'save_delivery_selection',
          nonce: '<?php echo wp_create_nonce('witylogix-nonce'); ?>',
          selection: JSON.stringify(selection),
        });
      }}
    />,
    document.getElementById('witylogix-checkout-widget')
  );
</script>
```

### Standalone HTML Embed

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Checkout</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>
  <div id="app"></div>

  <script>
    import { CheckoutWidget } from '@witylogix/checkout-widget';

    const root = ReactDOM.createRoot(document.getElementById('app'));
    root.render(
      <CheckoutWidget
        apiBaseUrl="https://api.mysite.com"
        deliveryMethods={[
          {
            id: 'standard',
            name: 'Standard Delivery',
            description: 'Next business day',
            estimatedTime: 'Next business day',
            estimatedMinutes: 1440,
            price: 5.99,
            enabled: true,
          },
        ]}
        onComplete={(selection) => {
          console.log('Selection:', selection);
          // POST to your backend
        }}
      />
    );
  </script>
</body>
</html>
```

## Debugging

Enable debugging to see API calls and state changes:

```tsx
<CheckoutWidget
  {...props}
  onSelectionChange={(selection) => {
    console.log('Selection updated:', selection);
  }}
  onError={(error) => {
    console.error('Widget error:', error);
  }}
/>
```

## Browser DevTools

The widget logs to console in development mode:
- API requests/responses
- State changes
- Validation errors
- Loading states

Check the Network tab in DevTools to debug API issues.

## Performance Tips

1. **Memoize delivery methods** if they're large lists
2. **Use default values** to avoid recomputation
3. **Enable request batching** in your API for availability
4. **Cache zone rates** with appropriate TTL
5. **Debounce address search** (already built-in, 300ms default)

## Troubleshooting

### Widget not rendering
- Check that React 18+ is available in parent
- Verify API base URL is correct
- Check browser console for errors

### API calls failing
- Verify CORS headers in your API
- Check Content-Type is application/json
- Verify request/response shapes match spec

### Styles not applying
- Ensure Tailwind CSS is configured
- Check that custom CSS variables are in root
- Verify no CSS conflicts with parent styles

### Date picker not showing availability
- Verify availability API endpoint is working
- Check that date range includes available slots
- Ensure zone detection is working correctly

## Support

For issues or questions:
1. Check the README.md for comprehensive docs
2. Review IMPLEMENTATION_SUMMARY.md for architecture
3. Check the Network tab in DevTools for API issues
4. Enable console logging for detailed debugging

Happy shipping! 🚚
