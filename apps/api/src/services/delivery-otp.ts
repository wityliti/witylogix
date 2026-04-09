/**
 * DeliveryOTP service — pure business logic for OTP generation and verification.
 * Extracted from the route handler so it can be unit-tested and reused.
 * WIT-92
 */

import { createHmac, randomInt } from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function getSecret(): string {
  return process.env.OTP_SECRET ?? 'witylogix-otp-secret';
}

export interface GenerateOTPParams {
  orderId: string;
  recipientPhone: string | null;
  channel: 'sms' | 'whatsapp';
}

export interface OTPRecord {
  id: string;
  orderId: string;
  code: string;       // plain text (only returned at generation time)
  channel: 'sms' | 'whatsapp';
  recipientPhone: string;
  verified: boolean;
  verifiedAt: Date | null;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  attempts: number;
}

/**
 * Generate a 6-digit OTP for the given order.
 * Throws if no phone number is available.
 */
export async function generateDeliveryOTP(params: GenerateOTPParams): Promise<OTPRecord> {
  if (!params.recipientPhone) {
    throw new Error('Customer phone number is required to send OTP');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  return {
    id: '',           // populated by the DB layer on persist
    orderId: params.orderId,
    code,
    channel: params.channel,
    recipientPhone: params.recipientPhone,
    verified: false,
    verifiedAt: null,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    createdAt: new Date(),
  };
}

/** Hash an OTP code for storage. */
export function hashOTPCode(plain: string): string {
  return createHmac('sha256', getSecret()).update(plain).digest('hex');
}

/**
 * Verify an OTP code against a stored record.
 * NOTE: This function works with plain-text codes (as stored in the mock/test layer).
 * In production the route compares hashes before calling this.
 */
export async function verifyDeliveryOTP(record: OTPRecord, code: string): Promise<VerifyResult> {
  const newAttempts = record.attempts + 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'Too many attempts. Request a new OTP.', attempts: newAttempts };
  }
  if (record.verified) {
    return { valid: false, reason: 'OTP already used', attempts: newAttempts };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'OTP expired', attempts: newAttempts };
  }
  if (record.code !== code) {
    return { valid: false, reason: 'Invalid OTP code', attempts: newAttempts };
  }

  return { valid: true, attempts: newAttempts };
}
