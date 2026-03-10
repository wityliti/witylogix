/**
 * POD (Proof of Delivery) Module
 *
 * Comprehensive proof of delivery system with:
 * - Multi-method capture: photo, signature, QR code, barcode, manual confirmation
 * - Delivery timeline tracking with status progression
 * - File storage abstraction (S3, R2, local)
 * - Verification and validation
 * - Offline queueing support
 *
 * Usage:
 * import { createPODService, PhotoCaptureService, DeliveryTimelineService } from '@witylogix/core/pod';
 *
 * const podService = createPODService({
 *   type: 's3',
 *   s3: { bucketName: 'pod-uploads', region: 'us-east-1', ... }
 * });
 *
 * // Capture photo proof
 * const result = await podService.capturePOD(deliveryId, 'photo', imageBuffer);
 *
 * // Record timeline event
 * const event = deliveryTimelineService.recordEvent({
 *   deliveryId,
 *   event: 'DELIVERED',
 *   description: 'Package delivered',
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 * });
 */

// ─── TYPE EXPORTS ───────────────────────────────────────────────

export type {
  PODMethod,
  PODStatus,
  PODRecord,
  PODResult,
  VerificationResult,
  // Photo types
  GeoLocation,
  PhotoMetadata,
  PhotoPOD,
  PhotoValidationResult,
  // Signature types
  SignaturePOD,
  SignatureValidationResult,
  // QR/Barcode types
  QRVerification,
  BarcodeVerification,
  QRCodePOD,
  BarcodePOD,
  // Manual confirmation
  ManualConfirmationPOD,
  // Timeline types
  TimelineEntry,
  TimelineEvent,
  DeliveryStatus,
  TimelineAttachments,
  TimelineRecordRequest,
  // Storage types
  StorageAdapter,
  StorageConfig,
} from './types.js';

// ─── SERVICE EXPORTS ────────────────────────────────────────────

export { PhotoCaptureService, photoCaptureService } from './photo-capture.js';
export { SignatureCaptureService, signatureCaptureService } from './signature-capture.js';
export { QRScannerService, qrScannerService } from './qr-scanner.js';
export { DeliveryTimelineService, deliveryTimelineService, EVENT_DESCRIPTIONS, EVENT_STATUS_MAP, VALID_TRANSITIONS } from './delivery-timeline.js';
export { PODService, createPODService, getPODService, setPODService } from './pod-service.js';

// ─── STORAGE EXPORTS ────────────────────────────────────────────

export {
  LocalStorageAdapter,
  S3StorageAdapter,
  R2StorageAdapter,
  createStorageAdapter,
} from './storage-adapter.js';
