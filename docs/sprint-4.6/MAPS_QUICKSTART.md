# Google Maps Components - Quick Start Guide

## 1. Setup (5 minutes)

### Get Your API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable APIs:
   - Maps JavaScript API
   - Places API
   - (Geometry, Drawing, Visualization included)
4. Create a new API key (unrestricted for now, add restrictions later)

### Add to Environment
Create `.env.local`:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Setup Provider
Wrap your app (usually `app/layout.tsx`):
```tsx
import { GoogleMapsProvider } from '@/components/maps';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GoogleMapsProvider
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          libraries={['places', 'drawing', 'visualization', 'geometry']}
        >
          {children}
        </GoogleMapsProvider>
      </body>
    </html>
  );
}
```

---

## 2. Use Components

### Address Input
```tsx
import { AddressAutocomplete } from '@/components/maps';

export default function CheckoutForm() {
  return (
    <AddressAutocomplete
      onSelect={(place) => {
        console.log('Address:', place.formattedAddress);
        console.log('Lat/Lng:', place.latitude, place.longitude);
      }}
      placeholder="Enter delivery address"
    />
  );
}
```

### Zone Editor
```tsx
import { ZoneMapEditor } from '@/components/maps';
import type { MapZone } from '@/components/maps';

export default function ZonesPage() {
  const [zones, setZones] = useState<MapZone[]>([]);

  return (
    <ZoneMapEditor
      zones={zones}
      onZonesChange={setZones}
      onZoneSelect={(id) => console.log('Selected zone:', id)}
    />
  );
}
```

### Route Display
```tsx
import { RouteMapViewer } from '@/components/maps';
import type { DeliveryRoute } from '@/components/maps';

export default function RoutePage() {
  const route: DeliveryRoute = {
    id: 'route-1',
    driverId: 'driver-1',
    stops: [
      {
        id: 'stop-1',
        sequenceNumber: 1,
        address: '123 Main St',
        latitude: 37.7749,
        longitude: -122.4194,
        customerName: 'John Doe',
        status: 'pending',
      },
      // ... more stops
    ],
    status: 'planning',
  };

  return (
    <RouteMapViewer
      route={route}
      onStopClick={(stop) => console.log('Stop:', stop)}
    />
  );
}
```

### Heatmap
```tsx
import { DeliveryHeatmap } from '@/components/maps';
import type { HeatmapDataPoint } from '@/components/maps';

export default function HeatmapPage() {
  const dataPoints: HeatmapDataPoint[] = [
    { latitude: 37.7749, longitude: -122.4194, weight: 0.8 },
    { latitude: 37.7849, longitude: -122.4094, weight: 0.6 },
    // ... more points
  ];

  return (
    <DeliveryHeatmap
      dataPoints={dataPoints}
      mode="count"
      timeRange={{
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      }}
    />
  );
}
```

### Place Search
```tsx
import { PlaceSearch } from '@/components/maps';

export default function SearchPage() {
  return (
    <PlaceSearch
      onResultSelect={(place) => {
        console.log('Selected:', place.name);
        console.log('Distance:', place.distance, 'meters');
      }}
      mapCenter={{ lat: 37.7749, lng: -122.4194 }}
    />
  );
}
```

---

## 3. Configure Settings

Visit: `/dashboard/settings/maps`

- Set your API key
- Configure default map center
- Adjust default zoom (1-21)
- Select map style (standard, satellite, terrain)
- Toggle features (heatmap, drawing, traffic, transit, bicycling)

---

## 4. Import Types

```tsx
import type {
  MapZone,
  DeliveryRoute,
  RouteStop,
  PlaceDetails,
  HeatmapDataPoint,
  PlaceSearchResult,
  MapsSettings,
} from '@/components/maps';
```

---

## 5. Common Tasks

### Export Zones as GeoJSON
```tsx
const zones = [...];
const geojson = {
  type: 'FeatureCollection',
  features: zones.map(zone => ({
    type: 'Feature',
    properties: { name: zone.name, color: zone.color },
    geometry: {
      type: 'Polygon',
      coordinates: [zone.vertices.map(v => [v.lng, v.lat])],
    },
  })),
};
```

### Calculate Distance
```tsx
const distance = google.maps.geometry.spherical.computeDistanceBetween(
  new google.maps.LatLng(lat1, lng1),
  new google.maps.LatLng(lat2, lng2)
);
// Returns distance in meters
```

### Check Point in Zone
```tsx
const isInside = google.maps.geometry.poly.containsLocation(
  new google.maps.LatLng(lat, lng),
  polygon // google.maps.Polygon instance
);
```

---

## 6. Styling Customization

### Override Component Styles
```tsx
<AddressAutocomplete
  onSelect={handleSelect}
  className="w-full max-w-md shadow-xl"
/>
```

### Use Theme Colors
```tsx
// Available CSS variables
--wl-primary-500
--wl-primary-600
--wl-success-400
--wl-danger-400
--wl-warning-400
--wl-text-primary
--wl-text-secondary
--wl-bg-surface
--wl-bg-overlay
--wl-bg-elevated
--wl-border-default
```

### Button Variants
```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">More</Button>
<Button variant="danger">Delete</Button>
```

---

## 7. Testing

### Run Tests
```bash
npm run test
```

### Test a Component
```tsx
import { render, screen } from '@testing-library/react';
import { AddressAutocomplete } from '@/components/maps';
import { GoogleMapsProvider } from '@/components/maps';

test('renders address input', () => {
  render(
    <GoogleMapsProvider apiKey="test">
      <AddressAutocomplete onSelect={() => {}} />
    </GoogleMapsProvider>
  );

  expect(screen.getByRole('textbox')).toBeInTheDocument();
});
```

---

## 8. Troubleshooting

### "Maps API not loaded"
- Check API key in .env.local
- Ensure GoogleMapsProvider wraps your component
- Check browser console for script errors

### Places autocomplete not working
- Enable Places API in Google Cloud Console
- Check API key restrictions
- Verify key has enough quota

### Drawing tools not visible
- Ensure 'drawing' library in GoogleMapsProvider libraries prop
- Check CSS isn't hiding drawing controls
- Verify map initialization completed

### Performance issues
- Reduce number of heatmap data points
- Virtualize large zone lists
- Use clustering for many markers
- Monitor API quota usage

---

## 9. Documentation

Full Documentation:
- Component details: `/apps/dashboard/src/components/maps/README.md`
- Implementation guide: `/MAPS_IMPLEMENTATION_GUIDE.md`
- Completion checklist: `/MAPS_COMPLETION_CHECKLIST.md`

---

## 10. Support

### Next Steps
1. Copy API key from Google Cloud Console
2. Add to .env.local
3. Wrap app with GoogleMapsProvider
4. Start using components!

### Getting Help
- Check component README for detailed docs
- Review implementation guide for setup help
- Look at test files for usage examples
- Check TypeScript interfaces for prop details

---

## Key Files Reference

```
/apps/dashboard/src/components/maps/
├── google-maps-provider.tsx        # Provider
├── address-autocomplete.tsx         # Address input
├── zone-map-editor.tsx             # Zone drawing
├── route-map-viewer.tsx            # Route display
├── delivery-heatmap.tsx            # Heatmap
├── place-search.tsx                # Place search
├── types.ts                        # Types
└── index.ts                        # Exports

/apps/dashboard/src/app/(dashboard)/settings/maps/
└── page.tsx                        # Settings page
```

---

That's it! You're ready to use Google Maps in your Witylogix app.
