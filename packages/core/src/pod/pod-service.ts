/**
 * POD Service — Main Proof of Delivery Orchestrator
 *
 * Coordinates all POD operations:
 * - Capture photos, signatures, QR codes, barcodes
 * - Store files and metadata
 * - Verify POD authenticity
 * - Manage delivery timeline
 * - Support offline queuing and retry
 */

import { z } from 'zod';
import type {
  PODMethod,
  PODRecord,
  PODResult,
  VerificationResult,
  PhotoPOD,
  SignaturePOD,
  QRCodePOD,
  BarcodePOD,
  ManualConfirmationPOD,
  StorageAdapter,
  StorageConfig,
} from './types.js';
import { photoCaptureService } from './photo-capture.js';
import { signatureCaptureService } from './signature-capture.js';
import { qrScannerService } from './qr-scanner.js';
import { deliveryTimelineService } from './delivery-timeline.js';
import { createStorageAdapter } from './storage-adapter.js';

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

const capturePODSchema = z.object({
  deliveryId: z.string().uuid(),
  method: z.enum(['photo', 'signature', 'qr_scan', 'barcode', 'manual_confirm']),
  data: z.any(), // Flexible data based on method
  options: z.record(z.any()).optional(),
});

// ─── POD SERVICE ────────────────────────────────────────────────

export class PODService {
  private storage: StorageAdapter;
  private podRecords: Map<string, PODRecord[]> = new Map();
  private verifications: Map<string, VerificationResult[]> = new Map();

  constructor(storageConfig: StorageConfig) {
    this.storage = createStorageAdapter(storageConfig);
  }

  /**
   * Capture proof of delivery using specified method
   *
   * Supports:
   * - photo: Image buffer with automatic validation and storage
   * - signature: SVG path data or point array
   * - qr_scan: Scanned QR data with verification
   * - barcode: Scanned barcode with format detection
   * - manual_confirm: Verbal confirmation by driver
   */
  async capturePOD(
    deliveryId: string,
    method: PODMethod,
    data: any,
    options?: Record<string, any>
  ): Promise<PODResult> {
    try {
      // Validate inputs
      capturePODSchema.parse({ deliveryId, method, data });

      let podRecord: PODRecord | null = null;

      // Process based on method
      switch (method) {
        case 'photo':
          podRecord = await this.capturePhoto(deliveryId, data);
          break;

        case 'signature':
          podRecord = await this.captureSignature(
            deliveryId,
            data,
            options?.signerName || 'Unknown'
          );
          break;

        case 'qr_scan':
          podRecord = await this.captureQRCode(
            deliveryId,
            data,
            options?.expectedData,
            options
          );
          break;

        case 'barcode':
          podRecord = await this.captureBarcode(
            deliveryId,
            data,
            options?.expectedBarcode,
            options
          );
          break;

        case 'manual_confirm':
          podRecord = this.captureManualConfirmation(
            deliveryId,
            options?.confirmedBy || 'Unknown',
            options?.notes
          );
          break;

        default:
          throw new Error(`Unknown POD method: ${method}`);
      }

      // Store POD record
      if (podRecord) {
        this.storePODRecord(deliveryId, podRecord);

        // Record timeline event
        await deliveryTimelineService.recordEvent({
          deliveryId,
          event: 'DELIVERED',
          description: `Delivery verified via ${method}`,
          metadata: {
            podId: podRecord.id,
            method,
          },
        });

        return {
          success: true,
          data: podRecord,
        };
      }

      return {
        success: false,
        error: 'Failed to capture POD',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get POD record for delivery
   */
  getPOD(deliveryId: string): PODRecord[] {
    return this.podRecords.get(deliveryId) || [];
  }

  /**
   * Get specific POD by type
   */
  getPODByMethod(deliveryId: string, method: PODMethod): PODRecord | null {
    const records = this.podRecords.get(deliveryId) || [];
    return records.find((r) => r.method === method) || null;
  }

  /**
   * Verify POD authenticity
   *
   * Checks:
   * - POD exists and is valid
   * - Metadata is complete
   * - Photo quality (if applicable)
   * - Signature validity
   * - QR/barcode verification
   */
  async verifyPOD(deliveryId: string): Promise<VerificationResult> {
    const podRecords = this.getPOD(deliveryId);

    if (!podRecords || podRecords.length === 0) {
      return {
        isVerified: false,
        method: 'photo',
        verifiedAt: new Date(),
        issues: ['No POD records found for delivery'],
      };
    }

    const issues: string[] = [];

    // Verify each POD record
    for (const pod of podRecords) {
      switch (pod.method) {
        case 'photo':
          await this.verifyPhotoPOD(pod as PhotoPOD, issues);
          break;

        case 'signature':
          this.verifySignaturePOD(pod as SignaturePOD, issues);
          break;

        case 'qr_scan':
          this.verifyQRCodePOD(pod as QRCodePOD, issues);
          break;

        case 'barcode':
          this.verifyBarcodePOD(pod as BarcodePOD, issues);
          break;

        case 'manual_confirm':
          this.verifyManualConfirmationPOD(pod as ManualConfirmationPOD, issues);
          break;
      }
    }

    const result: VerificationResult = {
      isVerified: issues.length === 0 && podRecords.length > 0,
      method: podRecords[0].method,
      verifiedAt: new Date(),
      issues,
    };

    // Store verification result
    this.storeVerification(deliveryId, result);

    return result;
  }

  /**
   * Get verification history
   */
  getVerifications(deliveryId: string): VerificationResult[] {
    return this.verifications.get(deliveryId) || [];
  }

  // ─── PRIVATE METHODS ────────────────────────────────────────

  /**
   * Capture photo POD
   */
  private async capturePhoto(deliveryId: string, imageBuffer: Buffer): Promise<PhotoPOD | null> {
    // Validate photo
    const validation = await photoCaptureService.validatePhoto(imageBuffer);
    if (!validation.valid) {
      throw new Error(`Photo validation failed: ${validation.issues.join(', ')}`);
    }

    // Process photo
    const photoPOD = await photoCaptureService.processPhoto(imageBuffer, deliveryId);

    if (!photoPOD) {
      return null;
    }

    // Generate thumbnail
    const thumbnail = await photoCaptureService.generateThumbnail(imageBuffer);

    // Upload original and thumbnail
    const uploadResult = await this.storage.upload(
      photoPOD.imageKey,
      imageBuffer,
      'image/jpeg'
    );

    const thumbnailKey = photoPOD.imageKey.replace(/\.[^.]+$/, '-thumb.jpg');
    const thumbnailResult = await this.storage.upload(thumbnailKey, thumbnail, 'image/jpeg');

    // Update POD with URLs
    photoPOD.imageUrl = uploadResult.url;
    photoPOD.thumbnailUrl = thumbnailResult.url;
    photoPOD.status = 'verified';
    photoPOD.verifiedAt = new Date();

    return photoPOD;
  }

  /**
   * Capture signature POD
   */
  private async captureSignature(
    deliveryId: string,
    signatureData: any,
    signerName: string
  ): Promise<SignaturePOD | null> {
    // Validate signature
    const validation = signatureCaptureService.validateSignature(signatureData);
    if (!validation.valid) {
      throw new Error(`Signature validation failed: ${validation.issues.join(', ')}`);
    }

    // Process signature
    const signaturePOD = await signatureCaptureService.processSignature(
      signatureData,
      signerName,
      deliveryId
    );

    // Render signature to PNG
    const signatureImage = await signatureCaptureService.renderSignaturePNG(signatureData);

    // Upload signature image
    const uploadResult = await this.storage.upload(
      signaturePOD.signatureKey,
      signatureImage,
      'image/png'
    );

    // Update POD with URL
    signaturePOD.signatureDataUrl = uploadResult.url;
    signaturePOD.status = 'verified';
    signaturePOD.verifiedAt = new Date();

    return signaturePOD;
  }

  /**
   * Capture QR code POD
   */
  private async captureQRCode(
    deliveryId: string,
    scannedData: string,
    expectedData?: string,
    options?: any
  ): Promise<QRCodePOD | null> {
    const expectedValue = expectedData || deliveryId;

    const podRecord = await qrScannerService.createQRPOD(
      scannedData,
      expectedValue,
      deliveryId,
      options
    );

    podRecord.status = podRecord.verification.valid ? 'verified' : 'rejected';
    if (podRecord.verification.valid) {
      podRecord.verifiedAt = new Date();
    }

    return podRecord;
  }

  /**
   * Capture barcode POD
   */
  private captureBarcode(
    deliveryId: string,
    scannedBarcode: string,
    expectedBarcode?: string,
    options?: any
  ): BarcodePOD | null {
    const expectedValue = expectedBarcode || deliveryId;

    const podRecord = qrScannerService.createBarcodePOD(
      scannedBarcode,
      expectedValue,
      deliveryId,
      options
    );

    podRecord.status = podRecord.verification.valid ? 'verified' : 'rejected';
    if (podRecord.verification.valid) {
      podRecord.verifiedAt = new Date();
    }

    return podRecord;
  }

  /**
   * Capture manual confirmation POD
   */
  private captureManualConfirmation(
    deliveryId: string,
    confirmedBy: string,
    notes?: string
  ): ManualConfirmationPOD {
    return {
      id: `pod-manual-${deliveryId}-${Date.now()}`,
      deliveryId,
      method: 'manual_confirm',
      confirmedBy,
      notes,
      confirmedAt: new Date(),
      verifiedAt: new Date(),
      status: 'verified',
    };
  }

  /**
   * Verify photo POD
   */
  private async verifyPhotoPOD(pod: PhotoPOD, issues: string[]): Promise<void> {
    if (!pod.imageUrl) {
      issues.push('Photo URL missing');
    }

    if (!pod.metadata) {
      issues.push('Photo metadata missing');
    } else {
      if (pod.metadata.size > 5 * 1024 * 1024) {
        issues.push('Photo exceeds 5MB limit');
      }

      if (pod.metadata.width && pod.metadata.height) {
        if (pod.metadata.width < 320 || pod.metadata.height < 320) {
          issues.push('Photo dimensions too small');
        }
      }
    }

    if (!pod.verifiedAt) {
      issues.push('Photo not verified');
    }
  }

  /**
   * Verify signature POD
   */
  private verifySignaturePOD(pod: SignaturePOD, issues: string[]): void {
    if (!pod.signerName || pod.signerName.length === 0) {
      issues.push('Signer name missing');
    }

    if (!pod.signatureDataUrl) {
      issues.push('Signature URL missing');
    }

    if (!pod.verifiedAt) {
      issues.push('Signature not verified');
    }
  }

  /**
   * Verify QR code POD
   */
  private verifyQRCodePOD(pod: QRCodePOD, issues: string[]): void {
    if (!pod.verification.valid) {
      issues.push(`QR code verification failed: ${pod.scannedData} != ${pod.verification.expectedData}`);
    }

    if (!pod.verifiedAt) {
      issues.push('QR code not verified');
    }
  }

  /**
   * Verify barcode POD
   */
  private verifyBarcodePOD(pod: BarcodePOD, issues: string[]): void {
    if (!pod.verification.valid) {
      issues.push(
        `Barcode verification failed: ${pod.scannedBarcode} != ${pod.verification.expectedBarcode}`
      );
    }

    if (!pod.verifiedAt) {
      issues.push('Barcode not verified');
    }
  }

  /**
   * Verify manual confirmation POD
   */
  private verifyManualConfirmationPOD(
    pod: ManualConfirmationPOD,
    issues: string[]
  ): void {
    if (!pod.confirmedBy || pod.confirmedBy.length === 0) {
      issues.push('Confirmation person missing');
    }

    if (!pod.verifiedAt) {
      issues.push('Confirmation not verified');
    }
  }

  /**
   * Store POD record in memory (in production, use database)
   */
  private storePODRecord(deliveryId: string, pod: PODRecord): void {
    const records = this.podRecords.get(deliveryId) || [];
    records.push(pod);
    this.podRecords.set(deliveryId, records);
  }

  /**
   * Store verification result
   */
  private storeVerification(deliveryId: string, result: VerificationResult): void {
    const verifications = this.verifications.get(deliveryId) || [];
    verifications.push(result);
    this.verifications.set(deliveryId, verifications);
  }
}

// ─── SINGLETON FACTORY ──────────────────────────────────────────

let podServiceInstance: PODService | null = null;

export function createPODService(storageConfig: StorageConfig): PODService {
  return new PODService(storageConfig);
}

export function getPODService(storageConfig?: StorageConfig): PODService {
  if (!podServiceInstance && storageConfig) {
    podServiceInstance = new PODService(storageConfig);
  }

  if (!podServiceInstance) {
    throw new Error('POD service not initialized. Call createPODService first.');
  }

  return podServiceInstance;
}

export function setPODService(service: PODService): void {
  podServiceInstance = service;
}
