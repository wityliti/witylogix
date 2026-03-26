# Google Maps Native UI Components

Complete suite of Google Maps components for the Witylogix delivery management platform. Built with React, Tailwind CSS v3.4, and TypeScript.

## Components

### 1. GoogleMapsProvider

Context provider that lazy-loads the Google Maps JavaScript API and makes it available to all child components.

```tsx
import { GoogleMapsProvider } from '@/components/maps';

export default function App() {
  return (
    <GoogleMapsProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <YourMapComponent />
    </GoogleMapsProvider>
  );
}
```

**Props:**
- `apiKey` (string): Google Maps API key
- `libraries` (array): Additional Google Maps libraries to load (`'places'`, `'drawing'`, `'visualization'`, `'geometry'`)
- `children` (ReactNode): Child components

**Hook:**
```tsx
const { isLoaded, isLoadingScript, google, error } = useGoogleMaps();
```

---

### 2. AddressAutocomplete

Google Places Autocomplete input with keyboard navigation and place details.

```tsx
import { AddressAutocomplete } from '@/components/maps';

export default function CheckoutForm() {
  const handleAddressSelect = (place) => {
    console.log(`Selected: ${place.formattedAddress}`);
    console.log(`Coordinates: ${place.latitude}, ${place.longitude}`);
  };

  return (
    <AddressAutocomplete
      onSelect={handleAddressSelect}
      placeholder="Enter delivery address"
      countryFilter={['US']}
      debounceMs={300}
    />
  );
}
```

**Features:**
- Debounced search (configurable)
- Keyboard navigation (arrow keys, Enter to select, Escape to close)
- Place details retrieval (address components, coordinates, viewport)
- Country and type filtering
- Clear button and loading indicator
- Selected address display with coordinates

**Props:**
- `onSelect` (function): Callback when place is selected
- `onInputChange` (function): Called on input change
- `defaultValue` (string): Default input value
- `placeholder` (string): Input placeholder
- `countryFilter` (string[]): ISO country codes to filter by
- `types` (string[]): Google Places types to filter
- `disabled` (boolean): Disable input
- `debounceMs` (number): Debounce delay in milliseconds (default: 300)

---

### 3. ZoneMapEditor

Interactive Google Maps editor for creating and managing delivery zones with drawing tools.

```tsx
import { ZoneMapEditor } from '@/components/maps';

export default function ZonesManagement() {
  const [zones, setZones] = useState([]);

  return (
    <ZoneMapEditor
      zones={zones}
      onZonesChange={setZones}
      onZoneSelect={(zoneId) => console.log('Selected:', zoneId)}
      defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
      defaultZoom={12}
    />
  );
}
```

**Features:**
- Draw polygons and rectangles
- Edit existing zones (drag vertices)
- Color picker with 12 presets
- Zone list sidebar
- Undo/redo functionality
- Zone overlap detection
- Import zones from GeoJSON
- Export zones as GeoJSON
- Rate per zone configuration

**Props:**
- `zones` (MapZone[]): Array of zones
- `onZonesChange` (function): Callback when zones change
- `onZoneSelect` (function): Called when zone is selected
- `defaultCenter` (object): Default map center `{ lat, lng }`
- `defaultZoom` (number): Default zoom level (default: 12)
- `readOnly` (boolean): Disable editing
- `className` (string): Additional CSS classes

---

### 4. RouteMapViewer

Display delivery routes with stops, markers, and polylines.

```tsx
import { RouteMapViewer } from '@/components/maps';

export default function RoutePage() {
  const route = {
    id: 'route-123',
    driverId: 'driver-456',
    stops: [
      {
        id: 'stop-1',
        sequenceNumber: 1,
        address: '123 Main St',
        latitude: 37.7749,
        longitude: -122.4194,
        customerName: 'John Doe',
        status: 'completed',
      },
      // More stops...
    ],
    currentLocation: { lat: 37.775, lng: -122.419, timestamp: new Date().toISOString() },
  };

  return (
    <RouteMapViewer
      route={route}
      onStopClick={(stop) => console.log('Stop clicked:', stop)}
      showActualRoute={true}
    />
  );
}
```

**Features:**
- Display planned and actual routes
- Numbered stop markers with status colors
- Current driver location marker
- Info windows on marker click
- Route summary panel (distance, time, stops count)
- Toggle between planned/actual routes
- Fit bounds to full route
- Status badges for each stop

**Props:**
- `route` (DeliveryRoute): Route object
- `onStopClick` (function): Called when stop marker is clicked
- `showActualRoute` (boolean): Show actual GPS trace (default: false)
- `defaultCenter` (object): Map center override
- `defaultZoom` (number): Default zoom level (default: 12)

---

### 5. DeliveryHeatmap

Visualize delivery density and patterns with Google Maps heatmap layer.

```tsx
import { DeliveryHeatmap } from '@/components/maps';

export default function HeatmapPage() {
  const [dataPoints, setDataPoints] = useState([]);

  return (
    <DeliveryHeatmap
      dataPoints={dataPoints}
      mode="count"
      timeRange={{ start: new Date().toISOString(), end: new Date().toISOString() }}
      onTimeRangeChange={(range) => console.log('Time range:', range)}
      showStats={true}
    />
  );
}
```

**Features:**
- Heatmap layer visualization
- Multiple modes: delivery count, delivery time, failed deliveries
- Time range selector (today, this week, this month, custom)
- Gradient legend
- Performance statistics overlay
- Peak density detection
- Cluster analysis

**Props:**
- `dataPoints` (HeatmapDataPoint[]): Array of delivery points
- `mode` (string): 'count' | 'time' | 'failures'
- `timeRange` (object): `{ start: ISO string, end: ISO string }`
- `onTimeRangeChange` (function): Called when time range changes
- `showStats` (boolean): Show statistics overlay (default: true)
- `defaultCenter` (object): Map center

---

### 6. PlaceSearch

Search for places near a map center with category filtering.

```tsx
import { PlaceSearch } from '@/components/maps';

export default function SearchPage() {
  const handleSelectResult = (place) => {
    console.log(`Selected place: ${place.name}`);
    console.log(`Distance: ${place.distance}m`);
  };

  return (
    <PlaceSearch
      onResultSelect={handleSelectResult}
      categoryFilter="establishments"
      mapCenter={{ lat: 37.7749, lng: -122.4194 }}
      searchRadius={5000}
      showRecentSearches={true}
    />
  );
}
```

**Features:**
- Text search with Google Places
- Category filtering (addresses, establishments, geocodes)
- Distance calculation from map center
- Recent searches history (localStorage)
- Distance formatting
- Loading indicator
- Result limit (10 results)

**Props:**
- `onResultSelect` (function): Called when place is selected
- `categoryFilter` (string): Filter type
- `mapCenter` (object): Center for distance calculation
- `searchRadius` (number): Search radius in meters (default: 5000)
- `showRecentSearches` (boolean): Show recent searches (default: true)

---

## Setup

### 1. Install Dependencies

```bash
npm install @google/maps
```

### 2. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 3. Wrap Application with Provider

```tsx
// app/layout.tsx
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

## Type Definitions

All components are fully typed with TypeScript. Import types for your own components:

```tsx
import type {
  MapZone,
  DeliveryRoute,
  RouteStop,
  PlaceDetails,
  MapsSettings,
} from '@/components/maps';
```

---

## Styling

All components use:
- **Tailwind CSS v3.4** for styling
- **CSS Variables** (`--wl-*`) for theme colors
- **Dark theme** by default
- **cn()** utility from `@/lib/utils` for class merging

### Customization

Override default styles:

```tsx
<AddressAutocomplete
  onSelect={handleSelect}
  className="w-full max-w-md"
/>
```

---

## Google Maps Settings Page

Configure API key and feature toggles at:

```
/dashboard/settings/maps
```

Features:
- API key configuration with validation
- Connection testing
- Default map center and zoom
- Map style selection
- Feature toggles (heatmap, drawing, traffic, etc.)
- Settings persistence

---

## Testing

Test files include:
- `address-autocomplete.test.tsx` - Input, predictions, keyboard nav
- `zone-map-editor.test.tsx` - Zone CRUD, import/export, undo/redo

Run tests:

```bash
npm run test
```

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

---

## Performance Considerations

1. **Lazy Loading**: Google Maps script is loaded on demand
2. **Debouncing**: Autocomplete search is debounced by 300ms
3. **Caching**: Place predictions are cached
4. **Memoization**: Components use React.memo where appropriate
5. **Error Boundaries**: Graceful degradation on API failures

---

## Common Issues

### API Key Not Working

Ensure:
- Key has Maps JavaScript API enabled
- Key is not restricted by IP/domain
- Key is for the correct Google Cloud project

### Script Already Loaded

The provider checks if the script is already loaded and reuses it:

```tsx
if (window.google?.maps) {
  // Script already loaded
}
```

### Type Errors

Ensure `google` is properly typed:

```tsx
declare global {
  interface Window {
    google?: typeof google;
  }
}
```

---

## Future Enhancements

- Directions API integration
- Distance Matrix queries
- Geocoding reverse lookup
- Elevation data
- Time zone lookups
- Real-time traffic/transit data
- Street View integration
- Custom marker clustering
- Advanced styling options

---

## License

Part of the Witylogix platform. All rights reserved.
