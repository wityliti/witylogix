/**
 * QR Code & Barcode Scanner Module
 *
 * Handles verification of QR codes and barcodes:
 * - Validate scanned QR data against expected values
 * - Barcode format detection and validation
 * - Fuzzy matching for QR codes (handling minor corruption)
 * - Generate QR codes for delivery tracking
 */

import QRCode from 'qrcode';
import type {
  QRVerification,
  BarcodeVerification,
  QRCodePOD,
  BarcodePOD,
} from './types.js';

// ─── CONSTANTS ──────────────────────────────────────────────────

const QR_MATCH_THRESHOLD = 0.95; // 95% match required
const BARCODE_FORMATS = {
  CODE128: /^[!-~]{1,}$/,
  EAN13: /^\d{13}$/,
  EAN8: /^\d{8}$/,
  UPC_A: /^\d{12}$/,
  CODE39: /^[0-9A-Z\-. $/+%]{1,}$/,
};

// ─── QR SCANNER SERVICE ─────────────────────────────────────────

export class QRScannerService {
  /**
   * Validate scanned QR data against expected data
   *
   * Performs exact match by default, with optional fuzzy matching
   * for handling minor corruption or encoding differences
   */
  validateQRCode(
    scannedData: string,
    expectedData: string,
    options: { fuzzyMatch?: boolean; fuzzyThreshold?: number } = {}
  ): QRVerification {
    if (!scannedData || !expectedData) {
      return {
        valid: false,
        scannedData,
        expectedData,
        matchPercentage: 0,
      };
    }

    // Exact match
    if (scannedData === expectedData) {
      return {
        valid: true,
        scannedData,
        expectedData,
        matchPercentage: 100,
      };
    }

    // Fuzzy match if enabled
    if (options.fuzzyMatch) {
      const threshold = options.fuzzyThreshold || QR_MATCH_THRESHOLD;
      const similarity = this.calculateStringSimilarity(scannedData, expectedData);

      return {
        valid: similarity >= threshold,
        scannedData,
        expectedData,
        matchPercentage: Math.round(similarity * 100),
      };
    }

    return {
      valid: false,
      scannedData,
      expectedData,
      matchPercentage: 0,
    };
  }

  /**
   * Generate QR code for delivery tracking
   *
   * Returns:
   * - qrData: Raw QR data encoded
   * - qrImageBase64: Base64-encoded PNG image of QR code
   */
  async generateDeliveryQR(
    deliveryId: string,
    options: { errorCorrection?: 'L' | 'M' | 'Q' | 'H'; width?: number } = {}
  ): Promise<{ qrData: string; qrImageBase64: string }> {
    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    const errorCorrection = options.errorCorrection || 'M';
    const width = options.width || 300;

    try {
      // Create QR code data (can be delivery ID or full tracking URL)
      const qrData = deliveryId;

      // Generate QR code as PNG
      const qrImageBase64 = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: errorCorrection,
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return {
        qrData,
        qrImageBase64, // Data URL: data:image/png;base64,...
      };
    } catch (error) {
      throw new Error(
        `Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create QRCodePOD from scanned data
   */
  async createQRPOD(
    scannedData: string,
    expectedData: string,
    deliveryId: string,
    options?: { fuzzyMatch?: boolean; fuzzyThreshold?: number }
  ): Promise<QRCodePOD> {
    const verification = this.validateQRCode(scannedData, expectedData, options);

    const podRecord: QRCodePOD = {
      id: `pod-qr-${deliveryId}-${Date.now()}`,
      deliveryId,
      method: 'qr_scan',
      scannedData,
      scannedAt: new Date(),
      verification,
      status: verification.valid ? 'verified' : 'rejected',
    };

    return podRecord;
  }

  // ─── BARCODE VALIDATION ─────────────────────────────────────

  /**
   * Validate barcode against expected value
   *
   * Supports multiple formats: CODE128, EAN13, EAN8, UPC-A, CODE39
   */
  validateBarcode(
    scannedBarcode: string,
    expectedBarcode: string,
    options: { format?: string; strictMatch?: boolean } = {}
  ): BarcodeVerification {
    if (!scannedBarcode || !expectedBarcode) {
      return {
        valid: false,
        scannedBarcode,
        expectedBarcode,
      };
    }

    // Detect format if not specified
    const format = options.format || this.detectBarcodeFormat(scannedBarcode);

    // Validate format
    if (format && BARCODE_FORMATS[format as keyof typeof BARCODE_FORMATS]) {
      const formatRegex = BARCODE_FORMATS[format as keyof typeof BARCODE_FORMATS];
      if (!formatRegex.test(scannedBarcode)) {
        return {
          valid: false,
          scannedBarcode,
          expectedBarcode,
          format,
        };
      }
    }

    // Check against expected
    const isValid = scannedBarcode === expectedBarcode;

    return {
      valid: isValid,
      scannedBarcode,
      expectedBarcode,
      format,
    };
  }

  /**
   * Create BarcodePOD from scanned data
   */
  createBarcodePOD(
    scannedBarcode: string,
    expectedBarcode: string,
    deliveryId: string,
    options?: { format?: string; strictMatch?: boolean }
  ): BarcodePOD {
    const verification = this.validateBarcode(scannedBarcode, expectedBarcode, options);

    const podRecord: BarcodePOD = {
      id: `pod-barcode-${deliveryId}-${Date.now()}`,
      deliveryId,
      method: 'barcode',
      scannedBarcode,
      barcodeFormat: verification.format,
      scannedAt: new Date(),
      verification,
      status: verification.valid ? 'verified' : 'rejected',
    };

    return podRecord;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  /**
   * Detect barcode format from scanned data
   */
  private detectBarcodeFormat(barcode: string): string | undefined {
    if (/^\d{13}$/.test(barcode)) {
      return 'EAN13';
    }
    if (/^\d{8}$/.test(barcode)) {
      return 'EAN8';
    }
    if (/^\d{12}$/.test(barcode)) {
      return 'UPC_A';
    }
    if (/^[0-9A-Z\-. $/+%]{1,}$/.test(barcode)) {
      return 'CODE39';
    }
    return 'CODE128'; // Most flexible format
  }

  /**
   * Calculate string similarity using Levenshtein distance
   *
   * Returns value between 0 and 1
   * 1 = exact match, 0 = completely different
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Exact match
    if (str1 === str2) {
      return 1;
    }

    const len1 = str1.length;
    const len2 = str2.length;

    // One string is empty
    if (len1 === 0 || len2 === 0) {
      return 0;
    }

    // Create matrix for Levenshtein distance
    const matrix: number[][] = [];

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    // Calculate similarity from distance
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }
}

// ─── SINGLETON INSTANCE ─────────────────────────────────────────

export const qrScannerService = new QRScannerService();
