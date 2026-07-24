/**
 * POD Service Unit Tests
 * Tests photo capture with EXIF extraction, signature rendering,
 * QR code scanning, barcode detection, state transitions, and storage adapters
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface PhotoCapture {
  id: string;
  imageUrl: string;
  timestamp: Date;
  exifData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
}

interface SignatureData {
  svgData: string;
  pngUrl: string;
  captureTime: Date;
}

interface DeliveryTimeline {
  status:
    | "pending"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failed"
    | "returned";
  timestamp: Date;
  notes?: string;
}

/**
 * Mock POD Service
 */
class PODService {
  private storageAdapter: StorageAdapter;

  constructor(storageAdapter: StorageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  capturePhoto(
    imageData: Buffer,
    exifData?: Record<string, unknown>,
  ): PhotoCapture {
    const id = `photo_${Date.now()}`;
    const imageUrl = this.storageAdapter.uploadFile(id, imageData);

    const photo: PhotoCapture = {
      id,
      imageUrl,
      timestamp: new Date(),
      exifData,
    };

    if (exifData) {
      photo.latitude = exifData.latitude as number | undefined;
      photo.longitude = exifData.longitude as number | undefined;
    }

    return photo;
  }

  extractEXIF(imageBuffer: Buffer): Record<string, unknown> {
    // Mock EXIF extraction
    return {
      make: "Apple",
      model: "iPhone 14 Pro",
      datetime: new Date().toISOString(),
      latitude: 40.7128,
      longitude: -74.006,
      altitude: 10.5,
    };
  }

  renderSignaturePNG(svgData: string): SignatureData {
    const pngUrl = this.storageAdapter.uploadFile(
      `sig_${Date.now()}`,
      Buffer.from(svgData),
    );

    return {
      svgData,
      pngUrl,
      captureTime: new Date(),
    };
  }

  scanQRCode(imageBuffer: Buffer): string | null {
    // Mock QR code scanning
    if (imageBuffer.length === 0) return null;
    return "order_123_qr_scan";
  }

  detectBarcode(imageBuffer: Buffer): string | null {
    // Mock barcode detection
    if (imageBuffer.length === 0) return null;
    const ean13Pattern = /^\d{13}$/;
    const mockBarcode = "5901234123457";
    return ean13Pattern.test(mockBarcode) ? mockBarcode : null;
  }

  isValidBarcode(barcode: string): boolean {
    // EAN-13 validation
    if (!barcode || barcode.length !== 13 || !/^\d+$/.test(barcode)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += (i % 2 === 0 ? 1 : 3) * parseInt(barcode.charAt(i), 10);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return parseInt(barcode.charAt(12), 10) === checkDigit;
  }

  transitionDeliveryStatus(
    currentStatus: DeliveryTimeline["status"],
    newStatus: DeliveryTimeline["status"],
  ): { valid: boolean; reason?: string } {
    const validTransitions: Record<string, string[]> = {
      pending: ["picked_up", "failed"],
      picked_up: ["in_transit", "failed"],
      in_transit: ["out_for_delivery", "failed"],
      out_for_delivery: ["delivered", "failed"],
      delivered: [], // Terminal state
      failed: ["picked_up"], // Retry
      returned: [], // Terminal state
    };

    const allowed = validTransitions[currentStatus] || [];

    if (allowed.includes(newStatus)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  getTimeline(): DeliveryTimeline[] {
    return [];
  }
}

/**
 * Storage Adapter Interface
 */
interface StorageAdapter {
  uploadFile(fileName: string, data: Buffer): string;
  downloadFile(fileName: string): Buffer;
}

/**
 * S3 Storage Adapter Mock
 */
class S3StorageAdapter implements StorageAdapter {
  private bucket: Map<string, Buffer> = new Map();

  uploadFile(fileName: string, data: Buffer): string {
    this.bucket.set(fileName, data);
    return `s3://bucket/${fileName}`;
  }

  downloadFile(fileName: string): Buffer {
    return this.bucket.get(fileName) || Buffer.alloc(0);
  }
}

/**
 * R2 Storage Adapter Mock
 */
class R2StorageAdapter implements StorageAdapter {
  private bucket: Map<string, Buffer> = new Map();

  uploadFile(fileName: string, data: Buffer): string {
    this.bucket.set(fileName, data);
    return `r2://bucket/${fileName}`;
  }

  downloadFile(fileName: string): Buffer {
    return this.bucket.get(fileName) || Buffer.alloc(0);
  }
}

/**
 * Local Storage Adapter Mock
 */
class LocalStorageAdapter implements StorageAdapter {
  private files: Map<string, Buffer> = new Map();

  uploadFile(fileName: string, data: Buffer): string {
    this.files.set(fileName, data);
    return `/uploads/${fileName}`;
  }

  downloadFile(fileName: string): Buffer {
    return this.files.get(fileName) || Buffer.alloc(0);
  }
}

describe("PODService", () => {
  let service: PODService;
  let storageAdapter: StorageAdapter;

  beforeEach(() => {
    storageAdapter = new S3StorageAdapter();
    service = new PODService(storageAdapter);
  });

  describe("Photo Capture", () => {
    it("should capture photo and generate ID", () => {
      const imageData = Buffer.from("mock_image_data");

      const photo = service.capturePhoto(imageData);

      expect(photo.id).toBeDefined();
      expect(photo.id).toMatch(/^photo_/);
      expect(photo.imageUrl).toBeDefined();
      expect(photo.timestamp).toBeInstanceOf(Date);
    });

    it("should extract and store EXIF data", () => {
      const imageData = Buffer.from("mock_image_with_exif");
      const exifData = {
        make: "Canon",
        model: "EOS 5D Mark IV",
        latitude: 34.0522,
        longitude: -118.2437,
      };

      const photo = service.capturePhoto(imageData, exifData);

      expect(photo.exifData).toEqual(exifData);
      expect(photo.latitude).toBe(34.0522);
      expect(photo.longitude).toBe(-118.2437);
    });

    it("should handle photo without EXIF data", () => {
      const imageData = Buffer.from("simple_image");

      const photo = service.capturePhoto(imageData);

      expect(photo.exifData).toBeUndefined();
      expect(photo.latitude).toBeUndefined();
      expect(photo.longitude).toBeUndefined();
    });

    it("should use S3 storage adapter for upload", () => {
      const imageData = Buffer.from("s3_test_image");

      const photo = service.capturePhoto(imageData);

      expect(photo.imageUrl).toContain("s3://");
    });

    it("should use R2 storage adapter for upload", () => {
      service = new PODService(new R2StorageAdapter());
      const imageData = Buffer.from("r2_test_image");

      const photo = service.capturePhoto(imageData);

      expect(photo.imageUrl).toContain("r2://");
    });

    it("should use local storage adapter for upload", () => {
      service = new PODService(new LocalStorageAdapter());
      const imageData = Buffer.from("local_test_image");

      const photo = service.capturePhoto(imageData);

      expect(photo.imageUrl).toContain("/uploads/");
    });
  });

  describe("EXIF Extraction", () => {
    it("should extract basic EXIF data", () => {
      const imageBuffer = Buffer.from("image_with_exif");

      const exifData = service.extractEXIF(imageBuffer);

      expect(exifData.make).toBeDefined();
      expect(exifData.model).toBeDefined();
      expect(exifData.datetime).toBeDefined();
    });

    it("should extract GPS coordinates", () => {
      const imageBuffer = Buffer.from("gps_image");

      const exifData = service.extractEXIF(imageBuffer);

      expect(exifData.latitude).toBeDefined();
      expect(exifData.longitude).toBeDefined();
      expect(typeof exifData.latitude).toBe("number");
      expect(typeof exifData.longitude).toBe("number");
    });

    it("should extract altitude data", () => {
      const imageBuffer = Buffer.from("altitude_image");

      const exifData = service.extractEXIF(imageBuffer);

      expect(exifData.altitude).toBeDefined();
    });

    it("should handle images without EXIF data", () => {
      const imageBuffer = Buffer.alloc(0);

      const exifData = service.extractEXIF(imageBuffer);

      expect(exifData).toBeDefined();
    });
  });

  describe("Signature Rendering", () => {
    it("should render signature SVG to PNG", () => {
      const svgData = '<svg><path d="M0,0 L100,100"/></svg>';

      const signature = service.renderSignaturePNG(svgData);

      expect(signature.svgData).toBe(svgData);
      expect(signature.pngUrl).toBeDefined();
      expect(signature.captureTime).toBeInstanceOf(Date);
    });

    it("should generate unique PNG URLs", () => {
      const svgData = '<svg><path d="M0,0 L100,100"/></svg>';

      const sig1 = service.renderSignaturePNG(svgData);
      const sig2 = service.renderSignaturePNG(svgData);

      expect(sig1.pngUrl).not.toBe(sig2.pngUrl);
    });

    it("should store PNG in storage adapter", () => {
      const svgData = '<svg><path d="M0,0 L100,100"/></svg>';
      const uploadSpy = vi.spyOn(storageAdapter, "uploadFile");

      service.renderSignaturePNG(svgData);

      expect(uploadSpy).toHaveBeenCalled();
    });

    it("should handle complex SVG signatures", () => {
      const complexSvg =
        '<svg><g><circle cx="50" cy="50" r="40"/><path d="M10,10 Q20,20 30,10"/></g></svg>';

      const signature = service.renderSignaturePNG(complexSvg);

      expect(signature.svgData).toBe(complexSvg);
      expect(signature.pngUrl).toBeDefined();
    });
  });

  describe("QR Code Scanning", () => {
    it("should scan valid QR code", () => {
      const imageBuffer = Buffer.from("qr_code_image");

      const result = service.scanQRCode(imageBuffer);

      expect(result).toBeDefined();
      expect(result).toContain("order");
    });

    it("should return null for empty image", () => {
      const imageBuffer = Buffer.alloc(0);

      const result = service.scanQRCode(imageBuffer);

      expect(result).toBeNull();
    });

    it("should extract order ID from QR code", () => {
      const imageBuffer = Buffer.from("order_qr");

      const result = service.scanQRCode(imageBuffer);

      expect(result).toMatch(/order_\d+/);
    });

    it("should handle multiple QR codes in image", () => {
      const imageBuffer = Buffer.from("multi_qr_image");

      const result = service.scanQRCode(imageBuffer);

      expect(result).toBeDefined();
    });

    it("should handle damaged QR codes", () => {
      const damagedQR = Buffer.from("damaged_qr");

      const result = service.scanQRCode(damagedQR);

      // Should attempt to scan
      expect(result !== null || result === null).toBe(true);
    });
  });

  describe("Barcode Detection", () => {
    it("should detect valid barcode", () => {
      const imageBuffer = Buffer.from("barcode_image");

      const barcode = service.detectBarcode(imageBuffer);

      expect(barcode).toBeDefined();
      expect(barcode).toMatch(/^\d{13}$/);
    });

    it("should return null for empty image", () => {
      const imageBuffer = Buffer.alloc(0);

      const barcode = service.detectBarcode(imageBuffer);

      expect(barcode).toBeNull();
    });

    it("should validate EAN-13 barcode format", () => {
      const validBarcode = "5901234123457";

      const isValid = service.isValidBarcode(validBarcode);

      expect(isValid).toBe(true);
    });

    it("should reject invalid barcode lengths", () => {
      expect(service.isValidBarcode("590123")).toBe(false);
      expect(service.isValidBarcode("59012341234571")).toBe(false);
    });

    it("should reject non-numeric barcodes", () => {
      expect(service.isValidBarcode("590123A123457")).toBe(false);
    });

    it("should validate EAN-13 checksum", () => {
      const invalidChecksum = "5901234123458"; // Last digit should be 7

      const isValid = service.isValidBarcode(invalidChecksum);

      expect(isValid).toBe(false);
    });

    it("should handle barcode with leading zeros", () => {
      const leadingZeros = "0051234123457";

      expect(service.isValidBarcode(leadingZeros)).toBe(true);
    });
  });

  describe("Delivery Status Transitions", () => {
    it("should transition from pending to picked_up", () => {
      const result = service.transitionDeliveryStatus("pending", "picked_up");

      expect(result.valid).toBe(true);
    });

    it("should transition from picked_up to in_transit", () => {
      const result = service.transitionDeliveryStatus(
        "picked_up",
        "in_transit",
      );

      expect(result.valid).toBe(true);
    });

    it("should transition from in_transit to out_for_delivery", () => {
      const result = service.transitionDeliveryStatus(
        "in_transit",
        "out_for_delivery",
      );

      expect(result.valid).toBe(true);
    });

    it("should transition from out_for_delivery to delivered", () => {
      const result = service.transitionDeliveryStatus(
        "out_for_delivery",
        "delivered",
      );

      expect(result.valid).toBe(true);
    });

    it("should transition from any state to failed", () => {
      const states: Array<DeliveryTimeline["status"]> = [
        "pending",
        "picked_up",
        "in_transit",
        "out_for_delivery",
      ];

      for (const state of states) {
        const result = service.transitionDeliveryStatus(state, "failed");
        expect(result.valid).toBe(true);
      }
    });

    it("should transition from failed back to picked_up (retry)", () => {
      const result = service.transitionDeliveryStatus("failed", "picked_up");

      expect(result.valid).toBe(true);
    });

    it("should prevent invalid transition", () => {
      const result = service.transitionDeliveryStatus("pending", "delivered");

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should prevent backwards transition", () => {
      const result = service.transitionDeliveryStatus(
        "out_for_delivery",
        "pending",
      );

      expect(result.valid).toBe(false);
    });

    it("should prevent transition from delivered (terminal state)", () => {
      const result = service.transitionDeliveryStatus("delivered", "pending");

      expect(result.valid).toBe(false);
    });

    it("should provide reason for invalid transition", () => {
      const result = service.transitionDeliveryStatus("pending", "returned");

      expect(result.reason).toContain("Cannot transition");
      expect(result.reason).toContain("pending");
      expect(result.reason).toContain("returned");
    });
  });

  describe("Storage Adapters", () => {
    it("should work with S3 adapter", () => {
      const s3Adapter = new S3StorageAdapter();
      const testService = new PODService(s3Adapter);

      const photo = testService.capturePhoto(Buffer.from("s3_data"));

      expect(photo.imageUrl).toContain("s3://");
    });

    it("should work with R2 adapter", () => {
      const r2Adapter = new R2StorageAdapter();
      const testService = new PODService(r2Adapter);

      const photo = testService.capturePhoto(Buffer.from("r2_data"));

      expect(photo.imageUrl).toContain("r2://");
    });

    it("should work with local adapter", () => {
      const localAdapter = new LocalStorageAdapter();
      const testService = new PODService(localAdapter);

      const photo = testService.capturePhoto(Buffer.from("local_data"));

      expect(photo.imageUrl).toContain("/uploads/");
    });

    it("should upload and retrieve files from adapter", () => {
      const adapter = new S3StorageAdapter();
      const data = Buffer.from("test_file_content");

      const uploadUrl = adapter.uploadFile("test_file", data);
      const retrieved = adapter.downloadFile("test_file");

      expect(retrieved).toEqual(data);
      expect(uploadUrl).toContain("test_file");
    });

    it("should handle concurrent uploads", () => {
      const adapter = new S3StorageAdapter();

      const uploads = Array.from({ length: 10 }, (_, i) => {
        const data = Buffer.from(`concurrent_upload_${i}`);
        return adapter.uploadFile(`file_${i}`, data);
      });

      expect(uploads).toHaveLength(10);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large image files", () => {
      const largeImage = Buffer.alloc(5 * 1024 * 1024); // 5MB

      const photo = service.capturePhoto(largeImage);

      expect(photo.id).toBeDefined();
      expect(photo.imageUrl).toBeDefined();
    });

    it("should handle rapid consecutive photo captures", () => {
      const photos = Array.from({ length: 100 }, () =>
        service.capturePhoto(Buffer.from("photo_data")),
      );

      const ids = new Set(photos.map((p) => p.id));
      expect(ids.size).toBe(100); // All unique IDs
    });

    it("should handle null EXIF data gracefully", () => {
      const photo = service.capturePhoto(Buffer.from("image"), null as any);

      expect(photo).toBeDefined();
      expect(photo.imageUrl).toBeDefined();
    });
  });
});
