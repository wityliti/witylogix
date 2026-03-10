/**
 * Photo POD Capture Module
 *
 * Handles photo-based proof of delivery:
 * - Image processing and validation
 * - Thumbnail generation
 * - EXIF data extraction (including geolocation)
 * - Quality checks and metadata extraction
 * - Support for JPEG and PNG formats
 */

import sharp from 'sharp';
import type { PhotoPOD, PhotoValidationResult, PhotoMetadata, GeoLocation } from './types.js';

// ─── CONSTANTS ──────────────────────────────────────────────────

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FORMATS = ['jpeg', 'png'];
const THUMBNAIL_SIZE = { width: 200, height: 200 };
const MIN_PHOTO_DIMENSION = 320;

// ─── EXIF TYPES ─────────────────────────────────────────────────

interface ExifData {
  image?: {
    XResolution?: number;
    YResolution?: number;
  };
  photo?: Record<string, any>;
  exif?: Record<string, any>;
  gps?: {
    GPSLatitude?: [number, number, number];
    GPSLongitude?: [number, number, number];
    GPSAltitude?: number;
    GPSTimestamp?: [number, number, number];
  };
}

// ─── PHOTO CAPTURE SERVICE ──────────────────────────────────────

export class PhotoCaptureService {
  /**
   * Process and validate photo upload
   *
   * Returns PhotoPOD with metadata on success
   */
  async processPhoto(
    imageBuffer: Buffer,
    deliveryId: string
  ): Promise<PhotoPOD | null> {
    // Validate buffer
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer');
    }

    if (imageBuffer.length > MAX_PHOTO_SIZE) {
      throw new Error(`Image exceeds maximum size of ${MAX_PHOTO_SIZE / 1024 / 1024}MB`);
    }

    // Process with sharp
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Validate format
    if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
      throw new Error(`Unsupported format: ${metadata.format}. Allowed: ${ALLOWED_FORMATS.join(', ')}`);
    }

    // Validate dimensions
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }

    if (metadata.width < MIN_PHOTO_DIMENSION || metadata.height < MIN_PHOTO_DIMENSION) {
      throw new Error(
        `Image too small. Minimum: ${MIN_PHOTO_DIMENSION}x${MIN_PHOTO_DIMENSION}px`
      );
    }

    // Extract EXIF data
    const exifData = metadata;
    const geoLocation = this.extractGeoTag(exifData);

    // Create metadata
    const photoMetadata: PhotoMetadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format as 'jpeg' | 'png',
      size: imageBuffer.length,
      capturedAt: this.extractCaptureDate(exifData) || new Date(),
      deviceInfo: metadata.chromaSubsampling ? `Chroma: ${metadata.chromaSubsampling}` : undefined,
      exifData: exifData as any,
      hasGeoTag: !!geoLocation,
      geoLocation,
    };

    // Create POD record
    const podRecord: PhotoPOD = {
      id: `pod-${deliveryId}-${Date.now()}`,
      deliveryId,
      method: 'photo',
      imageUrl: '', // Will be set by storage adapter
      thumbnailUrl: '', // Will be set by storage adapter
      imageKey: `deliveries/${deliveryId}/photos/${Date.now()}.${metadata.format}`,
      metadata: photoMetadata,
      capturedAt: photoMetadata.capturedAt,
      status: 'pending',
    };

    return podRecord;
  }

  /**
   * Generate thumbnail from image buffer
   *
   * @param imageBuffer Original image buffer
   * @param size Optional thumbnail size (defaults to 200x200)
   * @returns Thumbnail buffer
   */
  async generateThumbnail(
    imageBuffer: Buffer,
    size: { width: number; height: number } = THUMBNAIL_SIZE
  ): Promise<Buffer> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer');
    }

    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(size.width, size.height, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract geolocation from EXIF GPS data
   *
   * Returns GeoLocation object if valid GPS data found, null otherwise
   */
  extractGeoTag(metadata: any): GeoLocation | null {
    try {
      // Check for GPS data in EXIF
      const exif = metadata.exif;
      if (!exif) {
        return null;
      }

      // Try to extract GPS coordinates
      // EXIF format: [degrees, minutes, seconds]
      const latitude = this.extractGPSCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef);
      const longitude = this.extractGPSCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef);

      if (latitude === null || longitude === null) {
        return null;
      }

      const geoLocation: GeoLocation = {
        latitude,
        longitude,
        timestamp: new Date(),
      };

      // Add altitude if available
      if (exif.GPSAltitude !== undefined) {
        geoLocation.altitude = exif.GPSAltitude;
      }

      return geoLocation;
    } catch (error) {
      // Silently fail for GPS extraction
      return null;
    }
  }

  /**
   * Validate photo buffer and return validation result
   *
   * Checks:
   * - Buffer size (max 5MB)
   * - Format (JPEG/PNG only)
   * - Dimensions (min 320x320)
   * - Image corruption
   */
  async validatePhoto(imageBuffer: Buffer): Promise<PhotoValidationResult> {
    const issues: string[] = [];

    if (!imageBuffer || imageBuffer.length === 0) {
      issues.push('Image buffer is empty');
    }

    if (imageBuffer.length > MAX_PHOTO_SIZE) {
      issues.push(`Image exceeds maximum size of ${MAX_PHOTO_SIZE / 1024 / 1024}MB`);
    }

    let metadata: any = null;
    try {
      const image = sharp(imageBuffer);
      metadata = await image.metadata();

      if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
        issues.push(`Unsupported format: ${metadata.format}`);
      }

      if (!metadata.width || !metadata.height) {
        issues.push('Unable to determine image dimensions');
      }

      if (metadata.width && metadata.height) {
        if (metadata.width < MIN_PHOTO_DIMENSION || metadata.height < MIN_PHOTO_DIMENSION) {
          issues.push(
            `Image too small. Minimum: ${MIN_PHOTO_DIMENSION}x${MIN_PHOTO_DIMENSION}px`
          );
        }
      }
    } catch (error) {
      issues.push(
        `Image processing error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      metadata: metadata
        ? {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: imageBuffer.length,
          }
        : undefined,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  /**
   * Extract capture date from EXIF data
   *
   * Tries multiple date fields:
   * - EXIF.DateTimeOriginal (most accurate)
   * - EXIF.DateTime
   * - Image.ModifyDate
   */
  private extractCaptureDate(metadata: any): Date | null {
    try {
      // Try DateTimeOriginal first (most accurate for photos)
      if (metadata.exif?.DateTimeOriginal) {
        return this.parseExifDate(metadata.exif.DateTimeOriginal);
      }

      // Try DateTime
      if (metadata.exif?.DateTime) {
        return this.parseExifDate(metadata.exif.DateTime);
      }

      // Try image ModifyDate
      if (metadata.exif?.ModifyDate) {
        return this.parseExifDate(metadata.exif.ModifyDate);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse EXIF date string (format: YYYY:MM:DD HH:MM:SS)
   */
  private parseExifDate(dateString: string): Date | null {
    try {
      const match = dateString.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (!match) {
        return null;
      }

      const [, year, month, day, hour, minute, second] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract GPS coordinate from EXIF format [degrees, minutes, seconds]
   *
   * Formula: degrees + minutes/60 + seconds/3600
   * Apply direction: N/E = positive, S/W = negative
   */
  private extractGPSCoordinate(
    value: [number, number, number] | undefined,
    ref: string | undefined
  ): number | null {
    if (!value || !Array.isArray(value) || value.length < 2) {
      return null;
    }

    try {
      const [degrees, minutes, seconds] = value;
      let coordinate = degrees + minutes / 60 + (seconds || 0) / 3600;

      // Apply direction reference
      if (ref === 'S' || ref === 'W') {
        coordinate = -coordinate;
      }

      return coordinate;
    } catch (error) {
      return null;
    }
  }
}

// ─── SINGLETON INSTANCE ─────────────────────────────────────────

export const photoCaptureService = new PhotoCaptureService();
