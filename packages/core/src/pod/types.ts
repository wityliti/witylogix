/**
 * POD (Proof of Delivery) v2 Types
 *
 * Comprehensive type definitions for multi-method proof of delivery:
 * - Photo capture with geolocation
 * - E-signature collection
 * - QR/barcode scanning
 * - Manual confirmation
 * - Delivery timeline tracking
 */

// ─── POD METHODS ─────────────────────────────────────────────────

export type PODMethod = 'photo' | 'signature' | 'qr_scan' | 'barcode' | 'manual_confirm';

export type PODStatus = 'pending' | 'verified' | 'rejected' | 'failed';

// ─── PHOTO POD ───────────────────────────────────────────────────

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  timestamp: Date;
}

export interface PhotoMetadata {
  width: number;
  height: number;
  format: 'jpeg' | 'png';
  size: number;
  capturedAt: Date;
  deviceInfo?: string;
  exifData?: Record<string, any>;
  hasGeoTag: boolean;
  geoLocation?: GeoLocation;
}

export interface PhotoPOD {
  id: string;
  deliveryId: string;
  method: 'photo';
  imageUrl: string;
  thumbnailUrl: string;
  imageKey: string;
  metadata: PhotoMetadata;
  capturedAt: Date;
  verifiedAt?: Date;
  status: PODStatus;
}

// ─── SIGNATURE POD ──────────────────────────────────────────────

export interface SignaturePOD {
  id: string;
  deliveryId: string;
  method: 'signature';
  signerName: string;
  signatureDataUrl: string; // Base64 encoded SVG path data or image
  signatureKey: string;
  signedAt: Date;
  verifiedAt?: Date;
  status: PODStatus;
}

// ─── QR/BARCODE POD ────────────────────────────────────────────

export interface QRVerification {
  valid: boolean;
  scannedData: string;
  expectedData: string;
  matchPercentage: number;
  decodedInfo?: Record<string, any>;
}

export interface BarcodeVerification {
  valid: boolean;
  scannedBarcode: string;
  expectedBarcode: string;
  format?: string;
}

export interface QRCodePOD {
  id: string;
  deliveryId: string;
  method: 'qr_scan';
  scannedData: string;
  decodedInfo?: Record<string, any>;
  scannedAt: Date;
  verification: QRVerification;
  verifiedAt?: Date;
  status: PODStatus;
}

export interface BarcodePOD {
  id: string;
  deliveryId: string;
  method: 'barcode';
  scannedBarcode: string;
  barcodeFormat?: string;
  scannedAt: Date;
  verification: BarcodeVerification;
  verifiedAt?: Date;
  status: PODStatus;
}

// ─── MANUAL CONFIRMATION ────────────────────────────────────────

export interface ManualConfirmationPOD {
  id: string;
  deliveryId: string;
  method: 'manual_confirm';
  confirmedBy: string;
  notes?: string;
  confirmedAt: Date;
  verifiedAt?: Date;
  status: PODStatus;
}

// ─── UNIFIED POD RECORD ──────────────────────────────────────────

export type PODRecord = PhotoPOD | SignaturePOD | QRCodePOD | BarcodePOD | ManualConfirmationPOD;

export interface PODResult {
  success: boolean;
  data?: PODRecord;
  error?: string;
  details?: Record<string, any>;
}

export interface VerificationResult {
  isVerified: boolean;
  method: PODMethod;
  verifiedAt: Date;
  issues: string[];
  details?: Record<string, any>;
}

// ─── DELIVERY TIMELINE ───────────────────────────────────────────

export type TimelineEvent =
  | 'CREATED'
  | 'CONFIRMED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | 'RESCHEDULED'
  | 'RETURNED';

export type DeliveryStatus =
  | 'pending'
  | 'confirmed'
  | 'picked_up'
  | 'out_for_delivery'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'rescheduled'
  | 'returned';

export interface TimelineAttachments {
  photoUrl?: string;
  photoKey?: string;
  signatureUrl?: string;
  signatureKey?: string;
  notes?: string;
}

export interface TimelineEntry {
  id: string;
  deliveryId: string;
  event: TimelineEvent;
  status: DeliveryStatus;
  description: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  attachments?: TimelineAttachments;
  metadata?: Record<string, any>;
}

export interface TimelineRecordRequest {
  deliveryId: string;
  event: TimelineEvent;
  status?: DeliveryStatus;
  description: string;
  latitude?: number;
  longitude?: number;
  attachments?: TimelineAttachments;
  metadata?: Record<string, any>;
}

// ─── STORAGE ADAPTER ────────────────────────────────────────────

export interface StorageAdapter {
  /**
   * Upload a file and return public URL and storage key
   */
  upload(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{
    url: string;
    key: string;
  }>;

  /**
   * Download a file by key
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file by key
   */
  delete(key: string): Promise<void>;

  /**
   * Get public URL for a file
   */
  getUrl(key: string): string;

  /**
   * Get a signed/temporary URL with expiration
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

export interface StorageConfig {
  type: 'local' | 's3' | 'r2';
  local?: {
    basePath: string;
    baseUrl: string;
  };
  s3?: {
    bucketName: string;
    region: string;
    baseUrl?: string;
    accessKeyId?: string;
    secretAccessKey: string;
  };
  r2?: {
    bucketName: string;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    baseUrl?: string;
  };
}

// ─── PHOTO VALIDATION ───────────────────────────────────────────

export interface PhotoValidationResult {
  valid: boolean;
  issues: string[];
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

// ─── SIGNATURE VALIDATION ──────────────────────────────────────

export interface SignatureValidationResult {
  valid: boolean;
  issues: string[];
  pointCount?: number;
  hasStroke?: boolean;
}
