import { describe, it, expect } from 'vitest';
import {
  normalizeBarcodeData,
  validatePickupBarcode,
  validatePodBarcode,
  isSupportedFormat,
} from '../barcodeValidation';

describe('normalizeBarcodeData', () => {
  it('trims whitespace', () => {
    expect(normalizeBarcodeData('  ABC123  ')).toBe('ABC123');
  });

  it('uppercases the value', () => {
    expect(normalizeBarcodeData('abc-123')).toBe('ABC-123');
  });

  it('handles already-normalised input', () => {
    expect(normalizeBarcodeData('TRACK-001')).toBe('TRACK-001');
  });
});

describe('validatePickupBarcode', () => {
  it('returns valid when scanned matches expected', () => {
    const result = validatePickupBarcode('TRACK-001', 'TRACK-001');
    expect(result.valid).toBe(true);
  });

  it('normalises both sides before comparison', () => {
    const result = validatePickupBarcode('  track-001  ', 'TRACK-001');
    expect(result.valid).toBe(true);
  });

  it('returns invalid with error message when codes differ', () => {
    const result = validatePickupBarcode('TRACK-999', 'TRACK-001');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/does not match/);
    expect(result.error).toContain('TRACK-001');
    expect(result.error).toContain('TRACK-999');
  });

  it('returns invalid when scanned is empty', () => {
    const result = validatePickupBarcode('', 'TRACK-001');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/missing/i);
  });

  it('returns invalid when expected is empty', () => {
    const result = validatePickupBarcode('TRACK-001', '');
    expect(result.valid).toBe(false);
  });
});

describe('validatePodBarcode', () => {
  it('returns valid for any non-empty barcode', () => {
    expect(validatePodBarcode('QR-POD-001').valid).toBe(true);
  });

  it('returns invalid for empty string', () => {
    const result = validatePodBarcode('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no barcode/i);
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validatePodBarcode('   ');
    expect(result.valid).toBe(false);
  });
});

describe('isSupportedFormat', () => {
  it('accepts qr', () => {
    expect(isSupportedFormat('qr')).toBe(true);
  });

  it('accepts code128 (case-insensitive)', () => {
    expect(isSupportedFormat('CODE128')).toBe(true);
  });

  it('accepts code39', () => {
    expect(isSupportedFormat('code39')).toBe(true);
  });

  it('accepts ean13', () => {
    expect(isSupportedFormat('ean13')).toBe(true);
  });

  it('accepts ean8', () => {
    expect(isSupportedFormat('ean8')).toBe(true);
  });

  it('rejects unsupported format', () => {
    expect(isSupportedFormat('aztec')).toBe(false);
  });
});
