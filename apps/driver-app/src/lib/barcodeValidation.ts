/**
 * Pure barcode validation utilities — WIT-143
 * Kept dependency-free so they can be unit-tested without React Native.
 */

export type BarcodeMode = "pickup" | "pod";

export interface ScanValidationResult {
  valid: boolean;
  error?: string;
}

/** Supported barcode formats accepted by the scanner. */
export const SUPPORTED_BARCODE_TYPES = [
  "qr",
  "code128",
  "code39",
  "ean13",
  "ean8",
] as const;

export type SupportedBarcodeType = (typeof SUPPORTED_BARCODE_TYPES)[number];

/**
 * Normalise raw barcode data: trim whitespace, uppercase for consistency.
 */
export function normalizeBarcodeData(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Validate a pickup scan against the expected barcode on the shipment record.
 * Both values are normalised before comparison.
 */
export function validatePickupBarcode(
  scanned: string,
  expected: string,
): ScanValidationResult {
  if (!scanned || !expected) {
    return { valid: false, error: "Missing barcode data" };
  }
  const match =
    normalizeBarcodeData(scanned) === normalizeBarcodeData(expected);
  return match
    ? { valid: true }
    : {
        valid: false,
        error: `Scanned code does not match expected package barcode. Expected: ${normalizeBarcodeData(expected)}, Got: ${normalizeBarcodeData(scanned)}`,
      };
}

/**
 * For POD scans, any non-empty barcode is valid — the value is recorded
 * as proof and sent to the batch events endpoint.
 */
export function validatePodBarcode(scanned: string): ScanValidationResult {
  if (!scanned || !scanned.trim()) {
    return { valid: false, error: "No barcode data scanned" };
  }
  return { valid: true };
}

/**
 * Check whether a barcode format string is in the supported set.
 */
export function isSupportedFormat(format: string): boolean {
  return (SUPPORTED_BARCODE_TYPES as readonly string[]).includes(
    format.toLowerCase(),
  );
}
