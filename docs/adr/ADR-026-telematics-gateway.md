# ADR-026: Telematics Gateway Architecture

**Status**: Proposed
**Date**: 2026-03-11
**Authors**: Arjun (CTO)
**Decision Drivers**: ETA integration, fleet visibility, maintenance alerts, compliance reporting
**Context**: Witylogix needs to integrate with multiple telematics providers (Samsara, Geotab, Verizon, Motive) to enable real-time fleet visibility, predictive maintenance, and driver behavior monitoring.

## Problem Statement

Current fleet management lacks:

- Real-time vehicle position tracking and status visibility
- Predictive maintenance alerts based on diagnostics
- Driver behavior analytics (speeding, hard braking, harsh acceleration)
- Fuel consumption monitoring and optimization
- Multi-provider telematics support for customer flexibility
- Data consistency across different vendor APIs

We need a flexible, extensible architecture that normalizes data from heterogeneous telematics sources while maintaining high performance and reliability.

## Proposed Solution

### 1. Adapter Pattern for Provider Integration

Implement a **provider adapter abstraction layer** to support multiple telematics platforms:

```typescript
interface ITelematicsAdapter {
  // Provider metadata
  providerName: TelematicsProvider;
  apiVersion: string;

  // Vehicle lifecycle
  registerVehicle(vehicleInfo: VehicleRegistration): Promise<VehicleIdentifier>;
  deregisterVehicle(vehicleId: string): Promise<void>;

  // Real-time data
  getVehiclePosition(vehicleId: string): Promise<VehiclePosition>;
  getVehicleStatus(vehicleId: string): Promise<VehicleStatus>;
  getVehicleFuel(vehicleId: string): Promise<VehicleFuel>;
  getVehicleDiagnostics(vehicleId: string): Promise<VehicleDiagnostics>;
  getFleetVehicles(): Promise<Vehicle[]>;

  // Events and alerts
  subscribeToEvents(callback: EventCallback): void;
  unsubscribeFromEvents(): void;

  // Driver behavior
  getDriverBehavior(
    vehicleId: string,
    dateRange: DateRange,
  ): Promise<DriverBehaviorEvent[]>;

  // Polling state
  getLastSyncTime(vehicleId: string): Promise<Date | null>;
  setLastSyncTime(vehicleId: string, timestamp: Date): Promise<void>;
}
```

**Supported Providers**:

- **Samsara**: Real-time GPS, maintenance alerts, driver safety
- **Geotab**: Comprehensive diagnostics, fuel economy, harsh event detection
- **Verizon Connect**: Vehicle tracking, maintenance scheduling, compliance
- **Motive**: ETA integration, driver scoring, route optimization

### 2. Polling vs Webhook Strategies

#### Polling Strategy (Default)

Used for all providers to ensure consistency:

- **Interval**: 30-60 seconds for active vehicles
- **Batch Size**: Up to 100 vehicles per request
- **Exponential Backoff**: Failed requests retry with 2x backoff (max 5min)
- **Queue**: Bull job queue for distributed polling across workers
- **Priority**: Active vehicles polled more frequently than idle

```
Vehicle Status Loop:
┌─────────────────┐
│ Polling Queue   │
├─────────────────┤
│ Active Vehicles │─────────┐
│ (1 min interval)│         │
│                 │         ├──→ Adapter Layer ──→ Provider API
│ Idle Vehicles   │─────────┤
│ (5 min interval)│         │
│                 │         └──→ Prisma DB ──→ Cache (Redis)
└─────────────────┘
```

#### Webhook Strategy (Supplemental)

Used by Samsara/Geotab for critical alerts:

- **Route**: `POST /api/webhooks/telematics/:provider`
- **Signature Verification**: HMAC-SHA256 validation
- **Retry Logic**: Exponential backoff (3 attempts)
- **Dead Letter Queue**: Failed webhooks stored for manual review

**Events via Webhook**:

- Engine diagnostics (malfunction indicator light)
- Harsh driving events (speeding, hard brake, harsh accel)
- Collision detection
- Geofence violations
- Maintenance due alerts

### 3. Data Normalization Layer

All provider APIs return different data structures. Normalize to internal types:

```typescript
// Normalized Vehicle Position
interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  heading: number; // 0-360 degrees
  speed: number; // km/h
  accuracy: number; // meters
  timestamp: Date;
  providerData?: Record<string, any>; // Store raw provider data
}

// Normalized Vehicle Status
interface VehicleStatus {
  vehicleId: string;
  status: "ACTIVE" | "IDLE" | "OFFLINE" | "MAINTENANCE";
  engineRunning: boolean;
  lastPosition: VehiclePosition;
  battery: number; // 0-100 percent
  odometer: number; // kilometers
  hours: number; // operating hours
  faultCodes: DiagnosticCode[];
  timestamp: Date;
}

// Normalized Fuel Data
interface VehicleFuel {
  vehicleId: string;
  fuelLevel: number; // 0-100 percent
  fuelVolume: number; // liters
  fuelType: "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID";
  fuelEconomy: number; // km/liter
  range: number; // estimated km
  timestamp: Date;
}

// Normalized Diagnostics
interface VehicleDiagnostics {
  vehicleId: string;
  faultCodes: DiagnosticCode[];
  severity: "INFO" | "WARNING" | "CRITICAL";
  description: string;
  affectedSystems: string[];
  recommendedAction: string;
  firstSeenAt: Date;
  clearedAt?: Date;
}

// Normalized Driver Behavior
interface DriverBehaviorEvent {
  vehicleId: string;
  driverId?: string;
  eventType:
    | "SPEEDING"
    | "HARSH_BRAKE"
    | "HARSH_ACCEL"
    | "COLLISION"
    | "DISTRACTION";
  severity: 1 | 2 | 3 | 4 | 5; // 1=minor, 5=critical
  location: { latitude: number; longitude: number };
  speed: number;
  description: string;
  timestamp: Date;
  durationMs?: number;
}
```

### 4. Rate Limiting and Backpressure

Protect against API quota limits:

```typescript
interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize: number;
  providers: {
    [key in TelematicsProvider]: {
      requestsPerMinute: number;
      dailyLimit: number;
    };
  };
}

// Redis-based token bucket algorithm
class RateLimiter {
  async checkLimit(provider: string, count: number): Promise<boolean>;
  async consumeTokens(provider: string, count: number): Promise<void>;
  async getRemainingTokens(provider: string): Promise<number>;
}
```

**Provider Quotas** (typical):

- **Samsara**: 100 req/sec, 1M daily
- **Geotab**: 10 req/sec, unlimited daily
- **Verizon**: 500 req/sec, unlimited daily
- **Motive**: 20 req/sec, 10k daily

### 5. Caching Strategy with Redis

Multi-tier caching:

```typescript
// Tier 1: Hot cache (vehicle position, last sync)
// TTL: 30-60 seconds
// Key: `vehicle:{id}:position`, `vehicle:{id}:status`

// Tier 2: Warm cache (diagnostics, behavior, health)
// TTL: 5-15 minutes
// Key: `vehicle:{id}:diagnostics`, `fleet:health:score`

// Tier 3: Cold cache (historical analytics)
// TTL: 1-7 days
// Key: `analytics:vehicle:{id}:fuel_month`

interface CacheConfig {
  positions: { ttl: 60, compressed: true };
  status: { ttl: 60, compressed: false };
  diagnostics: { ttl: 300, compressed: true };
  behavior: { ttl: 600, compressed: true };
  fleetHealth: { ttl: 120, compressed: false };
}

// Cache invalidation on webhook events
onVehicleStatusChange(vehicle) {
  cache.del(`vehicle:${vehicle.id}:status`);
  cache.del(`vehicle:${vehicle.id}:position`);
  cache.del(`fleet:health:score`);
}
```

**Cache Hit Targets**:

- Dashboard position queries: >95% hit rate
- Fleet overview: >80% hit rate
- Historical analytics: 50-70% hit rate

### 6. Fleet Event Types

Classify and prioritize events for user notifications:

```typescript
type FleetEventType =
  | "VEHICLE_ONLINE"
  | "VEHICLE_OFFLINE"
  | "ENGINE_START"
  | "ENGINE_STOP"
  | "HARSH_ACCELERATION"
  | "HARSH_BRAKING"
  | "SPEEDING"
  | "COLLISION_DETECTED"
  | "GEOFENCE_ENTRY"
  | "GEOFENCE_EXIT"
  | "MAINTENANCE_ALERT"
  | "FAULT_CODE_DETECTED"
  | "LOW_FUEL"
  | "FUEL_THEFT"
  | "IDLING_ALERT"
  | "SEATBELT_VIOLATION"
  | "DISTRACTED_DRIVING";

interface FleetEvent {
  id: string;
  fleetId: string;
  vehicleId: string;
  eventType: FleetEventType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  data: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}
```

### 7. Security: API Key Rotation

Manage provider credentials securely:

```typescript
interface ProviderCredential {
  id: string;
  fleetId: string;
  provider: TelematicsProvider;
  apiKeyHash: string; // Hashed with bcrypt
  secretKeyHash: string;
  encryptedPrivateData: string; // Encrypted with --wl-secret
  status: "ACTIVE" | "ROTATED" | "REVOKED";
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

class CredentialRotationService {
  async rotateCredentials(provider: string, fleetId: string): Promise<void>;
  async validateCredential(credential: ProviderCredential): Promise<boolean>;
  async revokeExpiredCredentials(): Promise<number>;
  async auditCredentialUsage(daysBack: number): Promise<AuditLog[]>;
}
```

**Rotation Policy**:

- Automatic rotation every 90 days
- Manual rotation on security incidents
- Immediate revocation of leaked keys
- Audit trail of all rotations and usage

### 8. Prisma Schema Design

```prisma
// Fleet and Vehicle Models
model Fleet {
  id                    String    @id @default(cuid())
  shopId                String    @unique
  name                  String
  operatingRegion       String?   // Geographic region
  totalVehicles         Int       @default(0)
  activeVehicles        Int       @default(0)
  telematicsProviders   TelematicsProvider[] @default([])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  vehicles              Vehicle[]
  credentials           ProviderCredential[]
  healthMetrics         FleetHealthMetric[]
  events                FleetEvent[]

  @@index([shopId])
}

model Vehicle {
  id                    String    @id @default(cuid())
  fleetId               String
  fleet                 Fleet     @relation(fields: [fleetId], references: [id], onDelete: Cascade)

  // Vehicle identification
  make                  String
  model                 String
  year                  Int
  vin                   String    @unique
  licensePlate          String    @unique
  engineType            String    // "GASOLINE", "DIESEL", "EV", "HYBRID"

  // Telematics integration
  providerVehicleId     String?   // External provider ID
  primaryProvider       TelematicsProvider?

  // Status tracking
  status                VehicleStatus @default(OFFLINE)
  lastPosition          String?   // JSON-serialized VehiclePosition
  lastSyncAt            DateTime?
  odometer              Int       @default(0) // km
  engineHours           Int       @default(0)
  fuelLevel             Int       @default(0) // 0-100
  battery               Int       @default(100) // 0-100

  // Assignment
  driverId              String?
  driver                Driver?   @relation(fields: [driverId], references: [id])

  // Maintenance
  nextMaintenanceDate   DateTime?
  maintenanceAlerts     MaintenanceAlert[]
  diagnostics           VehicleDiagnostic[]

  // Business logic
  capacity              Int       // kg or cubic meters
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  behaviors             DriverBehaviorEvent[]
  fuelHistory           FuelConsumption[]
  events                FleetEvent[]

  @@index([fleetId])
  @@index([status])
  @@index([driverId])
  @@index([lastSyncAt])
}

model VehiclePosition {
  id                    String    @id @default(cuid())
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  latitude              Float
  longitude             Float
  heading               Int       // 0-360
  speed                 Int       // km/h
  accuracy              Int       // meters
  altitude              Int?      // meters

  timestamp             DateTime
  createdAt             DateTime  @default(now())

  @@index([vehicleId, timestamp])
  @@index([timestamp])
  @@spatial([latitude, longitude]) // PostGIS
}

model VehicleDiagnostic {
  id                    String    @id @default(cuid())
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  faultCode             String    // "P0101", etc.
  faultDescription      String
  severity              String    @default("WARNING") // INFO, WARNING, CRITICAL
  affectedSystems       String[]
  recommendedAction     String?

  firstSeenAt           DateTime
  clearedAt             DateTime?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([vehicleId])
  @@index([severity])
  @@index([firstSeenAt])
}

model DriverBehaviorEvent {
  id                    String    @id @default(cuid())
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  driverId              String?

  eventType             String    // SPEEDING, HARSH_BRAKE, etc.
  severity              Int       // 1-5
  location              String?   // JSON: {latitude, longitude}
  speed                 Int?      // km/h
  description           String
  durationMs            Int?

  timestamp             DateTime
  createdAt             DateTime  @default(now())

  @@index([vehicleId, timestamp])
  @@index([driverId])
  @@index([eventType])
}

model FuelConsumption {
  id                    String    @id @default(cuid())
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  fuelLevel             Int       // 0-100 percent
  fuelVolume            Float     // liters
  fuelEconomy           Float     // km/liter
  estimatedRange        Int       // km

  recordedAt            DateTime
  createdAt             DateTime  @default(now())

  @@index([vehicleId, recordedAt])
}

model MaintenanceAlert {
  id                    String    @id @default(cuid())
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  alertType             String    // "OIL_CHANGE", "TIRE_ROTATION", etc.
  dueDate               DateTime
  severity              String    @default("WARNING")
  estimatedCost         Float?
  notes                 String?

  isCompleted           Boolean   @default(false)
  completedAt           DateTime?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([vehicleId])
  @@index([dueDate])
}

model FleetHealthMetric {
  id                    String    @id @default(cuid())
  fleetId               String
  fleet                 Fleet     @relation(fields: [fleetId], references: [id], onDelete: Cascade)

  // Health indicators (0-100)
  overallScore          Int
  fuelEfficiency        Int
  driverSafety          Int
  maintenanceStatus     Int
  utilizationRate       Int

  totalVehicles         Int
  activeVehicles        Int
  idleVehicles          Int
  offlineVehicles       Int
  maintenanceVehicles   Int

  // Aggregates
  avgFuelEconomy        Float     // km/liter
  totalIdleHours        Int
  criticalAlerts        Int

  recordedAt            DateTime
  createdAt             DateTime  @default(now())

  @@index([fleetId, recordedAt])
  @@unique([fleetId, recordedAt])
}

model FleetEvent {
  id                    String    @id @default(cuid())
  fleetId               String
  fleet                 Fleet     @relation(fields: [fleetId], references: [id], onDelete: Cascade)
  vehicleId             String
  vehicle               Vehicle   @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  eventType             String    // VEHICLE_OFFLINE, HARSH_BRAKING, etc.
  severity              String    @default("INFO")
  data                  String    // JSON payload

  acknowledged          Boolean   @default(false)
  acknowledgedBy        String?
  acknowledgedAt        DateTime?

  timestamp             DateTime
  createdAt             DateTime  @default(now())

  @@index([fleetId, timestamp])
  @@index([vehicleId])
  @@index([eventType])
  @@index([acknowledged])
}

model ProviderCredential {
  id                    String    @id @default(cuid())
  fleetId               String
  fleet                 Fleet     @relation(fields: [fleetId], references: [id], onDelete: Cascade)

  provider              String    // "SAMSARA", "GEOTAB", etc.
  apiKeyHash            String    // bcrypt
  secretKeyHash         String?   // bcrypt
  encryptedPrivateData  String?   // AES-256-GCM

  status                String    @default("ACTIVE")
  createdAt             DateTime  @default(now())
  rotatedAt             DateTime?
  expiresAt             DateTime?
  lastUsedAt            DateTime?

  @@index([fleetId])
  @@index([status])
}

enum VehicleStatus {
  ACTIVE
  IDLE
  OFFLINE
  MAINTENANCE
}

enum TelematicsProvider {
  SAMSARA
  GEOTAB
  VERIZON
  MOTIVE
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Fleet Dashboard (Frontend)                   │
├─────────────────────────────────────────────────────────────────┤
│  Vehicle Cards │ Fleet Health Gauge │ Alerts │ Diagnostics │   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway & Routes                          │
├─────────────────────────────────────────────────────────────────┤
│  GET /fleet/overview    POST /fleet/vehicles                    │
│  GET /fleet/vehicles    PATCH /fleet/vehicles/:id               │
│  GET /fleet/health      Webhooks: /webhooks/telematics         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│           Fleet Service (Core Business Logic)                    │
├─────────────────────────────────────────────────────────────────┤
│ - registerVehicle()        - getFleetOverview()                 │
│ - getVehicleStatus()       - getVehicleDiagnostics()            │
│ - calculateFleetHealth()   - getDriverBehavior()                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────┬─────────────────────┬────────────────────┐
│ Rate Limiter         │ Cache (Redis)       │ Event Bus          │
│ (Token Bucket)       │ Hot: Positions      │ (Webhook Events)   │
│                      │ Warm: Diagnostics   │                    │
│                      │ Cold: Analytics     │                    │
└──────────────────────┴──────────┬──────────┴──────────┬─────────┘
                                  │                     │
             ┌────────────────────┴─────────────────────┴──────┐
             ▼                     ▼                           ▼
       ┌────────────┐        ┌───────────┐          ┌──────────────┐
       │  Prisma    │        │ Adapters  │          │Polling Queue │
       │   (DB)     │        │ Layer     │          │   (Bull)     │
       │ Vehicle    │        ├───────────┤          └──────────────┘
       │ Position   │        │ Samsara   │                  │
       │ Diagnostic │        │ Geotab    │                  ▼
       │ Events     │        │ Verizon   │          ┌──────────────┐
       │ Health     │        │ Motive    │          │Telematics    │
       └────────────┘        └─────┬─────┘          │  Providers   │
                                   │                │  APIs        │
                                   ▼                └──────────────┘
                            ┌──────────────┐
                            │ Normalization│
                            │ Layer        │
                            └──────────────┘
```

## Adoption Plan

### Phase 1: Core Infrastructure (Week 1-2)

- Implement adapter interface and base adapter class
- Create Prisma schema for fleet/vehicle models
- Build rate limiter and cache layer
- Implement polling queue

### Phase 2: Provider Adapters (Week 3-4)

- Samsara adapter (comprehensive)
- Geotab adapter (diagnostics-focused)
- Motive adapter (ETA-focused)
- Verizon adapter (optional for Q2)

### Phase 3: API & Dashboard (Week 5-6)

- Fleet service implementation
- API endpoints for vehicle listing, status, diagnostics
- Dashboard pages and components
- Webhook ingestion for critical alerts

### Phase 4: Advanced Features (Week 7-8)

- Driver behavior analytics
- Maintenance scheduling algorithms
- Fleet health scoring
- Real-time WebSocket updates

## Trade-offs & Decisions

| Aspect                 | Choice               | Rationale                                               |
| ---------------------- | -------------------- | ------------------------------------------------------- |
| **Polling**            | Default strategy     | Consistency across providers; simplifies error handling |
| **Caching**            | Redis multi-tier     | 95%+ cache hit for dashboards; cost-effective           |
| **Normalization**      | Custom types         | Provider-agnostic; future-proof for new providers       |
| **Rate Limiting**      | Token bucket         | Fair-share; handles burst traffic gracefully            |
| **Credential Storage** | Encrypted at-rest    | PCI compliance; key rotation enabled                    |
| **Schema Design**      | Denormalized metrics | Fast dashboard queries; trade-off with write complexity |

## Monitoring & Observability

```typescript
// Metrics to track
- Provider API latency (p50, p95, p99)
- Cache hit/miss rate
- Polling success rate per provider
- Data staleness (last sync gap)
- Error rates by provider and error type
- Queue depth and job duration
- Fleet health score trend
```

**Alerts**:

- Provider API unavailable >5min
- Polling queue backlog >1000 jobs
- Cache error rate >1%
- Data staleness >10min for active vehicles
- Critical vehicle offline >15min

## Testing Strategy

- **Unit Tests**: Adapter interfaces, normalization logic
- **Integration Tests**: Polling loop, cache invalidation
- **Contract Tests**: Mock provider APIs
- **Load Tests**: 10k+ vehicles, concurrent polling
- **Chaos Tests**: Provider API failures, network degradation

## Future Enhancements

1. **Real-time WebSocket**: Replace polling for active dashboard users
2. **Machine Learning**: Predictive maintenance scoring
3. **Mobile App**: Driver-facing app with ETA, safety alerts
4. **Analytics Engine**: Fuel, safety, utilization trends
5. **Custom Integrations**: Allow customers to plug in custom adapters
6. **Blockchain**: Immutable audit trail for compliance
