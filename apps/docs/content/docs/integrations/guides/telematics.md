# Telematics Integration Guide

Telematics platforms provide real-time GPS tracking, vehicle diagnostics, driver behavior monitoring, and maintenance management. Witylogix supports 14 telematics providers, from enterprise IoT platforms to specialized GPS tracking services.

## Supported Providers

| Provider             | Focus              | Best For             | Cost      |
| -------------------- | ------------------ | -------------------- | --------- |
| **Samsara**          | IoT + Safety       | Enterprise fleets    | $500+/mo  |
| **Geotab**           | Connected vehicles | Telematics data      | $200+/mo  |
| **Motive**           | AI + Operations    | Driver safety        | $400+/mo  |
| **Verizon Connect**  | Telecom-backed     | Comprehensive mgmt   | $300+/mo  |
| **Flespi**           | Data aggregation   | Multi-device         | $50+/mo   |
| **Fleetio**          | Maintenance        | Service scheduling   | $200+/mo  |
| **Trimble**          | Enterprise         | Complex logistics    | $1000+/mo |
| **Powerfleet**       | IoT Intelligence   | Asset monitoring     | $300+/mo  |
| **Azuga**            | Analytics          | Driver behavior      | $150+/mo  |
| **Omnitracs**        | ELD Compliance     | Regulatory           | $200+/mo  |
| **Platform Science** | Smart TMS          | Dispatch integration | $400+/mo  |
| **ClearPath GPS**    | Budget tracking    | SMB fleets           | $50+/mo   |
| **One Step GPS**     | Simple tracking    | Vehicle monitoring   | $30+/mo   |
| **Titan GPS**        | Real-time          | Fleet basics         | $40+/mo   |

## Setup by Provider

### Samsara

**Best for**: Enterprise fleets, safety compliance, insurance partnerships.

#### 1. Get API Key

- Log in to [samsara.com](https://samsara.com)
- Navigate to **Settings → API Keys**
- Generate new API key with appropriate scopes

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "samsara",
  credentials: {
    apiKey: "YOUR_SAMSARA_API_KEY",
  },
  config: {
    syncInterval: 60, // seconds between location updates
    dataCategories: [
      "locations",
      "driverBehavior",
      "vehicleHealth",
      "safetyEvents",
    ],
    webhookUrl: "https://your-api.com/webhooks/samsara",
  },
});
```

#### 3. Data Mapping

```javascript
// Samsara → Witylogix mapping
const mapping = {
  location: {
    samsara: "drivers[].location",
    witylogix: "coordinates",
  },
  speed: {
    samsara: "drivers[].speed",
    witylogix: "speed",
  },
  heading: {
    samsara: "drivers[].heading",
    witylogix: "heading",
  },
  safetyEvent: {
    samsara: "safetyEvents[].type",
    witylogix: "driverBehavior.event",
  },
};
```

### Geotab

**Best for**: Detailed telematics data, open API, flexible integration.

#### 1. Get Credentials

- Sign up at [geotab.com](https://geotab.com)
- Navigate to **Settings → API**
- Create database and user account
- Get your database server URL

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "geotab",
  credentials: {
    username: "your-email@company.com",
    password: "your-geotab-password",
    database: "your-company",
    server: "https://my1234.geotab.com",
  },
  config: {
    syncInterval: 30,
    dataCategories: ["gpsData", "diagnostics", "driverSafety", "faultCodes"],
  },
});
```

#### 3. Polling Configuration

```javascript
// Geotab uses polling; configure intervals
const polling = {
  locations: 30, // seconds
  diagnostics: 60, // seconds
  faults: 120, // seconds
  maxRetries: 3,
  retryDelay: 5000, // ms
};
```

### Motive

**Best for**: AI-powered driver coaching, fleet operations, insurance integration.

#### 1. Get API Key

- Log in to [motive.com](https://motive.com)
- Settings → **Integrations → API Keys**
- Generate new API key with required scopes

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "motive",
  credentials: {
    apiKey: "YOUR_MOTIVE_API_KEY",
    accountId: "YOUR_ACCOUNT_ID",
  },
  config: {
    syncInterval: 60,
    features: {
      realtimeTracking: true,
      driverCoaching: true,
      vehicleHealth: true,
      incidents: true,
      safetyEvents: true,
    },
  },
});
```

#### 3. Event Subscriptions

```javascript
// Subscribe to specific events
const events = [
  "location.updated", // Real-time GPS
  "driverIncident.detected", // Safety events
  "vehicle.diagnostic.alert", // Vehicle health
  "trip.completed", // Trip summary
];
```

### Verizon Connect

**Best for**: Carrier-backed reliability, comprehensive platform.

#### 1. Get API Credentials

- Log in to [verizonconnect.com](https://verizonconnect.com)
- Admin → **API Credentials**
- Create new API user with required permissions

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "verizonConnect",
  credentials: {
    apiUsername: "your-api-user",
    apiPassword: "your-api-password",
    accountId: "YOUR_ACCOUNT_ID",
  },
  config: {
    syncInterval: 60,
    dataTypes: ["realtime", "historical", "diagnostics", "maintenance"],
  },
});
```

### Flespi

**Best for**: Device-agnostic, multi-protocol, IoT aggregation.

#### 1. Get API Token

- Sign up at [flespi.com](https://flespi.com)
- **Accounts → API Tokens**
- Create new token with storage and streaming scopes

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "flespi",
  credentials: {
    apiToken: "YOUR_FLESPI_API_TOKEN",
  },
  config: {
    deviceFilter: {
      tags: ["witylogix", "production"],
    },
    telemetryFields: [
      "position.latitude",
      "position.longitude",
      "position.speed",
      "position.heading",
      "engine.rpm",
      "system.voltage",
    ],
  },
});
```

#### 3. Stream Configuration

```javascript
// Flespi supports real-time streaming
const stream = {
  protocol: "MQTT",
  topic: "flespi/gps/+/data",
  qos: 1,
  reconnectInterval: 5000,
};
```

### Fleetio

**Best for**: Maintenance tracking, service scheduling, fuel management.

#### 1. Get API Key

- Log in to [fleetio.com](https://fleetio.com)
- Account → **API**
- Generate new API key

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "fleetio",
  credentials: {
    apiKey: "YOUR_FLEETIO_API_KEY",
    accountToken: "YOUR_ACCOUNT_TOKEN",
  },
  config: {
    syncInterval: 3600, // Maintenance-focused, less frequent
    dataCategories: [
      "fuelEconomy",
      "maintenanceRecords",
      "scheduleItems",
      "serviceReminders",
    ],
  },
});
```

### Trimble Transportation

**Best for**: Enterprise transportation, complex compliance, advanced routing.

#### 1. Get API Credentials

- Log in to Trimble Transportation Management
- **Admin → API Integrations**
- Create new API client

#### 2. Configure in Witylogix

```javascript
const telematics = await client.integrations.create({
  provider: "trimble",
  credentials: {
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    customerId: "YOUR_CUSTOMER_ID",
  },
  config: {
    syncInterval: 60,
    modules: ["tracking", "routing", "compliance", "fleet"],
  },
});
```

### Platform Science

**Best for**: Telematics + dispatch integration, AI-powered coaching.

#### 1. Get OAuth Credentials

- Register at [platformscience.com](https://platformscience.com)
- **Developer Portal → Applications**
- Create OAuth application

#### 2. Configure OAuth Flow

```javascript
const oauth = {
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
  redirectUri: "https://your-api.com/auth/callback",
  scope: "telematics dispatch",
};
```

### Simpler Providers (ClearPath, One Step, Titan)

**Best for**: Budget tracking, basic fleet operations.

#### Setup Template

```javascript
const telematics = await client.integrations.create({
  provider: "clearpathgps|onestepgps|titangps",
  credentials: {
    username: "your-username",
    password: "your-password",
    // or
    apiKey: "YOUR_API_KEY",
  },
  config: {
    syncInterval: 300, // 5 minutes
    dataCategories: ["locations", "alerts"],
  },
});
```

## Data Mapping

### Standard Location Data

All providers map to Witylogix location schema:

```javascript
const locationMapping = {
  latitude: "coords.lat",
  longitude: "coords.lng",
  altitude: "coords.altitude",
  speed: "motion.speed",
  heading: "motion.heading",
  accuracy: "quality.accuracy",
  timestamp: "timestamp",
  satelliteCount: "quality.satellites",
};
```

### Driver Behavior Events

```javascript
const driverEventMapping = {
  hard_acceleration: "safetyEvent.type",
  hard_braking: "safetyEvent.type",
  harsh_cornering: "safetyEvent.type",
  excessive_speeding: "safetyEvent.type",
  seat_belt_violation: "complianceEvent.type",
  phone_usage: "distractionEvent.type",
};
```

### Vehicle Diagnostics

```javascript
const diagnosticsMapping = {
  engine_hours: "vehicle.engineHours",
  odometer: "vehicle.mileage",
  fuel_level: "vehicle.fuel",
  battery_voltage: "vehicle.voltage",
  engine_temperature: "vehicle.temperature",
  dtc_fault_codes: "vehicle.faults",
};
```

## Polling Intervals

Configure how often data is synced from providers:

```javascript
const pollingConfig = {
  realtime: {
    interval: 30, // seconds
    priority: "high",
    dataTypes: ["location", "speed", "heading"],
  },
  behavioral: {
    interval: 60,
    priority: "medium",
    dataTypes: ["safetyEvents", "driverBehavior"],
  },
  diagnostic: {
    interval: 300, // 5 minutes
    priority: "low",
    dataTypes: ["fuelLevel", "temperature", "faults"],
  },
};
```

## Health Monitoring

### Connection Status

```javascript
const health = await client.integrations.health({
  id: "samsara-prod",
});

// {
//   status: "connected",
//   lastSync: "2024-03-16T14:23:45Z",
//   syncDelay: 12,  // seconds
//   errorRate: 0.002,
//   nextSync: "2024-03-16T14:24:45Z",
// }
```

### Alert Thresholds

```javascript
{
  syncFailureThreshold: 3,      // fail after 3 errors
  syncDelayWarning: 300,        // seconds over 5 min
  connectionDropThreshold: 5,   // minutes
}
```

## Best Practices

1. **Use polling intervals appropriate to your use case**
   - Real-time tracking: 30-60 seconds
   - Behavioral monitoring: 60 seconds
   - Diagnostics: 5+ minutes

2. **Implement local caching**
   - Cache location data to reduce API calls
   - Only update when position changes >50m

3. **Monitor provider API quota**
   - Some providers limit requests per hour
   - Track your usage to avoid overages

4. **Dedup events in application**
   - Telematics data can be duplicated
   - Use timestamp + driver ID as dedup key

5. **Secure credentials**
   - Store API keys in environment variables
   - Rotate credentials quarterly
   - Never log credentials

## Troubleshooting

| Issue                 | Cause                   | Solution                    |
| --------------------- | ----------------------- | --------------------------- |
| Stale locations       | Polling too infrequent  | Increase sync frequency     |
| API quota exceeded    | Too many requests       | Reduce polling interval     |
| Missing safety events | Event filter too strict | Review event subscriptions  |
| Authentication fails  | Token expired           | Refresh/rotate credentials  |
| Data inconsistency    | Race condition          | Use timestamps for ordering |

## Next Steps

- [Configure integrations](/docs/integrations/OVERVIEW)
- [Setup routing](/docs/integrations/guides/routing)
- [View all integrations](/docs/integrations/catalog)
