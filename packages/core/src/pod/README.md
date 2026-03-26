# POD v2: Proof of Delivery Module

Complete proof of delivery system with multi-method capture, status timeline tracking, and cloud storage integration.

## Features

### Multi-Method POD Capture
- **Photo**: JPEG/PNG with automatic thumbnail generation and EXIF/geolocation extraction
- **E-Signature**: SVG path data or point arrays, rendered to PNG with signature validation
- **QR Code**: Scanned QR data with fuzzy matching support
- **Barcode**: Multiple format support (CODE128, EAN13, EAN8, UPC-A, CODE39)
- **Manual Confirmation**: Verbal confirmation with driver name and notes

### Delivery Timeline
- 9 status events: CREATED, CONFIRMED, PICKED_UP, OUT_FOR_DELIVERY, ARRIVED, DELIVERED, FAILED, RESCHEDULED, RETURNED
- Location tracking (latitude, longitude)
- Attachment support (photos, signatures, notes)
- Status transition validation
- Event query and retrieval

### Storage Abstraction
- **Local Filesystem**: Development and testing
- **AWS S3**: Production cloud storage
- **Cloudflare R2**: S3-compatible alternative
- Signed/temporary URLs
- Automatic key generation

### Quality Assurance
- Photo validation (format, size, dimensions, EXIF data)
- Signature validation (minimum stroke points, data format)
- QR code verification with similarity matching
- Barcode format detection
- Complete test coverage

## Installation

POD module is part of the core package. Already available in the monorepo.

```bash
# From repository root
pnpm install
```

## Usage

### Initialize POD Service

```typescript
import { createPODService, deliveryTimelineService } from '@witylogix/core/pod';

const podService = createPODService({
  type: 's3',
  s3: {
    bucketName: 'witylogix-pod-uploads',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

### Capture Photo POD

```typescript
const imageBuffer = await fs.promises.readFile('delivery-photo.jpg');

const result = await podService.capturePOD(
  deliveryId,
  'photo',
  imageBuffer
);

if (result.success) {
  console.log('Photo stored at:', result.data.imageUrl);
  console.log('Thumbnail at:', result.data.thumbnailUrl);
}
```

### Capture Signature POD

```typescript
// From canvas/drawing app (SVG path data)
const signatureData = 'M10,10 L20,20 Q30,30 40,40 L50,50';

const result = await podService.capturePOD(
  deliveryId,
  'signature',
  signatureData,
  {
    signerName: 'John Doe',
    notes: 'Signed via mobile app',
  }
);

if (result.success) {
  console.log('Signature stored:', result.data.signatureUrl);
}
```

Or with point array from touch/mouse tracking:

```typescript
const points = [
  { x: 10, y: 20, t: 1000 },  // t = timestamp
  { x: 15, y: 25, t: 1050 },
  { x: 20, y: 30, t: 1100 },
  // ... more points
];

const result = await podService.capturePOD(
  deliveryId,
  'signature',
  points,
  { signerName: 'Jane Smith' }
);
```

### Capture QR Code POD

```typescript
const result = await podService.capturePOD(
  deliveryId,
  'qr_scan',
  scannedQRData,
  {
    expectedData: deliveryId,  // Optional, defaults to deliveryId
    fuzzyMatch: true,          // Optional, for handling corruption
  }
);
```

### Capture Barcode POD

```typescript
const result = await podService.capturePOD(
  deliveryId,
  'barcode',
  '9781234567890',
  {
    expectedBarcode: '9781234567890',  // Optional
    format: 'EAN13',                   // Optional, auto-detected
  }
);
```

### Record Manual Confirmation

```typescript
const result = await podService.capturePOD(
  deliveryId,
  'manual_confirm',
  {},
  {
    confirmedBy: 'Driver Name',
    notes: 'Delivered to recipient in person',
  }
);
```

### Verify POD

```typescript
const verification = await podService.verifyPOD(deliveryId);

console.log('POD Valid:', verification.isVerified);
console.log('Verification Issues:', verification.issues);
```

### Record Timeline Events

```typescript
const timelineEntry = deliveryTimelineService.recordEvent({
  deliveryId,
  event: 'OUT_FOR_DELIVERY',
  description: 'Package out for delivery',
  latitude: 40.7128,
  longitude: -74.006,
  attachments: {
    photoUrl: 'https://...',
    notes: 'Package scanned at hub',
  },
  metadata: {
    hubId: 'HUB-123',
    driverId: 'DRV-456',
  },
});
```

### Query Timeline

```typescript
// Get complete timeline
const timeline = deliveryTimelineService.getTimeline(deliveryId);

// Get current status
const currentStatus = deliveryTimelineService.getCurrentStatus(deliveryId);
// Returns: 'pending' | 'confirmed' | 'out_for_delivery' | 'delivered' | etc.

// Get specific event
const deliveredEvent = deliveryTimelineService.getEventByType(deliveryId, 'DELIVERED');

// Get events in time range
const recentEvents = deliveryTimelineService.getEventsBetween(
  deliveryId,
  new Date(Date.now() - 3600000),  // Last hour
  new Date()
);
```

## API Routes

All routes require authentication (`requireAuth` middleware).

### Photo POD
```
POST /api/pod/:deliveryId/photo
Content-Type: multipart/form-data

Form data:
  - file: (image file, max 5MB, JPEG or PNG)

Response:
{
  "success": true,
  "data": {
    "id": "pod-...",
    "deliveryId": "...",
    "method": "photo",
    "imageUrl": "https://...",
    "thumbnailUrl": "https://...",
    "status": "verified",
    "capturedAt": "2025-03-11T10:30:00Z"
  }
}
```

### Signature POD
```
POST /api/pod/:deliveryId/signature
Content-Type: application/json

{
  "signatureData": "M10,10 L20,20 ...",  // SVG path or point array
  "signerName": "John Doe",
  "notes": "Signed on delivery"
}

Response:
{
  "success": true,
  "data": {
    "id": "pod-sig-...",
    "method": "signature",
    "signerName": "John Doe",
    "signatureUrl": "https://...",
    "status": "verified",
    "signedAt": "2025-03-11T10:30:00Z"
  }
}
```

### QR Code POD
```
POST /api/pod/:deliveryId/qr
Content-Type: application/json

{
  "scannedData": "550e8400-...",
  "expectedData": "550e8400-...",  // Optional
  "fuzzyMatch": true                // Optional
}
```

### Barcode POD
```
POST /api/pod/:deliveryId/barcode
Content-Type: application/json

{
  "scannedBarcode": "9781234567890",
  "expectedBarcode": "9781234567890",  // Optional
  "format": "EAN13"                     // Optional
}
```

### Manual Confirmation
```
POST /api/pod/:deliveryId/confirm
Content-Type: application/json

{
  "confirmedBy": "Driver Name",
  "notes": "Delivery completed"
}
```

### Get POD Records
```
GET /api/pod/:deliveryId

Response:
{
  "success": true,
  "data": [ /* array of POD records */ ],
  "total": 2
}
```

### Get Delivery Timeline
```
GET /api/pod/:deliveryId/timeline

Response:
{
  "success": true,
  "data": [ /* array of timeline entries */ ],
  "total": 5
}
```

### Verify POD
```
GET /api/pod/:deliveryId/verify

Response:
{
  "success": true,
  "data": {
    "isVerified": true,
    "method": "photo",
    "verifiedAt": "2025-03-11T10:35:00Z",
    "issues": []
  }
}
```

## Database Schema

### ProofOfDelivery Table

```sql
CREATE TABLE proofs_of_delivery (
  id UUID PRIMARY KEY,
  delivery_id UUID NOT NULL,
  method VARCHAR(20) NOT NULL,        -- photo, signature, qr_scan, barcode, manual_confirm
  status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected, failed

  -- Photo fields
  photo_url VARCHAR(2048),
  photo_key VARCHAR(500),
  thumbnail_url VARCHAR(2048),
  photo_metadata JSONB,               -- { width, height, format, size, exif, geoLocation }

  -- Signature fields
  signer_name VARCHAR(255),
  signature_url VARCHAR(2048),
  signature_key VARCHAR(500),
  signature_data JSONB,               -- SVG path or points

  -- QR fields
  qr_scanned_data VARCHAR(1000),
  qr_expected_data VARCHAR(1000),
  qr_verification JSONB,              -- { valid, matchPercentage, decodedInfo }

  -- Barcode fields
  barcode_scanned VARCHAR(255),
  barcode_expected VARCHAR(255),
  barcode_format VARCHAR(50),         -- CODE128, EAN13, etc.
  barcode_verification JSONB,

  -- Manual confirmation
  confirmed_by VARCHAR(255),
  confirmation_notes TEXT,

  -- Timestamps
  captured_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  metadata JSONB DEFAULT '{}',

  UNIQUE(delivery_id, method),
  INDEX(delivery_id),
  INDEX(method),
  INDEX(status),
  INDEX(verified_at)
);
```

### DeliveryTimeline Table

```sql
CREATE TABLE delivery_timeline (
  id UUID PRIMARY KEY,
  delivery_id UUID NOT NULL,
  event VARCHAR(50) NOT NULL,         -- CREATED, PICKED_UP, DELIVERED, etc.
  status VARCHAR(50) NOT NULL,        -- pending, confirmed, delivered, etc.
  description TEXT NOT NULL,

  -- Location
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Attachments
  photo_url VARCHAR(2048),
  photo_key VARCHAR(500),
  signature_url VARCHAR(2048),
  signature_key VARCHAR(500),
  notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX(delivery_id),
  INDEX(event),
  INDEX(status),
  INDEX(timestamp),
  INDEX(delivery_id, timestamp)
);
```

## Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     DELIVERY STATUS FLOW                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│     CREATED ──────────────> CONFIRMED ──────┐                │
│       │                        │             │                │
│       │                        v             v                │
│       │                  PICKED_UP ────> OUT_FOR_DELIVERY     │
│       │                        │             │                │
│       │                        v             v                │
│       └───────> FAILED <─── ARRIVED      (terminal)          │
│                   │                         │                │
│                   v                         v                │
│            RESCHEDULED ────────────> DELIVERED (terminal)    │
│                   │                                           │
│                   v                                           │
│             CONFIRMED ───────────────────────────────────────┘
│                   │
│                   v
│             RESCHEDULED
│
│  FAILED ──────> RETURNED (terminal)
│
└─────────────────────────────────────────────────────────────┘
```

## Offline Support

POD module is designed for offline-first mobile apps:

1. **Capture Locally**: Store POD data locally until connectivity returns
2. **Queue Operations**: Buffer uploads in a local queue
3. **Sync When Online**: Batch upload photos/signatures when connected
4. **Conflict Resolution**: Last-write-wins strategy for timeline events

```typescript
// Example offline queue implementation
interface OfflinePODQueue {
  deliveryId: string;
  method: PODMethod;
  data: any;
  options?: Record<string, any>;
  queuedAt: Date;
  status: 'pending' | 'synced' | 'failed';
}

const offlineQueue: OfflinePODQueue[] = [];

// Queue locally
function queuePOD(entry: OfflinePODQueue) {
  offlineQueue.push(entry);
  localStorage.setItem('pod-queue', JSON.stringify(offlineQueue));
}

// Sync when online
async function syncPODQueue() {
  const queue = JSON.parse(localStorage.getItem('pod-queue') || '[]');

  for (const item of queue) {
    try {
      await podService.capturePOD(
        item.deliveryId,
        item.method,
        item.data,
        item.options
      );
      item.status = 'synced';
    } catch (error) {
      item.status = 'failed';
    }
  }

  localStorage.setItem('pod-queue', JSON.stringify(queue));
}
```

## Configuration

### Storage Configuration Examples

**Local Storage (Development)**
```typescript
{
  type: 'local',
  local: {
    basePath: './uploads',
    baseUrl: 'http://localhost:3000/uploads',
  },
}
```

**AWS S3**
```typescript
{
  type: 's3',
  s3: {
    bucketName: 'witylogix-pod-uploads',
    region: 'us-east-1',
    baseUrl: 'https://d1234567890.cloudfront.net',  // Optional CloudFront
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}
```

**Cloudflare R2**
```typescript
{
  type: 'r2',
  r2: {
    bucketName: 'witylogix-pod-uploads',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    baseUrl: 'https://pub-xyz123.r2.dev',  // Optional custom domain
  },
}
```

## Testing

```bash
# Run unit tests
pnpm test packages/core/src/pod

# Run specific test file
pnpm test packages/core/src/pod/__tests__/pod-service.test.ts

# Watch mode
pnpm test --watch packages/core/src/pod
```

## Limitations & Future Improvements

- **Photo Processing**: Currently minimal validation; consider adding face detection, blur detection
- **Signature**: Support for digital pen pressure (pressure-sensitive drawing)
- **QR Codes**: Add ability to generate custom QR codes for delivery URLs
- **Timeline**: Implement timeline analytics (average time in each status, failure rate by driver)
- **Mobile**: Better offline support with background sync
- **Analytics**: POD success rate, capture method distribution

## Dependencies

- `sharp`: Image processing (photo validation, thumbnail generation)
- `qrcode`: QR code generation
- `@fastify/multipart`: File upload handling (API routes)
- `zod`: Schema validation

## Related Modules

- `packages/core/src/file-storage`: File storage abstraction
- `packages/core/src/delivery-rules`: Delivery workflow rules
- `apps/api/src/routes/deliveries`: Main delivery API

## Contributing

When adding new POD methods:

1. Create new capture service in `pod/`
2. Update types in `types.ts`
3. Add capture logic in `pod-service.ts`
4. Add API endpoint in `apps/api/src/routes/pod.ts`
5. Update Prisma schema if needed
6. Add tests to `__tests__/`

## License

Open source - see LICENSE file
