# Data Migration Quick Start Guide

## Overview

This guide covers the Sprint 2.5 data migration framework for MongoDB → PostgreSQL migration with idempotent, resumable operations.

## Installation

All utilities are exported from `@witylogix/core/migration`:

```typescript
import {
  MongoDBAdapter,
  MigrationRunnerV2,
  transformers,
  MigrationConfig,
  MigrationReport,
} from '@witylogix/core/migration'
```

## Basic Migration Flow

### 1. Initialize Adapters

```typescript
import { MongoDBAdapter } from '@witylogix/core/migration'

// MongoDB source
const mongoAdapter = new MongoDBAdapter(process.env.MONGO_URI)

// PostgreSQL target (implement DataTarget interface)
const postgresTarget = new PostgresTarget(process.env.DATABASE_URL)
```

### 2. Configure Collections

```typescript
import { transformers } from '@witylogix/core/migration'

const config: MigrationConfig = {
  mongoUri: process.env.MONGO_URI,
  postgresUri: process.env.DATABASE_URL,
  batchSize: 500,
  dryRun: false, // Set to true for testing
  validateBeforeMigration: true,
  stopOnError: false, // Continue on errors
  collections: [
    {
      mongoCollection: 'orders',
      prismaModel: 'Order',
      fieldMap: [
        { sourceField: '_id', targetField: 'id' },
        { sourceField: 'customer_id', targetField: 'customerId' },
        { sourceField: 'total_price', targetField: 'totalPrice' },
        // ... more field mappings
      ],
      preProcess: (doc) => {
        // Clean/normalize document before transformation
        return {
          ...doc,
          _id: doc._id.toString(), // Ensure string ObjectId
        }
      },
      postProcess: (record) => {
        // Final transformations before insert
        return {
          ...record,
          migratedAt: new Date(),
        }
      },
    },
    {
      mongoCollection: 'shipments',
      prismaModel: 'Shipment',
      fieldMap: [
        // ... field mappings
      ],
    },
    // ... more collections
  ],
}
```

### 3. Run Migration

```typescript
import { MigrationRunnerV2 } from '@witylogix/core/migration'

const runner = new MigrationRunnerV2(config)

const report = await runner.run(mongoAdapter, postgresTarget, {
  // Resume from previous checkpoint (if migration was interrupted)
  resumeFrom: previousCheckpoint?.id,

  // Skip specific collections
  skipCollections: ['legacy_orders'],

  // Track progress
  onProgress: (progress) => {
    console.log(
      `${progress.collection}: ${progress.processed}/${progress.total} (${progress.eta})`
    )
  },
})

console.log(report.summary)
// {
//   totalCollections: 2,
//   collectionsProcessed: 2,
//   totalRecords: 125000,
//   totalProcessed: 124980,
//   totalFailed: 20,
//   totalSkipped: 0,
// }
```

## Advanced Features

### Dry-Run Mode (Testing)

```typescript
const config: MigrationConfig = {
  ...baseConfig,
  dryRun: true, // No actual writes
}

const report = await runner.run(mongoAdapter, postgresTarget)
// Report shows what would be migrated without making changes
```

### Resume from Checkpoint

```typescript
// First run - save checkpoints
const report1 = await runner.run(mongoAdapter, postgresTarget)
const checkpoints = runner.saveCheckpoints()

// If interrupted, reload and resume
runner.loadCheckpoints(checkpoints)
const report2 = await runner.run(mongoAdapter, postgresTarget, {
  resumeFrom: checkpoints[0].collection,
})
```

### Custom Transformers

```typescript
// Instead of using built-in transformers, define custom ones:
const collections: CollectionMapping[] = [
  {
    mongoCollection: 'orders',
    prismaModel: 'Order',
    fieldMap: [],
    preProcess: (doc) => {
      // Custom transformation logic
      return {
        id: doc._id.toString(),
        shopId: doc.shop_id,
        customerId: doc.customer_id.toString(),
        status: doc.status.toUpperCase(),
        totalPrice: parseFloat(doc.total_price),
        shippingAddress: {
          street: doc.shipping?.street,
          city: doc.shipping?.city,
          state: doc.shipping?.state,
          zip: doc.shipping?.zip,
        },
        metadata: {
          originalId: doc._id.toString(),
          migratedAt: new Date().toISOString(),
        },
      }
    },
  },
]
```

### Using Built-in Entity Transformers

```typescript
import { transformOrder, transformShipment, transformDriver } from '@witylogix/core/migration'

// Use pre-built transformers
const collections: CollectionMapping[] = [
  {
    mongoCollection: 'orders',
    prismaModel: 'Order',
    fieldMap: [],
    preProcess: (doc) => transformOrder(doc),
  },
  {
    mongoCollection: 'shipments',
    prismaModel: 'Shipment',
    fieldMap: [],
    preProcess: (doc) => transformShipment(doc),
  },
  {
    mongoCollection: 'drivers',
    prismaModel: 'Driver',
    fieldMap: [],
    preProcess: (doc) => transformDriver(doc),
  },
]
```

### Error Handling & Logging

```typescript
const report = await runner.run(mongoAdapter, postgresTarget)

// Check for errors
if (!report.success) {
  console.error('Migration failed!')

  // Get all errors
  report.errors.forEach((error) => {
    console.error(`[${error.collection}] ${error.error}`)
  })

  // Get collection-specific errors
  report.collections.forEach((collection) => {
    if (collection.errors.length > 0) {
      console.error(`\n${collection.collection} errors:`)
      collection.errors.forEach((error) => {
        console.error(`  Row ${error.rowIndex}: ${error.error}`)
        if (error.document) {
          console.error(`  Document: ${JSON.stringify(error.document).substring(0, 100)}...`)
        }
      })
    }
  })
}
```

## MongoDB Adapter Usage

### Basic Querying

```typescript
import { MongoDBAdapter } from '@witylogix/core/migration'

const adapter = new MongoDBAdapter(process.env.MONGO_URI)
await adapter.connect()

// Stream all documents
for await (const doc of adapter.query('orders')) {
  console.log(doc)
}

// Stream with filter
for await (const doc of adapter.query('orders', { status: 'shipped' })) {
  console.log(doc)
}

await adapter.disconnect()
```

### Batch Reading

```typescript
// Read in batches (more efficient)
for await (const batch of adapter.batchRead('orders', 1000)) {
  // batch is array of 1000 docs
  console.log(`Processing batch of ${batch.length}`)
  // Process batch...
}
```

### Collection Statistics

```typescript
const stats = await adapter.getStats('orders')
console.log(`Collection: orders`)
console.log(`  Documents: ${stats.count}`)
console.log(`  Size: ${stats.size} bytes`)
console.log(`  Avg Doc Size: ${stats.avgDocSize} bytes`)
// Useful for estimating migration time
```

## Location API Usage

### Create Location

```typescript
const response = await fetch('https://api.example.com/locations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'Central Warehouse',
    type: 'WAREHOUSE',
    addressLine1: '123 Main Street',
    city: 'New York',
    province: 'NY',
    postalCode: '10001',
    country: 'US',
    latitude: 40.7128,
    longitude: -74.0060,
    phone: '+1-555-0100',
    email: 'warehouse@example.com',
    allowPickup: true,
    allowDelivery: true,
    serviceLevel: 'premium',
    operatingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '15:00' },
      sunday: { isClosed: true },
    },
    capacity: {
      totalSlots: 1000,
      category: 'standard',
    },
    metadata: {
      warehouseManager: 'John Doe',
      warehouseCode: 'NYC-001',
    },
  }),
})

const location = await response.json()
console.log(`Created location: ${location.id}`)
```

### Get Nearest Locations

```typescript
const response = await fetch(
  'https://api.example.com/locations/nearest?latitude=40.7128&longitude=-74.0060&maxDistance=50&type=WAREHOUSE&limit=5',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
)

const nearest = await response.json()
nearest.forEach((location) => {
  console.log(`${location.name}: ${location.distance_km.toFixed(2)}km away`)
})
```

### Update Location Capacity

```typescript
const response = await fetch(
  'https://api.example.com/locations/{locationId}/capacity',
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      usedSlots: 450,
      totalSlots: 1000,
      reservedSlots: 50,
    }),
  }
)

const capacity = await response.json()
console.log(`Utilization: ${capacity.utilization_percent}%`)
console.log(`Available slots: ${capacity.available_slots}`)
```

### Manage Working Hours

```typescript
// Set working hours
const response = await fetch(
  'https://api.example.com/locations/{locationId}/hours',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      // ... rest of week
    }),
  }
)
```

## Performance Tips

### 1. Optimize Batch Size

```typescript
// For slow network: smaller batches
config.batchSize = 100

// For fast local connection: larger batches
config.batchSize = 1000

// General rule: 1-2 seconds per batch
```

### 2. Monitor Progress

```typescript
onProgress: (progress) => {
  const percent = ((progress.processed / progress.total) * 100).toFixed(1)
  const rate = (progress.processed / (Date.now() - progress.startedAt.getTime())) * 1000
  console.log(
    `${progress.collection}: ${percent}% | ${rate.toFixed(0)} rec/sec | ETA: ${progress.eta?.toLocaleTimeString()}`
  )
}
```

### 3. Handle Errors Gracefully

```typescript
// Always use try-catch
try {
  const report = await runner.run(mongoAdapter, postgresTarget)
} catch (error) {
  console.error(`Migration failed: ${error.message}`)
  // Save checkpoint for resume
  const checkpoints = runner.saveCheckpoints()
  fs.writeFileSync('migration-checkpoint.json', JSON.stringify(checkpoints))
}
```

## Troubleshooting

### Issue: "Connection timeout"
**Solution:** Increase MongoDB maxPoolSize in adapter
```typescript
const adapter = new MongoDBAdapter(mongoUri, {
  maxPoolSize: 20,
  socketTimeoutMS: 60000,
})
```

### Issue: "Out of memory"
**Solution:** Reduce batch size
```typescript
config.batchSize = 100 // was 1000
```

### Issue: "Duplicate key error"
**Solution:** Enable idempotent mode (already default)
```typescript
// Runner automatically updates existing records
// No need for manual conflict handling
```

### Issue: "Migration stalls"
**Solution:** Enable checkpoint saving and resume
```typescript
const checkpoints = runner.saveCheckpoints()
fs.writeFileSync('checkpoint.json', JSON.stringify(checkpoints))

// Later, resume from checkpoint
runner.loadCheckpoints(checkpoints)
const report = await runner.run(mongoAdapter, postgresTarget, {
  resumeFrom: checkpoints[0].collection,
})
```

## Best Practices

1. **Always test with dry-run first**
   ```typescript
   config.dryRun = true
   await runner.run(mongoAdapter, postgresTarget)
   ```

2. **Save checkpoints frequently**
   ```typescript
   const checkpoints = runner.saveCheckpoints()
   fs.writeFileSync('checkpoint.json', JSON.stringify(checkpoints, null, 2))
   ```

3. **Monitor error logs**
   ```typescript
   report.errors.forEach(error => {
     logger.error(`${error.collection}: ${error.error}`)
   })
   ```

4. **Validate data quality post-migration**
   ```typescript
   const postgresCount = await target.count('Order')
   const mongoCount = await source.count('orders')
   console.assert(postgresCount === mongoCount, 'Count mismatch!')
   ```

5. **Schedule migrations during low-traffic hours**
   - Reduces impact on production
   - Easier to troubleshoot
   - Better throughput

## Support

For issues, refer to:
- `/SPRINT_2_5_COMPLETION.md` - Full documentation
- `packages/core/src/migration/` - Source code
- Error logs in migration report

---

Last Updated: March 6, 2026
