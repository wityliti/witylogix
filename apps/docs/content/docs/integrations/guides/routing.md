# Routing Integration Guide

Route optimization and navigation are critical for delivery performance. Witylogix supports 10 routing providers, from fully-managed cloud services to self-hosted open-source engines.

## Supported Providers

| Provider        | Type        | Best For           | Cost Model      | Coverage |
| --------------- | ----------- | ------------------ | --------------- | -------- |
| **Mapbox**      | Managed     | Scale + features   | Pay-per-request | Global   |
| **OSRM**        | Open source | Self-hosting       | Free            | Global   |
| **HERE Maps**   | Managed     | Enterprise         | Pay-per-request | Global   |
| **Valhalla**    | Open source | Self-hosting       | Free            | Global   |
| **VROOM**       | Open source | VRP solving        | Free            | Global   |
| **Routific**    | Managed     | AI optimization    | Monthly plan    | Global   |
| **OptimoRoute** | Managed     | Delivery platforms | Monthly plan    | Global   |
| **Route4Me**    | Managed     | Multi-stop routing | Pay-per-request | Global   |
| **GraphHopper** | Open source | Flexible routing   | Free + paid     | Global   |
| **TomTom**      | Managed     | Real-time traffic  | Pay-per-request | Global   |

## Setup by Provider

### Mapbox

**Best for**: Balanced feature set, production scale, real-time ETA.

#### 1. Get API Key

- Log in to [mapbox.com](https://mapbox.com)
- Create new access token under **Tokens**
- Copy public token (starts with `pk_`)

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "mapbox",
  credentials: {
    apiKey: "pk_YOUR_TOKEN_HERE",
  },
  config: {
    mode: "driving", // walking, cycling, driving
    includeTraffic: true, // real-time traffic costs extra
    alternatives: 2, // return alternate routes
    steps: true, // detailed turn-by-turn
    annotations: ["duration", "distance", "congestion"],
  },
});
```

#### 3. Test Route

```bash
curl https://api.mapbox.com/directions/v5/mapbox/driving/[lon],[lon];[lon],[lon] \
  ?access_token=pk_YOUR_TOKEN_HERE
```

### OSRM (Open Source)

**Best for**: Self-hosted, no external costs, full data privacy.

#### 1. Deploy OSRM Server

```bash
# Docker deployment
docker run -d --name osrm-backend \
  -p 5000:5000 \
  -v /data:/data \
  osrm/osrm-backend:v5.27
```

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "osrm",
  credentials: {
    url: "http://your-osrm-server:5000",
    apiKey: null, // OSRM doesn't require auth
  },
  config: {
    mode: "driving",
    includeTraffic: false, // OSRM doesn't include real traffic
    alternatives: 2,
  },
});
```

#### 3. Preprocess Map Data

```bash
# Extract your region's OSM data
osmium extract -b -75.5,40.0,-74.5,41.0 --complete-ways \
  planet-latest.osm.pbf -o northeast.osm.pbf

# Process with OSRM
osrm-extract northeast.osm.pbf -p /opt/osrm/profiles/car.lua
osrm-partition northeast.osrm
osrm-customize northeast.osrm
```

### HERE Maps

**Best for**: Enterprise scale, real-time traffic, comprehensive coverage.

#### 1. Get API Key

- Sign up at [developer.here.com](https://developer.here.com)
- Create **REST API Key** under Projects
- Copy the API key

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "here",
  credentials: {
    apiKey: "YOUR_HERE_API_KEY",
  },
  config: {
    mode: "fastest", // fastest, shortest
    traffic: "enabled", // historical or realtime
    alternatives: 3,
    returnInstructions: true,
    spans: true,
  },
});
```

### Valhalla

**Best for**: Open source, complex routing, isochrones.

#### 1. Deploy Valhalla

```bash
docker run -d --name valhalla \
  -p 8002:8002 \
  -v /data:/data \
  gisops/valhalla
```

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "valhalla",
  credentials: {
    url: "http://your-valhalla-server:8002",
  },
  config: {
    costing: "auto", // auto, pedestrian, bikeshare, taxi
    includeAlternates: true,
    steps: true,
  },
});
```

### VROOM (Vehicle Routing Optimization)

**Best for**: Complex VRP, multi-vehicle routing.

#### 1. Deploy VROOM Server

```bash
docker run -d --name vroom \
  -p 3000:3000 \
  jilles/vroom
```

#### 2. Configure Optimization

```javascript
const optimization = await client.routing.optimize({
  integration: "vroom",
  vehicles: [
    {
      id: "vehicle_1",
      start: [-74.006, 40.7128],
      end: [-74.006, 40.7128],
      capacity: 10,
    },
  ],
  jobs: [
    {
      id: "job_1",
      location: [-73.977, 40.757],
      duration: 300,
    },
  ],
});
```

### Routific

**Best for**: AI-powered optimization, managed service, white-label.

#### 1. Get API Key

- Log in to [routific.com](https://routific.com)
- Under **Account**, copy API token
- Enable OAuth if using white-label

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "routific",
  credentials: {
    apiKey: "YOUR_ROUTIFIC_API_KEY",
  },
  config: {
    optimizationLevel: 3, // 1-3, higher = slower but better
    vehicle: {
      maxDistance: 500, // km/day
      maxDuration: 28800, // seconds/day
      costPerKm: 0.5,
    },
  },
});
```

### OptimoRoute

**Best for**: Delivery-focused, mobile app, real-time tracking.

#### 1. Get API Key

- Log in to [optimoroute.com](https://optimoroute.com)
- Navigate to **Settings → API**
- Generate new token

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "optimoroute",
  credentials: {
    apiKey: "YOUR_OPTIMOROUTE_API_KEY",
  },
  config: {
    defaultVehicleCapacity: 50,
    defaultDrivingSpeed: 40, // km/h
    defaultBreakTime: 0,
  },
});
```

### Route4Me

**Best for**: Dynamic routing, live tracking, delivery proof.

#### 1. Get API Key

- Sign up at [route4me.com](https://route4me.com)
- Copy **API Key** from dashboard
- Note your **Member ID**

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "route4me",
  credentials: {
    apiKey: "YOUR_ROUTE4ME_API_KEY",
    memberId: "YOUR_MEMBER_ID",
  },
  config: {
    optimization: "distance", // time, distance, or none
    routePathOutput: "Points", // Points or Shapefile
  },
});
```

### GraphHopper

**Best for**: Flexible routing, custom profiles, open data.

#### 1. Get API Key

- Sign up at [graphhopper.com](https://graphhopper.com)
- Copy **API Key** from dashboard

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "graphhopper",
  credentials: {
    apiKey: "YOUR_GRAPHHOPPER_API_KEY",
  },
  config: {
    profile: "car", // car, foot, bike, hike, wheelchair
    locale: "en",
    customWeighting: false,
  },
});
```

### TomTom

**Best for**: Real-time traffic, global coverage, high-volume.

#### 1. Get API Key

- Create account at [tomtom.com/developers](https://developer.tomtom.com)
- Create **API Key** under your project
- Enable **Maps API** and **Routing API**

#### 2. Configure in Witylogix

```javascript
const routing = await client.integrations.create({
  provider: "tomtom",
  credentials: {
    apiKey: "YOUR_TOMTOM_API_KEY",
  },
  config: {
    traffic: "live", // none, historical, live
    routeType: "fastest", // fastest, shortest, eco
    vehicleType: "car",
  },
});
```

## Configuration Options

All routing integrations support common configuration:

```javascript
{
  // Basic options
  mode: "driving",                    // walking, cycling, driving
  alternatives: 2,                    // number of alternate routes
  steps: true,                        // include turn-by-turn
  annotations: ["duration", "distance"], // include metrics

  // Advanced options
  includeTraffic: true,              // real-time traffic
  avoidTolls: false,
  avoidHighways: false,
  avoidFerry: false,

  // Vehicle options
  vehicleType: "car",                // car, truck, motorcycle
  vehicleWeight: 2000,               // kg
  vehicleHeight: 2.5,                // m
  vehicleWidth: 2.0,                 // m
  vehicleLength: 6.0,                // m

  // Route preferences
  departureTime: "2024-03-16T14:00:00Z",
  language: "en",
  units: "metric",                   // metric or imperial
}
```

## Fallback Behavior

When your primary routing provider fails, Witylogix automatically falls back:

```
Request Route
  ↓
Try Mapbox API
  ↓ (Timeout/Error)
Fall back to Valhalla (if configured)
  ↓ (Timeout/Error)
Use cached route + straight line
  ↓ (No cache)
Return error to application
```

### Configure Fallback Chain

```javascript
const routing = await client.integrations.create({
  provider: "mapbox",
  credentials: { apiKey: "..." },
  fallback: {
    enabled: true,
    providers: ["here", "graphhopper", "osrm"],
    timeout: 5000, // ms before trying fallback
  },
});
```

## Cost Optimization

### Routing Quota Comparison

- **Mapbox**: $0.50 per 1,000 directions requests
- **HERE**: ~$0.90 per 1,000 requests
- **OSRM**: Free (self-hosted)
- **Google**: $5.00-10.00 per 1,000 requests
- **GraphHopper**: Free tier, then ~$0.50 per 1,000

### Cost Reduction Tips

1. **Batch requests** — Group multiple destinations per call
2. **Cache results** — Don't re-request identical routes
3. **Use alternatives sparingly** — Each alternative costs extra
4. **Disable traffic** for non-critical routes
5. **Self-host open source** providers for high volume

## Monitoring

```javascript
// Track routing costs and performance
const stats = await client.integrations.stats({
  id: "mapbox-prod",
  period: "month",
});

console.log(stats);
// {
//   requestsCount: 45200,
//   errorRate: 0.002,
//   avgLatency: 1230,  // ms
//   costEstimate: 22.60,
//   provider: "mapbox"
// }
```

## Troubleshooting

| Issue                    | Cause                | Solution                          |
| ------------------------ | -------------------- | --------------------------------- |
| Route too slow/expensive | Wrong provider       | Try faster provider like OSRM     |
| Inaccurate ETAs          | Traffic not included | Enable traffic in config          |
| Timeouts                 | Provider overloaded  | Increase timeout, add fallback    |
| No routes found          | Invalid coordinates  | Validate lat/lon format           |
| Wrong path               | Avoidance options    | Review toll/ferry/highway options |

## Next Steps

- [Configure integrations](/docs/integrations/OVERVIEW)
- [Setup telematics](/docs/integrations/guides/telematics)
- [View all integrations](/docs/integrations/catalog)
