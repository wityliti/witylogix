# Sprint 2.5 Implementation Notes

## Files Created

### 1. Migration Framework (3 files)

#### `packages/core/src/migration/mongodb-adapter.ts` (319 lines)
- **Purpose:** MongoDB connection pooling, document streaming, type conversion
- **Key exports:** `MongoDBAdapter` class
- **Dependencies:** `mongodb` (dynamic import)
- **Key methods:**
  - `connect()` / `disconnect()` - Lifecycle management
  - `query()` / `batchRead()` - Async iterators for memory efficiency
  - `findOne()` / `count()` - Single document access
  - `getStats()` - Collection metrics
  - `dropCollection()` - Rollback support
- **Type conversions implemented:**
  - ObjectId → string (handles native, $oid format, _id references)
  - Date → ISO 8601 string
  - Nested objects → JSON (recursive)
  - Undefined → null (PostgreSQL compatibility)

#### `packages/core/src/migration/transformers.ts` (332 lines)
- **Purpose:** Entity-specific data transformers for each collection
- **Key exports:** 7 transform functions + transformers object
- **Transformers:**
  - `transformOrder()` - Shopify order → Order entity
  - `transformShipment()` - Shipment document transformation
  - `transformDriver()` - Driver record with verification tracking
  - `transformCustomer()` - Customer with address normalization
  - `transformProduct()` - Product catalog with SKU/barcode
  - `transformZone()` - Delivery zone with rate configuration
  - `transformRoute()` - Route with waypoint transformation
- **Helper functions:**
  - `transformAddress()` - Standardizes address format
  - `transformLineItems()` - Order line item processing
  - `transformOrderStatus()` - Enum conversions (status mappings)
- **Features:**
  - Graceful null/undefined handling
  - Type coercion (parseFloat, parseInt, toString)
  - Relation ID resolution (ObjectId → string)
  - Default values for missing fields
  - No exceptions thrown (defensive)

#### `packages/core/src/migration/migration-runner-v2.ts` (436 lines)
- **Purpose:** Orchestrate migrations with idempotency, checkpointing, progress tracking
- **Key exports:** `MigrationRunnerV2` class
- **Features:**
  - **Idempotent upsert:** Check exists + update on conflict (no duplicates)
  - **Dry-run mode:** Test without writing
  - **Progress tracking:** Real-time updates every 50 records
  - **ETA calculation:** Based on processing rate
  - **Checkpoint system:** Save/load for resumability
  - **Error logging:** Document-level errors with skippable rows
  - **Rollback support:** Track inserted IDs for reversal
  - **Console reporting:** Beautiful formatted migration report
- **Key methods:**
  - `run()` - Main migration orchestration
  - `migrateCollectionIdempotent()` - Per-collection upsert
  - `calculateETA()` - ETA prediction
  - `getCheckpoint()` / `loadCheckpoints()` / `saveCheckpoints()` - Resumability
  - `rollback()` - Cleanup on failure
  - `printReport()` - Formatted console output
- **Configuration:**
  - `batchSize` - Records per batch (default 100)
  - `dryRun` - Test mode (default false)
  - `validateBeforeMigration` - Schema validation (default true)
  - `stopOnError` - Halt on first error (default false)

### 2. Location/Warehouse Management (2 files)

#### `packages/db/prisma/schema/32-locations-v2.prisma` (112 lines)
- **Purpose:** Schema extensions for PostGIS-ready location management
- **New models:**
  - `LocationWorkingHours` - Day-based operating hours (7 rows per location)
  - `LocationCapacity` - Warehouse capacity tracking (1:1 with location)
  - `LocationZoneLink` - Multi-zone association with priority
- **Key indexes:**
  - `LocationWorkingHours: unique(locationId, dayOfWeek)`
  - `LocationZoneLink: unique(locationId, zoneId)`
- **Cascade delete:** Working hours and zone links auto-delete with location
- **Location model extensions** (to apply via migration):
  - `latitude` / `longitude` (Float, PostGIS-ready)
  - `allowPickup` / `allowDelivery` (Boolean, service flags)
  - `maxPickupHour` / `minDeliveryDay` (Int, service constraints)
  - `serviceLevel` (String: standard/premium/express)
  - Relations: workingHours, capacity, zones

#### `apps/api/src/routes/locations-v2.ts` (715 lines)
- **Purpose:** RESTful API for location management with PostGIS-ready features
- **Key endpoints:** 13 routes
- **Route structure:**
  - `GET /` - List locations (paginated, filterable, searchable)
  - `GET /:id` - Single location + working hours + capacity + zones
  - `POST /` - Create location with working hours and capacity
  - `PATCH /:id` - Partial update
  - `DELETE /:id` - Soft deactivate
  - `GET /:id/hours` - Get working hours
  - `POST /:id/hours` - Set working hours (replaces all)
  - `GET /:id/capacity` - Get capacity with utilization
  - `PATCH /:id/capacity` - Update capacity slots
  - `GET /:id/zones` - List zone associations
  - `POST /:id/zones` - Add zone link
  - `DELETE /:id/zones/:zoneId` - Remove zone link
  - `GET /nearest` - Find nearest locations (haversine distance)
- **Validation schemas (Zod):**
  - `createLocationSchema` - Full location creation
  - `updateLocationSchema` - Partial updates
  - `workingHoursSchema` - Weekly hours
  - `capacityUpdateSchema` - Capacity modifications
  - `zoneAssociationSchema` - Zone linking
  - `nearestLocationSchema` - Distance query
- **Distance calculation:**
  - Haversine formula in SQL (no PostGIS required yet)
  - Supports 50+ km radius queries
  - Order by distance ascending
- **Query features:**
  - Full-text search on name/address/city
  - Filter by location type
  - Filter by service flags (allowPickup, allowDelivery)
  - Pagination (page, limit)
  - Sorting options
- **Database operations:**
  - Raw SQL for performance (Haversine calculation)
  - Proper UUID handling
  - JSON field serialization
  - Unique constraints for data integrity

### 3. Updates to Existing Files

#### `packages/core/package.json`
- **Added exports:**
  - `"./migration/mongodb-adapter": "./src/migration/mongodb-adapter.ts"`
  - `"./migration/transformers": "./src/migration/transformers.ts"`
  - `"./migration/migration-runner-v2": "./src/migration/migration-runner-v2.ts"`

#### `packages/core/src/migration/index.ts`
- **Added exports:**
  - `MigrationRunnerV2` class
  - `MongoDBAdapter` class
  - Individual transformer functions (transformOrder, etc.)
  - `transformers` object (all transformers)
- **Updated default export** to include new utilities

### 4. Documentation (2 files)

#### `SPRINT_2_5_COMPLETION.md` (comprehensive guide)
- 600+ line full documentation
- Architecture principles and design decisions
- Complete API reference with examples
- Performance characteristics
- Testing checklist
- Deployment guide
- Troubleshooting section

#### `MIGRATION_QUICKSTART.md` (quick reference)
- Quick start guide for developers
- Common use cases and examples
- MongoDB adapter usage
- Location API usage
- Performance tips
- Troubleshooting section

---

## System Design Decisions

### 1. Idempotent Migration Pattern
**Decision:** Use check-exists + update on conflict instead of insert-ignore
**Rationale:**
- Ensures data consistency (updates existing records)
- Safe to resume without duplicating data
- Clear separation: `processed` vs `skipped` metrics

**Implementation:**
```typescript
exists = await target.checkExists(model, 'id', recordId)
if (exists) {
  await target.updateRecord(model, recordId, data) // skipped++
} else {
  await target.createRecord(model, data) // processed++
}
```

### 2. Streaming + Batching Architecture
**Decision:** Use MongoDB cursors with batch reading
**Rationale:**
- Memory efficient for 1M+ document migrations
- Automatic connection pooling
- Server-side cursor management

**Implementation:**
```typescript
async *batchRead(collection, batchSize, filter) {
  const cursor = collection.find(filter, { batchSize: 1000 })
  // Yield user-requested batch size (1000)
}
```

### 3. Type Conversion Pipeline
**Decision:** Recursive, defensive conversion with null handling
**Rationale:**
- MongoDB ObjectId has multiple representations
- Date handling varies across documents
- Undefined → null for PostgreSQL compatibility

**Implementation:**
```typescript
// Converts: ObjectId, Date, nested objects, undefined
private convertDocument(doc: any): any {
  // ... recursive descent
  // No exceptions thrown (graceful degradation)
}
```

### 4. PostGIS-Ready Coordinates
**Decision:** Store lat/lng as Float fields, use Haversine in SQL
**Rationale:**
- PostGIS extension not yet available
- Haversine formula works without PostGIS
- Easy migration path when PostGIS becomes available

**Haversine formula (ready for PostGIS):**
```sql
2 * 6371 * asin(sqrt(
  power(sin(radians((lat2 - lat1) / 2)), 2) +
  cos(radians(lat1)) * cos(radians(lat2)) *
  power(sin(radians((lng2 - lng1) / 2)), 2)
))
```

### 5. Day-of-Week Working Hours
**Decision:** Separate LocationWorkingHours table instead of JSON
**Rationale:**
- Enables querying "is location open today at 14:00?"
- Supports complex business rules
- Better normalization

**Implementation:**
```prisma
// 7 rows per location (0-6: Sun-Sat)
model LocationWorkingHours {
  dayOfWeek Int      // 0-6
  openTime String?   // null = closed
  closeTime String?
}
```

### 6. Multi-Zone Association with Priority
**Decision:** Junction table with priority field
**Rationale:**
- Locations may serve multiple zones
- Priority determines zone preference
- Supports complex delivery rule logic

**Implementation:**
```prisma
model LocationZoneLink {
  locationId String
  zoneId String
  priority Int
  isDefault Boolean
  @@unique([locationId, zoneId])
}
```

---

## TypeScript Features Used

### 1. Async Generators
```typescript
async *query(collection, filter): AsyncIterableIterator<any> {
  for await (const doc of cursor) {
    yield this.convertDocument(doc)
  }
}
```
**Why:** Memory efficient streaming without loading all documents

### 2. Record<K, V> Utility Type
```typescript
metadata: Record<string, any> = {}
```
**Why:** Flexible JSON field validation

### 3. Zod Runtime Validation
```typescript
const schema = z.object({
  latitude: z.number().min(-90).max(90),
})
const parsed = schema.parse(request.body)
```
**Why:** Type-safe validation at runtime

### 4. Generic Type Parameters
```typescript
async *batchRead<T>(collection: string, batchSize: number): AsyncIterableIterator<T[]>
```
**Why:** Reusable, type-safe batch operations

### 5. Interface Composition
```typescript
interface MigrationProgress {
  collection: string
  total: number
  processed: number
  // ... more fields
}
```
**Why:** Clear contract definition without external dependencies

---

## No External Dependencies (Core Module)

The migration module intentionally avoids `@prisma/client` imports:

```typescript
// ❌ NOT imported
import { PrismaClient } from '@prisma/client'

// ✅ Instead, use generic DataTarget interface
interface DataTarget {
  connect(): Promise<void>
  createRecord(model: string, data: any): Promise<any>
  updateRecord(model: string, id: any, data: any): Promise<any>
}
```

**Rationale:**
- Allows testing without Prisma
- Works with any data adapter (SQL, NoSQL, REST)
- No tight coupling

---

## Performance Metrics (Expected)

### MongoDB Adapter
- Connection pool: 2-10 connections
- Batch throughput: 100-300 docs/sec (with transformation)
- Memory per 1000 docs: ~1-2 MB
- Cursor overhead: negligible

### Migration Runner
- Throughput: 100-300 records/sec (transformer dependent)
- ETA accuracy: ±10% for large batches
- Checkpoint overhead: 1 KB per collection
- Progress update frequency: every 50 records

### Location API
- List query: 50ms (100 locations)
- Haversine distance: 100 microseconds per location
- Nearest location (top 5): 200ms for 1000 locations
- Create location: 20ms (3 inserts: location, hours, capacity)

---

## Known Limitations

### Phase 2.5
1. **Haversine distance:** Not PostGIS (ready when extension available)
2. **Working hours:** No timezone support (stores UTC, convert on client)
3. **Capacity:** Basic numeric tracking (no allocation logic yet)
4. **Zone polygon:** Not validated (ready for PostGIS ST_Contains)

### MongoDB Adapter
1. **No authentication options:** Only supports mongoUri with credentials
2. **No sharding support:** Assumes single MongoDB cluster
3. **No change streams:** Batch-based only (not real-time)

### Location API
1. **Distance units:** Always kilometers (no miles support)
2. **No rate limiting:** Implement at gateway level
3. **No caching:** Each nearest-location query runs distance calculation

---

## Testing Recommendations

### Unit Tests

**MongoDB Adapter:**
```typescript
describe('MongoDBAdapter', () => {
  it('converts ObjectId to string', () => {
    const doc = { _id: new ObjectId() }
    const converted = adapter.convertDocument(doc)
    expect(typeof converted.id).toBe('string')
  })

  it('streams documents with batchRead', async () => {
    const batches = []
    for await (const batch of adapter.batchRead('test', 10)) {
      batches.push(batch)
    }
    expect(batches.length).toBeGreaterThan(0)
  })
})
```

**Transformers:**
```typescript
describe('transformOrder', () => {
  it('converts status to uppercase', () => {
    const order = transformOrder({ status: 'pending' })
    expect(order.status).toBe('PENDING')
  })

  it('handles missing customer phone', () => {
    const order = transformOrder({ customer: { email: 'test@example.com' } })
    expect(order.phone).toBeNull()
  })
})
```

**Migration Runner:**
```typescript
describe('MigrationRunnerV2', () => {
  it('skips existing records (idempotent)', async () => {
    // First run
    const report1 = await runner.run(source, target)
    // Second run
    const report2 = await runner.run(source, target)
    // Should have 0 processed, all skipped
    expect(report2.summary.totalProcessed).toBe(0)
  })

  it('saves and loads checkpoints', () => {
    runner.loadCheckpoints([{ collection: 'test' }])
    const checkpoints = runner.saveCheckpoints()
    expect(checkpoints).toHaveLength(1)
  })
})
```

### Integration Tests

**Location API:**
```typescript
describe('POST /locations', () => {
  it('creates location with working hours', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/locations',
      payload: {
        name: 'Test Warehouse',
        type: 'WAREHOUSE',
        addressLine1: '123 Main',
        city: 'NYC',
        latitude: 40.7128,
        longitude: -74.0060,
        operatingHours: {
          monday: { open: '08:00', close: '18:00' },
        },
      },
    })
    expect(response.statusCode).toBe(201)
    expect(response.json().id).toBeDefined()
  })

  it('finds nearest locations', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/locations/nearest?latitude=40.7128&longitude=-74.0060&maxDistance=50',
    })
    expect(response.statusCode).toBe(200)
    const locations = response.json()
    expect(locations.length).toBeGreaterThan(0)
    expect(locations[0].distance_km).toBeLessThanOrEqual(50)
  })
})
```

---

## Deployment Checklist

- [ ] Backup MongoDB and PostgreSQL
- [ ] Run migration in dry-run mode first
- [ ] Verify transformer outputs match expected schema
- [ ] Test with 1% of data
- [ ] Calculate total migration time (based on sample rate)
- [ ] Schedule during low-traffic window
- [ ] Monitor: CPU, memory, network, database connections
- [ ] Save checkpoints for resume capability
- [ ] Validate data integrity post-migration
- [ ] Update API documentation
- [ ] Deploy `locations-v2.ts` routes
- [ ] Enable location-based features in frontend

---

## Next Steps (Phase 3)

1. **Enable PostGIS extension**
   - Replace Haversine with `ST_Distance(geography)`
   - Add `ST_Contains(polygon)` for zone validation
   - Create spatial indexes

2. **Add timezone support**
   - Add `timezone` field to Location model
   - Convert working hours to location timezone

3. **Implement inventory allocation**
   - Capacity reservation logic
   - Stock level tracking per location
   - Allocation optimization

4. **Add geofencing**
   - Notify drivers entering/leaving zones
   - Real-time location tracking integration
   - Geofence-based rule triggers

5. **Route optimization**
   - Use PostGIS for waypoint ordering
   - Distance matrix calculation
   - Multi-stop routing

---

**Completed by:** AM (Integration Dev)
**Date:** March 6, 2026
**Status:** Ready for code review and deployment
