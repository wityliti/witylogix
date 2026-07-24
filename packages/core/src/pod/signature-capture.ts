/**
 * Signature POD Capture Module
 *
 * Handles e-signature collection and rendering:
 * - Process signature from canvas/drawing (SVG path data)
 * - Render signature to PNG image
 * - Validate signature data
 * - Support for canvas touch/mouse strokes
 */

import sharp from "sharp";
import type { SignaturePOD, SignatureValidationResult } from "./types.js";

// ─── CONSTANTS ──────────────────────────────────────────────────

const SIGNATURE_PAD_WIDTH = 400;
const SIGNATURE_PAD_HEIGHT = 200;
const MIN_STROKE_POINTS = 5;
const MAX_SIGNATURE_SIZE = 1024 * 1024; // 1MB

// ─── SIGNATURE SERVICE ──────────────────────────────────────────

export class SignatureCaptureService {
  /**
   * Process signature data and create SignaturePOD record
   *
   * Accepts signature in multiple formats:
   * - SVG path data (M10,10 L20,20 Q30,30 40,40...)
   * - Array of points [{x, y, t?}, ...]
   * - Canvas ImageData
   *
   * Returns SignaturePOD with rendered image
   */
  async processSignature(
    signatureData: any,
    signerName: string,
    deliveryId: string,
  ): Promise<SignaturePOD> {
    // Validate inputs
    if (!signerName || signerName.trim().length === 0) {
      throw new Error("Signer name is required");
    }

    if (!signatureData) {
      throw new Error("Signature data is required");
    }

    // Validate signature
    const validation = this.validateSignature(signatureData);
    if (!validation.valid) {
      throw new Error(`Invalid signature: ${validation.issues.join(", ")}`);
    }

    // Store signature data (as SVG path or JSON)
    const signatureDataUrl = this.serializeSignatureData(signatureData);

    // Create POD record
    const podRecord: SignaturePOD = {
      id: `pod-sig-${deliveryId}-${Date.now()}`,
      deliveryId,
      method: "signature",
      signerName: signerName.trim(),
      signatureDataUrl,
      signatureKey: `deliveries/${deliveryId}/signatures/${Date.now()}.png`,
      signedAt: new Date(),
      status: "pending",
    };

    return podRecord;
  }

  /**
   * Render signature to PNG image
   *
   * Converts SVG path data to PNG with:
   * - Canvas rendering
   * - High DPI for print quality
   * - Custom styling (color, stroke width)
   */
  async renderSignaturePNG(
    signatureData: any,
    options: {
      width?: number;
      height?: number;
      strokeColor?: string;
      strokeWidth?: number;
      backgroundColor?: string;
    } = {},
  ): Promise<Buffer> {
    const width = options.width || SIGNATURE_PAD_WIDTH;
    const height = options.height || SIGNATURE_PAD_HEIGHT;
    const strokeColor = options.strokeColor || "#000000";
    const strokeWidth = options.strokeWidth || 2;
    const backgroundColor = options.backgroundColor || "#FFFFFF";

    try {
      // Normalize signature data to SVG path
      const svgPath = this.normalizeToSVGPath(signatureData);

      if (!svgPath) {
        throw new Error("Unable to convert signature data to SVG path");
      }

      // Create SVG with signature
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
          <path
            d="${svgPath}"
            stroke="${strokeColor}"
            stroke-width="${strokeWidth}"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `.trim();

      // Convert SVG to PNG using sharp
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      return pngBuffer;
    } catch (error) {
      throw new Error(
        `Failed to render signature: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate signature data
   *
   * Checks:
   * - Data exists and has content
   * - Minimum number of stroke points
   * - Valid format (SVG path, array, or ImageData)
   */
  validateSignature(signatureData: any): SignatureValidationResult {
    const issues: string[] = [];

    if (!signatureData) {
      issues.push("Signature data is empty");
      return { valid: false, issues };
    }

    let pointCount = 0;
    let hasStroke = false;

    // Handle SVG path string
    if (typeof signatureData === "string") {
      if (!signatureData.trim().length) {
        issues.push("SVG path is empty");
      } else {
        // Count approximate points from path
        pointCount = (signatureData.match(/[ML]/g) || []).length;
        hasStroke = signatureData.length > 5;
      }
    }
    // Handle array of points
    else if (Array.isArray(signatureData)) {
      pointCount = signatureData.length;
      hasStroke = pointCount > 0;

      if (pointCount < MIN_STROKE_POINTS) {
        issues.push(
          `Signature has too few points (${pointCount}). Minimum: ${MIN_STROKE_POINTS}`,
        );
      }

      // Validate point structure
      for (let i = 0; i < Math.min(pointCount, 5); i++) {
        const point = signatureData[i];
        if (typeof point !== "object" || !("x" in point) || !("y" in point)) {
          issues.push(`Invalid point structure at index ${i}`);
          break;
        }
      }
    }
    // Handle ImageData
    else if (signatureData instanceof ImageData || signatureData.data) {
      pointCount = signatureData.data?.length || 0;
      hasStroke = pointCount > 0;

      if (!hasStroke) {
        issues.push("ImageData is empty");
      }
    }
    // Handle object with points/path
    else if (typeof signatureData === "object") {
      if (signatureData.points && Array.isArray(signatureData.points)) {
        pointCount = signatureData.points.length;
        if (pointCount < MIN_STROKE_POINTS) {
          issues.push(
            `Signature has too few points (${pointCount}). Minimum: ${MIN_STROKE_POINTS}`,
          );
        }
      } else if (signatureData.path && typeof signatureData.path === "string") {
        pointCount = (signatureData.path.match(/[ML]/g) || []).length;
      } else {
        issues.push("Signature object missing points or path property");
      }
    } else {
      issues.push(`Unknown signature data format: ${typeof signatureData}`);
    }

    return {
      valid: issues.length === 0 && hasStroke,
      issues,
      pointCount: pointCount > 0 ? pointCount : undefined,
      hasStroke,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  /**
   * Serialize signature data for storage
   *
   * Converts various formats to JSON for consistent storage
   */
  private serializeSignatureData(data: any): string {
    if (typeof data === "string") {
      return JSON.stringify({ type: "svg_path", path: data });
    }

    if (Array.isArray(data)) {
      return JSON.stringify({ type: "points", points: data });
    }

    if (typeof data === "object" && data !== null) {
      return JSON.stringify({ type: data.type || "object", ...data });
    }

    return JSON.stringify({ type: "unknown", data });
  }

  /**
   * Normalize signature data to SVG path format
   *
   * Converts multiple input formats to SVG path string (M10,10 L20,20...)
   */
  private normalizeToSVGPath(data: any): string | null {
    try {
      // Already an SVG path
      if (typeof data === "string") {
        return data;
      }

      // Array of points [{x, y}, ...]
      if (Array.isArray(data)) {
        return this.pointsToSVGPath(data);
      }

      // Object with points array
      if (data && data.points && Array.isArray(data.points)) {
        return this.pointsToSVGPath(data.points);
      }

      // Object with path string
      if (data && data.path && typeof data.path === "string") {
        return data.path;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert array of points to SVG path
   *
   * Format:
   * - First point: M (move to)
   * - Subsequent points: L (line to) with optional cubic bezier
   */
  private pointsToSVGPath(
    points: Array<{ x: number; y: number; t?: number }>,
  ): string {
    if (!points || points.length === 0) {
      return "";
    }

    const path: string[] = [];

    points.forEach((point, index) => {
      const x = Math.round(point.x);
      const y = Math.round(point.y);

      if (index === 0) {
        path.push(`M${x},${y}`);
      } else {
        path.push(`L${x},${y}`);
      }
    });

    return path.join(" ");
  }
}

// ─── SINGLETON INSTANCE ─────────────────────────────────────────

export const signatureCaptureService = new SignatureCaptureService();
