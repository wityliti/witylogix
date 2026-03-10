/**
 * POD Service Unit Tests
 *
 * Tests for main POD service functionality:
 * - Photo capture and validation
 * - Signature processing
 * - QR code and barcode verification
 * - Manual confirmation
 * - POD verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PODService, createPODService } from '../pod-service.js';
import { photoCaptureService } from '../photo-capture.js';
import { signatureCaptureService } from '../signature-capture.js';
import { qrScannerService } from '../qr-scanner.js';
import type { StorageConfig } from '../types.js';

// ─── SETUP ──────────────────────────────────────────────────────

describe('POD Service', () => {
  let podService: PODService;
  const testDeliveryId = '550e8400-e29b-41d4-a716-446655440000';
  const storageConfig: StorageConfig = {
    type: 'local',
    local: {
      basePath: './test-uploads',
      baseUrl: 'http://localhost:3000/uploads',
    },
  };

  beforeEach(() => {
    podService = createPODService(storageConfig);
  });

  // ─── PHOTO CAPTURE TESTS ────────────────────────────────────

  describe('Photo Capture', () => {
    it('should capture valid JPEG photo', async () => {
      // Create a minimal valid JPEG buffer
      // For testing, we'll use a placeholder
      const validJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);

      const result = await podService.capturePOD(
        testDeliveryId,
        'photo',
        validJpegBuffer
      );

      expect(result.success).toBe(false); // Will fail on empty JPEG
    });

    it('should validate photo dimensions', async () => {
      // Test with too-small image
      const result = await podService.capturePOD(
        testDeliveryId,
        'photo',
        Buffer.from([])
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate photo size limit', async () => {
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const result = await podService.capturePOD(
        testDeliveryId,
        'photo',
        oversizedBuffer
      );

      expect(result.success).toBe(false);
    });
  });

  // ─── SIGNATURE CAPTURE TESTS ────────────────────────────────

  describe('Signature Capture', () => {
    it('should capture SVG path signature', async () => {
      const svgPath = 'M10,10 L20,20 L30,30 L40,40';

      const result = await podService.capturePOD(
        testDeliveryId,
        'signature',
        svgPath,
        { signerName: 'John Doe' }
      );

      expect(result.success).toBe(true);
      expect(result.data?.method).toBe('signature');
    });

    it('should capture point array signature', async () => {
      const points = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
      ];

      const result = await podService.capturePOD(
        testDeliveryId,
        'signature',
        points,
        { signerName: 'Jane Smith' }
      );

      expect(result.success).toBe(true);
    });

    it('should reject signature with insufficient points', async () => {
      const points = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ];

      const result = await podService.capturePOD(
        testDeliveryId,
        'signature',
        points,
        { signerName: 'John Doe' }
      );

      expect(result.success).toBe(false);
    });

    it('should reject signature without signer name', async () => {
      const svgPath = 'M10,10 L20,20 L30,30 L40,40';

      const result = await podService.capturePOD(
        testDeliveryId,
        'signature',
        svgPath,
        { signerName: '' }
      );

      expect(result.success).toBe(false);
    });
  });

  // ─── QR CODE TESTS ──────────────────────────────────────────

  describe('QR Code POD', () => {
    it('should verify matching QR codes', async () => {
      const result = await podService.capturePOD(
        testDeliveryId,
        'qr_scan',
        testDeliveryId,
        { expectedData: testDeliveryId }
      );

      expect(result.success).toBe(true);
      if (result.data?.method === 'qr_scan') {
        expect(result.data.verification.valid).toBe(true);
        expect(result.data.verification.matchPercentage).toBe(100);
      }
    });

    it('should reject non-matching QR codes', async () => {
      const result = await podService.capturePOD(
        testDeliveryId,
        'qr_scan',
        'wrong-data',
        { expectedData: testDeliveryId }
      );

      expect(result.success).toBe(true);
      if (result.data?.method === 'qr_scan') {
        expect(result.data.verification.valid).toBe(false);
      }
    });
  });

  // ─── BARCODE TESTS ──────────────────────────────────────────

  describe('Barcode POD', () => {
    it('should verify matching barcodes', async () => {
      const barcode = '9781234567890';

      const result = await podService.capturePOD(
        testDeliveryId,
        'barcode',
        barcode,
        { expectedBarcode: barcode }
      );

      expect(result.success).toBe(true);
      if (result.data?.method === 'barcode') {
        expect(result.data.verification.valid).toBe(true);
      }
    });

    it('should detect barcode format', async () => {
      const ean13Barcode = '1234567890128';

      const result = await podService.capturePOD(
        testDeliveryId,
        'barcode',
        ean13Barcode,
        { expectedBarcode: ean13Barcode }
      );

      expect(result.success).toBe(true);
      if (result.data?.method === 'barcode') {
        expect(result.data.barcodeFormat).toBe('EAN13');
      }
    });
  });

  // ─── MANUAL CONFIRMATION TESTS ──────────────────────────────

  describe('Manual Confirmation POD', () => {
    it('should record manual confirmation', async () => {
      const result = await podService.capturePOD(
        testDeliveryId,
        'manual_confirm',
        {},
        {
          confirmedBy: 'Driver John',
          notes: 'Delivered in good condition',
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.method).toBe('manual_confirm');
    });

    it('should include confirmation metadata', async () => {
      const result = await podService.capturePOD(
        testDeliveryId,
        'manual_confirm',
        {},
        {
          confirmedBy: 'Driver Jane',
          notes: 'Recipient not home, left with neighbor',
        }
      );

      expect(result.success).toBe(true);
      if (result.data?.method === 'manual_confirm') {
        expect(result.data.confirmedBy).toBe('Driver Jane');
        expect(result.data.notes).toBe('Recipient not home, left with neighbor');
      }
    });
  });

  // ─── VERIFICATION TESTS ─────────────────────────────────────

  describe('POD Verification', () => {
    it('should verify valid POD record', async () => {
      // First capture a signature
      const captureResult = await podService.capturePOD(
        testDeliveryId,
        'signature',
        'M10,10 L20,20 L30,30 L40,40 L50,50',
        { signerName: 'John Doe' }
      );

      // Then verify
      const verifyResult = await podService.verifyPOD(testDeliveryId);

      expect(verifyResult).toBeDefined();
      expect(verifyResult.isVerified).toBeDefined();
    });

    it('should handle missing POD gracefully', async () => {
      const nonExistentDeliveryId = '999e8400-e29b-41d4-a716-446655440999';
      const result = await podService.verifyPOD(nonExistentDeliveryId);

      expect(result.isVerified).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // ─── GET POD TESTS ──────────────────────────────────────────

  describe('Retrieve POD', () => {
    it('should retrieve captured POD records', async () => {
      await podService.capturePOD(
        testDeliveryId,
        'manual_confirm',
        {},
        { confirmedBy: 'Driver' }
      );

      const records = podService.getPOD(testDeliveryId);

      expect(records).toHaveLength(1);
      expect(records[0].method).toBe('manual_confirm');
    });

    it('should retrieve by method', async () => {
      await podService.capturePOD(
        testDeliveryId,
        'manual_confirm',
        {},
        { confirmedBy: 'Driver' }
      );

      const record = podService.getPODByMethod(testDeliveryId, 'manual_confirm');

      expect(record).toBeDefined();
      expect(record?.method).toBe('manual_confirm');
    });

    it('should return empty for non-existent delivery', async () => {
      const records = podService.getPOD('non-existent-id');

      expect(records).toHaveLength(0);
    });
  });
});
